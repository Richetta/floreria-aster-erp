import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './PurchasesMobile.css';

export const PurchasesMobile = () => {
    const suppliers = useStore(state => state.suppliers);
    const products = useStore(state => state.products);
    const processPurchase = useStore(state => state.processPurchase);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const loadProducts = useStore(state => state.loadProducts);

    const [view, setView] = useState<'history' | 'new'>('history');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
    const [paymentMethod] = useState<'cash' | 'transfer'>('transfer');

    const { alertModal, showAlert } = useModal();

    useEffect(() => {
        loadSuppliers();
        loadProducts();
    }, []);

    const handleAddProduct = (product: any) => {
        const existing = purchaseItems.find(item => item.productId === product.id);
        if (existing) {
            setPurchaseItems(items => items.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setPurchaseItems([...purchaseItems, { productId: product.id, productName: product.name, quantity: 1, cost: product.cost || 0 }]);
        }
    };

    const handleConfirmPurchase = async () => {
        if (!selectedSupplier || purchaseItems.length === 0) {
            showAlert({ title: 'Faltan datos', message: 'Seleccioná un proveedor y al menos un producto', variant: 'warning' });
            return;
        }
        try {
            const success = await processPurchase({
                supplierId: selectedSupplier,
                items: purchaseItems.map(i => ({ productId: i.productId, quantity: i.quantity, cost: i.cost })),
                method: paymentMethod,
                notes: 'Compra mobile'
            });
            if (success) {
                showAlert({ title: 'Éxito', message: 'Compra registrada y stock actualizado', variant: 'success' });
                setView('history');
                setPurchaseItems([]);
                setSelectedSupplier('');
            }
        } catch (err) {
            showAlert({ title: 'Error', message: 'Error al procesar la compra', variant: 'error' });
        }
    };

    const totalAmount = purchaseItems.reduce((sum, i) => sum + (i.cost * i.quantity), 0);

    return (
        <div className="purchases-mobile-wrapper">
            <header className="mobile-purchases-header">
                <div className="p-header-top">
                    <h2>{view === 'history' ? 'Compras' : 'Nueva Compra'}</h2>
                    <button className={`p-toggle-btn ${view === 'new' ? 'active' : ''}`} onClick={() => setView(view === 'history' ? 'new' : 'history')}>
                        <span className="material-symbols-rounded">{view === 'history' ? 'add' : 'close'}</span>
                        {view === 'history' ? 'Nueva' : 'Cerrar'}
                    </button>
                </div>
            </header>

            <div className="purchases-scroll-content">
                {view === 'history' ? (
                    <div className="p-history-list">
                        <div className="p-history-card">
                            <span className="material-symbols-rounded icon">history</span>
                            <div className="p-h-info">
                                <h3>Historial Reciente</h3>
                                <p>Próximamente: Lista detallada de compras pasadas.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-new-form">
                        <div className="p-step-card">
                            <label>1. Seleccionar Proveedor</label>
                            <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                                <option value="">Elegir uno...</option>
                                {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="p-step-card">
                            <label>2. Agregar Productos</label>
                            <div className="p-product-grid">
                                {products?.filter(p => !p.category?.includes('Ramos')).map(p => (
                                    <button key={p.id} onClick={() => handleAddProduct(p)} className="p-prod-pill">
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {purchaseItems.length > 0 && (
                            <div className="p-items-section">
                                <h3>Resumen de Compra</h3>
                                {purchaseItems.map(item => (
                                    <div key={item.productId} className="p-item-row">
                                        <div className="p-i-main">
                                            <span className="p-i-name">{item.productName}</span>
                                            <div className="p-i-qty">
                                                <button onClick={() => setPurchaseItems(items => items.map(i => i.productId === item.productId ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))}>-</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => setPurchaseItems(items => items.map(i => i.productId === item.productId ? {...i, quantity: i.quantity + 1} : i))}>+</button>
                                            </div>
                                        </div>
                                        <div className="p-i-cost">
                                            <input type="number" value={item.cost} onChange={e => setPurchaseItems(items => items.map(i => i.productId === item.productId ? {...i, cost: parseFloat(e.target.value) || 0} : i))} />
                                        </div>
                                    </div>
                                ))}
                                <div className="p-total-footer">
                                    <span>Total:</span>
                                    <span className="p-total-val">${totalAmount.toLocaleString()}</span>
                                </div>
                                <button className="p-confirm-btn" onClick={handleConfirmPurchase}>Confirmar Ingreso</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
