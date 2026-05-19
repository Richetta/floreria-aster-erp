import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './PurchasesMobile.css';

export const PurchasesMobile = () => {
    const suppliers = useStore(state => state.suppliers);
    const products = useStore(state => state.products);
    const transactions = useStore(state => state.transactions);
    const processPurchase = useStore(state => state.processPurchase);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const loadProducts = useStore(state => state.loadProducts);
    const loadTransactions = useStore(state => state.loadTransactions);
    const user = useStore(state => state.user);
    const addNotification = useStore(state => state.addNotification);
    const businessId = user?.business_id || 'default_business';

    // State
    const [view, setView] = useState<'history' | 'new'>('history');
    const [refreshKey, setRefreshKey] = useState(0);

    // Form inputs
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
    const [purchaseNotes, setPurchaseNotes] = useState('');

    // Modal
    const [previewItem, setPreviewItem] = useState<any | null>(null);

    const { alertModal, showAlert } = useModal();

    useEffect(() => {
        const loadAll = async () => {
            await Promise.all([loadSuppliers(), loadProducts(), loadTransactions()]);
        };
        loadAll();
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

    // Merge virtual orders and real transactions chronologically
    const consolidatedHistory = useMemo(() => {
        const list: any[] = [];

        // 1. Add Virtual orders
        virtualOrders.forEach(vo => {
            let dateVal = new Date();
            const parts = vo.id.split('_');
            const timestamp = parseInt(parts[parts.length - 1]);
            if (!isNaN(timestamp)) {
                dateVal = new Date(timestamp);
            }

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
        return list;
    }, [virtualOrders, transactions, refreshKey]);

    const handleAddProduct = (product: any) => {
        const existing = purchaseItems.find(item => item.productId === product.id);
        if (existing) {
            setPurchaseItems(items => items.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setPurchaseItems([...purchaseItems, { productId: product.id, productName: product.name, quantity: 1, cost: product.cost || 0 }]);
        }
    };

    const handleConvertVirtualToPurchase = (item: any) => {
        const vo = item.raw;
        const mappedItems = (vo.customData?.rows || []).map((row: any) => {
            const matchedProd = products.find(p => p.id === row.id || p.code === row.code || p.name.toLowerCase() === row.name.toLowerCase());
            return {
                productId: matchedProd ? matchedProd.id : `invented_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                productName: row.name,
                quantity: row.quantity || 1,
                cost: row.cost || 0
            };
        });

        setSelectedSupplier(item.supplierId || '');
        setPurchaseItems(mappedItems);
        setPurchaseNotes(`Pedido generado a partir de la planilla virtual: ${vo.name}.`);
        setView('new');
        addNotification('Pedido pre-cargado en el formulario.', 'info');
    };

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

    const handleConfirmPurchase = async () => {
        if (!selectedSupplier || purchaseItems.length === 0) {
            showAlert({ title: 'Faltan datos', message: 'Seleccioná un proveedor y al menos un producto', variant: 'warning' });
            return;
        }

        try {
            const sanitizedItems = purchaseItems.map(item => {
                return {
                    productId: item.productId.startsWith('invented_') ? undefined : item.productId,
                    productName: item.productName,
                    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
                    cost: Math.max(0, Number(item.cost) || 0)
                };
            }).filter(item => item.productId !== undefined);

            const success = await processPurchase({
                supplierId: selectedSupplier,
                items: sanitizedItems,
                method: paymentMethod,
                notes: purchaseNotes || 'Compra mobile'
            });

            if (success) {
                showAlert({ title: 'Éxito', message: 'Compra registrada y stock actualizado', variant: 'success' });
                setView('history');
                setPurchaseItems([]);
                setSelectedSupplier('');
                setPurchaseNotes('');
                setRefreshKey(prev => prev + 1);
            }
        } catch (err) {
            showAlert({ title: 'Error', message: 'Error al procesar la compra', variant: 'error' });
        }
    };

    const totalAmount = purchaseItems.reduce((sum, i) => sum + (i.cost * i.quantity), 0);

    const getSupplierName = (supplierId?: string) => {
        if (!supplierId) return 'Sin asignar';
        const supplier = suppliers?.find(s => s.id === supplierId);
        return supplier ? supplier.name : 'Proveedor eliminado';
    };

    return (
        <div className="purchases-mobile-wrapper">
            <header className="mobile-purchases-header" style={{ background: '#4F7A5A', color: 'white', padding: '15px' }}>
                <div className="p-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>
                        {view === 'history' ? 'Historial de Compras' : 'Registrar Compra'}
                    </h2>
                    <button 
                        className={`p-toggle-btn ${view === 'new' ? 'active' : ''}`} 
                        onClick={() => setView(view === 'history' ? 'new' : 'history')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                            {view === 'history' ? 'add' : 'close'}
                        </span>
                        {view === 'history' ? 'Nueva' : 'Cerrar'}
                    </button>
                </div>
            </header>

            <div className="purchases-scroll-content" style={{ padding: '12px' }}>
                {view === 'history' ? (
                    <div className="p-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {consolidatedHistory.length === 0 ? (
                            <div className="p-history-empty" style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                <span className="material-symbols-rounded icon" style={{ fontSize: '48px', color: '#cbd5e1' }}>shopping_bag</span>
                                <h3>Sin movimientos registrados</h3>
                                <p style={{ fontSize: '0.85rem' }}>Los pedidos del Workspace o compras aparecerán acá.</p>
                            </div>
                        ) : (
                            consolidatedHistory.map(tx => (
                                <div key={tx.id} className="p-history-card" style={{ display: 'flex', gap: '10px', background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div className="p-h-icon" style={{
                                        width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: tx.type === 'virtual' ? '#fef3c7' : '#ecfdf5',
                                        color: tx.type === 'virtual' ? '#b45309' : '#15803d'
                                    }}>
                                        <span className="material-symbols-rounded">
                                            {tx.type === 'virtual' ? 'description' : 'payments'}
                                        </span>
                                    </div>
                                    <div className="p-h-info" style={{ flex: 1 }}>
                                        <div className="p-h-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>
                                                {getSupplierName(tx.supplierId)}
                                            </h3>
                                            <span className="p-h-amount" style={{ fontSize: '0.9rem', fontWeight: '900', color: tx.type === 'virtual' ? '#b45309' : '#15803d' }}>
                                                -${tx.amount.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                        <div className="p-h-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                                            <span>{tx.title}</span>
                                            <span>{tx.date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
                                        </div>
                                        
                                        {/* Actions block on card */}
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                                            <button 
                                                onClick={() => setPreviewItem(tx)}
                                                style={{ padding: '4px 8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                Ver Remito
                                            </button>
                                            
                                            {tx.type === 'virtual' ? (
                                                <>
                                                    <button 
                                                        onClick={() => handleConvertVirtualToPurchase(tx)}
                                                        style={{ padding: '4px 8px', border: 'none', background: '#4F7A5A', color: 'white', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                    >
                                                        Registrar Compra
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteVirtualOrder(tx.id)}
                                                        style={{ padding: '4px', border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', cursor: 'pointer' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                                                    ✓ Contabilizado ({tx.method === 'cash' ? 'Efectivo' : 'Transf.'})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="p-new-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="p-step-card" style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '6px' }}>1. Seleccionar Proveedor</label>
                            <select 
                                value={selectedSupplier} 
                                onChange={e => setSelectedSupplier(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            >
                                <option value="">Elegir uno...</option>
                                {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="p-step-card" style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '6px' }}>2. Agregar Productos</label>
                            <div className="p-product-grid" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                                {products?.filter(p => !p.category?.includes('Ramos')).map(p => {
                                    const qty = purchaseItems.find(i => i.productId === p.id)?.quantity || 0;
                                    return (
                                        <button 
                                            key={p.id} 
                                            onClick={() => handleAddProduct(p)} 
                                            style={{
                                                padding: '6px 12px', border: `1px solid ${qty > 0 ? '#86efac' : '#cbd5e1'}`, borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer',
                                                background: qty > 0 ? '#f0fdf4' : 'white', color: qty > 0 ? '#16a34a' : '#475569', fontWeight: qty > 0 ? 'bold' : 'normal'
                                            }}
                                        >
                                            {p.name} {qty > 0 ? `(${qty})` : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {purchaseItems.length > 0 && (
                            <div className="p-items-section" style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>Resumen de Compra</h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {purchaseItems.map(item => (
                                        <div key={item.productId} className="p-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '8px' }}>
                                            <div className="p-i-main" style={{ flex: 1 }}>
                                                <span className="p-i-name" style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>{item.productName}</span>
                                                <div className="p-i-qty" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button 
                                                        onClick={() => setPurchaseItems(items => items.map(i => i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                                                        style={{ width: '24px', height: '24px', borderRadius: '50%', border: 'none', background: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >
                                                        -
                                                    </button>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{item.quantity}</span>
                                                    <button 
                                                        onClick={() => setPurchaseItems(items => items.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))}
                                                        style={{ width: '24px', height: '24px', borderRadius: '50%', border: 'none', background: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-i-cost" style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px', background: 'white', width: '80px' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$</span>
                                                <input 
                                                    type="number" 
                                                    value={item.cost} 
                                                    onChange={e => setPurchaseItems(items => items.map(i => i.productId === item.productId ? { ...i, cost: parseFloat(e.target.value) || 0 } : i))} 
                                                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.8rem', textAlign: 'right', fontWeight: 'bold' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>Método de Pago</label>
                                        <select 
                                            value={paymentMethod} 
                                            onChange={e => setPaymentMethod(e.target.value as any)}
                                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                        >
                                            <option value="transfer">Transferencia</option>
                                            <option value="cash">Efectivo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>Notas</label>
                                        <input 
                                            type="text" 
                                            placeholder="Factura, etc..." 
                                            value={purchaseNotes} 
                                            onChange={e => setPurchaseNotes(e.target.value)}
                                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                        />
                                    </div>
                                </div>

                                <div className="p-total-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', padding: '10px', borderRadius: '8px', marginTop: '6px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#065f46' }}>Total:</span>
                                    <span className="p-total-val" style={{ fontSize: '1.1rem', fontWeight: '900', color: '#047857' }}>
                                        ${totalAmount.toLocaleString('es-AR')}
                                    </span>
                                </div>
                                
                                <button 
                                    className="p-confirm-btn" 
                                    onClick={handleConfirmPurchase}
                                    style={{ width: '100%', padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
                                >
                                    Confirmar Ingreso
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile Remito Previsualización Drawer/Modal */}
            {previewItem && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
                    <div style={{ background: 'white', width: '100%', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {previewItem.type === 'virtual' ? 'Planilla Virtual' : 'Compra Contable'}
                            </span>
                            <button 
                                onClick={() => setPreviewItem(null)}
                                style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', fontSize: '0.85rem' }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <div style={{ padding: '15px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', background: 'white' }}>
                                <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 'bold' }}>FLORERÍA MI JARDÍN</h4>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Remito Interno de Proveedor</span>
                                </div>

                                <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                                    <div>Fecha: <strong>{previewItem.date.toLocaleDateString('es-AR')}</strong></div>
                                    <div>Proveedor: <strong>{getSupplierName(previewItem.supplierId)}</strong></div>
                                    <div>Tipo: <strong>{previewItem.type === 'virtual' ? 'Presupuesto Virtual' : 'Compra Real'}</strong></div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '10px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #475569' }}>
                                            <th style={{ textAlign: 'left', padding: '4px 0' }}>Detalle</th>
                                            <th style={{ textAlign: 'right', padding: '4px 0' }}>Cant.</th>
                                            <th style={{ textAlign: 'right', padding: '4px 0' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewItem.type === 'virtual' ? (
                                            (previewItem.raw?.customData?.rows || []).map((row: any, idx: number) => (
                                                <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                                    <td style={{ padding: '6px 0' }}>{row.name}</td>
                                                    <td style={{ textAlign: 'right', padding: '6px 0' }}>{row.quantity}</td>
                                                    <td style={{ textAlign: 'right', padding: '6px 0' }}>${(row.cost * row.quantity).toLocaleString('es-AR')}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td style={{ padding: '8px 0' }}>{previewItem.title}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 0' }}>1 Lote</td>
                                                <td style={{ textAlign: 'right', padding: '8px 0' }}>${previewItem.amount.toLocaleString('es-AR')}</td>
                                            </tr>
                                        )}
                                        <tr style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                                            <td colSpan={2} style={{ padding: '8px 0', textAlign: 'right' }}>Total:</td>
                                            <td style={{ textAlign: 'right', padding: '8px 0', color: '#10b981' }}>
                                                ${previewItem.amount.toLocaleString('es-AR')}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', fontSize: '0.7rem', color: '#64748b' }}>
                                    <strong>Notas:</strong> {previewItem.description || 'Sin comentarios.'}
                                </div>
                            </div>

                            <button 
                                onClick={() => window.print()}
                                style={{ width: '100%', padding: '10px', background: '#4F7A5A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
                            >
                                Imprimir Comprobante
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
