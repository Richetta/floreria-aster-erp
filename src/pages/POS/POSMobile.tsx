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
import { usePlanGuard } from '../../store/useSubscription';
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
    const updateCartAdjustment = useStore((state) => state.updateCartAdjustment);
    const bulkUpdateCartAdjustments = useStore((state) => state.bulkUpdateCartAdjustments);
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
    const [adjMode, setAdjMode] = useState<'subtract' | 'add'>('subtract');
    const [adjValue, setAdjValue] = useState<number>(0);
    const [adjPresets, setAdjPresets] = useState<number[]>(() => {
        const saved = localStorage.getItem('pos_adjustment_presets');
        return saved ? JSON.parse(saved) : [5, 10, 15];
    });
    const [activeAdjustmentDrawer, setActiveAdjustmentDrawer] = useState<boolean>(false);
    const [showPresetsConfig, setShowPresetsConfig] = useState(false);
    const [tempPresets, setTempPresets] = useState<number[]>([...adjPresets]);
    const [activeItemAdjMenuId, setActiveItemAdjMenuId] = useState<string | null>(null);
    const [tempAdjType, setTempAdjType] = useState<'add' | 'subtract'>('add');
    const [tempAdjVal, setTempAdjVal] = useState<number>(0);

    const { showAlert } = useModal();
    const navigate = useNavigate();

    const { guard: guardOrder } = usePlanGuard('orders');

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
    const getAdjustedItemPrice = (item: any) => {
        const price = item.price || 0;
        const adjVal = item.adjustmentValue || 0;
        const adjTypeNormalized = item.adjustmentType || 'none';
        const adjAmount = price * (adjVal / 100);
        return adjTypeNormalized === 'subtract' 
            ? Math.max(0, price - adjAmount) 
            : (adjTypeNormalized === 'add' ? price + adjAmount : price);
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const totalSurcharges = cart.reduce((sum, item) => {
        if (item.adjustmentType === 'add' && item.adjustmentValue > 0) {
            return sum + (item.price * item.qty) * (item.adjustmentValue / 100);
        }
        return sum;
    }, 0);

    const totalDiscounts = cart.reduce((sum, item) => {
        if (item.adjustmentType === 'subtract' && item.adjustmentValue > 0) {
            return sum + (item.price * item.qty) * (item.adjustmentValue / 100);
        }
        return sum;
    }, 0);

    const finalTotal = Math.max(0, total + totalSurcharges - totalDiscounts);

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
    const renderUnifiedAdjustment = () => (
        <div className="pos-mobile-adjustment-unified" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <div className="adj-bar-mobile" style={{ flex: 1 }}>
                    <button 
                        className={`adj-mode-btn ${adjMode}`}
                        onClick={() => setAdjMode(adjMode === 'subtract' ? 'add' : 'subtract')}
                    >
                        {adjMode === 'subtract' ? '-' : '+'}
                    </button>
                    <div className="adj-input-container" onClick={() => setActiveAdjustmentDrawer(true)}>
                        <span className="adj-value-display">{adjValue}%</span>
                        <span className="adj-label">{adjMode === 'subtract' ? 'Descuento' : 'Recargo'}</span>
                    </div>
                    <button className="adj-config-btn" onClick={() => setShowPresetsConfig(true)}>
                        <span className="material-symbols-rounded">settings</span>
                    </button>
                </div>
                {cart.length > 0 && (
                    <button 
                        className="btn-apply-all-adj-mobile"
                        onClick={() => {
                            bulkUpdateCartAdjustments(
                                adjValue === 0 ? 'none' : (adjMode === 'subtract' ? 'subtract' : 'add'),
                                adjValue
                            );
                        }}
                        style={{
                            fontSize: '0.75rem',
                            padding: '0.6rem 0.6rem',
                            background: 'var(--primary-light, #ecfdf5)',
                            color: 'var(--primary-color, #10b981)',
                            border: '1px solid var(--primary-color, #10b981)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            height: '46px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        Aplicar a todos
                    </button>
                )}
            </div>
        </div>
    );

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
        guardOrder(async () => {
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
                    total: finalTotal, status: 'pending',
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
                setAdjValue(0);
            } catch {
                showAlert({ title: 'Error', message: 'No se pudo guardar el pedido.', variant: 'error' });
            }
        } else {
            try {
                const saleId = generateIdWithPrefix('v');
                const success = await processSale({
                    id: saleId, total: finalTotal, date: new Date().toISOString(),
                    items: cart, method: selectedPaymentMethod, notes: ''
                });
                if (success) {
                    showAlert({ title: '¡Venta Exitosa! 🌿', message: 'La venta se registró correctamente.', variant: 'success' });
                    clearCart(); setIsCartOpen(false); setCartStep('summary');
                    setAdjValue(0);
                }
            } catch {
                showAlert({ title: 'Error', message: 'Error procesando la venta.', variant: 'error' });
            }
        }
            setIsProcessing(false);
        });
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
                        <span className="sticky-total">${finalTotal.toLocaleString('es-AR')}</span>
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
                                    <div key={item.id} className="pos-cart-item" style={{ position: 'relative' }}>
                                        <div className="cart-item-icon">
                                            <span className="material-symbols-rounded">{getCategoryIcon(item.category)}</span>
                                        </div>
                                        <div className="cart-item-details" style={{ flex: 1, minWidth: 0 }}>
                                            <div className="cart-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '2px' }}>
                                                <span className="cart-item-price-calc" style={{ fontSize: '0.75rem', color: '#64748b' }}>${item.price.toLocaleString('es-AR')} c/u</span>
                                                
                                                <div className="cart-item-adj-wrapper" style={{ position: 'relative' }}>
                                                    <button 
                                                        className={`cart-item-adj-badge ${item.adjustmentType || 'none'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (activeItemAdjMenuId === item.id) {
                                                                setActiveItemAdjMenuId(null);
                                                            } else {
                                                                setActiveItemAdjMenuId(item.id);
                                                                setTempAdjType(item.adjustmentType === 'none' ? 'add' : item.adjustmentType);
                                                                setTempAdjVal(item.adjustmentValue || 0);
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: '0.65rem',
                                                            padding: '0.1rem 0.3rem',
                                                            borderRadius: '6px',
                                                            border: '1px solid #e2e8f0',
                                                            background: '#f8fafc',
                                                            color: '#64748b',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            fontWeight: 600,
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {(!item.adjustmentType || item.adjustmentType === 'none' || !item.adjustmentValue) ? (
                                                            <span>+ Ajuste</span>
                                                        ) : (
                                                            <span style={{ 
                                                                color: item.adjustmentType === 'subtract' ? '#ef4444' : '#10b981',
                                                                fontWeight: 700 
                                                            }}>
                                                                {item.adjustmentType === 'subtract' ? '-' : '+'}{item.adjustmentValue}%
                                                            </span>
                                                        )}
                                                    </button>

                                                    {activeItemAdjMenuId === item.id && (
                                                        <>
                                                            <div 
                                                                className="cart-item-adj-backdrop" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveItemAdjMenuId(null);
                                                                }}
                                                                style={{
                                                                    position: 'fixed',
                                                                    inset: 0,
                                                                    zIndex: 999,
                                                                    background: 'transparent'
                                                                }}
                                                            />
                                                            <div 
                                                                className="cart-item-adj-popover animate-scale-in"
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '100%',
                                                                    left: 0,
                                                                    zIndex: 1000,
                                                                    background: '#fff',
                                                                    border: '1px solid #e2e8f0',
                                                                    borderRadius: '10px',
                                                                    padding: '0.6rem',
                                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                                    width: '170px',
                                                                    marginTop: '4px',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '0.45rem'
                                                                }}
                                                            >
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>Ajuste de item</div>
                                                                
                                                                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                                                                    <button 
                                                                        className={`flex-1 text-center py-1 rounded ${tempAdjType === 'add' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
                                                                        onClick={(e) => { e.stopPropagation(); setTempAdjType('add'); }}
                                                                        style={{ flex: 1, fontSize: '0.65rem', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}
                                                                    >
                                                                        Recargo (+)
                                                                    </button>
                                                                    <button 
                                                                        className={`flex-1 text-center py-1 rounded ${tempAdjType === 'subtract' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
                                                                        onClick={(e) => { e.stopPropagation(); setTempAdjType('subtract'); }}
                                                                        style={{ flex: 1, fontSize: '0.65rem', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}
                                                                    >
                                                                        Dcto (-)
                                                                    </button>
                                                                </div>

                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                                                    {[0, 10, 20, 30, 40, 50].map(val => (
                                                                        <button
                                                                            key={val}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                updateCartAdjustment(item.id, val === 0 ? 'none' : tempAdjType, val);
                                                                                setActiveItemAdjMenuId(null);
                                                                            }}
                                                                            style={{
                                                                                fontSize: '0.65rem',
                                                                                padding: '0.25rem',
                                                                                border: '1px solid #e2e8f0',
                                                                                background: '#f8fafc',
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                fontWeight: 500
                                                                            }}
                                                                        >
                                                                            {val === 0 ? '0%' : `${val === 40 ? '40% M.O.' : `${val}%`}`}
                                                                        </button>
                                                                    ))}
                                                                </div>

                                                                <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center' }}>
                                                                    <input 
                                                                        type="number"
                                                                        value={tempAdjVal || ''}
                                                                        onChange={e => setTempAdjVal(Number(e.target.value))}
                                                                        placeholder="%"
                                                                        style={{ width: '100%', fontSize: '0.75rem', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '6px', height: '28px' }}
                                                                        onClick={e => e.stopPropagation()}
                                                                    />
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            updateCartAdjustment(item.id, tempAdjVal === 0 ? 'none' : tempAdjType, tempAdjVal);
                                                                            setActiveItemAdjMenuId(null);
                                                                        }}
                                                                        style={{
                                                                            fontSize: '0.7rem',
                                                                            padding: '0.25rem 0.5rem',
                                                                            background: 'var(--primary-color, #10b981)',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer',
                                                                            fontWeight: 600,
                                                                            height: '28px'
                                                                        }}
                                                                    >
                                                                        OK
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="cart-item-controls" style={{ marginLeft: '0.5rem', marginRight: '0.5rem' }}>
                                            <button className="cart-qty-btn" onClick={() => removeFromCart(item.id)}>
                                                <span className="material-symbols-rounded">{item.qty > 1 ? 'remove' : 'delete_outline'}</span>
                                            </button>
                                            <span className="cart-item-qty">{item.qty}</span>
                                            <button className="cart-qty-btn add" onClick={() => addToCart(products.find(p => p.id === item.id) as Product)}>
                                                <span className="material-symbols-rounded">add</span>
                                            </button>
                                        </div>
                                        <div className="cart-item-total" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '70px' }}>
                                            {item.adjustmentValue > 0 && item.adjustmentType !== 'none' && (
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textDecoration: 'line-through', opacity: 0.7 }}>
                                                    ${((item.price || 0) * item.qty).toLocaleString('es-AR')}
                                                </span>
                                            )}
                                            <span style={{ fontWeight: 700 }}>
                                                ${(getAdjustedItemPrice(item) * item.qty).toLocaleString('es-AR')}
                                            </span>
                                        </div>
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

                        {renderUnifiedAdjustment()}

                        <div className="pos-cart-footer">
                            <div className="cart-totals" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                                {(totalSurcharges > 0 || totalDiscounts > 0) && (
                                    <div className="order-totals-breakdown-mobile" style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.2rem',
                                        fontSize: '0.8rem',
                                        color: '#475569',
                                        borderBottom: '1px dashed #e2e8f0',
                                        paddingBottom: '0.4rem',
                                        marginBottom: '0.4rem',
                                        width: '100%'
                                    }}>
                                        <div className="flex justify-between w-full" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Subtotal base</span>
                                            <span>${(total || 0).toLocaleString('es-AR')}</span>
                                        </div>
                                        {totalSurcharges > 0 && (
                                            <div className="flex justify-between w-full" style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                                                <span>Mano de obra / Recargos</span>
                                                <span>+${(totalSurcharges || 0).toLocaleString('es-AR')}</span>
                                            </div>
                                        )}
                                        {totalDiscounts > 0 && (
                                            <div className="flex justify-between w-full" style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                                <span>Descuentos</span>
                                                <span>-${(totalDiscounts || 0).toLocaleString('es-AR')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {checkoutMode === 'order' && advancePayment > 0 && (
                                    <div className="cart-total-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Seña</span>
                                        <span style={{ color: '#5E9B7E' }}>-${advancePayment.toLocaleString('es-AR')}</span>
                                    </div>
                                )}
                                <div className="cart-total-row highlight" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                    <span>{checkoutMode === 'order' && advancePayment > 0 ? 'Saldo' : 'Total'}</span>
                                    <span>${(checkoutMode === 'order' && advancePayment > 0 ? finalTotal - advancePayment : finalTotal).toLocaleString('es-AR')}</span>
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
                            <div className="payment-step-total" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', margin: '1rem 0' }}>
                                <span className="payment-step-label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Total a cobrar</span>
                                <div className="payment-step-total-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.5rem' }}>
                                    {(totalSurcharges > 0 || totalDiscounts > 0) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: '#475569', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Subtotal base</span>
                                                <span>${total.toLocaleString('es-AR')}</span>
                                            </div>
                                            {totalSurcharges > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                                                    <span>Recargos (M.O.)</span>
                                                    <span>+${totalSurcharges.toLocaleString('es-AR')}</span>
                                                </div>
                                            )}
                                            {totalDiscounts > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                                    <span>Descuentos</span>
                                                    <span>-${totalDiscounts.toLocaleString('es-AR')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1e293b' }}>Total</span>
                                        <span className="payment-step-amount" style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary-color)' }}>${finalTotal.toLocaleString('es-AR')}</span>
                                    </div>
                                </div>
                            </div>



                            {renderUnifiedAdjustment()}

                            <div className="payment-selector-mobile">

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
                                {isProcessing ? 'Procesando...' : checkoutMode === 'sale' ? `Cobrar $${finalTotal.toLocaleString('es-AR')}` : 'Guardar Pedido 🌸'}
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

            {/* Adjustment Drawer */}
            <div className={`adj-drawer-overlay ${activeAdjustmentDrawer ? 'open' : ''}`} onClick={() => setActiveAdjustmentDrawer(false)}>
                <div className="adj-drawer-content" onClick={e => e.stopPropagation()}>
                    <div className="drawer-handle"></div>
                    <div className="drawer-header-compact">
                        <h3>Ajustar Total (%)</h3>
                        <button className="drawer-close-btn" onClick={() => setActiveAdjustmentDrawer(false)}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    
                    <div className="drawer-body-compact">
                        <div className="drawer-input-wrapper">
                            <input 
                                type="number" 
                                className={`drawer-input-large ${adjMode === 'add' ? 'surcharge' : ''}`}
                                value={adjValue || ''}
                                onChange={e => setAdjValue(Number(e.target.value))}
                                placeholder="0"
                                autoFocus
                            />
                            <span className="input-suffix">%</span>
                        </div>

                        <div className="drawer-presets">
                            {adjPresets.map(p => (
                                <button 
                                    key={p} 
                                    className={`drawer-preset-btn ${adjMode === 'add' ? 'surcharge' : ''} ${adjValue === p ? 'active' : ''}`}
                                    onClick={() => setAdjValue(p === adjValue ? 0 : p)}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>

                        <button className="drawer-apply-btn" onClick={() => setActiveAdjustmentDrawer(false)}>
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>

            {/* Presets Config Modal (Mobile) */}
            {showPresetsConfig && (
                <div className="mobile-config-modal-overlay" onClick={() => setShowPresetsConfig(false)}>
                    <div className="mobile-config-content" onClick={e => e.stopPropagation()}>
                        <h3>Configurar Presets</h3>
                        <div className="config-grid">
                            {tempPresets.map((p, i) => (
                                <div key={i} className="config-item">
                                    <label>Preset #{i+1}</label>
                                    <input 
                                        type="number" 
                                        value={p}
                                        onChange={e => {
                                            const newP = [...tempPresets];
                                            newP[i] = Number(e.target.value);
                                            setTempPresets(newP);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="config-actions">
                            <button className="btn-cancel" onClick={() => setShowPresetsConfig(false)}>Cancelar</button>
                            <button className="btn-save" onClick={() => {
                                setAdjPresets([...tempPresets]);
                                localStorage.setItem('pos_adjustment_presets', JSON.stringify(tempPresets));
                                setShowPresetsConfig(false);
                            }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
