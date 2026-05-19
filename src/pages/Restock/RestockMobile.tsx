import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import './RestockMobile.css';

interface RestockItem {
    id: string;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    cost: number;
    suggestedAmount: number;
    runoutDays: number;
    mermaRate: number;
    category: string;
}

interface SupplierRestock {
    supplierId: string | null;
    supplierName: string;
    supplierPhone: string | null;
    items: RestockItem[];
}

export const RestockMobile: React.FC = () => {
    const suppliers = useStore(state => state.suppliers);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const products = useStore(state => state.products);
    const loadProducts = useStore(state => state.loadProducts);
    const updateProduct = useStore(state => state.updateProduct);
    const addProduct = useStore(state => state.addProduct);
    const categoriesData = useStore(state => state.categoriesData) || [];
    const loadCategories = useStore(state => state.loadCategories);
    const addNotification = useStore(state => state.addNotification);
    const { user } = useAuth();
    const businessId = user?.business_id || 'default_business';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

    // Replenishment strategy & filters
    const [strategy, setStrategy] = useState<'critical' | 'predictive' | 'mermas'>('predictive');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');

    // Bulk assignment
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [targetSupplierId, setTargetSupplierId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    // Supplier specific settings: lead time (days) and custom notes
    const [leadTimes, setLeadTimes] = useState<Record<string, number>>(() => {
        const stored = localStorage.getItem(`restock_lead_times_${businessId}`);
        return stored ? JSON.parse(stored) : {};
    });
    const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});

    // New product drawer state
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newProductCode, setNewProductCode] = useState('');
    const [newProductCost, setNewProductCost] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductStock, setNewProductStock] = useState('');
    const [newProductMinStock, setNewProductMinStock] = useState('');
    const [newProductCategory, setNewProductCategory] = useState('');
    const [newProductSupplierId, setNewProductSupplierId] = useState('');

    // VFS Success indicator
    const [successVFSItem, setSuccessVFSItem] = useState<{ supplierName: string; filename: string } | null>(null);

    const fetchRestock = async () => {
        try {
            setLoading(true);
            await Promise.allSettled([
                loadProducts(),
                loadSuppliers(),
                loadCategories ? loadCategories(true) : Promise.resolve()
            ]);
            setError(null);
        } catch (err: any) {
            setError('Error al obtener faltantes');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestock();
    }, []);

    // Save lead times
    const handleSetLeadTime = (supplierId: string, days: number) => {
        const updated = { ...leadTimes, [supplierId]: days };
        setLeadTimes(updated);
        localStorage.setItem(`restock_lead_times_${businessId}`, JSON.stringify(updated));
    };

    // Calculate suggested stock amount based on strategy
    const restockData = useMemo(() => {
        const grouped: Record<string, SupplierRestock> = {};

        const filteredProducts = products.filter(p => {
            const matchesSearch = !searchQuery || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = !selectedCategory || p.category === selectedCategory;
            const matchesSupplier = !selectedSupplierFilter || p.supplierId === selectedSupplierFilter;

            return matchesSearch && matchesCategory && matchesSupplier;
        });

        filteredProducts.forEach(p => {
            const supplierId = p.supplierId || 'unassigned';
            const leadTime = leadTimes[supplierId] || 3;

            const dailySales = p.weeklySales ? (p.weeklySales / 7) : 0.4;
            const runoutDays = dailySales > 0 ? (p.stock / dailySales) : 999;
            const mermaRate = p.category?.toLowerCase().includes('flor') ? 0.12 : 0.05;

            // Suggested Restocking Amount
            let suggestedAmount = 0;
            let triggerRestock = false;

            if (strategy === 'critical') {
                triggerRestock = p.stock <= p.min;
                suggestedAmount = triggerRestock ? (p.min * 2 - p.stock) : 0;
            } else if (strategy === 'predictive') {
                triggerRestock = runoutDays <= (leadTime + 5) || p.stock <= p.min;
                suggestedAmount = Math.ceil(dailySales * 15) - p.stock;
            } else {
                triggerRestock = runoutDays <= (leadTime + 5) || p.stock <= p.min;
                const baseReplenish = Math.ceil(dailySales * 15) - p.stock;
                suggestedAmount = Math.ceil(baseReplenish * (1 + mermaRate));
            }

            if (suggestedAmount < 0) suggestedAmount = 0;
            if (suggestedAmount === 0 && triggerRestock) suggestedAmount = 10;

            const shouldShow = strategy === 'critical' ? p.stock <= p.min : (p.stock <= p.min || runoutDays <= (leadTime + 7));

            if (shouldShow) {
                if (!grouped[supplierId]) {
                    const supplier = suppliers.find(s => s.id === supplierId);
                    grouped[supplierId] = {
                        supplierId: supplierId === 'unassigned' ? null : supplierId,
                        supplierName: supplier ? supplier.name : 'Sin Proveedor Asignado',
                        supplierPhone: supplier ? supplier.phone : null,
                        items: []
                    };
                }
                grouped[supplierId].items.push({
                    id: p.id,
                    code: p.code || 'S/C',
                    name: p.name,
                    stock: p.stock ?? 0,
                    minStock: p.min ?? 0,
                    cost: p.cost || 0,
                    suggestedAmount,
                    runoutDays,
                    mermaRate,
                    category: p.category
                });
            }
        });

        return Object.values(grouped).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    }, [products, suppliers, strategy, searchQuery, selectedCategory, selectedSupplierFilter, leadTimes]);

    // Handle inline update
    const handleInlineUpdate = async (productId: string, field: 'stock' | 'min' | 'cost', value: number) => {
        try {
            await updateProduct(productId, { [field === 'min' ? 'min' : field]: value });
        } catch (error) {
            console.error('Error updating in-line value:', error);
        }
    };

    // Fast product creation
    const handleFastCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProductName.trim()) {
            addNotification('El nombre es obligatorio', 'warning');
            return;
        }

        try {
            await addProduct({
                name: newProductName,
                code: newProductCode || `P-${Date.now().toString().slice(-4)}`,
                category: newProductCategory || 'Flores Frescas',
                price: parseFloat(newProductPrice) || 0,
                cost: parseFloat(newProductCost) || 0,
                stock: parseInt(newProductStock) || 0,
                min: parseInt(newProductMinStock) || 10,
                tags: [],
                supplierId: newProductSupplierId || undefined
            });

            setIsDrawerOpen(false);
            setNewProductName('');
            setNewProductCode('');
            setNewProductCost('');
            setNewProductPrice('');
            setNewProductStock('');
            setNewProductMinStock('');
            setNewProductCategory('');
            setNewProductSupplierId('');
            
            await fetchRestock();
        } catch (error) {
            console.error('Error creating product in-line:', error);
        }
    };

    // Save to Workspace
    const handleSaveToWorkspace = (supplier: SupplierRestock) => {
        const itemsKey = `explorer_custom_items_${businessId}`;
        const storedItems = localStorage.getItem(itemsKey);
        let customItemsList = [];
        if (storedItems) {
            try {
                customItemsList = JSON.parse(storedItems);
            } catch (e) {
                console.error(e);
            }
        }

        const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        const filename = `Pedido_${supplier.supplierName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

        const columns = [
            { key: 'code', label: 'Código', width: 120 },
            { key: 'name', label: 'Producto', width: 250 },
            { key: 'quantity', label: 'Cantidad a Pedir', width: 130, align: 'right', badge: true },
            { key: 'cost', label: 'Costo Unitario ($)', width: 130, align: 'right', format: 'currency' },
            { key: 'total', label: 'Total Estimado ($)', width: 140, align: 'right', format: 'currency' }
        ];

        const rows = supplier.items.map(item => ({
            id: item.id,
            code: item.code,
            name: item.name,
            quantity: item.suggestedAmount,
            cost: item.cost,
            total: item.suggestedAmount * item.cost
        }));

        const newFile = {
            id: `restock_order_${supplier.supplierId || 'unassigned'}_${Date.now()}`,
            name: filename,
            parentId: 'proveedores_folder',
            type: 'file',
            entity: 'custom',
            description: `Orden de reposición sugerida para ${supplier.supplierName}. Notas: ${orderNotes[supplier.supplierId || ''] || 'Sin notas'}.`,
            color: '#fef3c7',
            isCustom: true,
            customData: {
                columns,
                rows
            }
        };

        customItemsList.push(newFile);
        localStorage.setItem(itemsKey, JSON.stringify(customItemsList));

        setSuccessVFSItem({
            supplierName: supplier.supplierName,
            filename
        });
        addNotification('Pedido guardado exitosamente en el Workspace virtual', 'success');

        setTimeout(() => {
            setSuccessVFSItem(null);
        }, 5000);
    };

    const generateWhatsAppLink = (supplier: SupplierRestock) => {
        if (!supplier.supplierPhone) return '#';
        const lead = leadTimes[supplier.supplierId || ''] || 3;
        const notes = orderNotes[supplier.supplierId || ''] || '';

        let message = `*FLORERÍA MI JARDÍN - ORDEN DE REPOSICIÓN*\n`;
        message += `Hola ${supplier.supplierName}, deseo coordinar la entrega de los siguientes artículos:\n\n`;

        let totalEstimado = 0;
        supplier.items.forEach(item => {
            const totalItem = item.suggestedAmount * item.cost;
            totalEstimado += totalItem;
            message += `- *${item.suggestedAmount}x* _${item.name}_ (Cod: ${item.code}) | Costo ref: $${item.cost.toLocaleString('es-AR')}\n`;
        });

        message += `\n💰 *Total Estimado*: $${totalEstimado.toLocaleString('es-AR')}\n`;
        message += `⏰ *Plazo de entrega solicitado*: ${lead} días hábiles.\n`;
        
        if (notes.trim()) {
            message += `📌 *Nota adjunta*: ${notes}\n`;
        }
        
        message += `\nQuedo a la espera de tu confirmación de stock y costos. ¡Muchas gracias!`;

        return `https://wa.me/${supplier.supplierPhone}?text=${encodeURIComponent(message)}`;
    };

    const handleToggleProduct = (productId: string) => {
        setSelectedProducts(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

    const handleToggleAllUnassigned = (unassignedItems: RestockItem[]) => {
        if (selectedProducts.length === unassignedItems.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts(unassignedItems.map(item => item.id));
        }
    };

    const handleBulkAssign = async () => {
        if (selectedProducts.length === 0) {
            addNotification('Selecciona al menos un producto', 'warning');
            return;
        }
        if (!targetSupplierId) {
            addNotification('Selecciona un proveedor', 'warning');
            return;
        }

        try {
            setIsAssigning(true);
            await api.bulkAssignSupplier(selectedProducts, targetSupplierId);
            addNotification('Proveedor asignado correctamente', 'success');
            setSelectedProducts([]);
            setTargetSupplierId('');
            await fetchRestock();
        } catch (err) {
            addNotification('Error al asignar proveedor', 'error');
        } finally {
            setIsAssigning(false);
        }
    };

    const toggleSupplier = (id: string) => {
        setExpandedSupplier(expandedSupplier === id ? null : id);
    };

    if (loading && restockData.length === 0) {
        return (
            <div className="restock-loading">
                <div className="spinner-restock"></div>
                <p>Analizando inventarios...</p>
            </div>
        );
    }

    const totalItems = restockData.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="restock-mobile-wrapper">
            <header className="restock-mobile-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="header-info">
                        <h2>Reposición Inteligente</h2>
                        <span className="header-count">{totalItems} productos sugeridos</span>
                    </div>
                    <button 
                        onClick={() => setIsDrawerOpen(true)}
                        style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>add</span>
                        Crear
                    </button>
                </div>

                {/* Strategy Buttons */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', width: '100%' }}>
                    <button 
                        onClick={() => setStrategy('critical')}
                        style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'critical' ? '#ffffff' : 'transparent', color: strategy === 'critical' ? '#4F7A5A' : '#64748b' }}
                    >
                        Crítico
                    </button>
                    <button 
                        onClick={() => setStrategy('predictive')}
                        style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'predictive' ? '#ffffff' : 'transparent', color: strategy === 'predictive' ? '#4F7A5A' : '#64748b' }}
                    >
                        Predictivo
                    </button>
                    <button 
                        onClick={() => setStrategy('mermas')}
                        style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'mermas' ? '#ffffff' : 'transparent', color: strategy === 'mermas' ? '#4F7A5A' : '#64748b' }}
                    >
                        + Mermas
                    </button>
                </div>

                {/* Mobile Filters */}
                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <span className="material-symbols-rounded" style={{ position: 'absolute', left: '8px', top: '8px', fontSize: '18px', color: '#94a3b8' }}>search</span>
                        <input 
                            type="text" 
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '6px 6px 6px 28px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: '#f8fafc' }}
                        />
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: 'white', maxWidth: '100px' }}
                    >
                        <option value="">Carpetas</option>
                        {categoriesData.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedSupplierFilter}
                        onChange={e => setSelectedSupplierFilter(e.target.value)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: 'white', maxWidth: '100px' }}
                    >
                        <option value="">Provs</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            {successVFSItem && (
                <div style={{ background: '#fef3c7', borderBottom: '1px solid #f59e0b', padding: '10px 12px', fontSize: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="material-symbols-rounded" style={{ color: '#d97706', fontSize: '18px' }}>check_circle</span>
                    <span style={{ color: '#78350f' }}>
                        ¡Pedido guardado en VFS! <strong>{successVFSItem.filename}</strong> se agregó a Proveedores y Compras.
                    </span>
                </div>
            )}

            {error && (
                <div className="restock-error">
                    <span className="material-symbols-rounded">error</span>
                    <span>{error}</span>
                </div>
            )}

            {!loading && restockData.length === 0 ? (
                <div className="restock-empty">
                    <span className="material-symbols-rounded">check_circle</span>
                    <h3>¡Todo en orden!</h3>
                    <p>No hay productos con stock bajo en esta vista.</p>
                </div>
            ) : (
                <div className="restock-content">
                    {restockData.map((supplier) => {
                        const isUnassigned = !supplier.supplierId;
                        const supplierKey = supplier.supplierId || 'unassigned';
                        const isExpanded = expandedSupplier === supplierKey;

                        const totalCostEstimado = supplier.items.reduce((sum, item) => sum + (item.suggestedAmount * item.cost), 0);

                        return (
                            <div key={supplierKey} className={`supplier-card-mobile ${isUnassigned ? 'unassigned' : ''}`}>
                                <div className="supplier-header" onClick={() => toggleSupplier(supplierKey)} style={{ background: isExpanded ? '#f8fafc' : '#ffffff' }}>
                                    <div className="supplier-info">
                                        <span className="material-symbols-rounded">
                                            {isUnassigned ? 'warning' : 'local_shipping'}
                                        </span>
                                        <div>
                                            <h3>{supplier.supplierName}</h3>
                                            <span className="supplier-count" style={{ fontSize: '0.7rem' }}>
                                                {supplier.items.length} productos | Est: <strong>${totalCostEstimado.toLocaleString('es-AR')}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`material-symbols-rounded chevron ${isExpanded ? 'expanded' : ''}`}>
                                        expand_more
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="supplier-items-list" style={{ background: '#f8fafc', padding: '8px' }}>
                                        {/* Notes and Lead times for Mobile */}
                                        {!isUnassigned && (
                                            <div style={{ background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>Demora Proveedor:</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <input 
                                                            type="number"
                                                            value={leadTimes[supplierKey] || 3}
                                                            onChange={e => handleSetLeadTime(supplierKey, parseInt(e.target.value) || 3)}
                                                            style={{ width: '45px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem' }}
                                                        />
                                                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>días</span>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="text"
                                                    placeholder="Notas de pedido..."
                                                    value={orderNotes[supplierKey] || ''}
                                                    onChange={e => setOrderNotes({ ...orderNotes, [supplierKey]: e.target.value })}
                                                    style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', width: '100%' }}
                                                />
                                            </div>
                                        )}

                                        {isUnassigned && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                                                <div 
                                                    onClick={() => handleToggleAllUnassigned(supplier.items)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', padding: '4px', color: '#475569' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#4F7A5A' }}>
                                                        {selectedProducts.length === supplier.items.length ? 'check_box' : 'check_box_outline_blank'}
                                                    </span>
                                                    <span>Seleccionar todos ({supplier.items.length})</span>
                                                </div>

                                                {selectedProducts.length > 0 && (
                                                    <div className="bulk-assign-bar" style={{ margin: 0 }}>
                                                        <select
                                                            value={targetSupplierId}
                                                            onChange={(e) => setTargetSupplierId(e.target.value)}
                                                        >
                                                            <option value="">Seleccionar proveedor...</option>
                                                            {suppliers.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            className="btn-assign"
                                                            onClick={handleBulkAssign}
                                                            disabled={isAssigning || selectedProducts.length === 0 || !targetSupplierId}
                                                        >
                                                            {isAssigning ? 'Asignando...' : 'Asignar'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Products grid */}
                                        {supplier.items.map(item => {
                                            const isSelected = selectedProducts.includes(item.id);
                                            const runoutLabel = item.runoutDays <= 5 ? 'Sin stock' : `${item.runoutDays.toFixed(0)}d`;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`restock-item-mobile ${isUnassigned ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => isUnassigned && handleToggleProduct(item.id)}
                                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                            {isUnassigned && (
                                                                <span className="material-symbols-rounded checkbox-icon">
                                                                    {isSelected ? 'check_box' : 'check_box_outline_blank'}
                                                                </span>
                                                            )}
                                                            <div className="item-mobile-info">
                                                                {item.code && <span className="item-code-sm">{item.code}</span>}
                                                                <div className="item-name-sm">{item.name}</div>
                                                                <span style={{ fontSize: '0.65rem', color: item.runoutDays <= 5 ? '#ef4444' : '#d97706', fontWeight: 'bold' }}>
                                                                    Autonomía: {runoutLabel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Suggested Replenishment Pill */}
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '6px' }}>
                                                            Surg: {item.suggestedAmount} u
                                                        </span>
                                                    </div>

                                                    {/* In-line parameter editing */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <label style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Stock</label>
                                                            <input 
                                                                type="number"
                                                                defaultValue={item.stock}
                                                                onBlur={e => handleInlineUpdate(item.id, 'stock', parseFloat(e.target.value) || 0)}
                                                                style={{ padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <label style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Mínimo</label>
                                                            <input 
                                                                type="number"
                                                                defaultValue={item.minStock}
                                                                onBlur={e => handleInlineUpdate(item.id, 'min', parseFloat(e.target.value) || 0)}
                                                                style={{ padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <label style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Costo ($)</label>
                                                            <input 
                                                                type="number"
                                                                defaultValue={item.cost}
                                                                onBlur={e => handleInlineUpdate(item.id, 'cost', parseFloat(e.target.value) || 0)}
                                                                style={{ padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!isUnassigned && (
                                            <div className="supplier-actions-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '6px', padding: '6px' }}>
                                                {/* Save to Workspace */}
                                                <button
                                                    onClick={() => handleSaveToWorkspace(supplier)}
                                                    style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>folder_open</span>
                                                    Workspace
                                                </button>

                                                <Link
                                                    to="/compras"
                                                    state={{
                                                        supplierId: supplier.supplierId,
                                                        items: supplier.items.map(item => ({
                                                            productId: item.id,
                                                            productName: item.name,
                                                            quantity: item.suggestedAmount,
                                                            cost: item.cost
                                                        }))
                                                    }}
                                                    className="btn-generate-purchase"
                                                    style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: '8px' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>shopping_cart</span>
                                                    Pedir
                                                </Link>

                                                {supplier.supplierPhone && (
                                                    <a
                                                        href={generateWhatsAppLink(supplier)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-whatsapp-order"
                                                        style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: '8px' }}
                                                    >
                                                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chat</span>
                                                        WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick Product Creation Drawer Modal */}
            {isDrawerOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', background: 'rgba(255,255,255,0.98)', zIndex: 9999, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderBottom: '1px solid #cbd5e1', background: '#4F7A5A', color: 'white' }}>
                        <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>+ Registrar Producto</h2>
                        <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1rem' }}>
                            Cerrar
                        </button>
                    </div>

                    <form onSubmit={handleFastCreateProduct} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Nombre *</label>
                            <input 
                                type="text"
                                placeholder="Ej: Rosas Importadas Rojas"
                                required
                                value={newProductName}
                                onChange={e => setNewProductName(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Código de barras</label>
                            <input 
                                type="text"
                                placeholder="Ej: 7791234567"
                                value={newProductCode}
                                onChange={e => setNewProductCode(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Costo ($)</label>
                                <input 
                                    type="number"
                                    placeholder="450"
                                    value={newProductCost}
                                    onChange={e => setNewProductCost(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Venta ($)</label>
                                <input 
                                    type="number"
                                    placeholder="1200"
                                    value={newProductPrice}
                                    onChange={e => setNewProductPrice(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Stock Inicial</label>
                                <input 
                                    type="number"
                                    placeholder="15"
                                    value={newProductStock}
                                    onChange={e => setNewProductStock(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Mínimo</label>
                                <input 
                                    type="number"
                                    placeholder="10"
                                    value={newProductMinStock}
                                    onChange={e => setNewProductMinStock(e.target.value)}
                                    style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Carpeta / Categoría</label>
                            <select
                                value={newProductCategory}
                                onChange={e => setNewProductCategory(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: 'white' }}
                            >
                                <option value="">Seleccionar carpeta...</option>
                                {categoriesData.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>Proveedor</label>
                            <select
                                value={newProductSupplierId}
                                onChange={e => setNewProductSupplierId(e.target.value)}
                                style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: 'white' }}
                            >
                                <option value="">Seleccionar proveedor...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
                        >
                            ✓ Registrar Producto
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};
