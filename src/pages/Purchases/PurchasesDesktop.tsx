import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Plus, Search, Truck, Package, Check, Trash2, 
    Printer, FileText, ArrowRight, Calendar, Filter 
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './Purchases.css';

export const PurchasesDesktop = () => {
    const suppliers = useStore(state => state.suppliers);
    const products = useStore(state => state.products);
    const transactions = useStore(state => state.transactions);
    const processPurchase = useStore(state => state.processPurchase);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const loadProducts = useStore(state => state.loadProducts);
    const loadTransactions = useStore(state => state.loadTransactions);
    const user = useAuth(state => state.user);
    const addNotification = useStore(state => state.addNotification);
    const businessId = user?.business_id || 'default_business';

    // UI View state
    const [view, setView] = useState<'list' | 'new'>('list');
    const [activeTab, setActiveTab] = useState<'historial' | 'registrar'>('historial');
    const [refreshKey, setRefreshKey] = useState(0);

    // Filters for Historial Tab
    const [historySearch, setHistorySearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'virtual' | 'real'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Purchase Form State
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
    const [activeVirtualOrderId, setActiveVirtualOrderId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
    const [formSearchProduct, setFormSearchProduct] = useState('');
    const [purchaseNotes, setPurchaseNotes] = useState('');

    // Modal & Preview state
    const [previewItem, setPreviewItem] = useState<any | null>(null);

    const { alertModal, showAlert } = useModal();
    const location = useLocation();

    // Check for pre-filled data from Restock page
    useEffect(() => {
        const stateData = location.state as any;
        if (stateData && stateData.supplierId && stateData.items) {
            setSelectedSupplier(stateData.supplierId);
            setPurchaseItems(stateData.items);
            setView('new');
            setActiveTab('registrar');
            // Clear location state to prevent re-filling on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    // Load data from backend on mount
    useEffect(() => {
        const loadData = async () => {
            await Promise.all([loadSuppliers(), loadProducts(), loadTransactions()]);
        };
        loadData();
    }, [refreshKey]);

    // Fetch virtual Excel orders from VFS Workspace (stored in localStorage)
    const virtualOrders = useMemo(() => {
        const itemsKey = `explorer_custom_items_${businessId}`;
        const stored = localStorage.getItem(itemsKey);
        if (!stored) return [];
        try {
            const list = JSON.parse(stored);
            return list.filter((item: any) => item.parentId === 'pedidos_compra_folder' && item.isCustom);
        } catch (e) {
            console.error('Error loading virtual orders:', e);
            return [];
        }
    }, [businessId, refreshKey, view]);

    // Combine virtual orders and real transactions chronologically
    const consolidatedHistory = useMemo(() => {
        const list: any[] = [];

        // 1. Add Virtual orders
        virtualOrders.forEach((vo: any) => {
            // Extract date from name or ID
            let dateVal = new Date();
            const parts = vo.id.split('_');
            const timestamp = parseInt(parts[parts.length - 1]);
            if (!isNaN(timestamp)) {
                dateVal = new Date(timestamp);
            }

            // Extract total amount
            const total = (vo.customData?.rows || []).reduce((acc: number, r: any) => acc + (r.total || 0), 0);

            list.push({
                id: vo.id,
                type: 'virtual',
                title: vo.name,
                description: vo.description,
                date: dateVal,
                amount: total,
                supplierId: vo.id.split('_')[2] || '',
                raw: vo
            });
        });

        // 2. Add Real Transactions
        const realPurchases = (transactions || []).filter(t => t.type === 'expense' && t.category === 'inventory');
        realPurchases.forEach(rt => {
            list.push({
                id: rt.id,
                type: 'real',
                title: rt.description || 'Compra contable registrada',
                description: rt.notes || 'Detalles registrados',
                date: new Date(rt.date),
                amount: rt.amount,
                method: rt.method,
                supplierId: rt.relatedId || '',
                raw: rt
            });
        });

        // Sort chronologically (newest first)
        list.sort((a, b) => b.date.getTime() - a.date.getTime());

        // Apply filters
        return list.filter(item => {
            const supplier = suppliers.find(s => s.id === item.supplierId);
            const supplierName = supplier ? supplier.name.toLowerCase() : '';
            const matchesSearch = item.title.toLowerCase().includes(historySearch.toLowerCase()) ||
                item.description.toLowerCase().includes(historySearch.toLowerCase()) ||
                supplierName.includes(historySearch.toLowerCase());

            const matchesType = typeFilter === 'all' ||
                (typeFilter === 'virtual' && item.type === 'virtual') ||
                (typeFilter === 'real' && item.type === 'real');

            const itemDateStr = item.date.toISOString().split('T')[0];
            const matchesStart = !startDate || itemDateStr >= startDate;
            const matchesEnd = !endDate || itemDateStr <= endDate;

            return matchesSearch && matchesType && matchesStart && matchesEnd;
        });
    }, [virtualOrders, transactions, suppliers, historySearch, typeFilter, startDate, endDate]);

    // Handle converting virtual order to form inputs immediately
    const handleConvertVirtualToPurchase = (historyItem: any) => {
        const vo = historyItem.raw;
        setActiveVirtualOrderId(vo.id);
        const mappedItems = (vo.customData?.rows || []).map((row: any) => {
            // Attempt to match catalog product
            const matchedProd = products.find(p => p.id === row.id || p.code === row.code || p.name.toLowerCase() === row.name.toLowerCase());
            return {
                productId: matchedProd ? matchedProd.id : `invented_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                productName: row.name,
                quantity: row.quantity || 1,
                cost: row.cost || 0
            };
        });

        setSelectedSupplier(historyItem.supplierId || '');
        setPurchaseItems(mappedItems);
        setPurchaseNotes(`Pedido generado a partir de la planilla virtual: ${vo.name}.`);
        setView('new');
        setActiveTab('registrar');
        addNotification('Pedido pre-cargado. Revisá cantidades y costos.', 'info');
    };

    // Remove virtual order
    const handleDeleteVirtualOrder = (orderId: string) => {
        const itemsKey = `explorer_custom_items_${businessId}`;
        const stored = localStorage.getItem(itemsKey);
        if (!stored) return;
        try {
            const list = JSON.parse(stored);
            const filtered = list.filter((item: any) => item.id !== orderId);
            localStorage.setItem(itemsKey, JSON.stringify(filtered));
            setRefreshKey(prev => prev + 1);
            addNotification('Planilla virtual eliminada', 'success');
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddProduct = (product: any) => {
        const existing = purchaseItems.find(item => item.productId === product.id);
        if (existing) {
            setPurchaseItems(items => 
                items.map(item => 
                    item.productId === product.id 
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            );
        } else {
            setPurchaseItems([...purchaseItems, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                cost: product.cost || 0
            }]);
        }
    };

    const handleUpdateQuantity = (productId: string, delta: number) => {
        setPurchaseItems(items =>
            items.map(item => {
                if (item.productId === productId) {
                    const newQty = Math.max(1, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0)
        );
    };

    const handleRemoveItem = (productId: string) => {
        setPurchaseItems(items => items.filter(item => item.productId !== productId));
    };

    const handleUpdateCost = (productId: string, cost: number) => {
        setPurchaseItems(items =>
            items.map(item =>
                item.productId === productId ? { ...item, cost } : item
            )
        );
    };

    const totalCost = purchaseItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

    const handleConfirmPurchase = async () => {
        if (!selectedSupplier) {
            showAlert({ title: 'Proveedor requerido', message: 'Seleccioná un proveedor', variant: 'warning' });
            return;
        }

        if (purchaseItems.length === 0) {
            showAlert({ title: 'Productos requeridos', message: 'Agregá al menos un producto', variant: 'warning' });
            return;
        }

        try {
            // Sanitize all numeric values before sending. Skip invented ones or match them
            const sanitizedItems = purchaseItems.map(item => {
                // If it is custom/invented item, it won't exist in DB as valid uuid, so we ignore or keep
                // Note: processPurchase expects valid catalog product_ids. Let's make sure it handles it.
                return {
                    productId: item.productId.startsWith('invented_') ? undefined : item.productId,
                    productName: item.productName,
                    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
                    cost: Math.max(0, Number(item.cost) || 0)
                };
            }).filter(item => item.productId !== undefined); // filter out invented ones for DB update

            const success = await processPurchase({
                supplierId: selectedSupplier,
                items: sanitizedItems,
                method: paymentMethod,
                notes: purchaseNotes || `Compra a proveedor registrada desde el panel de Compras.`
            });

            if (success) {
                // If this purchase was converted from a virtual restock draft, finalize the draft in VFS
                if (activeVirtualOrderId && activeVirtualOrderId.startsWith('restock_draft_')) {
                    const itemsKey = `explorer_custom_items_${businessId}`;
                    const stored = localStorage.getItem(itemsKey);
                    if (stored) {
                        try {
                            const list = JSON.parse(stored);
                            const draftIndex = list.findIndex((item: any) => item.id === activeVirtualOrderId);
                            if (draftIndex > -1) {
                                const draft = list[draftIndex];
                                const supplierName = getSupplierName(selectedSupplier);
                                const formattedDate = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                                
                                // 1. Change its id to pull it out of active drafts
                                draft.id = `restock_order_${Date.now()}`;
                                
                                // 2. Rename its name to Pedido_Finalizado_[Proveedor]_[FormattedDate].xlsx
                                draft.name = `Pedido_Finalizado_${supplierName.replace(/\s+/g, '_')}_${formattedDate}.xlsx`;
                                
                                // 3. Update its description to "Pedido recibido y contabilizado"
                                draft.description = `Pedido recibido y contabilizado. Notas: ${purchaseNotes || 'Sin notas'}`;
                                
                                // 4. Soften its color to #cbd5e1 (grayed out)
                                draft.color = '#cbd5e1';
                                
                                list[draftIndex] = draft;
                                localStorage.setItem(itemsKey, JSON.stringify(list));
                            }
                        } catch (e) {
                            console.error('Error finalizing virtual draft:', e);
                        }
                    }
                }

                showAlert({ title: '¡Compra registrada!', message: 'El stock fue actualizado y la compra fue registrada en finanzas.', variant: 'success' });
                setTimeout(() => {
                    setView('list');
                    setActiveTab('historial');
                    setSelectedSupplier('');
                    setPurchaseItems([]);
                    setPurchaseNotes('');
                    setActiveVirtualOrderId(null);
                    setRefreshKey(prev => prev + 1);
                }, 1500);
            }
        } catch (err) {
            console.error('Purchase failed:', err);
            showAlert({ title: 'Error', message: 'Ocurrió un error al procesar la compra. Revisá la consola.', variant: 'error' });
        }
    };

    const getSupplierName = (supplierId?: string) => {
        if (!supplierId) return 'Sin Proveedor';
        const s = suppliers.find(sup => sup.id === supplierId);
        return s ? s.name : 'Proveedor Desconocido';
    };

    // Filter products for the Form Product Selector search input
    const filteredCatalogProducts = useMemo(() => {
        return (products || [])
            .filter(p => p.category !== 'Ramos')
            .filter(p => !formSearchProduct || 
                p.name.toLowerCase().includes(formSearchProduct.toLowerCase()) || 
                (p.code && p.code.toLowerCase().includes(formSearchProduct.toLowerCase()))
            );
    }, [products, formSearchProduct]);

    // Print utility styles
    const printStyles = `
        @media print {
            body * {
                visibility: hidden !important;
            }
            #print-invoice-area, #print-invoice-area * {
                visibility: visible !important;
            }
            #print-invoice-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                padding: 30px !important;
            }
            .no-print {
                display: none !important;
            }
        }
    `;

    return (
        <div className="purchases-page">
            <style dangerouslySetInnerHTML={{ __html: printStyles }} />

            <header className="page-header mb-6 flex justify-between items-center" style={{ background: 'linear-gradient(135deg, #4f7a5a, #2c4232)', padding: '2rem', borderRadius: '16px', color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div>
                    <h1 className="text-h1" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.85rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>inventory_2</span>
                        Gestión de Compras y Pedidos
                    </h1>
                    <p className="text-body mt-2" style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                        Controlá tu cadena de suministro. Visualizá pedidos virtuales generados por Reposición y asocialos a compras contables reales.
                    </p>
                </div>
            </header>

            {/* Premium Tabs navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                <button
                    onClick={() => { setActiveTab('historial'); setView('list'); }}
                    style={{
                        padding: '10px 20px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        border: 'none',
                        background: 'transparent',
                        color: activeTab === 'historial' ? '#4f7a5a' : '#64748b',
                        borderBottom: activeTab === 'historial' ? '3px solid #4f7a5a' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <FileText size={18} />
                    Historial de Pedidos y Compras
                </button>
                <button
                    onClick={() => { setActiveTab('registrar'); setView('new'); setActiveVirtualOrderId(null); }}
                    style={{
                        padding: '10px 20px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        border: 'none',
                        background: 'transparent',
                        color: activeTab === 'registrar' ? '#4f7a5a' : '#64748b',
                        borderBottom: activeTab === 'registrar' ? '3px solid #4f7a5a' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <Truck size={18} />
                    🚛 Llegó la Trafic! (Compra Directa)
                </button>
            </div>

            {activeTab === 'historial' && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    {/* Filters Toolbar */}
                    <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Buscar por planilla, proveedor o notas..."
                                value={historySearch}
                                onChange={e => setHistorySearch(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Filter size={16} style={{ color: '#64748b' }} />
                            <select
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value as any)}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: 'white' }}
                            >
                                <option value="all">Todos los registros</option>
                                <option value="virtual">Planillas Excel (.xlsx)</option>
                                <option value="real">Compras Reales (Contables)</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={16} style={{ color: '#64748b' }} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>al</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                        </div>

                        {(historySearch || typeFilter !== 'all' || startDate || endDate) && (
                            <button
                                onClick={() => { setHistorySearch(''); setTypeFilter('all'); setStartDate(''); setEndDate(''); }}
                                style={{ padding: '8px 12px', border: 'none', background: '#e2e8f0', color: '#475569', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Limpiar Filtros
                            </button>
                        )}
                    </div>

                    {/* Timeline Table */}
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>FECHA</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>ORIGEN / PROVEEDOR</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>TIPO</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>DETALLE / NOTAS</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textAlign: 'right' }}>MONTO</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consolidatedHistory.map((item, idx) => {
                                    const supplierName = getSupplierName(item.supplierId);
                                    return (
                                        <tr key={item.id} style={{ borderBottom: idx < consolidatedHistory.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s', cursor: 'pointer' }} className="hover:bg-slate-50">
                                            <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>
                                                {item.date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: item.type === 'virtual' ? '#fef3c7' : '#ecfdf5', color: item.type === 'virtual' ? '#b45309' : '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Truck size={16} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>{supplierName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.title}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '99px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    background: item.type === 'virtual' ? '#fef3c7' : '#dcfce7',
                                                    color: item.type === 'virtual' ? '#d97706' : '#15803d',
                                                    border: `1px solid ${item.type === 'virtual' ? '#fde68a' : '#bbf7d0'}`
                                                }}>
                                                    {item.type === 'virtual' ? '📄 Planilla Excel' : '💰 Compra Real'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.description}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 'bold', color: item.type === 'virtual' ? '#b45309' : '#15803d', textAlign: 'right' }}>
                                                ${item.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => setPreviewItem(item)}
                                                        title="Previsualizar remito premium"
                                                        style={{ padding: '6px 10px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                                                    >
                                                        <Printer size={13} />
                                                        Remito
                                                    </button>

                                                    {item.type === 'virtual' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleConvertVirtualToPurchase(item)}
                                                                title="Registrar esta planilla en la contabilidad y sumar al stock"
                                                                style={{ padding: '6px 10px', border: 'none', background: '#4f7a5a', color: 'white', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                                                            >
                                                                <ArrowRight size={13} />
                                                                Registrar
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteVirtualOrder(item.id)}
                                                                title="Eliminar planilla virtual"
                                                                style={{ padding: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                                                            ✓ Contabilizado ({item.method === 'cash' ? 'Efectivo' : 'Transf.'})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {consolidatedHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '3rem', textAlign: 'center' }}>
                                            <Truck size={48} style={{ color: '#cbd5e1', marginBottom: '1rem', opacity: 0.5 }} />
                                            <h3 style={{ fontSize: '1rem', color: '#64748b', margin: '0 0 4px 0' }}>No se encontraron órdenes ni remitos</h3>
                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                                                Generá pedidos desde la sección "Reposición" o realizá compras directas para ver tu historial.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'registrar' && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start' }}>
                        {/* Main registration form panel */}
                        <div style={{ background: 'white', padding: '1.75rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                            <h2 style={{ fontSize: '1.15rem', color: '#1e293b', fontWeight: 'bold', margin: '0 0 1.25rem 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                                📑 Formulario de Entrada de Mercadería
                            </h2>

                            {/* Supplier selector */}
                            <div className="form-group mb-4">
                                <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#475569' }}>
                                    <Truck size={16} /> Seleccionar Proveedor
                                </label>
                                <select
                                    className="form-input"
                                    value={selectedSupplier}
                                    onChange={(e) => setSelectedSupplier(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                >
                                    <option value="">-- Seleccionar Proveedor --</option>
                                    {(suppliers || []).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Added Products Table */}
                            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold', margin: '0 0 1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🛒 Items en el Remito ({purchaseItems.length})</span>
                                    {purchaseItems.length > 0 && (
                                        <button
                                            onClick={() => setPurchaseItems([])}
                                            style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Limpiar todo
                                        </button>
                                    )}
                                </h3>

                                {purchaseItems.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                        <Package size={32} style={{ marginBottom: '6px', opacity: 0.4 }} />
                                        <div>No cargaste productos al remito todavía.</div>
                                        <div>Hacé click en los productos del panel lateral para sumarlos.</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {purchaseItems.map(item => (
                                            <div key={item.productId} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 40px', gap: '8px', background: 'white', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                                                {item.productId.startsWith('invented_') ? (
                                                    <input 
                                                        type="text"
                                                        value={item.productName}
                                                        onChange={(e) => setPurchaseItems(items => items.map(i => i.productId === item.productId ? { ...i, productName: e.target.value } : i))}
                                                        placeholder="Nombre del ítem libre..."
                                                        style={{ width: '100%', padding: '4px 8px', border: '1px dashed #ca8a04', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: '#854d0e', background: '#fefce8', outline: 'none' }}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>{item.productName}</span>
                                                )}
                                                
                                                {/* Qty Controls */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', borderRadius: '99px', padding: '2px 6px', justifyContent: 'space-between' }}>
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item.productId, -1)}
                                                        style={{ border: 'none', background: 'white', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                    >
                                                        -
                                                    </button>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                                    <button
                                                        onClick={() => handleUpdateQuantity(item.productId, 1)}
                                                        style={{ border: 'none', background: 'white', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Cost input */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', background: 'white' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$</span>
                                                    <input
                                                        type="number"
                                                        value={item.cost}
                                                        onChange={(e) => handleUpdateCost(item.productId, parseFloat(e.target.value) || 0)}
                                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.8rem', textAlign: 'right', fontWeight: 'bold' }}
                                                    />
                                                </div>

                                                {/* Subtotal */}
                                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4f7a5a', textAlign: 'right' }}>
                                                    ${(item.cost * item.quantity).toLocaleString('es-AR')}
                                                </span>

                                                <button
                                                    onClick={() => handleRemoveItem(item.productId)}
                                                    style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Total Summary Footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '8px', marginTop: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#065f46' }}>Total de Compra:</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#047857' }}>${totalCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Additional metadata & Payment */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
                                <div>
                                    <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', display: 'block' }}>
                                        💳 Método de Pago
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('cash')}
                                            style={{
                                                flex: 1, padding: '10px', fontSize: '0.8rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer',
                                                border: `1px solid ${paymentMethod === 'cash' ? '#4f7a5a' : '#cbd5e1'}`,
                                                background: paymentMethod === 'cash' ? '#ecfdf5' : 'white',
                                                color: paymentMethod === 'cash' ? '#4f7a5a' : '#475569'
                                            }}
                                        >
                                            💵 Efectivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('transfer')}
                                            style={{
                                                flex: 1, padding: '10px', fontSize: '0.8rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer',
                                                border: `1px solid ${paymentMethod === 'transfer' ? '#4f7a5a' : '#cbd5e1'}`,
                                                background: paymentMethod === 'transfer' ? '#ecfdf5' : 'white',
                                                color: paymentMethod === 'transfer' ? '#4f7a5a' : '#475569'
                                            }}
                                        >
                                            🏦 Transferencia
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', display: 'block' }}>
                                        📝 Notas del Remito
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Factura A Nro 0023, entrega pendiente..."
                                        value={purchaseNotes}
                                        onChange={e => setPurchaseNotes(e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                    />
                                </div>
                            </div>

                            {/* Submit form buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setView('list'); setActiveTab('historial'); setActiveVirtualOrderId(null); }}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPurchase}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Check size={18} />
                                    Confirmar Compra
                                </button>
                            </div>
                        </div>

                        {/* Product Selector Sidebar Panel */}
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', height: '100%', maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                                📦 Catálogo de Productos
                            </h3>

                            {/* Search bar inside selector */}
                            <div style={{ position: 'relative', marginBottom: '12px' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={formSearchProduct}
                                    onChange={e => setFormSearchProduct(e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                />
                            </div>

                            {/* Product buttons list */}
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                                <button
                                    onClick={() => handleAddProduct({ id: `invented_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name: formSearchProduct || '', cost: 0, stock: 0 })}
                                    style={{
                                        width: '100%', textAlign: 'left', padding: '10px', borderRadius: '8px', border: '1px dashed #ca8a04', background: '#fefce8', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'
                                    }}
                                    className="hover:bg-yellow-100"
                                >
                                    <Plus size={16} style={{ color: '#ca8a04' }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#854d0e' }}>
                                        {formSearchProduct ? `Agregar "${formSearchProduct}" libre` : 'Agregar ítem libre / fuera de catálogo'}
                                    </span>
                                </button>

                                {filteredCatalogProducts.map(product => {
                                    const qtyInCart = purchaseItems.find(item => item.productId === product.id)?.quantity || 0;
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => handleAddProduct(product)}
                                            style={{
                                                width: '100%', textAlign: 'left', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: qtyInCart > 0 ? '#f0fdf4' : 'white', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                borderColor: qtyInCart > 0 ? '#86efac' : '#e2e8f0'
                                            }}
                                            className="hover:border-emerald-500"
                                        >
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>{product.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Stock: <strong style={{ color: product.stock <= (product.min || 0) ? '#dc2626' : '#1e293b' }}>{product.stock}</strong> | Costo: ${product.cost}</div>
                                            </div>

                                            {qtyInCart > 0 && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '99px' }}>
                                                    {qtyInCart}x
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}

                                {filteredCatalogProducts.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                        No se encontraron productos.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Remito Previsualización Modal */}
            {previewItem && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }} className="no-print">
                    <div style={{ background: 'white', width: '100%', maxWidth: '800px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '90vh' }}>
                        
                        {/* Header bar */}
                        <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={18} style={{ color: '#4f7a5a' }} />
                                Previsualización de Comprobante / Remito
                            </h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => window.print()}
                                    style={{ padding: '6px 12px', border: 'none', background: '#4f7a5a', color: 'white', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Printer size={14} /> Imprimir / PDF
                                </button>
                                <button
                                    onClick={() => setPreviewItem(null)}
                                    style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        {/* Invoice physical mock-up sheet */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }} id="print-invoice-area">
                            <div style={{ border: '2px solid #334155', padding: '2rem', borderRadius: '8px', background: 'white', position: 'relative' }}>
                                
                                {/* Top invoice metadata */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: '900', color: '#334155', letterSpacing: '-0.5px' }}>FLORERÍA MI JARDÍN</h2>
                                        <p style={{ margin: '0 0 2px 0', fontSize: '0.75rem', color: '#64748b' }}>Calle de las Flores 1234, CABA, Argentina</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Tel: +54 9 11 2345-6789 | CUIT: 30-71234567-9</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-block', border: '2px solid #334155', padding: '6px 12px', fontSize: '1.5rem', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>X</div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#475569' }}>
                                            {previewItem.type === 'virtual' ? 'PEDIDO SUGERIDO' : 'REMITO DE COMPRA'}
                                        </h3>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                            Fecha: <strong>{previewItem.date.toLocaleDateString('es-AR')} {previewItem.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</strong>
                                        </p>
                                    </div>
                                </div>

                                {/* Supplier info */}
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', border: '1px solid #cbd5e1' }}>
                                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROVEEDOR ASOCIADO</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{getSupplierName(previewItem.supplierId)}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID Referencia: {previewItem.supplierId || 'Sin ID'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Método: <strong>{previewItem.type === 'virtual' ? 'Presupuesto' : (previewItem.method === 'cash' ? 'Efectivo' : 'Transferencia')}</strong></div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Origen: {previewItem.type === 'virtual' ? 'Workspace Explorer' : 'Finanzas ERP'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #334155' }}>
                                            <th style={{ padding: '8px 4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'left' }}>PRODUCTO / ARTÍCULO</th>
                                            <th style={{ padding: '8px 4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'right', width: '100px' }}>CANTIDAD</th>
                                            <th style={{ padding: '8px 4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'right', width: '120px' }}>COSTO REF.</th>
                                            <th style={{ padding: '8px 4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'right', width: '130px' }}>SUBTOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewItem.type === 'virtual' ? (
                                            (previewItem.raw?.customData?.rows || []).map((row: any, idx: number) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                    <td style={{ padding: '10px 4px', fontSize: '0.8rem', color: '#1e293b' }}>
                                                        <strong>{row.code || 'INV'}</strong> - {row.name}
                                                    </td>
                                                    <td style={{ padding: '10px 4px', fontSize: '0.8rem', color: '#1e293b', textAlign: 'right' }}>{row.quantity}</td>
                                                    <td style={{ padding: '10px 4px', fontSize: '0.8rem', color: '#1e293b', textAlign: 'right' }}>${row.cost.toLocaleString('es-AR')}</td>
                                                    <td style={{ padding: '10px 4px', fontSize: '0.8rem', color: '#1e293b', textAlign: 'right', fontWeight: 'bold' }}>${(row.cost * row.quantity).toLocaleString('es-AR')}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            // Real transaction items list.
                                            // Since transactions don't store physical items directly, we search products or metadata or show fallback
                                            <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                <td style={{ padding: '12px 4px', fontSize: '0.8rem', color: '#1e293b' }}>
                                                    {previewItem.title} - <em>Ingreso contable de mercadería</em>
                                                </td>
                                                <td style={{ padding: '12px 4px', fontSize: '0.8rem', color: '#1e293b', textAlign: 'right' }}>1 Lote</td>
                                                <td style={{ padding: '12px 4px', fontSize: '0.8rem', color: '#1e293b', textAlign: 'right' }}>${previewItem.amount.toLocaleString('es-AR')}</td>
                                                <td style={{ padding: '12px 4px', fontSize: '0.8rem', color: '#1e293b', textAlign: 'right', fontWeight: 'bold' }}>${previewItem.amount.toLocaleString('es-AR')}</td>
                                            </tr>
                                        )}

                                        {/* Total Row */}
                                        <tr style={{ borderTop: '2px solid #334155' }}>
                                            <td colSpan={2}></td>
                                            <td style={{ padding: '12px 4px', fontSize: '0.9rem', fontWeight: 'bold', color: '#334155', textAlign: 'right' }}>TOTAL:</td>
                                            <td style={{ padding: '12px 4px', fontSize: '1.1rem', fontWeight: '950', color: '#1e293b', textAlign: 'right' }}>
                                                ${previewItem.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Footer notes */}
                                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginTop: '1rem' }}>
                                    <h5 style={{ margin: '0 0 4px 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Notas / Comentarios del Remito</h5>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: '1.4' }}>
                                        {previewItem.description || 'Sin notas adicionales.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
