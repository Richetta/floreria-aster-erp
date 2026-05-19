import React, { useState, useEffect, useMemo } from 'react';
import { 
    PackageOpen, 
    AlertTriangle, 
    MessageCircle, 
    CheckSquare, 
    Square, 
    Truck, 
    Search, 
    Plus, 
    Check, 
    Scale, 
    Target, 
    FileSpreadsheet, 
    UserPlus,
    X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import './RestockDesktop.css';

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

const RestockDesktop: React.FC = () => {
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

    // Replenishment strategy
    const [strategy, setStrategy] = useState<'critical' | 'predictive' | 'mermas'>('predictive');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');

    // Bulk assignment state
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
            setError('Error al obtener faltantes de stock');
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
            const leadTime = leadTimes[supplierId] || 3; // Default 3 days

            // Ventas diarias promedio (Mock or fallback using weeklySales)
            const dailySales = p.weeklySales ? (p.weeklySales / 7) : 0.4; // fallback standard daily rate
            const runoutDays = dailySales > 0 ? (p.stock / dailySales) : 999;

            // Merma rate (fallback dynamic rates based on category or default 0.08)
            const mermaRate = p.category?.toLowerCase().includes('flor') ? 0.12 : 0.05;

            // Suggested Restocking Amount
            let suggestedAmount = 0;
            let triggerRestock = false;

            if (strategy === 'critical') {
                triggerRestock = p.stock <= p.min;
                suggestedAmount = triggerRestock ? (p.min * 2 - p.stock) : 0;
            } else if (strategy === 'predictive') {
                // If runout days is less than Lead Time + 5 safety buffer
                triggerRestock = runoutDays <= (leadTime + 5) || p.stock <= p.min;
                // Replenish for 15 days of stock
                suggestedAmount = Math.ceil(dailySales * 15) - p.stock;
            } else { // 'mermas' strategy
                triggerRestock = runoutDays <= (leadTime + 5) || p.stock <= p.min;
                // Replenish for 15 days + inflated for merma compensation
                const baseReplenish = Math.ceil(dailySales * 15) - p.stock;
                suggestedAmount = Math.ceil(baseReplenish * (1 + mermaRate));
            }

            if (suggestedAmount < 0) suggestedAmount = 0;
            if (suggestedAmount === 0 && triggerRestock) suggestedAmount = 10; // minimum package standard

            // In critical strategy, only show actually depleted items
            // In predictive/mermas, show items that are critical OR running out soon
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
            // Reset fields
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

        // Check columns template
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

        // Append and persist
        customItemsList.push(newFile);
        localStorage.setItem(itemsKey, JSON.stringify(customItemsList));

        // Show animation
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
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
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
            addNotification('Selecciona un proveedor de destino', 'warning');
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

    const totalItems = restockData.reduce((acc, curr) => acc + curr.items.length, 0);

    return (
        <div className="restock-page">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #4F7A5A, #37563f)', padding: '1.75rem', borderRadius: '16px', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <div>
                    <h1 className="text-h1" style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.85rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>local_shipping</span>
                        Reposición Inteligente
                        <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '99px', fontWeight: 'bold' }}>BI Suite v2</span>
                    </h1>
                    <p className="text-body mt-2" style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                        Identifica, planifica y automatiza el stock crítico del negocio. {totalItems} artículos sugieren reabastecimiento.
                    </p>
                </div>
                <button onClick={() => setIsDrawerOpen(true)} className="btn flex items-center gap-2" style={{ background: '#ffffff', color: '#4F7A5A', fontWeight: 'bold', padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <Plus size={18} />
                    <span>Nuevo Producto</span>
                </button>
            </header>

            {/* Strategy Selection and Search Filter Bar */}
            <section className="filter-strategy-bar" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1rem', background: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                {/* Algorithmic Modes Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Estrategia de Abastecimiento</span>
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                        <button 
                            onClick={() => setStrategy('critical')}
                            style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'critical' ? '#ffffff' : 'transparent', color: strategy === 'critical' ? '#4F7A5A' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: strategy === 'critical' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                            <AlertTriangle size={14} />
                            Crítico
                        </button>
                        <button 
                            onClick={() => setStrategy('predictive')}
                            style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'predictive' ? '#ffffff' : 'transparent', color: strategy === 'predictive' ? '#4F7A5A' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: strategy === 'predictive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                            <Target size={14} />
                            Predictivo (IA)
                        </button>
                        <button 
                            onClick={() => setStrategy('mermas')}
                            style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', background: strategy === 'mermas' ? '#ffffff' : 'transparent', color: strategy === 'mermas' ? '#4F7A5A' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: strategy === 'mermas' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                            <Scale size={14} />
                            Mermas + Seg
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Buscar código o nombre..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#ffffff', minWidth: '130px' }}
                    >
                        <option value="">Todas las Carpetas</option>
                        {categoriesData.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedSupplierFilter}
                        onChange={e => setSelectedSupplierFilter(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#ffffff', minWidth: '130px' }}
                    >
                        <option value="">Todos los Proveedores</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </section>

            {/* VFS Workspace success overlay banner */}
            {successVFSItem && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', padding: '6px', display: 'flex' }}>
                        <Check size={18} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', fontWeight: 'bold' }}>¡Pedido Guardado en Workspace!</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                            El archivo virtual <strong>{successVFSItem.filename}</strong> se generó en la carpeta <strong>Proveedores y Compras</strong> de tu <Link to="/workspace" style={{ fontWeight: 'bold', color: '#78350f', textDecoration: 'underline' }}>Workspace</Link>.
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-danger-light text-danger p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {loading && restockData.length === 0 ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : restockData.length === 0 ? (
                <div className="empty-state">
                    <PackageOpen size={48} className="text-primary opacity-50 mb-4" />
                    <h2 className="text-h2">¡Todo en Orden!</h2>
                    <p className="text-body text-muted mt-2">
                        No hay productos que requieran reposición bajo la estrategia seleccionada.
                    </p>
                </div>
            ) : (
                <div className="suppliers-grid">
                    {restockData.map((supplier) => {
                        const isUnassigned = !supplier.supplierId;
                        const sId = supplier.supplierId || 'unassigned';

                        // Calculate total suggested cost
                        const totalCostEstimado = supplier.items.reduce((sum, item) => sum + (item.suggestedAmount * item.cost), 0);

                        return (
                            <div key={sId} className={`supplier-restock-card ${isUnassigned ? 'unassigned' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                <div className="supplier-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: 0 }}>
                                    <div className="flex flex-col">
                                        <h3 className="text-h3 font-semibold flex items-center gap-2" style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>
                                            {isUnassigned ? (
                                                <>
                                                    <AlertTriangle size={20} className="text-warning-dark" style={{ color: '#d97706' }} />
                                                    {supplier.supplierName}
                                                </>
                                            ) : (
                                                <>
                                                    <Truck size={20} className="text-primary" style={{ color: '#4F7A5A' }} />
                                                    {supplier.supplierName}
                                                </>
                                            )}
                                        </h3>
                                        <span className="text-small text-muted" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                            {supplier.items.length} artículos en reposición | Total Ref: <strong>${totalCostEstimado.toLocaleString('es-AR')}</strong>
                                        </span>
                                    </div>

                                    {!isUnassigned && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleSaveToWorkspace(supplier)}
                                                className="btn flex items-center gap-1.5"
                                                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                                                title="Guardar como planilla Excel en tu Workspace virtual"
                                            >
                                                <FileSpreadsheet size={16} />
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
                                                className="btn btn-primary btn-sm flex items-center gap-1"
                                                style={{ background: '#4F7A5A', color: 'white', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <PackageOpen size={15} />
                                                Comprar
                                            </Link>

                                            {supplier.supplierPhone && (
                                                <a
                                                    href={generateWhatsAppLink(supplier)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-secondary whatsapp-btn btn-sm"
                                                    style={{ background: '#25D366', color: 'white', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <MessageCircle size={16} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Custom notes and Lead times per supplier */}
                                {!isUnassigned && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>Demora del Proveedor</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={leadTimes[sId] || 3}
                                                    onChange={e => handleSetLeadTime(sId, parseInt(e.target.value) || 3)}
                                                    style={{ width: '60px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', background: '#ffffff' }}
                                                />
                                                <span style={{ fontSize: '0.75rem', color: '#475569' }}>días</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>Notas internas de pedido</label>
                                            <input 
                                                type="text"
                                                placeholder="Agregar comentario de pedido para este proveedor..."
                                                value={orderNotes[sId] || ''}
                                                onChange={e => setOrderNotes({ ...orderNotes, [sId]: e.target.value })}
                                                style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', background: '#ffffff' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {isUnassigned && (
                                    <div className="bulk-assign-bar p-3 bg-white rounded-lg border border-gray-200 flex flex-wrap gap-3 items-center justify-between" style={{ padding: '12px', border: '1px solid #fed7aa', background: '#fffbeb', borderRadius: '8px' }}>
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleToggleAllUnassigned(supplier.items)}>
                                            {selectedProducts.length === supplier.items.length ? (
                                                <CheckSquare size={20} className="text-primary" style={{ color: '#4F7A5A' }} />
                                            ) : (
                                                <Square size={20} className="text-muted" style={{ color: '#94a3b8' }} />
                                            )}
                                            <span className="text-sm font-medium" style={{ fontSize: '0.8rem', color: '#1e293b' }}>Seleccionar todos los huérfanos</span>
                                        </div>

                                        <div className="flex items-center gap-2 flex-1 max-w-sm" style={{ display: 'flex', gap: '6px' }}>
                                            <select
                                                className="form-input text-sm py-1.5"
                                                value={targetSupplierId}
                                                onChange={(e) => setTargetSupplierId(e.target.value)}
                                                style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                                            >
                                                <option value="">Seleccionar proveedor de destino...</option>
                                                {suppliers.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                className="btn btn-secondary btn-sm flex-shrink-0"
                                                onClick={handleBulkAssign}
                                                disabled={isAssigning || selectedProducts.length === 0 || !targetSupplierId}
                                                style={{ padding: '6px 12px', background: '#4F7A5A', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                <Truck size={15} />
                                                {isAssigning ? 'Asignando...' : 'Asignar'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="supplier-items-list" style={{ display: 'flex', flexDirection: 'column' }}>
                                    {/* Table Headers */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr', padding: '8px', borderBottom: '2px solid #f1f5f9', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
                                        <div>Producto</div>
                                        <div style={{ textAlign: 'center' }}>Stock actual</div>
                                        <div style={{ textAlign: 'center' }}>Stock mínimo</div>
                                        <div style={{ textAlign: 'center' }}>Costo ref ($)</div>
                                        <div style={{ textAlign: 'center' }}>{strategy === 'critical' ? 'Faltante' : 'Sugerencia'}</div>
                                        <div style={{ textAlign: 'center' }}>Autonomía</div>
                                    </div>

                                    {supplier.items.map(item => {
                                        const isSelected = selectedProducts.includes(item.id);

                                        // Badge styling for Runout Days
                                        let badgeColor = '#10b981';
                                        let badgeBg = '#d1fae5';
                                        let badgeLabel = `${item.runoutDays.toFixed(0)} días`;

                                        if (item.runoutDays <= 5) {
                                            badgeColor = '#ef4444';
                                            badgeBg = '#fee2e2';
                                            badgeLabel = 'Faltante';
                                        } else if (item.runoutDays <= 15) {
                                            badgeColor = '#d97706';
                                            badgeBg = '#fef3c7';
                                            badgeLabel = `${item.runoutDays.toFixed(0)} d (Bajo)`;
                                        }

                                        return (
                                            <div
                                                key={item.id}
                                                className={`restock-item ${isUnassigned ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
                                                style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr', alignItems: 'center', padding: '12px 8px', borderBottom: '1px solid #f1f5f9', background: isSelected ? '#ecfdf5' : 'transparent', cursor: isUnassigned ? 'pointer' : 'default' }}
                                                onClick={() => isUnassigned && handleToggleProduct(item.id)}
                                            >
                                                {/* Product Info */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {isUnassigned && (
                                                        <div className="item-checkbox mr-2">
                                                            {isSelected ? (
                                                                <CheckSquare size={18} className="text-primary" style={{ color: '#4F7A5A' }} />
                                                            ) : (
                                                                <Square size={18} className="text-muted" style={{ color: '#94a3b8' }} />
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        {item.code && <span className="item-code" style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', width: 'fit-content' }}>{item.code}</span>}
                                                        <span className="item-name font-medium" style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{item.name}</span>
                                                    </div>
                                                </div>

                                                {/* Stock actual editable */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <input 
                                                        type="number"
                                                        defaultValue={item.stock}
                                                        onBlur={e => handleInlineUpdate(item.id, 'stock', parseFloat(e.target.value) || 0)}
                                                        style={{ width: '60px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}
                                                    />
                                                </div>

                                                {/* Stock mínimo editable */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <input 
                                                        type="number"
                                                        defaultValue={item.minStock}
                                                        onBlur={e => handleInlineUpdate(item.id, 'min', parseFloat(e.target.value) || 0)}
                                                        style={{ width: '60px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}
                                                    />
                                                </div>

                                                {/* Costo ref editable */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <input 
                                                        type="number"
                                                        defaultValue={item.cost}
                                                        onBlur={e => handleInlineUpdate(item.id, 'cost', parseFloat(e.target.value) || 0)}
                                                        style={{ width: '70px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}
                                                    />
                                                </div>

                                                {/* Suggested Replenishment */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#4F7A5A', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                                                        {item.suggestedAmount} und
                                                    </span>
                                                </div>

                                                {/* Runout Days Badges */}
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <span style={{ background: badgeBg, color: badgeColor, fontSize: '0.7rem', padding: '3px 8px', borderRadius: '99px', fontWeight: 'bold' }}>
                                                        {badgeLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fast Product Creation Slider Drawer */}
            {isDrawerOpen && (
                <div style={{ position: 'fixed', top: 0, right: 0, width: '450px', height: '100vh', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderLeft: '1px solid #cbd5e1', zIndex: 9999, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e2e8f0', background: '#4F7A5A', color: 'white' }}>
                        <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={20} />
                            + Crear Producto
                        </h2>
                        <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleFastCreateProduct} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Nombre del Producto *</label>
                            <input 
                                type="text"
                                placeholder="Ej: Rosas Importadas Rojas x12"
                                required
                                value={newProductName}
                                onChange={e => setNewProductName(e.target.value)}
                                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Código de barras / Ref</label>
                            <input 
                                type="text"
                                placeholder="Ej: 7791234567"
                                value={newProductCode}
                                onChange={e => setNewProductCode(e.target.value)}
                                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Costo Unitario ($)</label>
                                <input 
                                    type="number"
                                    placeholder="Ej: 450"
                                    value={newProductCost}
                                    onChange={e => setNewProductCost(e.target.value)}
                                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Precio de Venta ($)</label>
                                <input 
                                    type="number"
                                    placeholder="Ej: 1200"
                                    value={newProductPrice}
                                    onChange={e => setNewProductPrice(e.target.value)}
                                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Stock Inicial</label>
                                <input 
                                    type="number"
                                    placeholder="Ej: 15"
                                    value={newProductStock}
                                    onChange={e => setNewProductStock(e.target.value)}
                                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Stock Mínimo</label>
                                <input 
                                    type="number"
                                    placeholder="Ej: 10"
                                    value={newProductMinStock}
                                    onChange={e => setNewProductMinStock(e.target.value)}
                                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Carpeta / Categoría</label>
                            <select
                                value={newProductCategory}
                                onChange={e => setNewProductCategory(e.target.value)}
                                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', background: 'white' }}
                            >
                                <option value="">Seleccionar carpeta...</option>
                                {categoriesData.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Proveedor Asociado</label>
                            <select
                                value={newProductSupplierId}
                                onChange={e => setNewProductSupplierId(e.target.value)}
                                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', background: 'white' }}
                            >
                                <option value="">Seleccionar proveedor...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', marginTop: '1rem' }}
                        >
                            ✓ Registrar Producto
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default RestockDesktop;
