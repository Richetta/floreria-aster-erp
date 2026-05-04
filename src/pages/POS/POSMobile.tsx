import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
    const [checkoutMode, setCheckoutMode] = useState<'sale' | 'order'>('sale');
    const paymentMethod = shopInfo.paymentMethods?.[0]?.name || 'Efectivo';
    const [isProcessing, setIsProcessing] = useState(false);
    const inStockOnly = false;
    const sortBy = 'name';

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

    // Polling para sincronización del carrito
    useEffect(() => {
        if (!isAutoSyncEnabled) return;

        const interval = setInterval(() => {
            syncCartWithServer();
        }, 3000);

        return () => clearInterval(interval);
    }, [isAutoSyncEnabled, syncCartWithServer]);

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

    const navigate = useNavigate();

    const getCategoryIcon = (catName: string) => {
        const lower = catName.toLowerCase();
        if (lower.includes('flor')) return 'local_florist';
        if (lower.includes('planta')) return 'potted_plant';
        if (lower.includes('regalo') || lower.includes('regaler')) return 'card_giftcard';
        if (lower.includes('insumo') || lower.includes('maceta')) return 'inventory_2';
        return 'category';
    };

    return (
        <div className="pos-mobile-wrapper">
            {/* Header */}
            <div className="pos-mobile-header">
                <button className="icon-btn-ghost" onClick={() => navigate(-1)}>
                    <span className="material-symbols-rounded">chevron_left</span>
                </button>
                <h2>POS - Venta</h2>
                <div className="pos-header-actions">
                    <button className="icon-btn-ghost" onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}>
                        <span className="material-symbols-rounded" style={{ color: isAutoSyncEnabled ? '#10B981' : '#6B6B6B' }}>
                            {isAutoSyncEnabled ? 'cloud_sync' : 'cloud_off'}
                        </span>
                    </button>
                    <button className="icon-btn-ghost" onClick={() => setCheckoutMode(checkoutMode === 'sale' ? 'order' : 'sale')}>
                        <span className="material-symbols-rounded">
                            {checkoutMode === 'sale' ? 'calendar_today' : 'shopping_cart'}
                        </span>
                    </button>
                </div>
            </div>


            {checkoutMode === 'sale' ? (
                <>
                    {/* Search Bar */}
                    <div className="pos-search-container">
                        <div className="pos-search-box">
                            <span className="material-symbols-rounded search-icon">search</span>
                            <input
                                type="text"
                                placeholder="Buscar producto o escanear..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button className="clear-search" onClick={() => setSearchTerm('')}>
                                    <span className="material-symbols-rounded">close</span>
                                </button>
                            )}
                            <button className="barcode-icon-btn" onClick={() => setIsCameraScannerOpen(true)}>
                                <span className="material-symbols-rounded">barcode_scanner</span>
                            </button>
                        </div>
                    </div>

                    {/* Categorías */}
                    <div className="pos-categories-section">
                        <h4>Categorías</h4>
                        <div className="pos-categories-scroll">
                            <div
                                className={`cat-icon-item ${activeCategory === 'Todos' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('Todos')}
                            >
                                <div className="cat-icon-circle">
                                    <span className="material-symbols-rounded">apps</span>
                                </div>
                                <span>Todos</span>
                            </div>
                            {(categories || []).map(cat => (
                                <div
                                    key={cat}
                                    className={`cat-icon-item ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    <div className="cat-icon-circle">
                                        <span className="material-symbols-rounded">{getCategoryIcon(cat)}</span>
                                    </div>
                                    <span>{cat}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Products List (Not Grid) */}
                    <div className="pos-products-list-section">
                        <h4>Productos populares</h4>
                        <div className="pos-products-list">
                        {filteredProducts.map(product => (
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
                                    <span className="pos-item-stock">Stock: {product.stock}</span>
                                    <button className="pos-add-btn">
                                        <span className="material-symbols-rounded">add</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        </div>
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
                <div className="pos-sticky-cart-bar">
                    <div className="sticky-cart-info">
                        <span className="sticky-qty">{itemCount} productos</span>
                        <span className="sticky-total">${total.toLocaleString('es-AR')}</span>
                    </div>
                    <button className="sticky-cart-btn" onClick={() => setIsCartOpen(true)}>
                        Ver carrito
                    </button>
                </div>
            )}

            {/* Bottom Sheet - Summary & Checkout (Full screen like mockup) */}
            <div className={`pos-cart-modal ${isCartOpen ? 'open' : ''}`}>
                <div className="pos-cart-header">
                    <button className="icon-btn-ghost" onClick={() => setIsCartOpen(false)}>
                        <span className="material-symbols-rounded">chevron_left</span>
                    </button>
                    <h2>Carrito</h2>
                    <div style={{ width: '36px' }}></div> {/* Spacer */}
                </div>

                <div className="pos-cart-body">
                    {/* Client Section */}
                    <div className="pos-cart-client-section">
                        <div className="client-info-left">
                            <span className="client-label">Cliente</span>
                            <span className="client-name">{selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : 'Consumidor Final'}</span>
                        </div>
                        <button className="client-change-btn" onClick={() => {
                            setCheckoutMode('order');
                            setIsCartOpen(false);
                        }}>Cambiar</button>
                    </div>

                    {/* Items */}
                    <div className="pos-cart-items-list">
                        {cart.map(item => (
                            <div key={item.id} className="pos-cart-item">
                                <div className="cart-item-icon">
                                    <span className="material-symbols-rounded">{getCategoryIcon(item.category)}</span>
                                </div>
                                <div className="cart-item-details">
                                    <div className="cart-item-name">{item.name}</div>
                                    <div className="cart-item-price-calc">
                                        ${item.price.toLocaleString('es-AR')} x {item.qty}
                                    </div>
                                </div>
                                <div className="cart-item-total">
                                    ${(item.price * item.qty).toLocaleString('es-AR')}
                                </div>
                                <button className="cart-item-delete" onClick={() => removeFromCart(item.id)}>
                                    <span className="material-symbols-rounded">delete_outline</span>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pos-cart-add-note">
                        <span className="material-symbols-rounded">edit_note</span>
                        <input
                            type="text"
                            placeholder="Agregar nota al pedido"
                            value={orderNotes}
                            onChange={e => updatePosOrderForm({ orderNotes: e.target.value })}
                        />
                    </div>
                </div>

                <div className="pos-cart-footer">
                    <div className="cart-totals">
                        <div className="cart-total-row">
                            <span>Subtotal</span>
                            <span>${total.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="cart-total-row highlight">
                            <span>Total</span>
                            <span>${total.toLocaleString('es-AR')}</span>
                        </div>
                    </div>

                    <button
                        className="cart-checkout-btn-large"
                        disabled={cart.length === 0 || isProcessing}
                        onClick={handleCheckout}
                    >
                        {isProcessing ? 'Procesando...' : `Cobrar $${total.toLocaleString('es-AR')}`}
                    </button>
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

