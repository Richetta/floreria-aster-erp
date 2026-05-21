import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, Plus, Trash2, MessageCircle, FileSpreadsheet,
    ShoppingCart, PackageOpen, ChevronDown,
    ChevronUp, X, Check, Truck, RefreshCw,
    Filter, Download, Printer, Layers, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { ElPapelito } from './components/ElPapelito';
import './RestockMobile.css';

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

export const RestockMobile: React.FC = () => {
    const products = useStore(s => s.products);
    const suppliers = useStore(s => s.suppliers);
    const categoriesData = useStore(s => s.categoriesData) || [];
    const loadProducts = useStore(s => s.loadProducts);
    const loadSuppliers = useStore(s => s.loadSuppliers);
    const loadCategories = useStore(s => s.loadCategories);
    const addNotification = useStore(s => s.addNotification);
    const { user } = useAuth();
    const businessId = user?.business_id || 'default';

    // ── HUD State & Tabs ──
    const [activeTab, setActiveTab] = useState<'selection' | 'drafts' | 'boleto'>('selection');
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // ── Catalog Filters ──
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'low' | 'ok'>('all');

    // ── Mobile Expandable Filters ──
    const [filtersExpanded, setFiltersExpanded] = useState(false);

    // ── Checkbox Selection ──
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    
    // ── Bulk Assignment state ──
    const [bulkSupplierId, setBulkSupplierId] = useState('');
    const [bulkQuantity, setBulkQuantity] = useState(10);

    // ── Accordion expanded drafts ──
    const [expandedDrafts, setExpandedDrafts] = useState<Record<string, boolean>>({});

    // ── Boleto supplier preview selection ──
    const [boletoSupplierId, setBoletoSupplierId] = useState<string>('');

    // ── Inline Custom item form per draft ──
    const [customNameMap, setCustomNameMap] = useState<Record<string, string>>({});
    const [customQtyMap, setCustomQtyMap] = useState<Record<string, string>>({});
    const [customCostMap, setCustomCostMap] = useState<Record<string, string>>({});

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
        if (!window.confirm('¿Estás seguro de que querés eliminar este borrador?')) return;
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

    // ── Generate Stock Alerts ──
    const stockAlerts = useMemo((): StockAlert[] => {
        return products
            .filter(p => {
                const matchSearch = !searchQuery ||
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
                
                // Recursive category matcher helper
                const getCategoryWithDescendants = (catName: string): string[] => {
                    const matchingCat = categoriesData.find(c => c.name === catName);
                    if (!matchingCat) return [catName];
                    
                    const names = [matchingCat.name];
                    const collectChildren = (parentId: string) => {
                        const children = categoriesData.filter(c => c.parent_id === parentId);
                        children.forEach(ch => {
                            names.push(ch.name);
                            collectChildren(ch.id);
                        });
                    };
                    collectChildren(matchingCat.id);
                    return names;
                };

                const allowedCategories = selectedCategory ? getCategoryWithDescendants(selectedCategory) : [];
                const matchCat = !selectedCategory || allowedCategories.includes(p.category || '');
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
    }, [products, suppliers, searchQuery, selectedCategory, selectedTag, selectedSupplierFilter, urgencyFilter, categoriesData]);

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

            const existingIdx = draftItems.findIndex(item => item.id === id);
            if (existingIdx > -1) {
                draftItems[existingIdx].quantity += Number(bulkQuantity) || 10;
                draftItems[existingIdx].total = draftItems[existingIdx].quantity * draftItems[existingIdx].cost;
            } else {
                draftItems.push({
                    id: alert.id,
                    code: alert.code,
                    name: alert.name,
                    quantity: Number(bulkQuantity) || 10,
                    supplierName,
                    cost: alert.cost,
                    total: (Number(bulkQuantity) || 10) * alert.cost,
                    isCustom: false
                });
            }
        });

        saveVFSDraft(supplierId, supplierName, draftItems, existingNotes, existingLeadTime);
        setSelectedProductIds([]);
        addNotification(`Productos agregados al borrador de ${supplierName}`, 'success');
        
        // Open this draft accordion automatically so they see it
        setExpandedDrafts(prev => ({ ...prev, [draftId]: true }));
        setActiveTab('drafts');
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
        const suggested = Math.max(10, (alert.minStock * 2) - alert.stock);

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

        const grouped: Record<string, any[]> = {};
        items.forEach((item: any) => {
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
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background-color: #4F7A5A; color: #ffffff; font-size: 11px; text-align: left; padding: 6px; border: 1px solid #cbd5e1; }
    td { padding: 6px; border: 1px solid #e4e4e7; font-size: 12px; }
    .txt-right { text-align: right; }
    .total-box { text-align: right; font-weight: bold; font-size: 14px; margin-top: 20px; padding: 10px; background-color: #f4f4f5; border: 1px solid #e4e4e7; }
    .note-box { border: 1px solid #fed7aa; background-color: #fff7ed; padding: 10px; border-radius: 4px; margin-top: 15px; font-size: 11px; }
</style>
</head>
<body>
    <h1>FLORERÍA ASTER</h1>
    <div class="subtitle">Orden de Compra y Reposición (Móvil)</div>
    <table class="meta-box">
        <tr>
            <td style="border:none; width:50%; vertical-align:top;">
                <strong>EMISOR:</strong> Florería Aster S.R.L.<br>
                <strong>Solicitante:</strong> ${user?.name || 'Administrador'}<br>
                <strong>Fecha:</strong> ${dateStr} - ${hourStr}
            </td>
            <td style="border:none; width:50%; vertical-align:top; text-align:right;">
                <strong>${supplierInfo.replace(/\n/g, '<br>')}</strong><br>
                <strong>Estado:</strong> <span style="color:#15803d; font-weight:bold;">Abierto / En Proceso</span>
            </td>
        </tr>
    </table>
`;

        Object.entries(grouped).forEach(([category, catItems]) => {
            docContent += `
    <h3 style="color:#4F7A5A; border-bottom: 2px solid #4F7A5A; padding-bottom: 4px; margin-top: 20px;">${category.toUpperCase()}</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 15%;">Código</th>
                <th style="width: 50%;">Producto</th>
                <th style="width: 10%; text-align: right;">Cant.</th>
                <th style="width: 12%; text-align: right;">Costo Unit.</th>
                <th style="width: 13%; text-align: right;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
`;
            catItems.forEach((i: any) => {
                docContent += `
            <tr>
                <td><code>${i.code}</code></td>
                <td><strong>${i.name}</strong> ${i.isCustom ? ' (Manual)' : ''}</td>
                <td style="text-align: right;">${i.quantity}</td>
                <td style="text-align: right;">$${i.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right;">$${i.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
`;
            });
            docContent += `</tbody></table>`;
        });

        const total = items.reduce((s, i) => s + (i.quantity * i.cost), 0);
        docContent += `<div class="total-box">TOTAL ESTIMADO DE LA COMPRA: $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>`;

        if (draft.customData?.notes) {
            docContent += `
    <div class="note-box">
        <div style="font-weight: bold; color: #c2410c; margin-bottom: 3px;">📝 OBSERVACIONES:</div>
        <div>${draft.customData.notes}</div>
    </div>
`;
        }

        docContent += `</body></html>`;

        const blob = new Blob(['\ufeff' + docContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Pedido_${supplierName.replace(/\s+/g, '_')}_Movil.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addNotification('Pedido exportado en formato de Microsoft Word', 'success');
    };

    // ── Toggle Draft Accordion ──
    const toggleDraftAccordion = (id: string) => {
        setExpandedDrafts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // ── Get Active Draft for Boleto Letterhead View ──
    const activeBoletoDraft = useMemo(() => {
        if (!boletoSupplierId) {
            if (drafts.length > 0) {
                const sId = drafts[0].id.replace('restock_draft_', '');
                setBoletoSupplierId(sId);
                return drafts[0];
            }
            return null;
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
        <div className="rm-root">
            {/* ── Mobile HUD Top Bar ── */}
            <header className="rm-header">
                <div className="rm-header__left">
                    <h1 className="rm-header__title">
                        <span className="material-symbols-rounded">dashboard</span>
                        Reposición HUD
                    </h1>
                    <span className="rm-header__subtitle">Sincronizado VFS / Workspace</span>
                </div>
                <div className="rm-header__actions">
                    <button 
                        className="rm-action-btn"
                        onClick={() => { setRefreshKey(prev => prev + 1); addNotification('Workspace VFS actualizado', 'success'); }}
                        title="Sincronizar"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <Link to="/workspace" className="rm-workspace-link" title="Abrir Workspace">
                        <FileSpreadsheet size={18} />
                    </Link>
                </div>
            </header>

            {/* ── Sub Navigation Tabs ── */}
            <div className="rm-tabs-nav">
                <button 
                    className={`rm-tab-btn ${activeTab === 'selection' ? 'rm-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('selection')}
                >
                    <Layers size={16} />
                    <span>Catálogo ({stockAlerts.length})</span>
                </button>
                <button 
                    className={`rm-tab-btn ${activeTab === 'drafts' ? 'rm-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('drafts')}
                >
                    <ShoppingCart size={16} />
                    <span>Borradores ({drafts.length})</span>
                </button>
                <button 
                    className={`rm-tab-btn ${activeTab === 'boleto' ? 'rm-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab('boleto')}
                >
                    <Printer size={16} />
                    <span>Boleto</span>
                </button>
            </div>

            {/* ── Main Content Area ── */}
            <main className="rm-main">

                {/* ════════════════════════════════════════════
                    SUB-PAGE 1: Catalog & Stock Selection
                    ════════════════════════════════════════════ */}
                {activeTab === 'selection' && (
                    <section className="rm-selection-view animate-fade-in">
                        
                        {/* Filters Header toggle */}
                        <div className="rm-hud-card rm-filters-card">
                            <div className="rm-filters-toggle" onClick={() => setFiltersExpanded(!filtersExpanded)}>
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-emerald" />
                                    <span className="font-bold text-sm">Filtros Avanzados</span>
                                </div>
                                <div className="text-muted">
                                    {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {(filtersExpanded || searchQuery || selectedCategory || selectedTag || selectedSupplierFilter || urgencyFilter !== 'all') && (
                                <div className="rm-filters-expanded-fields animate-slide-down">
                                    <div className="rm-filter-field">
                                        <label>Buscar Producto</label>
                                        <div className="rm-search-wrapper">
                                            <Search size={14} className="rm-search-icon" />
                                            <input 
                                                type="text"
                                                placeholder="Nombre o código..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="rm-input rm-input--with-icon"
                                            />
                                            {searchQuery && (
                                                <button className="rm-clear-btn" onClick={() => setSearchQuery('')}>
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="rm-filter-field">
                                        <label>Categoría / Carpeta</label>
                                        <select className="rm-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                            <option value="">📁 Todas las categorías</option>
                                            {categoryOptions.map(c => <option key={c.id} value={c.name}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="rm-filter-field">
                                        <label>Etiqueta</label>
                                        <select className="rm-input" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                            <option value="">🏷️ Todas las etiquetas</option>
                                            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="rm-filter-field">
                                        <label>Proveedor</label>
                                        <select className="rm-input" value={selectedSupplierFilter} onChange={e => setSelectedSupplierFilter(e.target.value)}>
                                            <option value="">🚛 Todos los proveedores</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="rm-filter-field">
                                        <label>Urgencia de Stock</label>
                                        <select className="rm-input" value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value as any)}>
                                            <option value="all">Ver todo el catálogo</option>
                                            <option value="critical">🔴 Sin Stock</option>
                                            <option value="low">🟡 Stock Bajo</option>
                                            <option value="ok">🟢 Stock Óptimo</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Master Selector Bar */}
                        <div className="rm-master-select-bar">
                            <span className="text-xs text-muted">
                                Mostrando <strong>{stockAlerts.length}</strong> productos
                            </span>
                            {stockAlerts.length > 0 && (
                                <button className="rm-btn-select-all" onClick={handleSelectAllVisible}>
                                    {stockAlerts.every(a => selectedProductIds.includes(a.id)) ? 'Deseleccionar todos' : 'Seleccionar visibles'}
                                </button>
                            )}
                        </div>

                        {/* Compact Cards Grid for Catalog items */}
                        <div className="rm-catalog-list">
                            {loading ? (
                                <div className="rm-loading-box">
                                    <div className="rm-spinner" />
                                    <p>Sincronizando existencias...</p>
                                </div>
                            ) : stockAlerts.length === 0 ? (
                                <div className="rm-empty-box">
                                    <PackageOpen size={48} className="text-muted mb-2" />
                                    <h4>Sin productos que mostrar</h4>
                                    <p className="text-xs text-muted">Ajustá los filtros o el estado de búsqueda</p>
                                </div>
                            ) : (
                                stockAlerts.map(alert => {
                                    const isSelected = selectedProductIds.includes(alert.id);
                                    const inAnyDraft = drafts.some(d => d.customData?.rows?.some((r: any) => r.id === alert.id));
                                    
                                    return (
                                        <div 
                                            key={alert.id}
                                            className={`rm-catalog-card rm-card--${alert.urgency} ${isSelected ? 'rm-catalog-card--selected' : ''}`}
                                            onClick={() => handleSelectProduct(alert.id)}
                                        >
                                            <div className="rm-card-checkbox" onClick={e => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectProduct(alert.id)}
                                                />
                                            </div>
                                            <div className="rm-card-body">
                                                <div className="rm-card-header">
                                                    <span className="rm-card-code"><code>{alert.code}</code></span>
                                                    {alert.urgency === 'critical' && <span className="rm-badge rm-badge--critical">Sin Stock</span>}
                                                    {alert.urgency === 'low' && <span className="rm-badge rm-badge--low">Bajo</span>}
                                                    {alert.urgency === 'ok' && <span className="rm-badge rm-badge--ok">OK</span>}
                                                </div>
                                                <h4 className="rm-card-name">{alert.name}</h4>
                                                <div className="rm-card-meta">
                                                    <span>📁 {alert.category}</span>
                                                    {alert.supplierName && <span>🚛 {alert.supplierName}</span>}
                                                </div>
                                                <div className="rm-card-stock-grid">
                                                    <div>
                                                        <span className="rm-grid-label">Stock Actual</span>
                                                        <span className="rm-grid-val font-bold">{alert.stock}</span>
                                                    </div>
                                                    <div>
                                                        <span className="rm-grid-label">Mínimo</span>
                                                        <span className="rm-grid-val text-muted">{alert.minStock}</span>
                                                    </div>
                                                    <div>
                                                        <span className="rm-grid-label">Costo Ref.</span>
                                                        <span className="rm-grid-val font-mono">${alert.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rm-card-action" onClick={e => e.stopPropagation()}>
                                                <button
                                                    className={`rm-quick-add ${inAnyDraft ? 'rm-quick-add--in-draft' : ''}`}
                                                    onClick={() => handleQuickAdd(alert)}
                                                    title="Agregar rápido"
                                                >
                                                    {inAnyDraft ? <Check size={16} /> : <Plus size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Floating bottom command bar for mobile */}
                        <div className={`rm-floating-bar ${selectedProductIds.length > 0 ? 'rm-floating-bar--visible' : ''}`}>
                            <div className="rm-floating-bar__content">
                                <div className="rm-floating-bar__header">
                                    <div className="flex items-center gap-2">
                                        <span className="rm-floating-bar__count">{selectedProductIds.length}</span>
                                        <span className="font-bold text-xs text-slate-800">Seleccionados</span>
                                    </div>
                                    <button className="rm-floating-bar__close" onClick={() => setSelectedProductIds([])}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="rm-floating-bar__controls">
                                    <div className="rm-floating-field">
                                        <Truck size={14} className="rm-field-icon" />
                                        <select
                                            value={bulkSupplierId}
                                            onChange={e => setBulkSupplierId(e.target.value)}
                                            className="rm-floating-select"
                                        >
                                            <option value="">Vincular a Sin Proveedor</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="rm-floating-field">
                                        <Layers size={14} className="rm-field-icon" />
                                        <input 
                                            type="number"
                                            min={1}
                                            value={bulkQuantity}
                                            onChange={e => setBulkQuantity(parseInt(e.target.value) || 1)}
                                            className="rm-floating-qty"
                                            placeholder="Cant."
                                        />
                                    </div>
                                    <button className="rm-btn rm-btn--primary w-full py-3 mt-1" onClick={handleBulkAdd}>
                                        <Plus size={16} />
                                        <span>Agregar al Pedido</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ════════════════════════════════════════════
                    SUB-PAGE 2: VFS Active Draft Carts (Borradores)
                    ════════════════════════════════════════════ */}
                {activeTab === 'drafts' && (
                    <section className="rm-drafts-view animate-fade-in">
                        {drafts.length === 0 ? (
                            <div className="rm-hud-card rm-empty-state-mobile">
                                <ShoppingCart size={48} className="text-emerald mb-2" />
                                <h3>No hay borradores activos</h3>
                                <p className="text-xs text-muted mb-4">
                                    Agregá productos desde el catálogo para crear planillas de compras en el Workspace virtual.
                                </p>
                                <button className="rm-btn rm-btn--primary" onClick={() => setActiveTab('selection')}>
                                    <Layers size={16} />
                                    Explorar Catálogo
                                </button>
                            </div>
                        ) : (
                            <div className="rm-drafts-accordion-list">
                                {drafts.map(draft => {
                                    const draftId = draft.id;
                                    const supplierId = draftId.replace('restock_draft_', '');
                                    const supplierName = draft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
                                    const items = draft.customData?.rows || [];
                                    const totalEstimated = items.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
                                    const isExpanded = !!expandedDrafts[draftId];

                                    return (
                                        <div key={draftId} className="rm-hud-card rm-draft-accordion-card">
                                            {/* Accordion header */}
                                            <div className="rm-draft-acc-header" onClick={() => toggleDraftAccordion(draftId)}>
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-rounded text-emerald">receipt_long</span>
                                                    <div>
                                                        <h4 className="rm-draft-title">{supplierName}</h4>
                                                        <p className="rm-draft-meta-text">
                                                            {items.length} ítems · Est: <strong>${totalEstimated.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</strong>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div>
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </div>
                                            </div>

                                            {/* Expandable panel */}
                                            {isExpanded && (
                                                <div className="rm-draft-acc-content animate-slide-down">
                                                    {/* Top buttons */}
                                                    <div className="rm-draft-action-buttons">
                                                        <button 
                                                            className="rm-btn rm-btn--ghost flex-1 py-2 text-xs"
                                                            onClick={() => generateWAMessage(draft)}
                                                        >
                                                            <MessageCircle size={14} className="text-emerald" />
                                                            <span>WhatsApp</span>
                                                        </button>
                                                        <button 
                                                            className="rm-btn rm-btn--ghost flex-1 py-2 text-xs"
                                                            onClick={() => {
                                                                setBoletoSupplierId(supplierId);
                                                                setActiveTab('boleto');
                                                            }}
                                                        >
                                                            <Eye size={14} />
                                                            <span>Boleto</span>
                                                        </button>
                                                        <button 
                                                            className="rm-btn rm-btn--ghost flex-1 py-2 text-xs"
                                                            onClick={() => exportToWord(draft)}
                                                        >
                                                            <Download size={14} />
                                                            <span>Word</span>
                                                        </button>
                                                        <button 
                                                            className="rm-btn rm-btn--danger-ghost py-2"
                                                            onClick={() => deleteVFSDraft(draftId)}
                                                            title="Eliminar borrador"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Items density list */}
                                                    <div className="rm-draft-items-box">
                                                        {items.length === 0 ? (
                                                            <p className="text-center text-xs text-muted py-4">Borrador vacío</p>
                                                        ) : (
                                                            items.map((item: any) => (
                                                                <div key={item.id} className="rm-draft-item-row">
                                                                    <div className="rm-draft-item-info">
                                                                        <span className="rm-draft-item-code">
                                                                            {item.isCustom && <span className="rm-custom-label">LIBRE</span>}
                                                                            <code>{item.code}</code>
                                                                        </span>
                                                                        <span className="rm-draft-item-name">{item.name}</span>
                                                                    </div>
                                                                    <div className="rm-draft-item-inputs">
                                                                        <div className="rm-draft-input-group">
                                                                            <label>Cant.</label>
                                                                            <input 
                                                                                type="number"
                                                                                min={1}
                                                                                value={item.quantity}
                                                                                onChange={e => handleUpdateDraftItem(draftId, item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                                            />
                                                                        </div>
                                                                        <div className="rm-draft-input-group">
                                                                            <label>Cost.</label>
                                                                            <input 
                                                                                type="number"
                                                                                min={0}
                                                                                value={item.cost}
                                                                                onChange={e => handleUpdateDraftItem(draftId, item.id, 'cost', parseFloat(e.target.value) || 0)}
                                                                            />
                                                                        </div>
                                                                        <button 
                                                                            className="rm-draft-item-delete-btn"
                                                                            onClick={() => handleRemoveDraftItem(draftId, item.id)}
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    {/* Custom item inline adder */}
                                                    <div className="rm-draft-manual-form">
                                                        <h5 className="rm-form-sec-title">Agregar producto manual</h5>
                                                        <div className="rm-form-row">
                                                            <input 
                                                                type="text"
                                                                placeholder="Nombre producto..."
                                                                value={customNameMap[draftId] || ''}
                                                                onChange={e => setCustomNameMap({ ...customNameMap, [draftId]: e.target.value })}
                                                                className="rm-input flex-2"
                                                            />
                                                            <input 
                                                                type="number"
                                                                placeholder="Cant"
                                                                value={customQtyMap[draftId] || ''}
                                                                onChange={e => setCustomQtyMap({ ...customQtyMap, [draftId]: e.target.value })}
                                                                className="rm-input flex-1"
                                                            />
                                                            <input 
                                                                type="number"
                                                                placeholder="Cost"
                                                                value={customCostMap[draftId] || ''}
                                                                onChange={e => setCustomCostMap({ ...customCostMap, [draftId]: e.target.value })}
                                                                className="rm-input flex-1"
                                                            />
                                                            <button 
                                                                className="rm-btn rm-btn--primary px-3 py-2"
                                                                onClick={() => handleAddCustomItem(draftId)}
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Lead Time & Notes */}
                                                    <div className="rm-draft-meta-settings">
                                                        <div className="rm-meta-setting-field">
                                                            <label>⏱️ Plazo de Entrega (Días / Texto)</label>
                                                            <input 
                                                                type="text"
                                                                placeholder="Ej: 3 días, inmediato..."
                                                                value={draft.customData?.leadTime || ''}
                                                                onChange={e => handleUpdateDraftLeadTime(draftId, e.target.value)}
                                                                className="rm-input"
                                                            />
                                                        </div>
                                                        <div className="rm-meta-setting-field">
                                                            <label>📝 Observaciones y Comentarios</label>
                                                            <textarea 
                                                                rows={2}
                                                                placeholder="Instrucciones especiales para el proveedor..."
                                                                value={draft.customData?.notes || ''}
                                                                onChange={e => handleUpdateDraftNotes(draftId, e.target.value)}
                                                                className="rm-input"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
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
                    <section className="rm-boleto-view animate-fade-in">
                        {drafts.length === 0 ? (
                            <div className="rm-hud-card rm-empty-state-mobile">
                                <Printer size={48} className="text-muted mb-2" />
                                <h3>No hay datos para boleto</h3>
                                <p className="text-xs text-muted mb-4">
                                    Primero debés generar o agregar productos a un borrador activo.
                                </p>
                            </div>
                        ) : (
                            <div className="rm-boleto-container">
                                {/* Selector of active draft to preview */}
                                <div className="rm-hud-card p-3 mb-3">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Previsualizar Proveedor:</label>
                                    <select 
                                        value={boletoSupplierId}
                                        onChange={e => setBoletoSupplierId(e.target.value)}
                                        className="rm-input w-full"
                                    >
                                        {drafts.map(d => {
                                            const sId = d.id.replace('restock_draft_', '');
                                            const sName = d.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ');
                                            return <option key={d.id} value={sId}>{sName}</option>;
                                        })}
                                    </select>
                                    <button 
                                        className="rm-btn rm-btn--primary w-full py-3 mt-3 flex items-center justify-center gap-2"
                                        onClick={() => window.print()}
                                    >
                                        <Printer size={16} />
                                        <span>Imprimir / Exportar PDF</span>
                                    </button>
                                </div>

                                {/* Paper Sheet Mockup */}
                                <div className="rm-paper-canvas">
                                    {activeBoletoDraft ? (
                                        <div className="rm-paper-sheet">
                                            {/* Watermark Logo */}
                                            <div className="rm-paper-watermark">ASTER</div>
                                            
                                            {/* Header */}
                                            <div className="rm-paper-header">
                                                <div className="rm-paper-brand">
                                                    <h3>FLORERÍA ASTER</h3>
                                                    <span className="rm-paper-tagline">DISEÑO Y GESTIÓN FLORAL PREMIUM</span>
                                                </div>
                                                <div className="rm-paper-doc-type">
                                                    <h4>ORDEN DE COMPRA</h4>
                                                    <span>Virtual Sync ID: {activeBoletoDraft.id}</span>
                                                </div>
                                            </div>

                                            {/* Meta data row */}
                                            <div className="rm-paper-info-grid">
                                                <div>
                                                    <span className="rm-paper-info-title">EMISOR</span>
                                                    <p><strong>Florería Aster S.R.L.</strong></p>
                                                    <p>Solicitante: {user?.name || 'Administrador'}</p>
                                                    <p>Email: {user?.email || 'aster@business.com'}</p>
                                                </div>
                                                <div>
                                                    <span className="rm-paper-info-title">PROVEEDOR RECEPTOR</span>
                                                    <p><strong>{activeBoletoDraft.name.replace('Borrador_Pedido_', '').replace('.xlsx', '').replace(/_/g, ' ').toUpperCase()}</strong></p>
                                                    <p>Plazo de Entrega: {activeBoletoDraft.customData?.leadTime || 'Coordinar'}</p>
                                                    <p>Fecha: {new Date().toLocaleDateString('es-AR')}</p>
                                                </div>
                                            </div>

                                            {/* Products grouped */}
                                            <div className="rm-paper-details">
                                                {Object.entries(groupedBoletoItems).map(([category, catItems]) => (
                                                    <div key={category} className="rm-paper-group">
                                                        <h5 className="rm-paper-group-title">{category.toUpperCase()}</h5>
                                                        <div className="rm-paper-table-wrap">
                                                            <table className="rm-paper-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Código</th>
                                                                        <th>Detalle del Ítem</th>
                                                                        <th className="text-right">Cant</th>
                                                                        <th className="text-right">Costo U.</th>
                                                                        <th className="text-right">Total</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {catItems.map((i: any) => (
                                                                        <tr key={i.id}>
                                                                            <td><code>{i.code}</code></td>
                                                                            <td>
                                                                                <strong>{i.name}</strong>
                                                                                {i.isCustom && <span className="text-[10px] ml-1 text-slate-400 font-normal">(Manual)</span>}
                                                                            </td>
                                                                            <td className="text-right font-bold">{i.quantity}</td>
                                                                            <td className="text-right font-mono">${i.cost.toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                                                                            <td className="text-right font-mono font-bold">${i.total.toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Summary Box */}
                                            <div className="rm-paper-summary-box">
                                                <div className="rm-summary-row">
                                                    <span>Total Estimado de Importación:</span>
                                                    <strong className="text-emerald font-mono">
                                                        ${(activeBoletoDraft.customData?.rows || []).reduce((sum: number, r: any) => sum + r.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </strong>
                                                </div>
                                            </div>

                                            {/* Observaciones */}
                                            {activeBoletoDraft.customData?.notes && (
                                                <div className="rm-paper-observations">
                                                    <strong>📝 Observaciones Especiales:</strong>
                                                    <p>{activeBoletoDraft.customData.notes}</p>
                                                </div>
                                            )}

                                            {/* Handwritten grid */}
                                            <div className="rm-paper-handwritten">
                                                <strong>✍️ Ajustes y Recepción (Anotaciones Físicas):</strong>
                                                <div className="rm-paper-handwritten-line"></div>
                                                <div className="rm-paper-handwritten-line"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-xs text-muted py-6">Cargando borrador...</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

            </main>

            {/* Sticky Yellow Notes component */}
            <ElPapelito />
        </div>
    );
};
