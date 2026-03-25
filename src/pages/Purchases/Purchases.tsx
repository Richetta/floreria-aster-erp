import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Truck, Package, DollarSign, Check, X, Minus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './Purchases.css';

export const Purchases = () => {
    const suppliers = useStore(state => state.suppliers);
    const products = useStore(state => state.products);
    const processPurchase = useStore(state => state.processPurchase);
    const loadSuppliers = useStore(state => state.loadSuppliers);
    const loadProducts = useStore(state => state.loadProducts);

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'list' | 'new'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');

    const { alertModal, showAlert } = useModal();

    // Load data from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadSuppliers(), loadProducts()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.phone.includes(searchTerm)
        );
    }, [suppliers, searchTerm]);

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
            const success = await processPurchase({
                supplierId: selectedSupplier,
                items: purchaseItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    cost: item.cost
                })),
                method: paymentMethod,
                notes: `Compra a proveedor registrada desde el panel de Compras.`
            });

            if (success) {
                // Reset form
                setView('list');
                setSelectedSupplier('');
                setPurchaseItems([]);
            }
        } catch (err) {
            console.error('Purchase failed:', err);
        }
    };

    return (
        <div className="purchases-page">
            {/* Loading State */}
            {isLoading && (
                <div className="loading-overlay" style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(255,255,255,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: 50,
                            height: 50,
                            border: '4px solid #e5e7eb',
                            borderTopColor: '#9b51e0',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p style={{ color: '#64748b', fontWeight: 500 }}>Cargando...</p>
                    </div>
                </div>
            )}

            <header className="page-header mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-h1">Compras a Proveedores</h1>
                    <p className="text-body mt-2">Registrá ingresos de mercadería y actualizá el stock automáticamente.</p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={() => setView(view === 'list' ? 'new' : 'list')}
                >
                    {view === 'list' ? (
                        <>
                            <Plus size={20} />
                            <span>Nueva Compra</span>
                        </>
                    ) : (
                        <>
                            <X size={20} />
                            <span>Cancelar</span>
                        </>
                    )}
                </button>
            </header>

            {view === 'list' ? (
                /* List View */
                <div className="purchases-list-view">
                    <div className="inventory-controls mb-6">
                        <div className="search-bar flex-1">
                            <Search className="search-icon text-muted" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar proveedor..."
                                className="form-input search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="suppliers-grid">
                        {filteredSuppliers.map(supplier => (
                            <div key={supplier.id} className="card supplier-card">
                                <div className="supplier-header">
                                    <div className="flex items-center gap-3">
                                        <div className="supplier-avatar">
                                            <Truck size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-h3">{supplier.name}</h3>
                                            <p className="text-small text-muted">{supplier.phone}</p>
                                        </div>
                                    </div>
                                    {supplier.category && (
                                        <span className="category-badge">{supplier.category}</span>
                                    )}
                                </div>

                                {supplier.address && (
                                    <p className="text-small text-muted mt-3">{supplier.address}</p>
                                )}

                                {supplier.lastVisit && (
                                    <p className="text-micro text-muted mt-2">
                                        Última visita: {new Date(supplier.lastVisit).toLocaleDateString()}
                                    </p>
                                )}

                                <button 
                                    className="btn btn-secondary w-full mt-4"
                                    onClick={() => {
                                        setSelectedSupplier(supplier.id);
                                        setView('new');
                                    }}
                                >
                                    <Package size={18} />
                                    Registrar Compra
                                </button>
                            </div>
                        ))}
                    </div>

                    {filteredSuppliers.length === 0 && (
                        <div className="empty-state text-center py-12">
                            <Truck size={48} className="text-muted mx-auto mb-4 opacity-20" />
                            <h3 className="text-h3 text-muted mb-2">No se encontraron proveedores</h3>
                            <p className="text-body">Agregá proveedores en la sección de Configuración</p>
                        </div>
                    )}
                </div>
            ) : (
                /* New Purchase Form */
                <div className="purchase-form-container">
                    <div className="purchase-form-card">
                        <h2 className="text-h2 mb-6">Nueva Compra</h2>

                        {/* Supplier Selection */}
                        <div className="form-group mb-6">
                            <label className="form-label">
                                <Truck size={18} /> Proveedor
                            </label>
                            <select
                                className="form-input"
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                            >
                                <option value="">Seleccionar proveedor...</option>
                                {(suppliers || []).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Product Selection */}
                        <div className="form-group mb-6">
                            <label className="form-label">
                                <Package size={18} /> Agregar Productos
                            </label>
                            <div className="product-selector">
                                {(products || []).filter(p => p.category !== 'Ramos').map(product => (
                                    <button
                                        key={product.id}
                                        className="product-selector-btn"
                                        onClick={() => handleAddProduct(product)}
                                    >
                                        <span className="product-name">{product.name}</span>
                                        <span className="product-stock">Stock: {product.stock}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Purchase Items */}
                        {purchaseItems.length > 0 && (
                            <div className="purchase-items-section mb-6">
                                <h3 className="section-title mb-4">Productos a Comprar ({purchaseItems.length})</h3>
                                <div className="purchase-items-list">
                                    {purchaseItems.map(item => (
                                        <div key={item.productId} className="purchase-item-row">
                                            <div className="item-info">
                                                <span className="item-name">{item.productName}</span>
                                            </div>
                                            <div className="item-controls">
                                                <div className="qty-controls">
                                                    <button 
                                                        className="qty-btn"
                                                        onClick={() => handleUpdateQuantity(item.productId, -1)}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="qty-value">{item.quantity}</span>
                                                    <button 
                                                        className="qty-btn"
                                                        onClick={() => handleUpdateQuantity(item.productId, 1)}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <div className="cost-input">
                                                    <span className="currency-symbol">$</span>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={item.cost}
                                                        onChange={(e) => handleUpdateCost(item.productId, parseFloat(e.target.value) || 0)}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <span className="item-subtotal">
                                                    Subtotal: ${(item.cost * item.quantity).toLocaleString()}
                                                </span>
                                                <button 
                                                    className="btn-icon text-danger"
                                                    onClick={() => handleRemoveItem(item.productId)}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Total */}
                                <div className="purchase-total">
                                    <span className="total-label">Total de la Compra:</span>
                                    <span className="total-amount">${totalCost.toLocaleString()}</span>
                                </div>

                                {/* Payment Method */}
                                <div className="form-group mb-6">
                                    <label className="form-label">
                                        <DollarSign size={18} /> Método de Pago
                                    </label>
                                    <div className="payment-method-selector">
                                        <button
                                            className={`payment-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod('cash')}
                                        >
                                            <DollarSign size={18} />
                                            <span>Efectivo</span>
                                        </button>
                                        <button
                                            className={`payment-method-btn ${paymentMethod === 'transfer' ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod('transfer')}
                                        >
                                            <Truck size={18} />
                                            <span>Transferencia</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="form-actions">
                                    <button className="btn btn-secondary" onClick={() => setView('list')}>
                                        Cancelar
                                    </button>
                                    <button 
                                        className="btn btn-success"
                                        onClick={handleConfirmPurchase}
                                    >
                                        <Check size={20} />
                                        Confirmar Compra
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
