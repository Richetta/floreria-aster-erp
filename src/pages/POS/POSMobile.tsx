import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playBeep } from '../../utils/audio';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { CameraScanner } from '../../components/CameraScanner/CameraScanner';
import type { Product, Category } from '../../store/slices/types';
import { CategoryTreeMobile } from '../../components/CategoryTree/CategoryTreeMobile';
import './POSMobile.css';

export const POSMobile = () => {
    // --- Store & Global State ---
    const products = useStore((state) => state.products);
    const categoriesData = useStore((state) => state.categoriesData);
    const loadCategories = useStore((state) => state.loadCategories);
    const shopInfo = useStore((state) => state.shopInfo);
    const customers = useStore((state) => state.customers);
    const cart = useStore((state) => state.cart);
    const addToCart = useStore((state) => state.addToCart);
    const removeFromCart = useStore((state) => state.removeFromCart);
    const clearCart = useStore((state) => state.clearCart);
    const processSale = useStore((state) => state.processSale);
    const isAutoSyncEnabled = useStore((state) => state.isAutoSyncEnabled);
    const setIsAutoSyncEnabled = useStore((state) => state.setIsAutoSyncEnabled);
    const syncCartWithServer = useStore((state) => state.syncCartWithServer);
    const addOrder = useStore((state) => state.addOrder);
    const addTransaction = useStore((state) => state.addTransaction);
    const posOrderForm = useStore((state) => state.posOrderForm);
    const updatePosOrderForm = useStore((state) => state.updatePosOrderForm);
    const clearPosOrderForm = useStore((state) => state.clearPosOrderForm);

    // --- Local State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('Todos'); // stores category ID
    const [isCatTreeOpen, setIsCatTreeOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
    // 'sale' = Mostrador, 'order' = Pedido
    const [checkoutMode, setCheckoutMode] = useState<'sale' | 'order'>('sale');
    // Payment method selection (for the checkout step)
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    // Cart step: 'summary' | 'checkout' | 'payment'
    const [cartStep, setCartStep] = useState<'summary' | 'payment'>('summary');

    const { showAlert } = useModal();
    const navigate = useNavigate();

    // Load categories with hierarchy on mount
    useEffect(() => {
        loadCategories(true);
    }, []);


    // Get all descendant IDs for a given category ID
    const getDescendantIds = (catId: string, allCats: Category[]): string[] => {
        const children = allCats.filter(c => c.parent_id === catId);
        return [catId, ...children.flatMap(child => getDescendantIds(child.id, allCats))];
    };

    const {
        selectedCustomer, deliveryDate, deliveryTimeSlot,
        orderNotes, cardMessage, deliveryMethod, advancePayment,
        deliveryAddress, isGuest, guestName, guestPhone,
    } = posOrderForm;

    // --- Derived Data ---
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    // Set default payment method
    useEffect(() => {
        if (shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0 && !selectedPaymentMethod) {
            setSelectedPaymentMethod(shopInfo.paymentMethods[0].name);
        }
    }, [shopInfo.paymentMethods]);

    const filteredProducts = useMemo(() => {
        const activeCatIds = activeCategory === 'Todos'
            ? null
            : getDescendantIds(activeCategory, categoriesData);

        return products
            .filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.code.toLowerCase().includes(searchTerm.toLowerCase());

                let matchesCategory = activeCategory === 'Todos';
                if (!matchesCategory && activeCatIds) {
                    if (p.category_id) {
                        matchesCategory = activeCatIds.includes(p.category_id);
                    } else {
                        const matchingNames = categoriesData
                            .filter(c => activeCatIds.includes(c.id))
                            .map(c => c.name);
                        matchesCategory = matchingNames.includes(p.category);
                    }
                }

                return matchesSearch && matchesCategory;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchTerm, activeCategory, categoriesData]);

    // --- Barcode Scanner ---
    const handleBarcodeScan = async (scannedCode: string) => {
        let product = products.find(p => p.code === scannedCode || p.barcode === scannedCode);
        if (!product) {
            try {
                const backendProducts = await api.getProducts({ exact_barcode: scannedCode });
                if (backendProducts && backendProducts.length > 0) {
                    const bp = backendProducts[0];
                    product = {
                        id: bp.id, code: bp.code, barcode: bp.barcode,
                        name: bp.name, category: bp.category_name || '',
                        category_id: bp.category_id, price: bp.price,
                        cost: bp.cost, stock: bp.stock_quantity, min: bp.min_stock,
                        tags: bp.tags || [], supplierId: bp.supplier_id
                    } as Product;
                }
            } catch (err) { console.error('Scan error', err); }
        }
        if (product) {
            addToCart(product); playBeep('success'); setIsCameraScannerOpen(false);
        } else {
            playBeep('error');
            showAlert({ title: 'No encontrado', message: `Código: ${scannedCode}`, variant: 'error' });
        }
    };

    useBarcodeScanner({ onScan: handleBarcodeScan, isActive: !isCameraScannerOpen && !isCartOpen });

    useEffect(() => {
        if (!isAutoSyncEnabled) return;
        const interval = setInterval(() => syncCartWithServer(), 3000);
        return () => clearInterval(interval);
    }, [isAutoSyncEnabled, syncCartWithServer]);

    // --- Checkout Handler ---
    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);

        if (checkoutMode === 'order') {
            if (!isGuest && !selectedCustomer) {
                showAlert({ title: 'Atención', message: 'Seleccioná un cliente o marcá como Invitado.', variant: 'warning' });
                setIsProcessing(false); return;
            }
            if (!deliveryDate) {
                showAlert({ title: 'Atención', message: 'Indicá la fecha de entrega.', variant: 'warning' });
                setIsProcessing(false); return;
            }
            try {
                const orderId = generateIdWithPrefix('o');
                const customerObj = customers.find(c => c.id === selectedCustomer);
                await addOrder({
                    id: orderId,
                    customerName: isGuest ? guestName : (customerObj ? customerObj.name : 'Desconocido'),
                    customerId: isGuest ? 'guest' : selectedCustomer,
                    total, status: 'pending',
                    date: new Date(deliveryDate).toISOString(),
                    items: cart, notes: orderNotes, cardMessage, advancePayment,
                    deliveryMethod, deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
                    deliveryTimeSlot, contactPhone: isGuest ? guestPhone : customerObj?.phone,
                });
                if (advancePayment > 0) {
                    await addTransaction({
                        id: generateIdWithPrefix('t'), type: 'income',
                        category: 'Seña Pedido', amount: advancePayment,
                        date: new Date().toISOString(), method: selectedPaymentMethod,
                        description: `Seña Pedido ${orderId}`,
                    });
                }
                showAlert({ title: '¡Pedido Guardado! 🌸', message: 'El pedido se registró correctamente.', variant: 'success' });
                clearCart(); clearPosOrderForm(); setIsCartOpen(false);
                setCartStep('summary'); setCheckoutMode('sale');
            } catch {
                showAlert({ title: 'Error', message: 'No se pudo guardar el pedido.', variant: 'error' });
            }
        } else {
            try {
                const saleId = generateIdWithPrefix('v');
                const success = await processSale({
                    id: saleId, total, date: new Date().toISOString(),
                    items: cart, method: selectedPaymentMethod, notes: ''
                });
                if (success) {
                    showAlert({ title: '¡Venta Exitosa! 🌿', message: 'La venta se registró correctamente.', variant: 'success' });
                    clearCart(); setIsCartOpen(false); setCartStep('summary');
                }
            } catch {
                showAlert({ title: 'Error', message: 'Error procesando la venta.', variant: 'error' });
            }
        }
        setIsProcessing(false);
    };

    const getCategoryIcon = (catName: string) => {
        const lower = (catName || '').toLowerCase();
        if (lower.includes('flor')) return 'local_florist';
        if (lower.includes('planta')) return 'potted_plant';
        if (lower.includes('regalo') || lower.includes('regaler')) return 'card_giftcard';
        if (lower.includes('insumo') || lower.includes('maceta')) return 'inventory_2';
        return 'category';
    };

    const paymentMethodIcon = (method: string) => {
        const m = (method || '').toLowerCase();
        if (m.includes('efect') || m === 'cash') return 'payments';
        if (m.includes('tarj') || m === 'card' || m.includes('créd') || m.includes('déb')) return 'credit_card';
        if (m.includes('transf') || m === 'transfer') return 'account_balance';
        return 'point_of_sale';
    };

    const availablePaymentMethods = shopInfo.paymentMethods?.filter(m => m.is_active) || [
        { id: 'cash', name: 'Efectivo', type: 'cash' as const, is_active: true },
        { id: 'card', name: 'Tarjeta', type: 'credit' as const, is_active: true },
        { id: 'transfer', name: 'Transferencia', type: 'transfer' as const, is_active: true },
    ];

    return (
        <div className="pos-mobile-wrapper">
            {/* ── HEADER ── */}
            <div className="pos-mobile-header">
                <button className="icon-btn-ghost" onClick={() => navigate(-1)}>
                    <span className="material-symbols-rounded">chevron_left</span>
                </button>
                <h2>POS</h2>
                <div className="pos-header-actions">
                    <button
                        className="icon-btn-ghost"
                        onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                        title={isAutoSyncEnabled ? 'Sincronización activa' : 'Sincronización desactivada'}
                    >
                        <span className="material-symbols-rounded" style={{ color: isAutoSyncEnabled ? '#5E9B7E' : '#D8C3A5' }}>
                            {isAutoSyncEnabled ? 'cloud_sync' : 'cloud_off'}
                        </span>
                    </button>
                    <button className="icon-btn-ghost" onClick={() => setIsCameraScannerOpen(true)}>
                        <span className="material-symbols-rounded">barcode_scanner</span>
                    </button>
                </div>
            </div>

            {/* ── MODE TOGGLE: MOSTRADOR / PEDIDO ── */}
            <div className="pos-mode-toggle-container">
                <div className="pos-mode-toggle">
                    <button
                        className={`mode-toggle-btn ${checkoutMode === 'sale' ? 'active' : ''}`}
                        onClick={() => setCheckoutMode('sale')}
                    >
                        <span className="material-symbols-rounded">point_of_sale</span>
                        Mostrador
                    </button>
                    <button
                        className={`mode-toggle-btn ${checkoutMode === 'order' ? 'active' : ''}`}
                        onClick={() => setCheckoutMode('order')}
                    >
                        <span className="material-symbols-rounded">calendar_today</span>
                        Pedido
                    </button>
                </div>
            </div>

            {/* ── SEARCH BAR ── */}
            <div className="pos-search-container">
                <div className="pos-search-box">
                    <input
                        type="text"
                        placeholder={checkoutMode === 'sale' ? 'Buscar producto...' : 'Buscar y agregar al pedido...'}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="clear-search" onClick={() => setSearchTerm('')}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── CATEGORY SELECTOR ── */}
            <div className="pos-category-selector-container">
                <button 
                    className={`pos-category-selector-btn ${activeCategory !== 'Todos' ? 'active' : ''}`}
                    onClick={() => setIsCatTreeOpen(true)}
                >
                    <div className="btn-content">
                        <span className="material-symbols-rounded icon">account_tree</span>
                        <div className="label-box">
                            <span className="title">Categoría</span>
                            <span className="value">
                                {activeCategory === 'Todos' ? 'Todas' : (categoriesData.find(c => c.id === activeCategory)?.name || 'Seleccionada')}
                            </span>
                        </div>
                    </div>
                    <span className="material-symbols-rounded arrow">expand_more</span>
                </button>

                {activeCategory !== 'Todos' && (
                    <button className="clear-cat-btn" onClick={() => setActiveCategory('Todos')}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                )}
            </div>

            {/* ── ORDER FORM (shown above products when in 'order' mode) ── */}
            {checkoutMode === 'order' && (
                <div className="pos-order-quick-form animate-fade-in">
                    <div className="oqf-header">
                        <span className="material-symbols-rounded">calendar_today</span>
                        <span>Datos del Pedido</span>
                    </div>
                    <div className="oqf-body">
                        {/* Cliente */}
                        <div className="oqf-row">
                            <select
                                value={selectedCustomer || ''}
                                onChange={e => updatePosOrderForm({ selectedCustomer: e.target.value, isGuest: false })}
                                disabled={isGuest}
                                className="oqf-select"
                            >
                                <option value="">Cliente...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button
                                className={`oqf-pill-btn ${isGuest ? 'active' : ''}`}
                                onClick={() => updatePosOrderForm({ isGuest: !isGuest })}
                            >
                                {isGuest ? 'Invitado ✓' : 'Invitado'}
                            </button>
                        </div>
                        {isGuest && (
                            <div className="oqf-row oqf-guest animate-fade-in">
                                <input className="oqf-input" type="text" placeholder="Nombre del cliente" value={guestName} onChange={e => updatePosOrderForm({ guestName: e.target.value })} />
                                <input className="oqf-input" type="tel" placeholder="Teléfono" value={guestPhone} onChange={e => updatePosOrderForm({ guestPhone: e.target.value })} />
                            </div>
                        )}
                        {/* Fecha y horario */}
                        <div className="oqf-row">
                            <input className="oqf-input" type="date" value={deliveryDate} onChange={e => updatePosOrderForm({ deliveryDate: e.target.value })} />
                            <select className="oqf-select" value={deliveryTimeSlot} onChange={e => updatePosOrderForm({ deliveryTimeSlot: e.target.value })}>
                                <option value="morning">Mañana</option>
                                <option value="afternoon">Tarde</option>
                                <option value="evening">Noche</option>
                                <option value="allday">Todo el día</option>
                            </select>
                        </div>
                        {/* Entrega */}
                        <div className="oqf-delivery-row">
                            <button className={`oqf-delivery-btn ${deliveryMethod === 'pickup' ? 'active' : ''}`} onClick={() => updatePosOrderForm({ deliveryMethod: 'pickup' })}>
                                <span className="material-symbols-rounded">storefront</span>
                                Retiro
                            </button>
                            <button className={`oqf-delivery-btn ${deliveryMethod === 'delivery' ? 'active' : ''}`} onClick={() => updatePosOrderForm({ deliveryMethod: 'delivery' })}>
                                <span className="material-symbols-rounded">local_shipping</span>
                                Envío
                            </button>
                        </div>
                        {deliveryMethod === 'delivery' && (
                            <input className="oqf-input animate-fade-in" type="text" placeholder="Dirección de entrega" value={deliveryAddress.street} onChange={e => updatePosOrderForm({ deliveryAddress: { ...deliveryAddress, street: e.target.value } })} />
                        )}
                        {/* Seña */}
                        <div className="oqf-advance">
                            <span className="oqf-advance-prefix">$ Seña</span>
                            <input className="oqf-input" type="number" placeholder="0" value={advancePayment || ''} onChange={e => updatePosOrderForm({ advancePayment: Number(e.target.value) })} />
                        </div>
                        {/* Notas */}
                        <textarea className="oqf-textarea" placeholder="Notas del pedido (ej: moño azul, es regalo...)" value={orderNotes} onChange={e => updatePosOrderForm({ orderNotes: e.target.value })} rows={2} />
                    </div>
                </div>
            )}

            {/* ── PRODUCTS LIST ── */}
            <div className="pos-products-list-section">
                {filteredProducts.length === 0 ? (
                    <div className="pos-empty-products">
                        <span className="material-symbols-rounded">search_off</span>
                        <p>Sin resultados para "{searchTerm}"</p>
                    </div>
                ) : (
                    <div className="pos-products-list">
                        {filteredProducts.map(product => {
                            const cartItem = cart.find(i => i.id === product.id);
                            const qty = cartItem?.qty || 0;
                            return (
                                <div key={product.id} className="pos-list-item" onClick={() => addToCart(product)}>
                                    <div className="pos-item-leading">
                                        <div className="product-icon-circle">
                                            <span className="material-symbols-rounded">{getCategoryIcon(product.category)}</span>
                                        </div>
                                    </div>
                                    <div className="pos-item-content">
                                        <div className="pos-item-name">{product.name}</div>
                                        <div className="pos-item-price">${product.price.toLocaleString('es-AR')}</div>
                                    </div>
                                    <div className="pos-item-trailing">
                                        <span className={`pos-item-stock ${product.stock <= 0 ? 'out' : product.stock <= 5 ? 'low' : ''}`}>
                                            {product.stock <= 0 ? 'Sin stock' : `${product.stock} uds`}
                                        </span>
                                        {qty > 0 ? (
                                            <div className="pos-item-qty-badge">{qty}</div>
                                        ) : (
                                            <button className="pos-add-btn">
                                                <span className="material-symbols-rounded">add</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── STICKY CART BAR ── */}
            {cart.length > 0 && (
                <div className="pos-sticky-cart-bar animate-slide-up">
                    <div className="sticky-cart-info">
                        <span className="sticky-qty">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
                        <span className="sticky-total">${total.toLocaleString('es-AR')}</span>
                    </div>
                    <button className="sticky-cart-btn" onClick={() => { setCartStep('summary'); setIsCartOpen(true); }}>
                        {checkoutMode === 'sale' ? 'Cobrar' : 'Confirmar Pedido'}
                        <span className="material-symbols-rounded">chevron_right</span>
                    </button>
                </div>
            )}

            {/* --- Category Tree Drawer --- */}
            <div className={`pos-category-drawer ${isCatTreeOpen ? 'open' : ''}`}>
                <div className="drawer-overlay" onClick={() => setIsCatTreeOpen(false)} />
                <div className="drawer-content">
                    <div className="drawer-header">
                        <div className="header-title">
                            <span className="material-symbols-rounded">account_tree</span>
                            <h3>Categorías</h3>
                        </div>
                        <button className="close-btn" onClick={() => setIsCatTreeOpen(false)}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <div className="drawer-body">
                        <CategoryTreeMobile 
                            categoriesData={categoriesData}
                            activeCategory={activeCategory}
                            onSelect={(id) => {
                                setActiveCategory(id);
                                setIsCatTreeOpen(false);
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── CART MODAL (Full Screen) ── */}
            <div className={`pos-cart-modal ${isCartOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="pos-cart-header">
                    <button className="icon-btn-ghost" onClick={() => {
                        if (cartStep === 'payment') { setCartStep('summary'); }
                        else { setIsCartOpen(false); }
                    }}>
                        <span className="material-symbols-rounded">chevron_left</span>
                    </button>
                    <div className="pos-cart-title-group">
                        <h2>{cartStep === 'payment' ? 'Método de Pago' : (checkoutMode === 'sale' ? 'Carrito' : 'Resumen Pedido')}</h2>
                        <span className="pos-cart-mode-badge">
                            {checkoutMode === 'sale' ? 'Mostrador' : 'Pedido'}
                        </span>
                    </div>
                    <button className="icon-btn-ghost" onClick={() => { clearCart(); setIsCartOpen(false); setCartStep('summary'); }}>
                        <span className="material-symbols-rounded" style={{ color: '#DFA6A0' }}>delete_sweep</span>
                    </button>
                </div>

                {cartStep === 'summary' ? (
                    <>
                        <div className="pos-cart-body">
                            {/* Client info for orders */}
                            {checkoutMode === 'order' && (
                                <div className="pos-cart-order-summary">
                                    <div className="order-summary-row">
                                        <span className="material-symbols-rounded">person</span>
                                        <span>{isGuest ? guestName || 'Invitado' : (customers.find(c => c.id === selectedCustomer)?.name || 'Sin cliente')}</span>
                                    </div>
                                    {deliveryDate && (
                                        <div className="order-summary-row">
                                            <span className="material-symbols-rounded">event</span>
                                            <span>{new Date(deliveryDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {deliveryTimeSlot === 'morning' ? 'Mañana' : deliveryTimeSlot === 'afternoon' ? 'Tarde' : deliveryTimeSlot === 'evening' ? 'Noche' : 'Todo el día'}</span>
                                        </div>
                                    )}
                                    <div className="order-summary-row">
                                        <span className="material-symbols-rounded">{deliveryMethod === 'delivery' ? 'local_shipping' : 'storefront'}</span>
                                        <span>{deliveryMethod === 'delivery' ? (deliveryAddress.street || 'Envío a domicilio') : 'Retiro en local'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Cart Items */}
                            <div className="pos-cart-items-list">
                                {cart.map(item => (
                                    <div key={item.id} className="pos-cart-item">
                                        <div className="cart-item-icon">
                                            <span className="material-symbols-rounded">{getCategoryIcon(item.category)}</span>
                                        </div>
                                        <div className="cart-item-details">
                                            <div className="cart-item-name">{item.name}</div>
                                            <div className="cart-item-price-calc">${item.price.toLocaleString('es-AR')} × {item.qty}</div>
                                        </div>
                                        <div className="cart-item-controls">
                                            <button className="cart-qty-btn" onClick={() => removeFromCart(item.id)}>
                                                <span className="material-symbols-rounded">{item.qty > 1 ? 'remove' : 'delete_outline'}</span>
                                            </button>
                                            <span className="cart-item-qty">{item.qty}</span>
                                            <button className="cart-qty-btn add" onClick={() => addToCart(products.find(p => p.id === item.id) as Product)}>
                                                <span className="material-symbols-rounded">add</span>
                                            </button>
                                        </div>
                                        <div className="cart-item-total">${(item.price * item.qty).toLocaleString('es-AR')}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Note field */}
                            <div className="pos-cart-add-note">
                                <span className="material-symbols-rounded">edit_note</span>
                                <input
                                    type="text"
                                    placeholder="Nota rápida..."
                                    value={orderNotes}
                                    onChange={e => updatePosOrderForm({ orderNotes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pos-cart-footer">
                            <div className="cart-totals">
                                {checkoutMode === 'order' && advancePayment > 0 && (
                                    <div className="cart-total-row">
                                        <span>Seña</span>
                                        <span style={{ color: '#5E9B7E' }}>-${advancePayment.toLocaleString('es-AR')}</span>
                                    </div>
                                )}
                                <div className="cart-total-row highlight">
                                    <span>{checkoutMode === 'order' && advancePayment > 0 ? 'Saldo' : 'Total'}</span>
                                    <span>${(checkoutMode === 'order' && advancePayment > 0 ? total - advancePayment : total).toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                            <button
                                className="cart-checkout-btn-large"
                                disabled={cart.length === 0}
                                onClick={() => setCartStep('payment')}
                            >
                                {checkoutMode === 'sale' ? 'Seleccionar Pago' : 'Confirmar Pedido'}
                                <span className="material-symbols-rounded">arrow_forward</span>
                            </button>
                        </div>
                    </>
                ) : (
                    /* ── PAYMENT STEP ── */
                    <>
                        <div className="pos-cart-body">
                            <div className="payment-step-total">
                                <span className="payment-step-label">Total a cobrar</span>
                                <span className="payment-step-amount">${total.toLocaleString('es-AR')}</span>
                            </div>

                            <div className="payment-methods-section">
                                <h4>¿Cómo paga?</h4>
                                <div className="payment-methods-grid">
                                    {availablePaymentMethods.map(method => (
                                        <button
                                            key={method.id}
                                            className={`payment-method-card ${selectedPaymentMethod === method.name ? 'active' : ''}`}
                                            onClick={() => setSelectedPaymentMethod(method.name)}
                                        >
                                            <span className="material-symbols-rounded">{paymentMethodIcon(method.name)}</span>
                                            <span>{method.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {checkoutMode === 'order' && (
                                <div className="order-advance-recap">
                                    <span className="material-symbols-rounded">info</span>
                                    <span>Seña configurada: <strong>${advancePayment.toLocaleString()}</strong></span>
                                </div>
                            )}
                        </div>

                        <div className="pos-cart-footer">
                            <button
                                className="cart-checkout-btn-large"
                                disabled={!selectedPaymentMethod || isProcessing}
                                onClick={handleCheckout}
                            >
                                {isProcessing ? 'Procesando...' : checkoutMode === 'sale' ? `Cobrar $${total.toLocaleString('es-AR')}` : 'Guardar Pedido 🌸'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Scanner Overlay */}
            {isCameraScannerOpen && (
                <CameraScanner
                    onScan={handleBarcodeScan}
                    onClose={() => setIsCameraScannerOpen(false)}
                />
            )}
        </div>
    );
};
