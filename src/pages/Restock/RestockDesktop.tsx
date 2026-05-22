import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, Plus, Trash2, MessageCircle, FileSpreadsheet,
    ShoppingCart, PackageOpen, X, Check, Truck, StickyNote, RefreshCw,
    Download, Printer, Layers, Calendar, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import './RestockDesktop.css';

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

interface VFSItem {
    id: string;
    name: string;
    parentId: string | null;
    type: 'folder' | 'file';
    entity?: string;
    description?: string;
    color?: string;
    isCustom?: boolean;
    customData?: {
        columns: any[];
        rows: any[];
        notes?: string;
        leadTime?: string;
    };
}

const RestockDesktop: React.FC = () => {
    const products = useStore(s => s.products);
    const suppliers = useStore(s => s.suppliers);
    const categoriesData = useStore(s => s.categoriesData) || [];
    const loadProducts = useStore(s => s.loadProducts);
    const loadSuppliers = useStore(s => s.loadSuppliers);
    const loadCategories = useStore(s => s.loadCategories);
    const addNotification = useStore(s => s.addNotification);
    const updateProduct = useStore(s => s.updateProduct);
    const shopInfo = useStore(s => s.shopInfo);
    const { user } = useAuth();
    const businessId = user?.business_id || 'default';

    // ── HUD State & Tabs ──
    const [activeTab, setActiveTab] = useState<'selection' | 'drafts' | 'boleto'>('selection');
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // ── Catalog Filters ──
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'low' | 'ok'>('all');

    // ── Checkbox Selection ──
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    
    // ── Bulk Assignment panel state ──
    const [bulkSupplierId, setBulkSupplierId] = useState('');
    const [bulkQuantity, setBulkQuantity] = useState(10);

    // ── Boleto supplier preview selection ──
    const [boletoSupplierId, setBoletoSupplierId] = useState<string>('');

    // ── Inline Custom item form per draft ──
    const [customNameMap, setCustomNameMap] = useState<Record<string, string>>({});
    const [customQtyMap, setCustomQtyMap] = useState<Record<string, string>>({});
    const [customCostMap, setCustomCostMap] = useState<Record<string, string>>({});

    // ── Individual Quantities in Catalog ──
    const [catalogQuantities, setCatalogQuantities] = useState<Record<string, number>>({});

    // ── Recursive Expanded Categories ──
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // ── Printable Toggles ──
    const [printOptions, setPrintOptions] = useState({
        showCode: true,
        showPrice: true,
        showSubtotal: true,
        showTotal: true,
        showEmisor: true,
        showProveedor: true,
        showNotes: true,
        showHandwritten: true
    });

    const getDefaultQty = useCallback((alert: any) => {
        return Math.max(10, (alert.minStock * 2) - alert.stock);
    }, []);

    // ── Deep-link check from Suppliers agenda ──
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlSupplierId = params.get('supplierId');
        if (urlSupplierId) {
            setSelectedSupplierFilter(urlSupplierId);
            setActiveTab('selection');
            // Clean URL query param visually to prevent persistent filtering if navigated away
            window.history.replaceState({}, document.title, window.location.pathname);
            addNotification('Filtro de catálogo aplicado según el proveedor elegido', 'info');
        }
    }, [addNotification]);

    // ── Load Catalog Data ──
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
    }, [refreshKey]);

    // ── VFS Draft Loader ──
    const drafts = useMemo((): VFSItem[] => {
        const key = `explorer_custom_items_${businessId}`;
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored) as VFSItem[];
                return parsed.filter(item => 
                    item.parentId === 'pedidos_compra_folder' && 
                    item.isCustom && 
                    item.id.startsWith('restock_draft_')
                );
            }
        } catch (e) {
            console.error('Failed to load drafts from VFS:', e);
        }
        return [];
    }, [businessId, refreshKey, activeTab]);

    // ── Save/Update VFS Draft ──
    const saveVFSDraft = useCallback((supplierId: string, supplierName: string, items: any[], notes = '', leadTime = '') => {
        const key = `explorer_custom_items_${businessId}`;
        let stored: VFSItem[] = [];
        try {
            stored = JSON.parse(localStorage.getItem(key) || '[]') as VFSItem[];
        } catch {}
        
        const draftId = `restock_draft_${supplierId}`;
        const filename = `Borrador_Pedido_${supplierName.replace(/\s+/g, '_')}.xlsx`;
        
        const existingIndex = stored.findIndex(item => item.id === draftId);
        
        const columns = [
            { key: 'code', label: 'Código', width: 110 },
            { key: 'name', label: 'Producto', width: 250 },
            { key: 'quantity', label: 'Cantidad', width: 100, align: 'right', badge: true },
            { key: 'supplierName', label: 'Proveedor', width: 160 },
            { key: 'cost', label: 'Costo Unit.', width: 120, align: 'right', format: 'currency' },
            { key: 'total', label: 'Total Est.', width: 130, align: 'right', format: 'currency' }
        ];
        
        const rows = items.map(i => ({
            id: i.id,
            code: i.code,
            name: i.name,
            quantity: Number(i.quantity) || 1,
            supplierName: i.supplierName || supplierName,
            cost: Number(i.cost) || 0,
            total: (Number(i.quantity) || 1) * (Number(i.cost) || 0),
            isCustom: i.isCustom || false
        }));

        const draftItem: VFSItem = {
            id: draftId,
            name: filename,
            parentId: 'pedidos_compra_folder',
            type: 'file',
            entity: 'custom',
            description: `Borrador de reposición para ${supplierName}. Notas: ${notes || 'Sin notas'}. Plazo: ${leadTime || 'No definido'}`,
            color: '#a7f3d0', // Light green
            isCustom: true,
            customData: {
                columns,
                rows,
                notes,
                leadTime
            }
        };
        
        if (existingIndex > -1) {
            stored[existingIndex] = draftItem;
        } else {
            stored.push(draftItem);
        }
        
        localStorage.setItem(key, JSON.stringify(stored));
        setRefreshKey(prev => prev + 1);
    }, [businessId]);

    // ── Delete VFS Draft ──
    const deleteVFSDraft = useCallback((draftId: string) => {
        const key = `explorer_custom_items_${businessId}`;
        let stored: VFSItem[] = [];
        try {
            stored = JSON.parse(localStorage.getItem(key) || '[]') as VFSItem[];
        } catch {}
        
        const filtered = stored.filter(item => item.id !== draftId);
        localStorage.setItem(key, JSON.stringify(filtered));
        setRefreshKey(prev => prev + 1);
        addNotification('Borrador eliminado del Workspace virtual', 'info');
    }, [businessId, addNotification]);

    // ── Category options flat list with indents ──
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

    // ── Recursive Descendant Category Resolver ──
    const getDescendantNames = useCallback((catId: string, allCats: any[]): string[] => {
        const currentCat = allCats.find(c => c.id === catId);
        const children = allCats.filter(c => c.parent_id === catId);
        const names = currentCat ? [currentCat.name] : [];
        return [...names, ...children.flatMap(child => getDescendantNames(child.id, allCats))];
    }, []);

    // ── Generate Stock Alerts ──
    const stockAlerts = useMemo((): StockAlert[] => {
        return products
            .filter(p => {
                const matchSearch = !searchQuery ||
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
                const matchCat = !selectedCategoryId || (() => {
                    const allowedNames = getDescendantNames(selectedCategoryId, categoriesData);
                    return allowedNames.includes(p.category);
                })();
                const matchTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));
                const matchSupplier = !selectedSupplierFilter || p.supplierId === selectedSupplierFilter;

                if (!matchSearch || !matchCat || !matchTag || !matchSupplier) return false;

                const stock = p.stock ?? 0;
                const min = p.min ?? 5;
                const itemUrgency = stock <= 0 ? 'critical' : stock <= min ? 'low' : 'ok';
                
                if (urgencyFilter === 'all') return true;
                return itemUrgency === urgencyFilter;
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
    }, [products, suppliers, searchQuery, selectedCategoryId, selectedTag, selectedSupplierFilter, urgencyFilter, categoriesData, getDescendantNames]);

    // ── Bulk Add Handler ──
    const handleBulkAdd = () => {
        if (selectedProductIds.length === 0) {
            addNotification('No seleccionaste ningún producto', 'warning');
            return;
        }

        const supplierId = bulkSupplierId || 'unassigned';
        const supplier = suppliers.find(s => s.id === supplierId);
        const supplierName = supplier ? supplier.name : 'Sin Proveedor';

        // Load existing items in the draft from VFS
        const draftId = `restock_draft_${supplierId}`;
        const existingDraft = drafts.find(d => d.id === draftId);
        let draftItems: any[] = [];
        let existingNotes = '';
        let existingLeadTime = '';

        if (existingDraft && existingDraft.customData) {
            draftItems = [...(existingDraft.customData.rows || [])];
            existingNotes = existingDraft.customData.notes || '';
            existingLeadTime = existingDraft.customData.leadTime || '';
        }

        // Add each selected product
        selectedProductIds.forEach(id => {
            const alert = stockAlerts.find(a => a.id === id);
            if (!alert) return;

            const qty = catalogQuantities[id] ?? getDefaultQty(alert);

            const existingIdx = draftItems.findIndex(item => item.id === id);
            if (existingIdx > -1) {
                draftItems[existingIdx].quantity += Number(qty);
                draftItems[existingIdx].total = draftItems[existingIdx].quantity * draftItems[existingIdx].cost;
            } else {
                draftItems.push({
                    id: alert.id,
                    code: alert.code,
                    name: alert.name,
                    quantity: Number(qty),
                    supplierName,
                    cost: alert.cost,
                    total: Number(qty) * alert.cost,
                    isCustom: false
                });
            }
        });

        saveVFSDraft(supplierId, supplierName, draftItems, existingNotes, existingLeadTime);
        setSelectedProductIds([]);
        addNotification(`Productos agregados al borrador de ${supplierName}`, 'success');
    };

    // ── Checkbox Helpers ──
    const handleSelectProduct = (id: string) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAllVisible = () => {
        const visibleIds = stockAlerts.map(a => a.id);
        const allSelected = visibleIds.every(id => selectedProductIds.includes(id));
        
        if (allSelected) {
            setSelectedProductIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // ── Add Item to Draft Directly (Single Item Quick Action) ──
    const handleQuickAdd = (alert: StockAlert) => {
        const supplierId = alert.supplierId || 'unassigned';
        const supplierName = alert.supplierName || 'Sin Proveedor';
        const suggested = catalogQuantities[alert.id] ?? getDefaultQty(alert);

        const draftId = `restock_draft_${supplierId}`;
        const existingDraft = drafts.find(d => d.id === draftId);
        let draftItems: any[] = [];
        let existingNotes = '';
        let existingLeadTime = '';

        if (existingDraft && existingDraft.customData) {
            draftItems = [...(existingDraft.customData.rows || [])];
            existingNotes = existingDraft.customData.notes || '';
            existingLeadTime = existingDraft.customData.leadTime || '';
        }

        const existingIdx = draftItems.findIndex(item => item.id === alert.id);
        if (existingIdx > -1) {
            draftItems[existingIdx].quantity += suggested;
            draftItems[existingIdx].total = draftItems[existingIdx].quantity * draftItems[existingIdx].cost;
        } else {
            draftItems.push({
                id: alert.id,
                code: alert.code,
                name: alert.name,
                quantity: suggested,
                supplierName,
                cost: alert.cost,
                total: suggested * alert.cost,
                isCustom: false
            });
        }

        saveVFSDraft(supplierId, supplierName, draftItems, existingNotes, existingLeadTime);
        addNotification(`Agregado a borrador de ${supplierName}`, 'success');
    };

    // ── Edit Single Item Quantity/Cost in Draft inline ──
    const handleUpdateDraftItem = (draftId: string, itemId: string, field: 'quantity' | 'cost', value: number) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft || !draft.customData) return;

        const supplierId = draftId.replace('restock_draft_', '');
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');

        const updatedRows = (draft.customData.rows || []).map(row => {
            if (row.id === itemId) {
                const updatedVal = Math.max(0, value);
                return {
                    ...row,
                    [field]: updatedVal,
                    total: field === 'quantity' ? updatedVal * row.cost : row.quantity * updatedVal
                };
            }
            return row;
        });

        saveVFSDraft(supplierId, supplierName, updatedRows, draft.customData.notes, draft.customData.leadTime);
    };

    const handleRemoveDraftItem = (draftId: string, itemId: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft || !draft.customData) return;

        const supplierId = draftId.replace('restock_draft_', '');
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');

        const updatedRows = (draft.customData.rows || []).filter(row => row.id !== itemId);
        saveVFSDraft(supplierId, supplierName, updatedRows, draft.customData.notes, draft.customData.leadTime);
        addNotification('Producto quitado del borrador', 'info');
    };

    // ── Inline Custom item form per draft card ──
    const handleAddCustomItem = (draftId: string) => {
        const name = customNameMap[draftId] || '';
        const qtyStr = customQtyMap[draftId] || '';
        const costStr = customCostMap[draftId] || '';

        if (!name.trim()) {
            addNotification('Escribí el nombre del producto', 'warning');
            return;
        }

        const draft = drafts.find(d => d.id === draftId);
        if (!draft || !draft.customData) return;

        const supplierId = draftId.replace('restock_draft_', '');
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');

        const draftItems = [...(draft.customData.rows || [])];
        draftItems.push({
            id: `custom_${Date.now()}`,
            code: 'LIBRE',
            name: name.trim(),
            quantity: parseInt(qtyStr) || 1,
            cost: parseFloat(costStr) || 0,
            supplierName,
            total: (parseInt(qtyStr) || 1) * (parseFloat(costStr) || 0),
            isCustom: true
        });

        saveVFSDraft(supplierId, supplierName, draftItems, draft.customData.notes, draft.customData.leadTime);

        // Reset fields
        setCustomNameMap(prev => ({ ...prev, [draftId]: '' }));
        setCustomQtyMap(prev => ({ ...prev, [draftId]: '' }));
        setCustomCostMap(prev => ({ ...prev, [draftId]: '' }));
        addNotification('Producto libre agregado al borrador', 'success');
    };

    const handleUpdateDraftNotes = (draftId: string, notes: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft || !draft.customData) return;
        const supplierId = draftId.replace('restock_draft_', '');
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
        saveVFSDraft(supplierId, supplierName, draft.customData.rows || [], notes, draft.customData.leadTime);
    };

    const handleUpdateDraftLeadTime = (draftId: string, leadTime: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft || !draft.customData) return;
        const supplierId = draftId.replace('restock_draft_', '');
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
        saveVFSDraft(supplierId, supplierName, draft.customData.rows || [], draft.customData.notes, leadTime);
    };

    // ── WhatsApp Message Generator for VFS Draft ──
    const generateWAMessage = (draft: VFSItem) => {
        const items = draft.customData?.rows || [];
        const phone = suppliers.find(s => `restock_draft_${s.id}` === draft.id)?.phone || '';
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');

        let msg = `*FLORERÍA ASTER – PEDIDO DE REPOSICIÓN*\n\n`;
        msg += `Hola *${supplierName}*, por favor coordinar entrega de:\n\n`;

        items.forEach((i: any) => {
            msg += `• *${i.quantity}x* ${i.name} (${i.code})`;
            if (i.cost > 0) msg += ` – Ref: $${i.cost.toLocaleString('es-AR')} c/u`;
            msg += '\n';
        });

        const total = items.reduce((s, i) => s + (i.quantity * i.cost), 0);
        if (total > 0) msg += `\n💰 *Total estimado:* $${total.toLocaleString('es-AR')}`;
        if (draft.customData?.notes) msg += `\n📝 *Nota:* ${draft.customData.notes}`;
        msg += `\n\n¡Muchas gracias!`;

        const url = phone
            ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
            : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    // ── Export to Word (.doc) ──
    const exportToWord = (draft: VFSItem) => {
        const items = draft.customData?.rows || [];
        if (items.length === 0) {
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

        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
        const matchingSupplier = suppliers.find(s => `restock_draft_${s.id}` === draft.id);
        const supplierInfo = matchingSupplier
            ? `PROVEEDOR: ${matchingSupplier.name.toUpperCase()}\nContacto: ${matchingSupplier.phone || '—'} · ${(matchingSupplier as any).email || '—'}`
            : `PROVEEDOR: ${supplierName.toUpperCase()}`;

        // Group items by category/folder
        const grouped: Record<string, any[]> = {};
        items.forEach((item: any) => {
            // Find category
            const matchedProd = products.find(p => p.id === item.id);
            const cat = matchedProd?.category || 'Sin Categoría';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });

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

    <h1>${(shopInfo?.name || 'Florería Aster').toUpperCase()}</h1>
    <div class="subtitle">Orden de Compra y Reposición</div>

    <table class="meta-box">
        <tr>
            <td style="border:none; width:50%; vertical-align:top;">
                <strong>EMISOR:</strong> ${shopInfo?.name || 'Florería Aster S.R.L.'}<br>
                ${shopInfo?.phone ? `<strong>Teléfono:</strong> ${shopInfo.phone}<br>` : ''}
                ${shopInfo?.address ? `<strong>Dirección:</strong> ${shopInfo.address}<br>` : ''}
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

        Object.entries(grouped).forEach(([category, catItems]) => {
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
            catItems.forEach(item => {
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

        const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.cost), 0);

        if (grandTotal > 0) {
            docContent += `
    <div class="total-box">
        TOTAL ESTIMADO: <span style="color:#4F7A5A;">$${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
`;
        }

        if (draft.customData?.notes) {
            docContent += `
    <div class="note-box">
        <div class="note-title">📝 Observaciones del Pedido:</div>
        <div>${draft.customData.notes}</div>
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
        const filename = `Pedido_${supplierName.replace(/\s+/g, '_')}_${dateStr.replace(/\s+/g, '_')}.doc`;
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addNotification('Archivo de Word generado', 'success');
    };

    const printBoleto = () => {
        window.print();
    };

    // ── Save Order as .docx to dated folder in VFS Workspace ──
    const saveAsDocxToWorkspace = (draft: VFSItem) => {
        const key = `explorer_custom_items_${businessId}`;
        let stored: VFSItem[] = [];
        try {
            stored = JSON.parse(localStorage.getItem(key) || '[]') as VFSItem[];
        } catch {}

        const now = new Date();
        const yearMonth = now.toISOString().slice(0, 7); // e.g. "2026-05"
        const dateStr = now.toLocaleDateString('es-AR').replace(/\//g, '-');
        const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');

        // 1. Find or create the dated folder
        let datedFolder = stored.find(item => item.parentId === 'pedidos_compra_folder' && item.name === yearMonth);
        let datedFolderId = '';
        
        if (!datedFolder) {
            datedFolderId = `dated_folder_${yearMonth}_${Date.now()}`;
            datedFolder = {
                id: datedFolderId,
                name: yearMonth,
                parentId: 'pedidos_compra_folder',
                type: 'folder',
                description: `Órdenes de pedido correspondientes a ${yearMonth}`,
                color: '#f0fdf4', // Premium light green
                isCustom: true
            };
            stored.push(datedFolder);
        } else {
            datedFolderId = datedFolder.id;
        }

        // 2. Create docx file in that dated folder
        const filename = `Pedido_${dateStr}_${supplierName.replace(/\s+/g, '_')}.docx`;
        const docxId = `docx_order_${draft.id.replace('restock_draft_', '')}_${Date.now()}`;

        const newDocxFile: VFSItem = {
            id: docxId,
            name: filename,
            parentId: datedFolderId,
            type: 'file',
            entity: 'custom',
            description: `Orden de reposición oficial emitida para ${supplierName} (${dateStr})`,
            color: '#e0e7ff', // Premium light purple/indigo
            isCustom: true,
            customData: {
                rows: draft.customData?.rows || [],
                notes: draft.customData?.notes || '',
                leadTime: draft.customData?.leadTime || '',
                shopInfo: shopInfo,
                printOptions: printOptions,
                status: 'emitted', // Starts as emitted
                supplierName: supplierName,
                date: now.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }),
                hour: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            } as any
        };

        stored.push(newDocxFile);
        localStorage.setItem(key, JSON.stringify(stored));
        setRefreshKey(prev => prev + 1);
        addNotification(`Pedido guardado en Workspace: Órdenes de Pedido ➔ ${yearMonth} ➔ ${filename}`, 'success');
    };

    // ── Update Draft Lifecycle Status in VFS ──
    const updateDraftStatus = (draftId: string, newStatus: 'draft' | 'emitted' | 'received') => {
        const key = `explorer_custom_items_${businessId}`;
        let stored: VFSItem[] = [];
        try {
            stored = JSON.parse(localStorage.getItem(key) || '[]') as VFSItem[];
        } catch {}
        
        const updated = stored.map(item => {
            if (item.id === draftId) {
                return {
                    ...item,
                    customData: {
                        ...item.customData,
                        status: newStatus
                    }
                };
            }
            return item;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        setRefreshKey(prev => prev + 1);
        addNotification(`Estado del pedido cambiado a ${
            newStatus === 'draft' ? 'Borrador' : newStatus === 'emitted' ? 'Emitido' : 'Recibido'
        }`, 'success');
    };

    // ── Commit Order stock quantities into real inventory ──
    const handleCommitStockToInventory = async (draft: VFSItem) => {
        const items = draft.customData?.rows || [];
        if (items.length === 0) return;
        try {
            setLoading(true);
            for (const item of items) {
                const matchingProd = products.find(p => p.id === item.id);
                if (matchingProd) {
                    const currentStock = matchingProd.stock ?? 0;
                    await updateProduct(item.id, {
                        stock: currentStock + item.quantity
                    });
                }
            }
            
            const key = `explorer_custom_items_${businessId}`;
            let stored: VFSItem[] = [];
            try {
                stored = JSON.parse(localStorage.getItem(key) || '[]') as VFSItem[];
            } catch {}
            
            const updated = stored.map(item => {
                if (item.id === draft.id) {
                    return {
                        ...item,
                        customData: {
                            ...item.customData,
                            status: 'received',
                            stockCommitted: true
                        }
                    };
                }
                return item;
            });
            localStorage.setItem(key, JSON.stringify(updated));
            
            addNotification('Existencias cargadas con éxito en el inventario', 'success');
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            addNotification('Error al cargar existencias en el inventario', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Toggle Category Expand in Sidebar Tree ──
    const toggleCategoryExpand = (catId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedCategories(prev => ({
            ...prev,
            [catId]: !prev[catId]
        }));
    };

    // ── Recursive Category Sidebar Tree Render ──
    const renderCategoryTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
        const levelCats = categoriesData.filter(c => c.parent_id === parentId);
        if (levelCats.length === 0) return null;
        
        return (
            <ul className="rd-category-tree-list" style={{ paddingLeft: depth > 0 ? '12px' : '0', listStyle: 'none', margin: 0 }}>
                {levelCats.map(cat => {
                    const hasChildren = categoriesData.some(c => c.parent_id === cat.id);
                    const isExpanded = !!expandedCategories[cat.id];
                    const isActive = selectedCategoryId === cat.id;
                    
                    return (
                        <li key={cat.id} className="rd-category-tree-item" style={{ margin: '4px 0' }}>
                            <div 
                                className={`rd-category-tree-node ${isActive ? 'rd-category-tree-node--active' : ''}`}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                    color: isActive ? '#065f46' : '#475569',
                                    fontWeight: isActive ? '600' : 'normal'
                                }}
                            >
                                {hasChildren ? (
                                    <button 
                                        type="button" 
                                        className="rd-tree-expand-btn"
                                        onClick={(e) => toggleCategoryExpand(cat.id, e)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#94a3b8',
                                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease',
                                            fontSize: '8px'
                                        }}
                                    >
                                        ▶
                                    </button>
                                ) : (
                                    <span style={{ width: '12px' }} />
                                )}
                                <span className="rd-node-icon" style={{ fontSize: '14px' }}>
                                    {hasChildren ? '📁' : '📄'}
                                </span>
                                <span className="rd-node-label" style={{ fontSize: '13px' }}>{cat.name}</span>
                            </div>
                            {hasChildren && isExpanded && renderCategoryTree(cat.id, depth + 1)}
                        </li>
                    );
                })}
            </ul>
        );
    };

    // ── Active Boleto Preview Items calculation ──
    const activeBoletoDraft = useMemo(() => {
        if (!boletoSupplierId) {
            return drafts[0] || null;
        }
        return drafts.find(d => d.id === `restock_draft_${boletoSupplierId}`) || null;
    }, [drafts, boletoSupplierId]);

    const groupedBoletoItems = useMemo(() => {
        if (!activeBoletoDraft || !activeBoletoDraft.customData) return {};
        const items = activeBoletoDraft.customData.rows || [];
        const groups: Record<string, any[]> = {};
        
        items.forEach(item => {
            const matchedProd = products.find(p => p.id === item.id);
            const cat = matchedProd?.category || 'Sin Categoría';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [activeBoletoDraft, products]);

    return (
        <div className="rd-root">
            {/* ── HUD Top Header Panel ── */}
            <header className="rd-header">
                <div className="rd-header__left">
                    <h1 className="rd-header__title">
                        <span className="material-symbols-rounded">dashboard</span>
                        Consola HUD de Reposición
                    </h1>
                    <p className="rd-header__sub">Optimización de stock e importaciones virtuales en tiempo real</p>
                </div>
                <div className="rd-header__right">
                    <button
                        className="rd-btn rd-btn--ghost"
                        onClick={() => { setRefreshKey(prev => prev + 1); addNotification('Workspace VFS sincronizado', 'success'); }}
                        title="Actualizar datos y sincronizar VFS"
                    >
                        <RefreshCw size={16} />
                        <span>Sincronizar</span>
                    </button>
                    <Link to="/workspace" className="rd-btn rd-btn--workspace" title="Abrir explorador del Workspace">
                        <FileSpreadsheet size={16} />
                        <span>Workspace</span>
                    </Link>
                </div>
            </header>

            {/* ── HUD Navigation Subtabs ── */}
            <div className="rd-tabs-header">
                <button
                    className={`rd-tab-btn ${activeTab === 'selection' ? 'rd-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('selection')}
                >
                    <Layers size={16} />
                    Catálogo y Faltantes ({stockAlerts.length})
                </button>
                <button
                    className={`rd-tab-btn ${activeTab === 'drafts' ? 'rd-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('drafts')}
                >
                    <ShoppingCart size={16} />
                    Borradores Activos VFS ({drafts.length})
                </button>
                <button
                    className={`rd-tab-btn ${activeTab === 'boleto' ? 'rd-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('boleto')}
                >
                    <Printer size={16} />
                    Lienzo de Boleto Membretado
                </button>
            </div>

            {/* ── HUD Primary Body Container ── */}
            <div className="rd-body">

                {/* ════════════════════════════════════════════
                    SUB-PAGE 1: Catalog and Selection Consola
                    ════════════════════════════════════════════ */}
                {activeTab === 'selection' && (
                    <section className="rd-selection-console">
                        <div className="rd-selection-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                            {/* Collapsible Category Sidebar */}
                            <aside className="rd-sidebar-tree-panel rd-hud-card" style={{ width: '280px', flexShrink: 0, padding: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📁 Categorías
                                </h3>
                                <div 
                                    className={`rd-category-tree-node ${!selectedCategoryId ? 'rd-category-tree-node--active' : ''}`}
                                    onClick={() => setSelectedCategoryId('')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: !selectedCategoryId ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                        color: !selectedCategoryId ? '#065f46' : '#475569',
                                        fontWeight: !selectedCategoryId ? '600' : 'normal',
                                        marginBottom: '8px'
                                    }}
                                >
                                    🌎 Ver Todas
                                </div>
                                <div className="rd-tree-scroll" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                    {renderCategoryTree(null)}
                                </div>
                            </aside>

                            {/* Main Product Selection Panel */}
                            <div className="rd-main-selection-panel" style={{ flexGrow: 1, minWidth: 0 }}>
                                {/* Filters Bar */}
                                <div className="rd-hud-card rd-hud-card--filters" style={{ marginBottom: '20px' }}>
                                    <div className="rd-filters-grid">
                                        <div className="rd-filter-item">
                                            <label>Buscar Producto</label>
                                            <div className="rd-search-input-wrapper">
                                                <Search size={14} className="rd-search-icon" />
                                                <input
                                                    type="text"
                                                    placeholder="Nombre o código..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    className="rd-input rd-input--with-icon"
                                                />
                                                {searchQuery && (
                                                    <button className="rd-clear-btn" onClick={() => setSearchQuery('')}>
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="rd-filter-item">
                                            <label>Categoría Seleccionada</label>
                                            <select 
                                                className="rd-input" 
                                                value={selectedCategoryId} 
                                                onChange={e => setSelectedCategoryId(e.target.value)}
                                            >
                                                <option value="">📁 Todas las categorías</option>
                                                {categoryOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="rd-filter-item">
                                            <label>Etiqueta</label>
                                            <select className="rd-input" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                                <option value="">🏷️ Todas las etiquetas</option>
                                                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="rd-filter-item">
                                            <label>Proveedor</label>
                                            <select className="rd-input" value={selectedSupplierFilter} onChange={e => setSelectedSupplierFilter(e.target.value)}>
                                                <option value="">🚛 Todos los proveedores</option>
                                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="rd-filter-item">
                                            <label>Estado de Stock</label>
                                            <select className="rd-input" value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value as any)}>
                                                <option value="all">Ver todo el catálogo</option>
                                                <option value="critical">🔴 Sin Stock</option>
                                                <option value="low">🟡 Stock Bajo</option>
                                                <option value="ok">🟢 Stock Óptimo</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Density-Optimized Grid Table */}
                                <div className="rd-hud-card rd-table-card">
                                    <div className="rd-table-scroll">
                                        <table className="rd-catalog-table">
                                            <thead>
                                                <tr>
                                                    <th className="rd-col-checkbox" style={{ width: '40px' }}>
                                                        <input
                                                            type="checkbox"
                                                            onChange={handleSelectAllVisible}
                                                            checked={stockAlerts.length > 0 && stockAlerts.every(a => selectedProductIds.includes(a.id))}
                                                            disabled={stockAlerts.length === 0}
                                                        />
                                                    </th>
                                                    <th>Código</th>
                                                    <th>Nombre del Producto</th>
                                                    <th>Categoría</th>
                                                    <th className="rd-txt-right">Stock</th>
                                                    <th className="rd-txt-right">Mínimo</th>
                                                    <th className="rd-col-status">Nivel Alerta</th>
                                                    <th className="rd-txt-right">Costo Ref.</th>
                                                    <th className="rd-txt-right" style={{ width: '90px' }}>Cant. Pedir</th>
                                                    <th className="rd-col-actions" style={{ width: '80px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    <tr>
                                                        <td colSpan={10} className="rd-table-loading">
                                                            <div className="rd-spinner" />
                                                            <p>Analizando inventario y cargando catálogo...</p>
                                                        </td>
                                                    </tr>
                                                ) : stockAlerts.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={10} className="rd-table-empty">
                                                            <PackageOpen size={48} className="rd-empty-icon" />
                                                            <h4>No se encontraron productos</h4>
                                                            <p>Modificá los filtros de búsqueda o el nivel de urgencia.</p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    stockAlerts.map(alert => {
                                                        const isSelected = selectedProductIds.includes(alert.id);
                                                        const inAnyDraft = drafts.some(d => d.customData?.rows?.some((r: any) => r.id === alert.id));
                                                        const currentQty = catalogQuantities[alert.id] ?? getDefaultQty(alert);
                                                        return (
                                                            <tr 
                                                                key={alert.id} 
                                                                className={`rd-catalog-row rd-row--${alert.urgency} ${isSelected ? 'rd-row--selected' : ''}`}
                                                                onClick={() => handleSelectProduct(alert.id)}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                <td className="rd-col-checkbox" onClick={e => e.stopPropagation()}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => handleSelectProduct(alert.id)}
                                                                    />
                                                                </td>
                                                                <td className="rd-code-cell"><code>{alert.code}</code></td>
                                                                <td className="rd-name-cell">
                                                                    <span className="rd-product-title">{alert.name}</span>
                                                                    {alert.supplierName ? (
                                                                        <span className="rd-product-supplier-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginLeft: '6px' }} onClick={e => e.stopPropagation()}>
                                                                            <Truck size={10} /> {alert.supplierName}
                                                                            <button
                                                                                type="button"
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    if (window.confirm(`¿Querés desvincular al proveedor de ${alert.name}?`)) {
                                                                                        try {
                                                                                            setLoading(true);
                                                                                            await updateProduct(alert.id, { supplierId: null as any });
                                                                                            addNotification('Proveedor desvinculado con éxito', 'success');
                                                                                            setRefreshKey(prev => prev + 1);
                                                                                        } catch (err) {
                                                                                            addNotification('Error al desvincular proveedor', 'error');
                                                                                        } finally {
                                                                                            setLoading(false);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}
                                                                                title="Desvincular Proveedor"
                                                                            >
                                                                                <X size={10} />
                                                                            </button>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="rd-product-supplier-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginLeft: '6px' }}>
                                                                            Sin Proveedor
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td>{alert.category}</td>
                                                                <td className="rd-txt-right font-bold">{alert.stock}</td>
                                                                <td className="rd-txt-right text-muted">{alert.minStock}</td>
                                                                <td className="rd-col-status">
                                                                    {alert.urgency === 'critical' && <span className="rd-alert-pill rd-alert-pill--critical">Sin Stock</span>}
                                                                    {alert.urgency === 'low' && <span className="rd-alert-pill rd-alert-pill--low">Bajo</span>}
                                                                    {alert.urgency === 'ok' && <span className="rd-alert-pill rd-alert-pill--ok">OK</span>}
                                                                </td>
                                                                <td className="rd-txt-right font-mono">${alert.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                                <td className="rd-txt-right" onClick={e => e.stopPropagation()}>
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        value={currentQty}
                                                                        onChange={e => {
                                                                            const val = parseInt(e.target.value) || 1;
                                                                            setCatalogQuantities(prev => ({ ...prev, [alert.id]: val }));
                                                                        }}
                                                                        className="rd-input"
                                                                        style={{ width: '70px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}
                                                                        title="Cantidad a pedir"
                                                                    />
                                                                </td>
                                                                <td className="rd-col-actions" onClick={e => e.stopPropagation()}>
                                                                    <button
                                                                        type="button"
                                                                        className={`rd-quick-add-btn ${inAnyDraft ? 'rd-quick-add-btn--in-draft' : ''}`}
                                                                        onClick={() => handleQuickAdd(alert)}
                                                                        title={inAnyDraft ? "Producto ya en un borrador" : "Agregar rápidamente"}
                                                                    >
                                                                        {inAnyDraft ? <Check size={14} /> : <Plus size={14} />}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                        {/* ── Glassmorphic Floating Command Bar ── */}
                        <div className={`rd-floating-bar ${selectedProductIds.length > 0 ? 'rd-floating-bar--visible' : ''}`}>
                            <div className="rd-floating-bar__content">
                                <div className="rd-floating-bar__meta">
                                    <span className="rd-floating-bar__count">{selectedProductIds.length}</span>
                                    <div>
                                        <p className="rd-floating-bar__title">Productos seleccionados</p>
                                        <p className="rd-floating-bar__sub">Elegí proveedor y cantidad para vincular al lote</p>
                                    </div>
                                </div>
                                <div className="rd-floating-bar__actions">
                                    <div className="rd-floating-bar__field">
                                        <Truck size={14} className="rd-field-icon" />
                                        <select
                                            value={bulkSupplierId}
                                            onChange={e => setBulkSupplierId(e.target.value)}
                                            className="rd-input rd-floating-select"
                                        >
                                            <option value="">Vincular a Sin Proveedor</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="rd-floating-bar__field">
                                        <Layers size={14} className="rd-field-icon" />
                                        <input
                                            type="number"
                                            min={1}
                                            value={bulkQuantity}
                                            onChange={e => setBulkQuantity(parseInt(e.target.value) || 1)}
                                            className="rd-input rd-floating-qty"
                                            title="Cantidad base"
                                        />
                                    </div>
                                    <button className="rd-btn rd-btn--primary rd-floating-btn" onClick={handleBulkAdd}>
                                        <Plus size={16} />
                                        <span>Vincular y Agregar al Pedido</span>
                                    </button>
                                    <button className="rd-btn rd-btn--danger-ghost rd-floating-cancel" onClick={() => setSelectedProductIds([])} title="Limpiar selección">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ════════════════════════════════════════════
                    SUB-PAGE 2: VFS Active Draft Carts
                    ════════════════════════════════════════════ */}
                {activeTab === 'drafts' && (
                    <section className="rd-drafts-console">
                        {drafts.length === 0 ? (
                            <div className="rd-hud-card rd-empty-state-card">
                                <ShoppingCart size={64} className="rd-empty-state-icon" />
                                <h3>No hay borradores de pedido activos</h3>
                                <p>Sincronización en tiempo real con el explorador de archivos. Agregá productos desde el catálogo para crear planillas virtuales de reposición en `/workspace`.</p>
                                <button className="rd-btn rd-btn--primary mt-4" onClick={() => setActiveTab('selection')}>
                                    <Layers size={16} />
                                    Ir al Catálogo de Faltantes
                                </button>
                            </div>
                        ) : (
                            <div className="rd-drafts-grid">
                                {drafts.map(draft => {
                                    const draftId = draft.id;
                                    const supplierId = draftId.replace('restock_draft_', '');
                                    const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
                                    const items = draft.customData?.rows || [];
                                    const totalEstimated = items.reduce((sum, item) => sum + (item.quantity * item.cost), 0);

                                    return (
                                        <div key={draftId} className="rd-hud-card rd-draft-card">
                                            {/* Draft Header */}
                                            <div className="rd-draft-card__header">
                                                <div className="rd-draft-card__title-wrap">
                                                    <span className="material-symbols-rounded rd-draft-icon">receipt_long</span>
                                                    <div>
                                                        <h3 className="rd-draft-card__title">{supplierName}</h3>
                                                        <p className="rd-draft-card__meta">
                                                            {items.length} productos cargados · Planilla: <code>{draft.name}</code>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="rd-draft-card__actions">
                                                    <button 
                                                        className="rd-btn rd-btn--ghost rd-btn--sm"
                                                        onClick={() => generateWAMessage(draft)}
                                                        title="Enviar por WhatsApp"
                                                    >
                                                        <MessageCircle size={14} style={{ color: '#25d366' }} />
                                                        <span className="rd-text-whatsapp">WhatsApp</span>
                                                    </button>
                                                    <button 
                                                        className="rd-btn rd-btn--ghost rd-btn--sm"
                                                        onClick={() => {
                                                            setBoletoSupplierId(supplierId);
                                                            setActiveTab('boleto');
                                                        }}
                                                        title="Previsualizar en Boleto Membretado"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button 
                                                        className="rd-btn rd-btn--danger-ghost rd-btn--sm"
                                                        onClick={() => deleteVFSDraft(draftId)}
                                                        title="Eliminar borrador"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Items Table inside draft card */}
                                            <div className="rd-draft-table-wrap">
                                                <table className="rd-draft-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Código</th>
                                                            <th>Producto</th>
                                                            <th className="rd-txt-right" style={{ width: '90px' }}>Cant.</th>
                                                            <th className="rd-txt-right" style={{ width: '110px' }}>Costo Unit.</th>
                                                            <th className="rd-txt-right" style={{ width: '120px' }}>Subtotal</th>
                                                            <th style={{ width: '40px' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={6} className="rd-draft-table-empty">
                                                                    Borrador vacío. Agregá productos desde la pestaña de catálogo.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            items.map((item: any) => (
                                                                <tr key={item.id}>
                                                                    <td>
                                                                        {item.isCustom && <span className="rd-libre-badge-vfs">LIBRE</span>}
                                                                        <code>{item.code}</code>
                                                                    </td>
                                                                    <td className="font-bold">{item.name}</td>
                                                                    <td className="rd-txt-right">
                                                                        <input
                                                                            type="number"
                                                                            min={1}
                                                                            value={item.quantity}
                                                                            onChange={e => handleUpdateDraftItem(draftId, item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                                            className="rd-draft-qty-input"
                                                                        />
                                                                    </td>
                                                                    <td className="rd-txt-right">
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            value={item.cost}
                                                                            onChange={e => handleUpdateDraftItem(draftId, item.id, 'cost', parseFloat(e.target.value) || 0)}
                                                                            className="rd-draft-cost-input"
                                                                        />
                                                                    </td>
                                                                    <td className="rd-txt-right font-mono font-bold">${item.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0'}</td>
                                                                    <td>
                                                                        <button className="rd-draft-item-delete" onClick={() => handleRemoveDraftItem(draftId, item.id)}>
                                                                            <X size={12} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Quick Inline form to add extra product directly in this supplier's draft */}
                                            <div className="rd-draft-quick-form">
                                                <p className="rd-quick-form-title">
                                                    <Plus size={12} /> Agregar ítem manual fuera de catálogo
                                                </p>
                                                <div className="rd-quick-form-fields">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre..."
                                                        value={customNameMap[draftId] || ''}
                                                        onChange={e => setCustomNameMap({ ...customNameMap, [draftId]: e.target.value })}
                                                        className="rd-input rd-quick-form-name"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Cant."
                                                        min={1}
                                                        value={customQtyMap[draftId] || ''}
                                                        onChange={e => setCustomQtyMap({ ...customQtyMap, [draftId]: e.target.value })}
                                                        className="rd-input rd-quick-form-qty"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Costo Unit."
                                                        min={0}
                                                        value={customCostMap[draftId] || ''}
                                                        onChange={e => setCustomCostMap({ ...customCostMap, [draftId]: e.target.value })}
                                                        className="rd-input rd-quick-form-cost"
                                                    />
                                                    <button className="rd-btn rd-btn--primary rd-btn--sm" onClick={() => handleAddCustomItem(draftId)}>
                                                        Agregar
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Draft logistics and notes */}
                                            <div className="rd-draft-footer">
                                                <div className="rd-draft-meta-inputs">
                                                    <div className="rd-meta-input-group">
                                                        <Calendar size={13} />
                                                        <label>Lead Time (Días):</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Ej: 3 días" 
                                                            value={draft.customData?.leadTime || ''}
                                                            onChange={e => handleUpdateDraftLeadTime(draftId, e.target.value)}
                                                            className="rd-input rd-draft-meta-input"
                                                        />
                                                    </div>
                                                    <div className="rd-meta-input-group">
                                                        <StickyNote size={13} />
                                                        <label>Notas de Pedido:</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Ej: Entrega urgente..." 
                                                            value={draft.customData?.notes || ''}
                                                            onChange={e => handleUpdateDraftNotes(draftId, e.target.value)}
                                                            className="rd-input rd-draft-meta-input"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="rd-draft-total-row">
                                                    <span>Total Estimado:</span>
                                                    <strong>${totalEstimated.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                                </div>

                                                {/* Workflow Status Selector & Stock Commit inside the draft card */}
                                                <div className="rd-draft-workflow-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                                    <div className="rd-status-picker" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                                        <span className="font-bold text-slate-600">Estado:</span>
                                                        <select
                                                            value={(draft.customData as any)?.status || 'draft'}
                                                            onChange={e => updateDraftStatus(draftId, e.target.value as any)}
                                                            className={`rd-status-select rd-status-select--${(draft.customData as any)?.status || 'draft'}`}
                                                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold' }}
                                                        >
                                                            <option value="draft">📁 Borrador / En Creación</option>
                                                            <option value="emitted">🔵 Emitido / Enviado</option>
                                                            <option value="received">🟢 Obtenido / Recibido</option>
                                                        </select>
                                                    </div>

                                                    {(draft.customData as any)?.status === 'received' && (
                                                        <div className="rd-commit-section">
                                                            {(draft.customData as any)?.stockCommitted ? (
                                                                <span className="rd-commit-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 'bold', fontSize: '11px' }}>
                                                                    <Check size={12} /> Stock Cargado
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleCommitStockToInventory(draft)}
                                                                    className="rd-btn rd-btn--success rd-btn--sm"
                                                                    style={{ padding: '6px 12px', fontSize: '11px', gap: '4px', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    <Layers size={11} /> Cargar Stock
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* ════════════════════════════════════════════
                    SUB-PAGE 3: Printable Letterhead Boleto
                    ════════════════════════════════════════════ */}
                {activeTab === 'boleto' && (
                    <section className="rd-boleto-console">
                        {drafts.length === 0 ? (
                            <div className="rd-hud-card rd-empty-state-card">
                                <Printer size={64} className="rd-empty-state-icon" />
                                <h3>No hay órdenes para previsualizar</h3>
                                <p>Cargá productos en un borrador de proveedor para habilitar la plantilla membretada del pedido de reposición.</p>
                                <button className="rd-btn rd-btn--primary mt-4" onClick={() => setActiveTab('selection')}>
                                    Ir al Catálogo
                                </button>
                            </div>
                        ) : (
                            <div className="rd-boleto-layout">
                                {/* Side panel for selecting preview target */}
                                <div className="rd-hud-card rd-boleto-sidebar">
                                    <h4 className="rd-boleto-sidebar-title">
                                        <Truck size={14} />
                                        Seleccionar Orden de Pedido
                                    </h4>
                                    <div className="rd-boleto-sidebar-list">
                                        {drafts.map(d => {
                                            const sId = d.id.replace('restock_draft_', '');
                                            const sName = d.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
                                            const isActive = activeBoletoDraft?.id === d.id;

                                            return (
                                                <button
                                                    key={d.id}
                                                    className={`rd-boleto-sidebar-btn ${isActive ? 'rd-boleto-sidebar-btn--active' : ''}`}
                                                    onClick={() => setBoletoSupplierId(sId)}
                                                >
                                                    <span className="material-symbols-rounded">receipt_long</span>
                                                    <div>
                                                        <span className="rd-btn-name">{sName}</span>
                                                        <span className="rd-btn-meta">{(d.customData?.rows || []).length} productos</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {activeBoletoDraft && (
                                        <>
                                            <div className="rd-toggles-card mt-2 mb-4" style={{ padding: '12px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                                <h5 className="rd-toggles-title" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                    ⚙️ Personalización A4
                                                </h5>
                                                <div className="rd-toggles-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <label className={`rd-toggle-item ${printOptions.showEmisor ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showEmisor}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showEmisor: !p.showEmisor }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Datos del Emisor</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showProveedor ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showProveedor}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showProveedor: !p.showProveedor }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Datos del Proveedor</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showCode ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showCode}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showCode: !p.showCode }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Código de Producto</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showPrice ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showPrice}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showPrice: !p.showPrice }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Costo Unitario</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showSubtotal ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showSubtotal}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showSubtotal: !p.showSubtotal }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Subtotales por Fila</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showTotal ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showTotal}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showTotal: !p.showTotal }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Total Estimado</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showNotes ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showNotes}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showNotes: !p.showNotes }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Observaciones / Notas</span>
                                                    </label>
                                                    <label className={`rd-toggle-item ${printOptions.showHandwritten ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={printOptions.showHandwritten}
                                                            onChange={() => setPrintOptions(p => ({ ...p, showHandwritten: !p.showHandwritten }))}
                                                            style={{ accentColor: '#10b981' }}
                                                        />
                                                        <span>Ajustes a Mano</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="rd-boleto-sidebar-actions">
                                                <button className="rd-btn rd-btn--success w-full" onClick={() => saveAsDocxToWorkspace(activeBoletoDraft)}>
                                                    <Check size={15} />
                                                    Emitir y Guardar en Workspace
                                                </button>
                                                <button className="rd-btn rd-btn--workspace w-full" onClick={() => exportToWord(activeBoletoDraft)}>
                                                    <Download size={15} />
                                                    Descargar Word (.doc)
                                                </button>
                                                <button className="rd-btn rd-btn--primary w-full" onClick={printBoleto}>
                                                    <Printer size={15} />
                                                    Imprimir / PDF
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Paper Letterhead Canvas */}
                                <div className="rd-paper-wrapper">
                                    {activeBoletoDraft ? (
                                        <div id="rd-paper-to-print" className="rd-paper-sheet">
                                            {/* Header / Logo */}
                                            <div className="rd-paper-header">
                                                <div className="rd-paper-header__logo">
                                                    {printOptions.showEmisor && shopInfo?.name ? shopInfo.name.toUpperCase() : 'FLORERÍA ASTER'}
                                                </div>
                                                <div className="rd-paper-header__subtitle">Orden de Compra y Reposición</div>
                                                <div className="rd-paper-header__line"></div>
                                            </div>

                                            {/* Metadata Grid */}
                                            <div className="rd-paper-meta-grid">
                                                {printOptions.showEmisor ? (
                                                    <div className="rd-paper-meta-section">
                                                        <p><strong>EMISOR:</strong> {shopInfo?.name || 'Florería Aster S.R.L.'}</p>
                                                        {shopInfo?.phone && <p><strong>Teléfono:</strong> {shopInfo.phone}</p>}
                                                        {shopInfo?.address && <p><strong>Dirección:</strong> {shopInfo.address}</p>}
                                                        {shopInfo?.instagram && <p><strong>Instagram:</strong> @{shopInfo.instagram.replace(/^@/, '')}</p>}
                                                        <p className="rd-paper-meta-hint" style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>Solicitado por: {user?.name || 'Administrador'}</p>
                                                    </div>
                                                ) : (
                                                    <div className="rd-paper-meta-section">
                                                        <p className="text-slate-400 italic" style={{ fontSize: '12px' }}>Datos de emisor ocultados</p>
                                                    </div>
                                                )}
                                                <div className="rd-paper-meta-section rd-paper-meta-section--right">
                                                    <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                    <p><strong>Hora:</strong> {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    <p>
                                                        <strong>Estado:</strong>{' '}
                                                        <span className={`rd-paper-status-badge rd-paper-status-badge--${(activeBoletoDraft.customData as any)?.status || 'draft'}`} style={{ textTransform: 'capitalize' }}>
                                                            {(activeBoletoDraft.customData as any)?.status === 'draft' ? 'Borrador' : (activeBoletoDraft.customData as any)?.status === 'emitted' ? 'Emitido' : (activeBoletoDraft.customData as any)?.status === 'received' ? 'Recibido' : 'Abierto'}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Provider Section */}
                                            {printOptions.showProveedor && (
                                                <div className="rd-paper-provider-block" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46', borderRadius: '0 6px 6px 0', fontSize: '13px' }}>
                                                    <Truck size={14} className="text-emerald-700" />
                                                    <span><strong>PROVEEDOR:</strong> {activeBoletoDraft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ').toUpperCase()}</span>
                                                </div>
                                            )}

                                            {/* Category Grouped Items */}
                                            <div className="rd-paper-content-list" style={{ marginTop: '1.5rem' }}>
                                                {Object.keys(groupedBoletoItems).length === 0 ? (
                                                    <div className="rd-paper-empty-items">
                                                        No hay ítems cargados en esta orden.
                                                    </div>
                                                ) : (
                                                    Object.entries(groupedBoletoItems).map(([category, items]) => (
                                                        <div key={category} className="rd-paper-category-group">
                                                            <h3 className="rd-paper-category-title">{category.toUpperCase()}</h3>
                                                            <table className="rd-paper-items-table">
                                                                <thead>
                                                                    <tr>
                                                                        {printOptions.showCode && <th style={{ width: '15%' }}>Código</th>}
                                                                        <th style={{ width: printOptions.showCode ? '45%' : '60%' }}>Producto</th>
                                                                        <th style={{ width: '15%' }} className="rd-txt-right">Cant.</th>
                                                                        {printOptions.showPrice && <th style={{ width: '12%' }} className="rd-txt-right">Cost. Un.</th>}
                                                                        {printOptions.showSubtotal && <th style={{ width: '13%' }} className="rd-txt-right">Subtotal</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((item: any) => (
                                                                        <tr key={item.id}>
                                                                            {printOptions.showCode && <td>{item.code}</td>}
                                                                            <td>
                                                                                {item.isCustom && <span className="rd-libre-badge-vfs mr-1">LIBRE</span>}
                                                                                {item.name}
                                                                            </td>
                                                                            <td className="rd-txt-right"><strong>{item.quantity}</strong></td>
                                                                            {printOptions.showPrice && <td className="rd-txt-right">${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>}
                                                                            {printOptions.showSubtotal && <td className="rd-txt-right">${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Grand Total */}
                                            {printOptions.showTotal && activeBoletoDraft.customData && (
                                                <div className="rd-paper-totals-box">
                                                    Total Estimado: <strong>${(activeBoletoDraft.customData.rows || []).reduce((sum: number, item: any) => sum + item.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {printOptions.showNotes && activeBoletoDraft.customData?.notes && (
                                                <div className="rd-paper-note-block">
                                                    <h4>📝 Observaciones del Pedido:</h4>
                                                    <p>{activeBoletoDraft.customData.notes}</p>
                                                </div>
                                            )}

                                            {/* Dotted lines for handwritten notes */}
                                            {printOptions.showHandwritten && (
                                                <div className="rd-paper-handwritten">
                                                    <h4>✍️ Ajustes y Notas a Mano (Espacio de Trabajo):</h4>
                                                    <div className="rd-paper-handwritten-dotted"></div>
                                                    <div className="rd-paper-handwritten-dotted"></div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rd-paper-sheet flex items-center justify-center">
                                            <p className="text-muted">Cargando previsualización...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

            </div>
        </div>
    );
};

export default RestockDesktop;
