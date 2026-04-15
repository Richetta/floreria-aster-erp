import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playBeep } from '../../utils/audio';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { CameraScanner } from '../../components/CameraScanner/CameraScanner';
import type { Product } from '../../store/slices/types';
import './POSMobile.css';

export const POSMobile = () => {
    // --- Store & Global State ---
    const products = useStore((state) => state.products);
    const categories = useStore((state) => state.categories);
    const customers = useStore((state) => state.customers);
    const cart = useStore((state) => state.cart);
    const addToCart = useStore((state) => state.addToCart);
    const removeFromCart = useStore((state) => state.removeFromCart);
    const updateCartQty = useStore((state) => state.updateCartQty);
    const clearCart = useStore((state) => state.clearCart);
    const processSale = useStore((state) => state.processSale);
    const addOrder = useStore((state) => state.addOrder);
    const addTransaction = useStore((state) => state.addTransaction);

    const posOrderForm = useStore((state) => state.posOrderForm);
    const updatePosOrderForm = useStore((state) => state.updatePosOrderForm);
    const clearPosOrderForm = useStore((state) => state.clearPosOrderForm);

    // --- Local State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
    const [checkoutMode, setCheckoutMode] = useState<'sale' | 'order'>('sale');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [inStockOnly, setInStockOnly] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');

    const { showAlert } = useModal();

    const {
        selectedCustomer,
        deliveryDate,
        deliveryTimeSlot,
        orderNotes,
        cardMessage,
        deliveryMethod,
        advancePayment,
        deliveryAddress,
        isGuest,
        guestName,
        guestPhone,
    } = posOrderForm;

    // --- Derived Data ---
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const filteredProducts = useMemo(() => {
        let filtered = products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
            const matchesStock = inStockOnly ? p.stock > 0 : true;
            return matchesSearch && matchesCategory && matchesStock;
        });

        // Ordenar
        filtered.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'price') return b.price - a.price;
            if (sortBy === 'stock') return b.stock - a.stock;
            return 0;
        });

        return filtered;
    }, [products, searchTerm, activeCategory, inStockOnly, sortBy]);

    // --- Barcode Scanner Logic ---
    const handleBarcodeScan = async (scannedCode: string) => {
        let product = products.find(p => p.code === scannedCode || p.barcode === scannedCode);
        if (!product) {
            try {
                const backendProducts = await api.getProducts({ exact_barcode: scannedCode });
                if (backendProducts && backendProducts.length > 0) {
                    const bp = backendProducts[0];
                    product = {
                        id: bp.id,
                        code: bp.code,
                        barcode: bp.barcode,
                        name: bp.name,
                        category: bp.category_name || '',
                        category_id: bp.category_id,
                        price: bp.price,
                        cost: bp.cost,
                        stock: bp.stock_quantity,
                        min: bp.min_stock,
                        tags: bp.tags || [],
                        supplierId: bp.supplier_id
                    } as Product;
                }
            } catch (err) {
                console.error('Scan backend fallback error', err);
            }
        }

        if (product) {
            addToCart(product);
            playBeep('success');
            setIsCameraScannerOpen(false);
        } else {
            playBeep('error');
            showAlert({ title: 'No encontrado', message: `Código: ${scannedCode}`, variant: 'error' });
        }
    };

    useBarcodeScanner({ onScan: handleBarcodeScan, isActive: !isCameraScannerOpen && !isCartOpen });

    // --- Handlers ---
    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);

        if (checkoutMode === 'order') {
            // Validation for Order
            if (!isGuest && !selectedCustomer) {
                showAlert({ title: 'Atención', message: 'Seleccioná un cliente o marcá como Invitado.', variant: 'warning' });
                setIsProcessing(false);
                return;
            }
            if (!deliveryDate) {
                showAlert({ title: 'Atención', message: 'Indicá la fecha de entrega.', variant: 'warning' });
                setIsProcessing(false);
                return;
            }

            try {
                const orderId = generateIdWithPrefix('o');
                const customerObj = customers.find(c => c.id === selectedCustomer);

                await addOrder({
                    id: orderId,
                    customerName: isGuest ? guestName : (customerObj ? customerObj.name : 'Desconocido'),
                    customerId: isGuest ? 'guest' : selectedCustomer,
                    total,
                    status: 'pending',
                    date: new Date(deliveryDate).toISOString(),
                    items: cart,
                    notes: orderNotes,
                    cardMessage,
                    advancePayment,
                    deliveryMethod,
                    deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
                    deliveryTimeSlot,
                    contactPhone: isGuest ? guestPhone : customerObj?.phone,
                });

                if (advancePayment > 0) {
                    await addTransaction({
                        id: generateIdWithPrefix('t'),
                        type: 'income',
                        category: 'Seña Pedido',
                        amount: advancePayment,
                        date: new Date().toISOString(),
                        method: paymentMethod,
                        description: `Seña Pedido ${orderId}`,
                    });
                }

                showAlert({ title: 'Pedido Guardado', message: 'El pedido se registró correctamente.', variant: 'success' });
                clearCart();
                clearPosOrderForm();
                setIsCartOpen(false);
                setCheckoutMode('sale');
            } catch (err) {
                showAlert({ title: 'Error', message: 'No se pudo guardar el pedido.', variant: 'error' });
            }
        } else {
            // Standard Sale
            try {
                const saleId = generateIdWithPrefix('v');
                const success = await processSale({
                    id: saleId,
                    total,
                    date: new Date().toISOString(),
                    items: cart,
                    method: paymentMethod,
                    notes: ''
                });

                if (success) {
                    showAlert({ title: 'Venta Exitosa', message: 'La venta se registró correctamente.', variant: 'success' });
                    clearCart();
                    setIsCartOpen(false);
                }
            } catch (err) {
                showAlert({ title: 'Error', message: 'Error procesando la venta.', variant: 'error' });
            }
        }
        setIsProcessing(false);
    };

    return (
        <div className="pos-mobile-wrapper">
            {/* Main Tabs */}
            <div className="pos-mobile-tabs">
                <button
                    className={`mobile-tab ${checkoutMode === 'sale' ? 'active' : ''}`}
                    onClick={() => setCheckoutMode('sale')}
                >
                    <span className="material-symbols-rounded">shopping_cart</span>
                    Venta Rápida
                </button>
                <button
                    className={`mobile-tab ${checkoutMode === 'order' ? 'active' : ''}`}
                    onClick={() => setCheckoutMode('order')}
                >
                    <span className="material-symbols-rounded">calendar_today</span>
                    Pedidos
                </button>
            </div>

            {checkoutMode === 'sale' ? (
                <>
                    {/* Search & Categories */}
                    <div className="pos-mobile-controls">
                        {/* Search Bar */}
                        <div className="mobile-search-bar-wrapper">
                            <div className="mobile-search-bar">
                                <span className="material-symbols-rounded">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button className="clear-search" onClick={() => setSearchTerm('')}>
                                        <span className="material-symbols-rounded">close</span>
                                    </button>
                                )}
                            </div>
                            <button
                                className="barcode-scan-btn"
                                onClick={() => setIsCameraScannerOpen(true)}
                                title="Escanear producto"
                            >
                                <span className="material-symbols-rounded">photo_camera</span>
                            </button>
                        </div>

                        {/* Category Pills - Horizontal Scroll */}
                        <div className="mobile-cat-scroll">
                            <button
                                className={`cat-pill ${activeCategory === 'Todos' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('Todos')}
                            >
                                Todos
                            </button>
                            {(categories || []).map(cat => (
                                <button
                                    key={cat}
                                    className={`cat-pill ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Filter Row */}
                        <div className="pos-filter-row">
                            <button
                                className={`filter-toggle ${inStockOnly ? 'active' : ''}`}
                                onClick={() => setInStockOnly(!inStockOnly)}
                            >
                                <span className="material-symbols-rounded">inventory</span>
                                <span>En stock</span>
                                {inStockOnly && <span className="filter-badge">✓</span>}
                            </button>

                            <select
                                className="filter-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="name">A-Z</option>
                                <option value="price">💰 Precio</option>
                                <option value="stock">📦 Stock</option>
                            </select>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="pos-mobile-products-grid">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="m-product-card" onClick={() => addToCart(product)}>
                                <div className="m-product-header">
                                    <span className="m-product-tag">{product.category}</span>
                                    {product.stock <= 5 && <span className="m-product-stock-low">Bajó Stock</span>}
                                </div>
                                <h4 className="m-product-name">{product.name}</h4>
                                <div className="m-product-footer">
                                    <span className="m-product-price">${product.price.toLocaleString('es-AR')}</span>
                                    <div className="m-add-icon">
                                        <span className="material-symbols-rounded">add</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                /* Order Configuration Form (The "Wizard" View) */
                <div className="pos-mobile-order-form animate-fade-in">
                    <div className="order-form-section">
                        <label>
                            <span className="material-symbols-rounded">person</span>
                            Cliente del Pedido
                        </label>
                        <div className="order-form-row">
                            <select
                                value={selectedCustomer || ''}
                                onChange={e => updatePosOrderForm({ selectedCustomer: e.target.value, isGuest: false })}
                                disabled={isGuest}
                            >
                                <option value="">Seleccionar Cliente...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button
                                className={`guest-toggle ${isGuest ? 'active' : ''}`}
                                onClick={() => updatePosOrderForm({ isGuest: !isGuest })}
                            >
                                {isGuest ? 'Invitado' : 'Usar Invitado'}
                            </button>
                        </div>
                        {isGuest && (
                            <div className="guest-inputs">
                                <input
                                    type="text"
                                    placeholder="Nombre del Cliente"
                                    value={guestName}
                                    onChange={e => updatePosOrderForm({ guestName: e.target.value })}
                                />
                                <input
                                    type="tel"
                                    placeholder="Teléfono (opcional)"
                                    value={guestPhone}
                                    onChange={e => updatePosOrderForm({ guestPhone: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    <div className="order-form-section">
                        <label>
                            <span className="material-symbols-rounded">event</span>
                            Fecha y Horario
                        </label>
                        <div className="order-form-row">
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={e => updatePosOrderForm({ deliveryDate: e.target.value })}
                            />
                            <select
                                value={deliveryTimeSlot}
                                onChange={e => updatePosOrderForm({ deliveryTimeSlot: e.target.value })}
                            >
                                <option value="morning">Mañana</option>
                                <option value="afternoon">Tarde</option>
                                <option value="evening">Noche</option>
                                <option value="allday">Todo el día</option>
                            </select>
                        </div>
                    </div>

                    <div className="order-form-section">
                        <label>
                            <span className="material-symbols-rounded">local_shipping</span>
                            Método de Entrega
                        </label>
                        <div className="delivery-pills">
                            <button
                                className={deliveryMethod === 'pickup' ? 'active' : ''}
                                onClick={() => updatePosOrderForm({ deliveryMethod: 'pickup' })}
                            >
                                Retiro en Local
                            </button>
                            <button
                                className={deliveryMethod === 'delivery' ? 'active' : ''}
                                onClick={() => updatePosOrderForm({ deliveryMethod: 'delivery' })}
                            >
                                Envío a Domicilio
                            </button>
                        </div>
                        {deliveryMethod === 'delivery' && (
                            <input
                                className="mt-2"
                                type="text"
                                placeholder="Dirección completa..."
                                value={deliveryAddress.street}
                                onChange={e => updatePosOrderForm({ deliveryAddress: { ...deliveryAddress, street: e.target.value } })}
                            />
                        )}
                    </div>

                    <div className="order-form-section">
                        <label>
                            <span className="material-symbols-rounded">payments</span>
                            Seña / Adelanto
                        </label>
                        <div className="advance-input-wrapper">
                            <span>$</span>
                            <input
                                type="number"
                                value={advancePayment || ''}
                                onChange={e => updatePosOrderForm({ advancePayment: Number(e.target.value) })}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="order-form-section">
                        <label>
                            <span className="material-symbols-rounded">notes</span>
                            Notas y Mensaje
                        </label>
                        <div className="dual-notes-mobile">
                            <textarea
                                placeholder="Notas internas (ej: moño azul)"
                                value={orderNotes}
                                onChange={e => updatePosOrderForm({ orderNotes: e.target.value })}
                                rows={1}
                            />
                            <textarea
                                className="card-message-mobile"
                                placeholder="Mensaje para la tarjeta..."
                                value={cardMessage}
                                onChange={e => updatePosOrderForm({ cardMessage: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="order-cart-hint">
                        <span className="material-symbols-rounded">info</span>
                        Tenés {itemCount} productos en el carrito para este pedido.
                    </div>
                </div>
            )}

            {/* Global Bottom Actions (Cart Bar) */}
            {cart.length > 0 && (
                <div className="mobile-floating-cart" onClick={() => setIsCartOpen(true)}>
                    <div className="f-cart-left">
                        <div className="f-cart-badge">{itemCount}</div>
                        <span>Revisar Orden</span>
                    </div>
                    <div className="f-cart-right">
                        <span className="f-cart-total">${total.toLocaleString('es-AR')}</span>
                        <span className="material-symbols-rounded">keyboard_arrow_up</span>
                    </div>
                </div>
            )}

            {/* Bottom Sheet - Summary & Checkout */}
            <div className={`m-bottom-sheet ${isCartOpen ? 'open' : ''}`}>
                <div className="m-sheet-overlay" onClick={() => setIsCartOpen(false)} />
                <div className="m-sheet-container">
                    <div className="m-sheet-handle" />
                    <div className="m-sheet-header">
                        <h3>Tu Carrito</h3>
                        <button onClick={() => setIsCartOpen(false)}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    <div className="m-sheet-body">
                        {cart.length === 0 ? (
                            <div className="m-empty-cart">
                                <span className="material-symbols-rounded">shopping_basket</span>
                                <p>Tu carrito está vacío</p>
                            </div>
                        ) : (
                            <div className="m-cart-items">
                                {cart.map(item => (
                                    <div key={item.id} className="m-cart-item">
                                        <div className="m-item-info">
                                            <span className="m-item-name">{item.name}</span>
                                            <span className="m-item-price">${item.price.toLocaleString('es-AR')}</span>
                                        </div>
                                        <div className="m-item-actions">
                                            <button onClick={() => item.qty === 1 ? removeFromCart(item.id) : updateCartQty(item.id, -1)}>
                                                <span className="material-symbols-rounded">remove</span>
                                            </button>
                                            <span className="m-item-qty">{item.qty}</span>
                                            <button onClick={() => updateCartQty(item.id, 1)}>
                                                <span className="material-symbols-rounded">add</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="m-sheet-footer">
                        <div className="m-payment-options">
                            <button
                                className={paymentMethod === 'cash' ? 'active' : ''}
                                onClick={() => setPaymentMethod('cash')}
                            >
                                <span className="material-symbols-rounded">payments</span>
                                Efectivo
                            </button>
                            <button
                                className={paymentMethod === 'card' ? 'active' : ''}
                                onClick={() => setPaymentMethod('card')}
                            >
                                <span className="material-symbols-rounded">credit_card</span>
                                Tarjeta
                            </button>
                        </div>

                        <div className="m-summary-row">
                            <span>Total Final</span>
                            <span className="m-summary-total">${total.toLocaleString('es-AR')}</span>
                        </div>

                        <button
                            className="m-checkout-btn"
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleCheckout}
                        >
                            {isProcessing ? 'Procesando...' : (checkoutMode === 'order' ? 'Confirmar Pedido' : 'Finalizar Venta')}
                        </button>
                    </div>
                </div>
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

