import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, Plus, Trash2, MessageCircle, FileSpreadsheet,
    ShoppingCart, PackageOpen, AlertTriangle, ChevronDown,
    ChevronUp, X, Check, Truck, StickyNote, RefreshCw,
    Filter, Tag, Download, Printer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import './RestockDesktop.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface OrderItem {
    id: string;
    name: string;
    code: string;
    quantity: number;
    cost: number;
    supplierId?: string;
    supplierName?: string;
    category?: string;
    isCustom?: boolean;
    currentStock?: number;
    minStock?: number;
}

interface StockAlert {
    id: string;
    name: string;
    code: string;
    stock: number;
    minStock: number;
    cost: number;
    category: string;
    supplierId?: string;
    supplierName?: string;
    tags?: string[];
    urgency: 'critical' | 'low' | 'ok';
}

// ─────────────────────────────────────────────
// Persistence key
// ─────────────────────────────────────────────
const CART_STORAGE_KEY = (bId: string) => `restock_open_order_${bId}`;

const RestockDesktop: React.FC = () => {
    const products = useStore(s => s.products);
    const suppliers = useStore(s => s.suppliers);
    const categoriesData = useStore(s => s.categoriesData) || [];
    const loadProducts = useStore(s => s.loadProducts);
    const loadSuppliers = useStore(s => s.loadSuppliers);
    const loadCategories = useStore(s => s.loadCategories);
    const addNotification = useStore(s => s.addNotification);
    const { user } = useAuth();
    const businessId = user?.business_id || 'default';

    // ── Loading ──
    const [loading, setLoading] = useState(true);

    // ── Filters ──
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [showAll, setShowAll] = useState(false);

    // ── Cart (open order) ──
    const [orderItems, setOrderItems] = useState<OrderItem[]>(() => {
        try {
            const stored = localStorage.getItem(CART_STORAGE_KEY(businessId));
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });
    const [orderNote, setOrderNote] = useState(() =>
        localStorage.getItem(`restock_note_${businessId}`) || ''
    );
    const [showNote, setShowNote] = useState(false);

    // ── Custom (free-text) item form ──
    const [customName, setCustomName] = useState('');
    const [customQty, setCustomQty] = useState('');
    const [customCost, setCustomCost] = useState('');
    const [customSupplier, setCustomSupplier] = useState('');

    // ── WhatsApp ──
    const [waSupplierId, setWaSupplierId] = useState('');

    // ── Workspace save banner ──
    const [savedFilename, setSavedFilename] = useState<string | null>(null);

    // ── Tabs and Boleto state ──
    const [activeTab, setActiveTab] = useState<'cart' | 'boleto'>('cart');
    const [boletoSupplierId, setBoletoSupplierId] = useState<string>('');

    // ── Load data ──
    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.allSettled([
                loadProducts(),
                loadSuppliers(),
                loadCategories ? loadCategories(true) : Promise.resolve()
            ]);
            setLoading(false);
        })();
    }, []);

    // ── Persist cart ──
    useEffect(() => {
        localStorage.setItem(CART_STORAGE_KEY(businessId), JSON.stringify(orderItems));
    }, [orderItems, businessId]);

    useEffect(() => {
        localStorage.setItem(`restock_note_${businessId}`, orderNote);
    }, [orderNote, businessId]);

    // ── Category options flat list ──
    const categoryOptions = useMemo(() => {
        const build = (parentId: string | null = null, depth = 0): { id: string; name: string; label: string }[] => {
            const list: { id: string; name: string; label: string }[] = [];
            const filtered = categoriesData.filter(c =>
                parentId === null ? !c.parent_id : c.parent_id === parentId
            );
            filtered.forEach(c => {
                list.push({ id: c.id, name: c.name, label: `${'  '.repeat(depth)}${depth > 0 ? '↳ ' : '📁 '}${c.name}` });
                list.push(...build(c.id, depth + 1));
            });
            return list;
        };
        return build(null, 0);
    }, [categoriesData]);

    const allTags = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => p.tags?.forEach((t: string) => set.add(t)));
        return Array.from(set).sort();
    }, [products]);

    // ── Stock alerts ──
    const stockAlerts = useMemo((): StockAlert[] => {
        return products
            .filter(p => {
                const matchSearch = !searchQuery ||
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
                const matchCat = !selectedCategory || p.category === selectedCategory;
                const matchTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));

                if (!matchSearch || !matchCat || !matchTag) return false;
                if (showAll) return true;
                return (p.stock ?? 0) <= (p.min ?? 5);
            })
            .map(p => {
                const stock = p.stock ?? 0;
                const min = p.min ?? 5;
                const sup = suppliers.find(s => s.id === p.supplierId);
                let urgency: StockAlert['urgency'] = 'ok';
                if (stock <= 0) urgency = 'critical';
                else if (stock <= min) urgency = 'low';
                return {
                    id: p.id,
                    name: p.name,
                    code: p.code || 'S/C',
                    stock,
                    minStock: min,
                    cost: p.cost ?? 0,
                    category: p.category || 'Sin Categoría',
                    supplierId: p.supplierId,
                    supplierName: sup?.name,
                    tags: p.tags || [],
                    urgency
                };
            })
            .sort((a, b) => {
                const order = { critical: 0, low: 1, ok: 2 };
                return order[a.urgency] - order[b.urgency];
            });
    }, [products, suppliers, searchQuery, selectedCategory, selectedTag, showAll]);

    // ── Cart helpers ──
    const isInCart = useCallback((id: string) => orderItems.some(i => i.id === id), [orderItems]);

    const addToCart = (alert: StockAlert) => {
        if (isInCart(alert.id)) {
            addNotification('Ese producto ya está en la lista', 'warning');
            return;
        }
        const suggested = Math.max(1, (alert.minStock * 2) - alert.stock);
        setOrderItems(prev => [...prev, {
            id: alert.id,
            name: alert.name,
            code: alert.code,
            quantity: suggested,
            cost: alert.cost,
            supplierId: alert.supplierId,
            supplierName: alert.supplierName,
            category: alert.category,
            currentStock: alert.stock,
            minStock: alert.minStock
        }]);
    };

    const removeFromCart = (id: string) =>
        setOrderItems(prev => prev.filter(i => i.id !== id));

    const updateQty = (id: string, qty: number) =>
        setOrderItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));

    const updateItemSupplier = (id: string, supplierId: string) => {
        const sup = suppliers.find(s => s.id === supplierId);
        setOrderItems(prev => prev.map(i =>
            i.id === id ? { ...i, supplierId, supplierName: sup?.name || '' } : i
        ));
    };

    const addCustomItem = () => {
        if (!customName.trim()) {
            addNotification('Escribí el nombre del producto', 'warning');
            return;
        }
        const sup = suppliers.find(s => s.id === customSupplier);
        setOrderItems(prev => [...prev, {
            id: `custom_${Date.now()}`,
            name: customName.trim(),
            code: 'LIBRE',
            quantity: parseInt(customQty) || 1,
            cost: parseFloat(customCost) || 0,
            supplierId: customSupplier || undefined,
            supplierName: sup?.name,
            isCustom: true
        }]);
        setCustomName('');
        setCustomQty('');
        setCustomCost('');
        setCustomSupplier('');
    };

    const clearCart = () => {
        setOrderItems([]);
        setOrderNote('');
        addNotification('Lista de pedido limpiada', 'info');
    };

    // ── Totals ──
    const cartTotal = useMemo(() =>
        orderItems.reduce((s, i) => s + i.quantity * i.cost, 0), [orderItems]);

    // ── WhatsApp message ──
    const generateWAMessage = () => {
        const itemsToSend = waSupplierId
            ? orderItems.filter(i => i.supplierId === waSupplierId || (!i.supplierId && waSupplierId === 'none'))
            : orderItems;

        const sup = suppliers.find(s => s.id === waSupplierId);
        const phone = sup?.phone || '';
        let msg = `*FLORERÍA MI JARDÍN – PEDIDO DE REPOSICIÓN*\n\n`;
        if (sup) msg += `Hola ${sup.name}, por favor coordinar entrega de:\n\n`;
        else msg += `Detalle del pedido:\n\n`;

        itemsToSend.forEach(i => {
            msg += `• *${i.quantity}x* ${i.name} (${i.code})`;
            if (i.cost > 0) msg += ` – Ref: $${i.cost.toLocaleString('es-AR')} c/u`;
            msg += '\n';
        });

        const total = itemsToSend.reduce((s, i) => s + i.quantity * i.cost, 0);
        if (total > 0) msg += `\n💰 *Total estimado:* $${total.toLocaleString('es-AR')}`;
        if (orderNote.trim()) msg += `\n📝 *Nota:* ${orderNote}`;
        msg += `\n\n¡Muchas gracias!`;

        const url = phone
            ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
            : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    // ── Save to Workspace ──
    const saveToWorkspace = () => {
        if (orderItems.length === 0) {
            addNotification('La lista está vacía', 'warning');
            return;
        }
        const key = `explorer_custom_items_${businessId}`;
        let stored: any[] = [];
        try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        const date = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        const filename = `Pedido_${date}.xlsx`;
        stored.push({
            id: `restock_order_${Date.now()}`,
            name: filename,
            parentId: 'pedidos_compra_folder',
            type: 'file',
            entity: 'custom',
            description: `Orden de reposición. Nota: ${orderNote || 'Sin notas'}`,
            color: '#fef3c7',
            isCustom: true,
            customData: {
                columns: [
                    { key: 'code', label: 'Código', width: 110 },
                    { key: 'name', label: 'Producto', width: 250 },
                    { key: 'quantity', label: 'Cantidad', width: 100, align: 'right', badge: true },
                    { key: 'supplierName', label: 'Proveedor', width: 160 },
                    { key: 'cost', label: 'Costo Unit.', width: 120, align: 'right', format: 'currency' },
                    { key: 'total', label: 'Total Est.', width: 130, align: 'right', format: 'currency' }
                ],
                rows: orderItems.map(i => ({
                    id: i.id,
                    code: i.code,
                    name: i.name,
                    quantity: i.quantity,
                    supplierName: i.supplierName || '—',
                    cost: i.cost,
                    total: i.quantity * i.cost
                }))
            }
        });
        localStorage.setItem(key, JSON.stringify(stored));
        setSavedFilename(filename);
        setTimeout(() => setSavedFilename(null), 6000);
        addNotification('Pedido guardado en el Workspace', 'success');
    };

    // ── Grouped items by category/folder ──
    const groupedItemsByFolder = useMemo(() => {
        const filtered = boletoSupplierId
            ? orderItems.filter(i => i.supplierId === boletoSupplierId)
            : orderItems;

        const groups: Record<string, OrderItem[]> = {};
        filtered.forEach(item => {
            const cat = item.category || 'Sin Categoría';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [orderItems, boletoSupplierId]);

    // ── Export to Word (.doc) ──
    const exportToWord = () => {
        if (orderItems.length === 0) {
            addNotification('No hay ítems para exportar', 'warning');
            return;
        }

        const dateStr = new Date().toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const hourStr = new Date().toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const activeSupplier = suppliers.find(s => s.id === boletoSupplierId);
        const supplierInfo = activeSupplier
            ? `PROVEEDOR: ${activeSupplier.name.toUpperCase()}\nContacto: ${activeSupplier.phone || '—'} · ${(activeSupplier as any).email || '—'}`
            : 'PROVEEDORES: Varios / General';

        let docContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Pedido de Reposición - Florería Aster</title>
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #27272a; margin: 20px; line-height: 1.4; }
    h1 { color: #4F7A5A; text-align: center; margin-bottom: 5px; font-size: 24px; font-weight: bold; }
    .subtitle { text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; margin-bottom: 20px; font-weight: bold; }
    .meta-box { width: 100%; margin-bottom: 20px; font-size: 12px; }
    .meta-left { float: left; width: 45%; }
    .meta-right { float: right; width: 45%; text-align: right; }
    .clear { clear: both; }
    .cat-title { font-size: 13px; font-weight: bold; color: #4F7A5A; background-color: #f4f4f5; padding: 5px; border-left: 4px solid #4F7A5A; margin-top: 15px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background-color: #4F7A5A; color: #ffffff; font-size: 11px; text-align: left; padding: 6px; border: 1px solid #cbd5e1; }
    td { padding: 6px; border: 1px solid #e4e4e7; font-size: 12px; }
    .txt-right { text-align: right; }
    .total-box { text-align: right; font-weight: bold; font-size: 14px; margin-top: 20px; padding: 10px; background-color: #f4f4f5; border: 1px solid #e4e4e7; }
    .note-box { border: 1px solid #fed7aa; background-color: #fff7ed; padding: 10px; border-radius: 4px; margin-top: 15px; font-size: 11px; }
    .note-title { font-weight: bold; color: #c2410c; margin-bottom: 3px; }
    .handwritten-box { margin-top: 30px; border-top: 1px dashed #d4d4d8; padding-top: 10px; font-size: 11px; color: #71717a; }
    .handwritten-line { border-bottom: 1px dotted #a1a1aa; height: 30px; }
</style>
</head>
<body>

    <h1>FLORERÍA ASTER</h1>
    <div class="subtitle">Orden de Compra y Reposición</div>

    <table class="meta-box">
        <tr>
            <td style="border:none; width:50%; vertical-align:top;">
                <strong>EMISOR:</strong> Florería Aster S.R.L.<br>
                <strong>Solicitante:</strong> ${user?.name || 'Administrador'}<br>
                <strong>Email:</strong> ${user?.email || '—'}<br>
                <strong>Fecha:</strong> ${dateStr} a las ${hourStr}
            </td>
            <td style="border:none; width:50%; vertical-align:top; text-align:right;">
                <strong>${supplierInfo.replace(/\n/g, '<br>')}</strong><br>
                <strong>Estado:</strong> <span style="color:#15803d; font-weight:bold;">Abierto / En Proceso</span>
            </td>
        </tr>
    </table>

    <div class="clear"></div>
`;

        Object.entries(groupedItemsByFolder).forEach(([category, items]) => {
            docContent += `
    <div class="cat-title">${category.toUpperCase()}</div>
    <table>
        <thead>
            <tr>
                <th style="width: 15%;">Código</th>
                <th style="width: 45%;">Producto</th>
                <th style="width: 15%; text-align: right;">Cantidad</th>
                <th style="width: 12%; text-align: right;">Costo Unit.</th>
                <th style="width: 13%; text-align: right;">Total Est.</th>
            </tr>
        </thead>
        <tbody>
`;
            items.forEach(item => {
                const total = item.quantity * item.cost;
                docContent += `
            <tr>
                <td>${item.code}</td>
                <td>${item.name}</td>
                <td class="txt-right"><strong>${item.quantity}</strong></td>
                <td class="txt-right">$${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td class="txt-right">$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
`;
            });

            docContent += `
        </tbody>
    </table>
`;
        });

        const grandTotal = Object.values(groupedItemsByFolder)
            .flat()
            .reduce((sum, item) => sum + item.quantity * item.cost, 0);

        if (grandTotal > 0) {
            docContent += `
    <div class="total-box">
        TOTAL ESTIMADO: <span style="color:#4F7A5A;">$${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
`;
        }

        if (orderNote.trim()) {
            docContent += `
    <div class="note-box">
        <div class="note-title">📝 Observaciones del Pedido:</div>
        <div>${orderNote}</div>
    </div>
`;
        }

        docContent += `
    <div class="handwritten-box">
        <strong>✍️ Ajustes y Notas a Mano (Espacio de Trabajo):</strong>
        <div class="handwritten-line"></div>
        <div class="handwritten-line"></div>
        <div class="handwritten-line"></div>
    </div>

</body>
</html>
`;

        const blob = new Blob(['\ufeff' + docContent], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = activeSupplier
            ? `Pedido_${activeSupplier.name.replace(/\s+/g, '_')}_${dateStr.replace(/\s+/g, '_')}.doc`
            : `Pedido_General_${dateStr.replace(/\s+/g, '_')}.doc`;
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addNotification('Archivo de Word generado', 'success');
    };

    // ── Print / Save PDF ──
    const printBoleto = () => {
        window.print();
    };

    // ── Urgency badge ──
    const urgencyBadge = (u: StockAlert['urgency'], stock: number) => {
        if (u === 'critical') return <span className="rd-badge rd-badge--critical">Sin Stock ({stock})</span>;
        if (u === 'low') return <span className="rd-badge rd-badge--low">Bajo ({stock})</span>;
        return <span className="rd-badge rd-badge--ok">OK ({stock})</span>;
    };

    return (
        <div className="rd-root">
            {/* ── Header ── */}
            <header className="rd-header">
                <div>
                    <h1 className="rd-header__title">
                        <span className="material-symbols-rounded">inventory_2</span>
                        Reposición
                    </h1>
                    <p className="rd-header__sub">Armá tu lista de pedido y enviala cuando esté lista</p>
                </div>
                <div className="rd-header__actions">
                    <button
                        className="rd-btn rd-btn--ghost"
                        onClick={() => { loadProducts(); loadSuppliers(); addNotification('Datos actualizados', 'info'); }}
                        title="Actualizar datos"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <Link to="/workspace" className="rd-btn rd-btn--ghost" title="Ver pedidos guardados">
                        <FileSpreadsheet size={16} />
                        <span>Workspace</span>
                    </Link>
                </div>
            </header>

            {/* ── Body: 2 columns ── */}
            <div className="rd-body">

                {/* ════════════════════════════════
                    LEFT PANEL: Alerts
                    ════════════════════════════════ */}
                <section className="rd-alerts-panel">
                    <div className="rd-alerts-panel__header">
                        <h2 className="rd-section-title">
                            <AlertTriangle size={18} />
                            Alertas de Stock
                        </h2>
                        <button
                            className={`rd-btn rd-btn--sm ${showAll ? 'rd-btn--active' : 'rd-btn--ghost'}`}
                            onClick={() => setShowAll(v => !v)}
                        >
                            <Filter size={13} />
                            {showAll ? 'Ver solo bajos' : 'Ver todos'}
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="rd-filters">
                        <div className="rd-search-wrap">
                            <Search size={14} className="rd-search-icon" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="rd-input rd-search"
                            />
                            {searchQuery && (
                                <button className="rd-clear-search" onClick={() => setSearchQuery('')}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <select className="rd-input rd-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                            <option value="">📁 Todas las categorías</option>
                            {categoryOptions.map(o => <option key={o.id} value={o.name}>{o.label}</option>)}
                        </select>
                        {allTags.length > 0 && (
                            <select className="rd-input rd-select" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                <option value=""><Tag size={12} /> Todas las etiquetas</option>
                                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        )}
                    </div>

                    {/* Alert list */}
                    {loading ? (
                        <div className="rd-loading"><div className="rd-spinner" /></div>
                    ) : stockAlerts.length === 0 ? (
                        <div className="rd-empty">
                            <PackageOpen size={40} />
                            <p>{showAll ? 'No hay productos que coincidan' : '¡Todo el stock está en orden!'}</p>
                            <button className="rd-btn rd-btn--ghost" onClick={() => setShowAll(true)}>
                                Ver todo el catálogo
                            </button>
                        </div>
                    ) : (
                        <div className="rd-alert-list">
                            {stockAlerts.map(alert => {
                                const inCart = isInCart(alert.id);
                                return (
                                    <div key={alert.id} className={`rd-alert-item rd-alert-item--${alert.urgency} ${inCart ? 'rd-alert-item--in-cart' : ''}`}>
                                        <div className="rd-alert-item__info">
                                            <span className="rd-alert-item__name">{alert.name}</span>
                                            <span className="rd-alert-item__meta">
                                                {alert.code} · {alert.category}
                                                {alert.supplierName && <> · <Truck size={11} /> {alert.supplierName}</>}
                                            </span>
                                        </div>
                                        <div className="rd-alert-item__right">
                                            {urgencyBadge(alert.urgency, alert.stock)}
                                            <button
                                                className={`rd-add-btn ${inCart ? 'rd-add-btn--added' : ''}`}
                                                onClick={() => !inCart && addToCart(alert)}
                                                disabled={inCart}
                                                title={inCart ? 'Ya está en la lista' : 'Agregar al pedido'}
                                            >
                                                {inCart ? <Check size={16} /> : <Plus size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ════════════════════════════════
                    RIGHT PANEL: Open Order Cart & Live Boleto Preview
                    ════════════════════════════════ */}
                <section className="rd-cart-panel">
                    {/* Tabs navigation */}
                    <div className="rd-tabs-header">
                        <button
                            type="button"
                            className={`rd-tab-btn ${activeTab === 'cart' ? 'rd-tab-btn--active' : ''}`}
                            onClick={() => setActiveTab('cart')}
                            title="Ver y editar la lista de compras"
                        >
                            <ShoppingCart size={15} />
                            Lista Rápida ({orderItems.length})
                        </button>
                        <button
                            type="button"
                            className={`rd-tab-btn ${activeTab === 'boleto' ? 'rd-tab-btn--active' : ''}`}
                            onClick={() => setActiveTab('boleto')}
                            title="Ver vista previa membretada del pedido"
                        >
                            <FileSpreadsheet size={15} />
                            Boleto Membretado
                        </button>
                    </div>

                    {activeTab === 'cart' ? (
                        <>
                            <div className="rd-cart-panel__header">
                                <h2 className="rd-section-title">
                                    <ShoppingCart size={18} />
                                    Lista del Pedido
                                    {orderItems.length > 0 && (
                                        <span className="rd-cart-count">{orderItems.length}</span>
                                    )}
                                </h2>
                                {orderItems.length > 0 && (
                                    <button className="rd-btn rd-btn--danger-ghost rd-btn--sm" onClick={clearCart} title="Limpiar lista">
                                        <Trash2 size={13} /> Limpiar
                                    </button>
                                )}
                            </div>

                            {/* Cart items */}
                            <div className="rd-cart-list">
                                {orderItems.length === 0 ? (
                                    <div className="rd-cart-empty">
                                        <ShoppingCart size={36} />
                                        <p>La lista está vacía.</p>
                                        <p className="rd-cart-empty__hint">Tocá el <strong>+</strong> en cualquier producto o agregá uno manualmente abajo.</p>
                                    </div>
                                ) : (
                                    orderItems.map(item => (
                                        <div key={item.id} className="rd-cart-item">
                                            <div className="rd-cart-item__info">
                                                <span className="rd-cart-item__name">
                                                    {item.isCustom && <span className="rd-libre-badge">LIBRE</span>}
                                                    {item.name}
                                                </span>
                                                {item.currentStock !== undefined && (
                                                    <span className="rd-cart-item__meta">
                                                        Stock actual: {item.currentStock} · Mín: {item.minStock}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="rd-cart-item__controls">
                                                <select
                                                    className="rd-input rd-select rd-select--sm"
                                                    value={item.supplierId || ''}
                                                    onChange={e => updateItemSupplier(item.id, e.target.value)}
                                                    title="Proveedor (opcional)"
                                                >
                                                    <option value="">Sin proveedor</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={item.quantity}
                                                    onChange={e => updateQty(item.id, parseInt(e.target.value) || 1)}
                                                    className="rd-input rd-qty-input"
                                                    title="Cantidad"
                                                />
                                                <button className="rd-remove-btn" onClick={() => removeFromCart(item.id)} title="Quitar">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Custom item form */}
                            <div className="rd-custom-form">
                                <p className="rd-custom-form__label">
                                    <Plus size={13} /> Agregar ítem manualmente
                                </p>
                                <div className="rd-custom-form__row">
                                    <input
                                        type="text"
                                        placeholder="Nombre del producto..."
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        className="rd-input rd-input--grow"
                                        onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Cant."
                                        min={1}
                                        value={customQty}
                                        onChange={e => setCustomQty(e.target.value)}
                                        className="rd-input rd-qty-input"
                                    />
                                    <input
                                        type="number"
                                        placeholder="$Costo"
                                        min={0}
                                        value={customCost}
                                        onChange={e => setCustomCost(e.target.value)}
                                        className="rd-input rd-cost-input"
                                    />
                                </div>
                                <div className="rd-custom-form__row">
                                    <select
                                        className="rd-input rd-select rd-input--grow"
                                        value={customSupplier}
                                        onChange={e => setCustomSupplier(e.target.value)}
                                    >
                                        <option value="">Proveedor (opcional)</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <button className="rd-btn rd-btn--primary" onClick={addCustomItem}>
                                        <Plus size={15} /> Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Note */}
                            <div className="rd-note-section">
                                <button className="rd-note-toggle" onClick={() => setShowNote(v => !v)}>
                                    <StickyNote size={14} />
                                    {showNote ? 'Ocultar nota' : 'Agregar nota al pedido'}
                                    {showNote ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {showNote && (
                                    <textarea
                                        className="rd-note-input"
                                        placeholder="Ej: Pedir las flores para el jueves antes del mediodía..."
                                        value={orderNote}
                                        onChange={e => setOrderNote(e.target.value)}
                                        rows={3}
                                    />
                                )}
                            </div>

                            {/* Footer actions */}
                            {orderItems.length > 0 && (
                                <div className="rd-cart-footer">
                                    <div className="rd-cart-total">
                                        Total estimado: <strong>${cartTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                    </div>

                                    {/* WhatsApp */}
                                    <div className="rd-wa-row">
                                        <select
                                            className="rd-input rd-select rd-input--grow"
                                            value={waSupplierId}
                                            onChange={e => setWaSupplierId(e.target.value)}
                                        >
                                            <option value="">Enviar todo por WhatsApp</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>Solo {s.name}</option>)}
                                        </select>
                                        <button className="rd-btn rd-btn--whatsapp" onClick={generateWAMessage}>
                                            <MessageCircle size={16} />
                                            Enviar
                                        </button>
                                    </div>

                                    <button className="rd-btn rd-btn--workspace rd-btn--full" onClick={saveToWorkspace}>
                                        <FileSpreadsheet size={16} />
                                        Guardar Pedido en Workspace
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Boleto tab content */}
                            <div className="rd-boleto-controls">
                                <div className="rd-boleto-filter">
                                    <span className="rd-boleto-filter__label"><Truck size={13} /> Ver Proveedor:</span>
                                    <select
                                        className="rd-input rd-select rd-input--grow"
                                        value={boletoSupplierId}
                                        onChange={e => setBoletoSupplierId(e.target.value)}
                                    >
                                        <option value="">Todos los Proveedores</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Live Letterhead Preview Paper Canvas */}
                            <div className="rd-paper-wrapper">
                                <div id="rd-paper-to-print" className="rd-paper-sheet">
                                    {/* Header / Logo */}
                                    <div className="rd-paper-header">
                                        <div className="rd-paper-header__logo">FLORERÍA ASTER</div>
                                        <div className="rd-paper-header__subtitle">Orden de Compra y Reposición</div>
                                        <div className="rd-paper-header__line"></div>
                                    </div>

                                    {/* Metadata Grid */}
                                    <div className="rd-paper-meta-grid">
                                        <div className="rd-paper-meta-section">
                                            <p><strong>EMISOR:</strong> Florería Aster S.R.L.</p>
                                            <p><strong>Solicitante:</strong> {user?.name || 'Administrador'}</p>
                                            <p><strong>Email:</strong> {user?.email || '—'}</p>
                                            <p className="rd-paper-meta-hint">Florería Aster ERP v2.0</p>
                                        </div>
                                        <div className="rd-paper-meta-section rd-paper-meta-section--right">
                                            <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            <p><strong>Hora:</strong> {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                                            <p><strong>Estado:</strong> <span className="rd-paper-status-badge">Abierto / En Proceso</span></p>
                                        </div>
                                    </div>

                                    {/* Document Contents */}
                                    <div className="rd-paper-content-list">
                                        {Object.keys(groupedItemsByFolder).length === 0 ? (
                                            <div className="rd-paper-empty-items">
                                                No hay ítems cargados en esta orden.
                                            </div>
                                        ) : (
                                            Object.entries(groupedItemsByFolder).map(([category, items]) => (
                                                <div key={category} className="rd-paper-category-group">
                                                    <h3 className="rd-paper-category-title">{category.toUpperCase()}</h3>
                                                    <table className="rd-paper-items-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '15%' }}>Código</th>
                                                                <th style={{ width: '45%' }}>Producto</th>
                                                                <th style={{ width: '15%' }} className="rd-txt-right">Cant.</th>
                                                                <th style={{ width: '12%' }} className="rd-txt-right">Cost. Un.</th>
                                                                <th style={{ width: '13%' }} className="rd-txt-right">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {items.map(item => (
                                                                <tr key={item.id}>
                                                                    <td>{item.code}</td>
                                                                    <td>{item.name}</td>
                                                                    <td className="rd-txt-right"><strong>{item.quantity}</strong></td>
                                                                    <td className="rd-txt-right">${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                                    <td className="rd-txt-right">${(item.quantity * item.cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Totals */}
                                    {Object.keys(groupedItemsByFolder).length > 0 && (
                                        <div className="rd-paper-totals-box">
                                            Total Estimado: <strong>${Object.values(groupedItemsByFolder).flat().reduce((sum, item) => sum + item.quantity * item.cost, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                    )}

                                    {/* Order Note */}
                                    {orderNote.trim() && (
                                        <div className="rd-paper-note-block">
                                            <h4>📝 Observaciones del Pedido:</h4>
                                            <p>{orderNote}</p>
                                        </div>
                                    )}

                                    {/* Dotted lines for handwritten notes */}
                                    <div className="rd-paper-handwritten">
                                        <h4>✍️ Ajustes y Notas a Mano (Espacio de Trabajo):</h4>
                                        <div className="rd-paper-handwritten-dotted"></div>
                                        <div className="rd-paper-handwritten-dotted"></div>
                                        <div className="rd-paper-handwritten-dotted"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Export / Print actions */}
                            {orderItems.length > 0 && (
                                <div className="rd-boleto-footer-actions">
                                    <button type="button" className="rd-btn rd-btn--workspace rd-btn--full" onClick={exportToWord}>
                                        <Download size={15} /> Descargar Word (.doc)
                                    </button>
                                    <button type="button" className="rd-btn rd-btn--primary rd-btn--full" onClick={printBoleto}>
                                        <Printer size={15} /> Imprimir / Guardar PDF
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Saved banner */}
                    {savedFilename && (
                        <div className="rd-saved-banner">
                            <Check size={16} />
                            Pedido guardado como <strong>{savedFilename}</strong>
                            {' — '}
                            <Link to="/workspace" style={{ color: '#92400e', fontWeight: 'bold' }}>Ver en Workspace</Link>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default RestockDesktop;
