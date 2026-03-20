import { useState, useMemo, useRef, useEffect } from 'react';
import {
    Search,
    ShoppingCart,
    Trash2,
    CreditCard,
    Banknote,
    Minus,
    Plus,
    Calendar,
    X,
    Check,
    Store,
    Truck,
    Clock,
    TrendingUp,
    List,
    Award,
    Sparkles,
    ChevronDown,
    AlertCircle,
    Copy,
    Printer
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { TicketPrinter } from '../../components/TicketPrinter/TicketPrinter';
import { OrderTemplatesModal } from '../../components/OrderTemplates/OrderTemplatesModal';
import type { TicketData } from '../../components/TicketPrinter/TicketPrinter';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import './POS.css';

type ProductView = 'recent' | 'top' | 'all' | 'packages';

export const POS = () => {
    const products = useStore((state) => state.products);
    const packages = useStore((state) => state.packages);
    const checkPackageAvailability = useStore((state) => state.checkPackageAvailability);
    const processSale = useStore((state) => state.processSale);
    const customers = useStore((state) => state.customers);
    const updateCustomer = useStore((state) => state.updateCustomer);
    const addOrder = useStore((state) => state.addOrder);
    const addTransaction = useStore((state) => state.addTransaction);
    const categories = useStore((state) => state.categories);
    const addCustomer = useStore((state) => state.addCustomer);
    const tags = useStore((state) => state.tags);
    const loadProducts = useStore((state) => state.loadProducts);
    const loadPackages = useStore((state) => state.loadPackages);
    const loadCustomers = useStore((state) => state.loadCustomers);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Global Persistent State from useStore
    const cart = useStore((state) => state.cart);
    const addToCart = useStore((state) => state.addToCart);
    const removeFromCart = useStore((state) => state.removeFromCart);
    const updateCartQty = useStore((state) => state.updateCartQty);
    const clearCart = useStore((state) => state.clearCart);
    
    const posOrderForm = useStore((state) => state.posOrderForm);
    const updatePosOrderForm = useStore((state) => state.updatePosOrderForm);
    const clearPosOrderForm = useStore((state) => state.clearPosOrderForm);

    const {
        selectedCustomer,
        deliveryDate,
        deliveryTimeSlot,
        orderNotes,
        deliveryMethod,
        advancePayment,
        deliveryAddress,
        contactPhone
    } = posOrderForm;

    // Local-only state
    const [customerSearch, setCustomerSearch] = useState('');
    const [expandedSection, setExpandedSection] = useState<number | null>(1);
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [paymentWithAmount, setPaymentWithAmount] = useState<number | ''>('');
    
    // UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('Todos');
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [productView, setProductView] = useState<ProductView>('all');
    const [barcodeInput, setBarcodeInput] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [checkoutMode, setCheckoutMode] = useState<'sale' | 'order'>('sale');

    // Success Modals
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastSaleData, setLastSaleData] = useState<{ 
        id: string, 
        total: number, 
        method: string, 
        items: any[], 
        date: string 
    } | null>(null);
    const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);

    // Ticket Printer State
    const [showTicketPrinter, setShowTicketPrinter] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

    // Load data from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await Promise.allSettled([loadProducts(), loadPackages(), loadCustomers()]);
            } catch (err) {
                console.error("Error loading POS data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Helpers
    // Helpers are now in useStore actions

    // Add package to cart with stock validation
    const addPackageToCart = (pkg: any) => {
        const availability = checkPackageAvailability(pkg.id);

        if (!availability.available) {
            const missingList = availability.missingComponents
                .map(c => `• ${c.productName}: faltan ${c.shortage}`)
                .join('\n');

            alert(`⚠️ No se puede agregar el ramo "${pkg.name}"\n\nFaltan componentes:\n${missingList}\n\nReponé el stock antes de vender.`);
            return false;
        }

        // Add package as a cart item
        addToCart({
            id: pkg.id,
            name: pkg.name,
            price: pkg.price,
            isPackage: true,
            section: pkg.section
        });
        return true;
    };

    // Handle barcode scan
    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcodeInput.trim()) return;

        const product = products.find(p => p.code === barcodeInput.trim());
        if (product && product.stock > 0) {
            addToCart(product);
            setBarcodeInput('');

            // Sonido beep al escanear exitosamente
            playBeepSound();

            // Focus back to barcode input for next scan
            setTimeout(() => {
                const barcodeInputEl = document.getElementById('barcode-input');
                barcodeInputEl?.focus();
            }, 100);
        } else {
            alert('Producto no encontrado o sin stock');
            setBarcodeInput('');
        }
    };

    // Sonido beep para escaneo exitoso
    const playBeepSound = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800; // 800 Hz beep
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        } catch (error) {
            // Si falla el audio, continuar sin sonido
            console.log('No se pudo reproducir el sonido');
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+F o F3: Focus en búsqueda
            if ((e.ctrlKey || e.key === 'F3') && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // Escape: Limpiar carrito
            if (e.key === 'Escape' && cart.length > 0) {
                if (confirm('¿Vaciar carrito?')) {
                    clearCart();
                }
            }
            // Enter en búsqueda: agregar primer producto
            if (e.key === 'Enter' && searchTerm) {
                const firstProduct = products.find(p =>
                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.code.toLowerCase().includes(searchTerm.toLowerCase())
                );
                if (firstProduct && firstProduct.stock > 0) {
                    addToCart(firstProduct);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchTerm, cart]);

    const updateQty = (id: string, delta: number) => {
        updateCartQty(id, delta);
    };


    const handleAddCustomer = () => {
        if (!newCustomerName.trim()) return;
        const newId = generateIdWithPrefix('c');
        addCustomer({
            id: newId,
            name: newCustomerName,
            phone: newCustomerPhone || 'Sin teléfono',
            email: '',
            debtBalance: 0,
            importantDateName: '',
            importantDate: '',
            notes: '',
            orderCount: 0,
            lastOrderDate: undefined,
            address: ''
        });
        updatePosOrderForm({ selectedCustomer: newId });
        setIsAddingCustomer(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
    };

    // Filter customers by search
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customers;
        return customers.filter(c =>
            c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
            c.phone.includes(customerSearch)
        );
    }, [customers, customerSearch]);

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    // Calculate change
    const change = typeof paymentWithAmount === 'number' ? paymentWithAmount - total : 0;

    const handleCheckout = async (method: 'cash' | 'card') => {
        if (cart.length === 0) return;

        // For cash payments, require payment amount and calculate change
        if (method === 'cash') {
            if (typeof paymentWithAmount !== 'number' || paymentWithAmount < total) {
                alert(`⚠️ El monto con el que paga ($${paymentWithAmount || '0'}) es insuficiente.\n\nTotal a pagar: $${total.toLocaleString()}`);
                return;
            }
        }

        // Final Stock Validation before processing
        for (const item of cart) {
            if (item.isPackage) {
                const availability = checkPackageAvailability(item.id);
                if (!availability.available) {
                    const missingList = availability.missingComponents
                        .map(c => `• ${c.productName}: faltan ${c.shortage}`)
                        .join('\n');
                    alert(`⚠️ Error de stock de último momento:\nEl ramo "${item.name}" ya no puede armarse.\n\nFaltan:\n${missingList}\n\nPor favor, quitá el item o reponé stock.`);
                    return;
                }
            } else {
                // We no longer block the sale if stock is low, allowing "Negative Stock" behavior.
                // The visual indicator in the product list is enough for the user.
            }
        }

        if (checkoutMode === 'order') {
            if (!selectedCustomer) {
                alert("Debes seleccionar un cliente para crear un pedido programado.");
                return;
            }
            if (!deliveryDate) {
                alert("Debes indicar una fecha de entrega.");
                return;
            }
            if (deliveryMethod === 'delivery' && !deliveryAddress.street) {
                alert("Debes completar la dirección de entrega.");
                return;
            }

            const customerObj = customers.find(c => c.id === selectedCustomer);
            const remainingDebt = total - advancePayment;

            await addOrder({
                id: generateIdWithPrefix('o'),
                customerName: customerObj ? customerObj.name : 'Desconocido',
                customerId: selectedCustomer,
                total: total,
                status: 'pending',
                date: new Date(deliveryDate).toISOString(),
                items: cart,
                notes: orderNotes,
                advancePayment: advancePayment,
                deliveryMethod: deliveryMethod,
                deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
                deliveryTimeSlot,
                contactPhone: deliveryMethod === 'delivery' ? contactPhone : customerObj?.phone,
            });

            if (remainingDebt > 0 && customerObj) {
                await updateCustomer(customerObj.id, {
                    debtBalance: customerObj.debtBalance + remainingDebt,
                    orderCount: (customerObj.orderCount || 0) + 1,
                    lastOrderDate: new Date().toISOString()
                });
            }

            if (advancePayment > 0) {
                await addTransaction({
                    id: generateIdWithPrefix('t'),
                    type: 'income',
                    category: 'Adelanto Pedido',
                    amount: advancePayment,
                    date: new Date().toISOString(),
                    method: method,
                    description: `Seña para Pedido Nuevo de ${customerObj ? customerObj.name : 'Desconocido'}`,
                });
            }

            // Show success notification or modal
            setShowOrderSuccessModal(true);

            // Prepare and print ticket for order
            const orderTicket: TicketData = {
                type: 'order',
                id: generateIdWithPrefix('o').toUpperCase(),
                date: new Date(deliveryDate).toISOString(),
                customerName: customerObj ? customerObj.name : 'Desconocido',
                customerPhone: customerObj?.phone,
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.qty,
                    unitPrice: item.price,
                    total: item.price * item.qty
                })),
                subtotal: total,
                total: total,
                advancePayment: advancePayment,
                paymentMethod: method,
                notes: orderNotes
            };
            setTicketData(orderTicket);
            setShowTicketPrinter(true);

        } else {
            const saleId = generateIdWithPrefix('v');

            console.log('[POS] Iniciando checkout de venta:', {
                saleId,
                total,
                items: cart,
                method,
                customerId: selectedCustomer
            });

            try {
                const success = await processSale({
                    id: saleId,
                    total,
                    date: new Date().toISOString(),
                    items: cart,
                    method,
                    notes: orderNotes,
                    customerId: selectedCustomer || undefined
                });

                console.log('[POS] Resultado de processSale:', success);

                if (success) {
                    // Show success modal
                    setLastSaleData({
                        id: saleId,
                        total,
                        method: method === 'cash' ? 'Efectivo' : 'Tarjeta/Transferencia',
                        items: [...cart],
                        date: new Date().toISOString()
                    });
                    setShowSuccessModal(true);

                    // Reset everything ONLY on success
                    clearCart();
                    setCheckoutMode('sale');
                    clearPosOrderForm();
                    setPaymentWithAmount(''); // Reset payment amount
                } else {
                    // processSale returned false - error notification already shown
                    console.warn('[POS] Venta fallida, no se resetea el carrito');
                }
            } catch (err: any) {
                // Error notification is already handled in processSale
                console.error('[POS] Checkout failed:', err);
                alert(`❌ Error al generar la venta: ${err.message || 'Error desconocido'}\n\nRevisí la consola para más detalles.`);
            }
        }
    };

    // Product filtering logic with views
    const filteredProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
            const matchesTag = !activeTag || p.tags.includes(activeTag);
            return matchesSearch && matchesCategory && matchesTag;
        });

        // Apply view sorting
        if (productView === 'recent') {
            // Sort by last sale date (most recent first)
            result = result
                .filter(p => p.lastSaleDate)
                .sort((a, b) => new Date(b.lastSaleDate!).getTime() - new Date(a.lastSaleDate!).getTime())
                .slice(0, 20); // Top 20 recent
        } else if (productView === 'top') {
            // Sort by sales count (best sellers)
            result = result
                .filter(p => p.salesCount && p.salesCount > 0)
                .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
                .slice(0, 20); // Top 20 best sellers
        } else {
            // All products - alphabetical
            result = result.sort((a, b) => a.name.localeCompare(b.name));
        }

        return result;
    }, [products, searchTerm, activeCategory, activeTag, productView]);

    const getViewTitle = () => {
        switch (productView) {
            case 'recent': return 'Últimos Vendidos';
            case 'top': return 'Más Vendidos';
            case 'all': return 'Lista Completa';
            case 'packages': return 'Ramos y Paquetes';
        }
    };

    const getTimeAgo = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `hace ${diffMins}m`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        return `hace ${diffDays}d`;
    };

    // Helper para validar fechas
    const isValidDate = (dateString: string) => {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    };

    // Toggle accordion section
    const toggleSection = (sectionNum: number) => {
        setExpandedSection(expandedSection === sectionNum ? null : sectionNum);
    };

    const getRankBadge = (index: number) => {
        if (index === 0) return '🥇 #1';
        if (index === 1) return '🥈 #2';
        if (index === 2) return '🥉 #3';
        return `#${index + 1}`;
    };

    return (
        <div className="pos-container">
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
                        <p style={{ color: '#64748b', fontWeight: 500 }}>Cargando productos...</p>
                    </div>
                </div>
            )}

            {/* Left Side: Product Catalog */}
            <div className="pos-catalog">
                <div className="pos-header">
                    <div className="pos-title-section">
                        <h1 className="text-h2">Punto de Venta</h1>
                        <p className="text-body text-muted">Seleccioná productos y gestioná tus ventas diarias</p>
                    </div>

                    {/* Search Bar */}
                    <div className="search-bar pos-search mb-3">
                        <Search className="search-icon text-muted" size={20} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar producto por nombre o código..."
                            className="form-input search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Barcode Input */}
                    <form onSubmit={handleBarcodeSubmit} className="barcode-input-wrapper flex gap-2 mb-3">
                        <input
                            id="barcode-input"
                            type="text"
                            className="form-input flex-1"
                            placeholder="📷 Escanear código de barras (o escribir código)"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary">
                            Agregar
                        </button>
                    </form>

                    {/* Keyboard shortcuts hint */}
                    <p className="text-micro text-muted flex gap-4">
                        <span><kbd className="kbd">Ctrl+F</kbd> Buscar</span>
                        <span><kbd className="kbd">Enter</kbd> Agregar primero</span>
                        <span><kbd className="kbd">Esc</kbd> Vaciar carrito</span>
                    </p>

                    {/* View Tabs */}
                    <div className="view-tabs mt-4">
                        <button
                            className={`view-tab ${productView === 'recent' ? 'active' : ''}`}
                            onClick={() => setProductView('recent')}
                        >
                            <Clock size={18} />
                            <span>Últimos Vendidos</span>
                        </button>
                        <button
                            className={`view-tab ${productView === 'top' ? 'active' : ''}`}
                            onClick={() => setProductView('top')}
                        >
                            <Award size={18} />
                            <span>Más Vendidos</span>
                        </button>
                        <button
                            className={`view-tab ${productView === 'all' ? 'active' : ''}`}
                            onClick={() => setProductView('all')}
                        >
                            <List size={18} />
                            <span>Productos</span>
                        </button>
                        <button
                            className={`view-tab ${productView === 'packages' ? 'active' : ''}`}
                            onClick={() => setProductView('packages')}
                        >
                            <ShoppingCart size={18} />
                            <span>Ramos</span>
                        </button>
                    </div>

                    {/* Category & Tag Filters */}
                    <div className="filters-section mt-4">
                        <div className="category-filters flex gap-2 overflow-x-auto pb-2">
                            <button
                                className={`category-chip ${activeCategory === 'Todos' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('Todos')}
                            >
                                Todos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}
                                    title={`Filtrar por ${cat}`}
                                >
                                    {cat}
                                </button>
                            ))}
                            {products.some(p => p.category === 'Sin Categoría') && (
                                <button
                                    className={`category-chip ${activeCategory === 'Sin Categoría' ? 'active' : ''}`}
                                    onClick={() => setActiveCategory('Sin Categoría')}
                                    title="Ver productos sin categoría asignada"
                                >
                                    Sin Categoría
                                </button>
                            )}
                        </div>

                        {/* Custom Tag Filters */}
                        {tags.length > 0 && (
                            <div className="tag-filters flex gap-2 overflow-x-auto pb-2 mt-2">
                                <button
                                    className={`tag-chip ${activeTag === null ? 'active' : ''}`}
                                    onClick={() => setActiveTag(null)}
                                >
                                    <Sparkles size={12} />
                                    Todos los filtros
                                </button>
                                {tags.map(tag => (
                                    <button
                                        key={tag}
                                        className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
                                        onClick={() => setActiveTag(tag)}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Product List */}
                <div className="product-list-container">
                    <div className="product-list-header">
                        <div className="flex items-center gap-2">
                            {productView === 'recent' && <Clock size={18} className="text-primary" />}
                            {productView === 'top' && <TrendingUp size={18} className="text-primary" />}
                            {productView === 'all' && <List size={18} className="text-primary" />}
                            {productView === 'packages' && <ShoppingCart size={18} className="text-primary" />}
                            <span className="text-small font-semibold">{getViewTitle()}</span>
                            <span className="text-micro text-muted">
                                ({productView === 'packages' ? packages.length : filteredProducts.length})
                            </span>
                        </div>
                    </div>

                    <div className="product-list">
                        {productView === 'packages'
                            ? packages.filter(pkg => pkg.isActive).map((pkg) => {
                                // Package View
                                const availability = checkPackageAvailability(pkg.id);
                                return (
                                    <div
                                        key={pkg.id}
                                        className={`product-list-item ${!availability.available ? 'out-of-stock' : ''}`}
                                        onClick={() => availability.available && addPackageToCart(pkg)}
                                        style={!availability.available ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                                    >
                                        <div className="product-list-main">
                                            <div className="product-list-info">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="product-list-name">{pkg.name}</h3>
                                                    <span className="product-list-price">${pkg.price.toLocaleString()}</span>
                                                </div>
                                                <div className="product-list-meta">
                                                    <span className="text-micro text-muted">{pkg.section}</span>
                                                    {!availability.available && (
                                                        <span className="text-micro text-danger font-bold">• Faltan flores</span>
                                                    )}
                                                </div>
                                                {/* Recipe Preview */}
                                                <div className="recipe-preview mt-2">
                                                    {pkg.items.map((comp: any, idx: number) => {
                                                        const p = products.find(prod => prod.id === comp.productId);
                                                        const isShort = (p?.stock || 0) < comp.quantity;
                                                        return (
                                                            <span key={idx} className={`recipe-tag ${isShort ? 'text-danger' : 'text-muted'}`}>
                                                                {comp.quantity}x {p?.name || 'Producto'}
                                                                {isShort && ` (disp. ${p?.stock || 0})`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="product-list-actions">
                                            <span className={`stock-badge ${availability.available ? 'in' : 'out'}`}>
                                                {availability.available ? '✅ Armable' : '❌ Falta Stock'}
                                            </span>
                                            {availability.available ? (
                                                <button className="add-to-cart-btn" onClick={(e) => {
                                                    e.stopPropagation();
                                                    addPackageToCart(pkg);
                                                }}>
                                                    <Plus size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="add-to-cart-btn"
                                                    style={{ background: 'var(--color-danger)', opacity: 0.5, cursor: 'not-allowed' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const missingList = availability.missingComponents
                                                            .map(c => `• ${c.productName}: faltan ${c.shortage}`)
                                                            .join('\n');
                                                        alert(`⚠️ No se puede vender\n\nFaltan componentes:\n${missingList}`);
                                                    }}
                                                >
                                                    <AlertCircle size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                            : filteredProducts.map((item, index) => (
                                // Product View
                                <div
                                    key={item.id}
                                    className={`product-list-item ${item.stock === 0 ? 'out-of-stock-pos' : ''}`}
                                    onClick={() => addToCart(item)}
                                    style={item.stock === 0 ? { borderLeft: '4px solid var(--color-warning)' } : {}}
                                >
                                    <div className="product-list-main">
                                        <div className="product-list-info">
                                            <h3 className="product-list-name">{item.name}</h3>
                                            <div className="product-list-meta">
                                                <span className="text-micro text-muted">{item.category}</span>
                                                {item.stock < item.min && (
                                                    <span className="text-micro text-danger">• Stock bajo</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="product-list-actions">
                                        {productView === 'top' && (
                                            <span className="rank-badge">{getRankBadge(index)}</span>
                                        )}
                                        {productView === 'recent' && (
                                            <span className="time-badge">{getTimeAgo(item.lastSaleDate)}</span>
                                        )}
                                        <span className="product-list-price">${item.price.toLocaleString()}</span>
                                        <span className={`stock-badge ${item.stock === 0 ? 'out' : item.stock < item.min ? 'low' : 'in'}`}>
                                            {item.stock} disp.
                                        </span>
                                        <button className="add-to-cart-btn" onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(item);
                                            }}>
                                                <Plus size={18} />
                                            </button>
                                    </div>
                                </div>
                            ))
                        }

                        {filteredProducts.length === 0 && productView !== 'packages' && (
                            <div className="empty-products-msg">
                                <Search size={48} className="text-muted mb-4 opacity-30" />
                                <p className="text-body text-center font-medium">
                                    No se encontraron productos.<br />
                                    Intentá con otro filtro o búsqueda.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side: Shopping Cart & Checkout */}
            <div className="pos-cart-panel card">
                {/* Cart Header - FIXED */}
                <div className="cart-header">
                    <div className="pos-tabs">
                        <button
                            className={`pos-tab pos-tab-strong ${checkoutMode === 'sale' ? 'active-sale' : 'inactive'}`}
                            onClick={() => setCheckoutMode('sale')}
                        >
                            <ShoppingCart size={16} />
                            <span>Venta Rápida</span>
                        </button>
                        <button
                            className={`pos-tab pos-tab-strong ${checkoutMode === 'order' ? 'active-order' : 'inactive'}`}
                            onClick={() => setCheckoutMode('order')}
                        >
                            <Calendar size={16} />
                            <span>Pedir Después</span>
                        </button>
                    </div>

                    <div className="cart-header-title">
                        <div className="flex justify-between items-center">
                            <h2 className="text-h3">Carrito</h2>
                            <div className="flex gap-2">
                                <button
                                    className="btn-icon text-primary"
                                    onClick={() => setShowTemplatesModal(true)}
                                    title="Cargar pedido frecuente"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>
                        <span className="badge badge-warning text-small">{itemCount} items</span>
                    </div>
                </div>

                {/* Cart Items & Order Form - Unified Scrollable Area */}
                <div className="cart-scroll-container">
                    <div className="cart-items-section">
                        {cart.length === 0 ? (
                            <div className="empty-cart-msg">
                                <ShoppingCart size={48} className="text-muted mb-2 opacity-20" />
                                <p className="text-body text-center font-medium">
                                    Bandeja vacía.<br />
                                    Seleccioná productos.
                                </p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={`${item.id}-${idx}`} className="cart-line-item">
                                    <div className="cart-line-details">
                                        <h4 className="font-bold text-small line-clamp-1">{item.name}</h4>
                                        <p className="text-micro text-muted">${item.price.toLocaleString()} c/u</p>
                                    </div>

                                    <div className="cart-line-actions">
                                        <div className="qty-controls">
                                            <button className="qty-btn" onClick={() => updateQty(item.id, -1)} title="Disminuir cantidad">
                                                <Minus size={10} />
                                            </button>
                                            <span className="qty-value">{item.qty}</span>
                                            <button className="qty-btn" onClick={() => updateQty(item.id, 1)} title="Aumentar cantidad">
                                                <Plus size={10} />
                                            </button>
                                        </div>

                                        <div className="cart-line-total font-bold">
                                            ${(item.price * item.qty).toLocaleString()}
                                        </div>

                                        <button
                                            className="btn-icon text-danger"
                                            onClick={() => removeFromCart(item.id)}
                                            title="Quitar del carrito (Esc)"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {checkoutMode === 'order' && (
                        /* PEDIR PARA DESPUÉS - Formulario con Acordeón */
                        <div className="order-form-scrollable">
                            {/* Step 1: Customer */}
                            <div className="order-form-section">
                                <div
                                    className={`section-header ${expandedSection === 1 ? 'expanded' : ''}`}
                                    onClick={() => toggleSection(1)}
                                >
                                    <div className="section-title-row">
                                        <span className="section-number">1</span>
                                        <h4 className="section-title">Cliente</h4>
                                    </div>
                                    {selectedCustomer && (
                                        <span className="selected-value">
                                            {customers.find(c => c.id === selectedCustomer)?.name}
                                        </span>
                                    )}
                                    <ChevronDown size={18} className={`section-expand-icon ${expandedSection === 1 ? 'expanded' : ''}`} />
                                </div>

                                {expandedSection === 1 && (
                                    <div className="section-content expanded">
                                        <div className="search-input-wrapper">
                                            <Search size={16} className="search-icon" />
                                            <input
                                                type="text"
                                                className="form-input customer-search-input"
                                                placeholder="Buscar cliente..."
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>

                                        <div className="customer-list-compact">
                                            {filteredCustomers.slice(0, 6).map(customer => (
                                                <button
                                                    key={customer.id}
                                                    className={`customer-list-item-compact ${selectedCustomer === customer.id ? 'selected' : ''}`}
                                                    onClick={() => updatePosOrderForm({ selectedCustomer: customer.id })}
                                                >
                                                    <div className="customer-list-info">
                                                        <span className="customer-list-name">{customer.name}</span>
                                                        <span className="customer-list-phone">{customer.phone}</span>
                                                    </div>
                                                    {selectedCustomer === customer.id && (
                                                        <Check size={16} className="text-primary" />
                                                    )}
                                                </button>
                                            ))}
                                            <button
                                                className="customer-list-item-compact new-customer-btn"
                                                onClick={() => setIsAddingCustomer(true)}
                                            >
                                                <div className="customer-list-info">
                                                    <span className="customer-list-name">+ Nuevo Cliente</span>
                                                    <span className="customer-list-phone">Crear en agenda</span>
                                                </div>
                                            </button>
                                        </div>

                                        {isAddingCustomer && (
                                            <div className="new-customer-form-compact">
                                                <input
                                                    type="text"
                                                    className="form-input mb-2"
                                                    placeholder="Nombre completo"
                                                    value={newCustomerName}
                                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                                />
                                                <input
                                                    type="tel"
                                                    className="form-input mb-2"
                                                    placeholder="Teléfono"
                                                    value={newCustomerPhone}
                                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        className="btn btn-sm btn-success flex-1"
                                                        onClick={handleAddCustomer}
                                                        disabled={!newCustomerName.trim()}
                                                    >
                                                        <Check size={14} /> Guardar
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-secondary flex-1"
                                                        onClick={() => setIsAddingCustomer(false)}
                                                    >
                                                        <X size={14} /> Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Delivery */}
                            <div className="order-form-section">
                                <div
                                    className={`section-header ${expandedSection === 2 ? 'expanded' : ''}`}
                                    onClick={() => toggleSection(2)}
                                >
                                    <div className="section-title-row">
                                        <span className="section-number">2</span>
                                        <h4 className="section-title">Entrega</h4>
                                    </div>
                                    <ChevronDown size={18} className={`section-expand-icon ${expandedSection === 2 ? 'expanded' : ''}`} />
                                </div>

                                {expandedSection === 2 && (
                                    <div className="section-content expanded">
                                        <div className="delivery-method-toggle">
                                            <button
                                                className={`toggle-btn ${deliveryMethod === 'pickup' ? 'active' : ''}`}
                                                onClick={() => updatePosOrderForm({ deliveryMethod: 'pickup' })}
                                            >
                                                <Store size={14} />
                                                <span>Local</span>
                                            </button>
                                            <button
                                                className={`toggle-btn ${deliveryMethod === 'delivery' ? 'active' : ''}`}
                                                onClick={() => updatePosOrderForm({ deliveryMethod: 'delivery' })}
                                            >
                                                <Truck size={14} />
                                                <span>Domicilio</span>
                                            </button>
                                        </div>

                                        {deliveryMethod === 'delivery' && (
                                            <>
                                                <div className="form-row-compact mt-3">
                                                    <div className="form-group-compact flex-1">
                                                        <label className="form-label-compact">Calle</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Calle"
                                                            value={deliveryAddress.street}
                                                            onChange={(e) => updatePosOrderForm({ deliveryAddress: { ...deliveryAddress, street: e.target.value } })}
                                                        />
                                                    </div>
                                                    <div className="form-group-compact" style={{ width: '70px' }}>
                                                        <label className="form-label-compact">N°</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="N°"
                                                            value={deliveryAddress.number}
                                                            onChange={(e) => updatePosOrderForm({ deliveryAddress: { ...deliveryAddress, number: e.target.value } })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-row-compact mt-2">
                                                    <div className="form-group-compact" style={{ width: '70px' }}>
                                                        <label className="form-label-compact">Piso</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Piso"
                                                            value={deliveryAddress.floor}
                                                            onChange={(e) => updatePosOrderForm({ deliveryAddress: { ...deliveryAddress, floor: e.target.value } })}
                                                        />
                                                    </div>
                                                    <div className="form-group-compact flex-1">
                                                        <label className="form-label-compact">Localidad</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Localidad"
                                                            value={deliveryAddress.city}
                                                            onChange={(e) => updatePosOrderForm({ deliveryAddress: { ...deliveryAddress, city: e.target.value } })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-group-compact mt-2">
                                                    <label className="form-label-compact">Teléfono</label>
                                                    <input
                                                        type="tel"
                                                        className="form-input"
                                                        placeholder="11-2345-6789"
                                                        value={contactPhone}
                                                        onChange={(e) => updatePosOrderForm({ contactPhone: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {deliveryMethod === 'pickup' && (
                                            <div className="pickup-info-compact">
                                                <Store size={16} className="text-primary" />
                                                <span className="text-small">Retiro sin cargo en local</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Step 3: Date & Time */}
                            <div className="order-form-section">
                                <div
                                    className={`section-header ${expandedSection === 3 ? 'expanded' : ''}`}
                                    onClick={() => toggleSection(3)}
                                >
                                    <div className="section-title-row">
                                        <span className="section-number">3</span>
                                        <h4 className="section-title">Fecha</h4>
                                    </div>
                                    <ChevronDown size={18} className={`section-expand-icon ${expandedSection === 3 ? 'expanded' : ''}`} />
                                </div>

                                {expandedSection === 3 && (
                                    <div className="section-content expanded">
                                        <div className="form-row-compact">
                                            <div className="form-group-compact flex-1">
                                                <label className="form-label-compact">Fecha</label>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    value={deliveryDate}
                                                    onChange={(e) => updatePosOrderForm({ deliveryDate: e.target.value })}
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                            <div className="form-group-compact flex-1">
                                                <label className="form-label-compact">Horario</label>
                                                <select
                                                    className="form-input"
                                                    value={deliveryTimeSlot}
                                                    onChange={(e) => updatePosOrderForm({ deliveryTimeSlot: e.target.value as any })}
                                                >
                                                    <option value="allday">Todo el día</option>
                                                    <option value="morning">Mañana (9-13hs)</option>
                                                    <option value="afternoon">Tarde (14-18hs)</option>
                                                    <option value="evening">Noche (18-21hs)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-group-compact mt-2">
                                            <label className="form-label-compact">Notas</label>
                                            <textarea
                                                className="form-input notes-input-compact"
                                                rows={2}
                                                placeholder="Ej: Tarjeta, moño..."
                                                value={orderNotes}
                                                onChange={(e) => updatePosOrderForm({ orderNotes: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Summary & Confirm - Always Visible */}
                            <div className="order-summary-compact">
                                <div className="summary-row">
                                    <span className="summary-label">Total</span>
                                    <span className="summary-amount">${total.toLocaleString()}</span>
                                </div>
                                {selectedCustomer && (
                                    <div className="summary-row">
                                        <span className="summary-label">Cliente</span>
                                        <span className="summary-value">{customers.find(c => c.id === selectedCustomer)?.name}</span>
                                    </div>
                                )}
                                {deliveryDate && isValidDate(deliveryDate) && (
                                    <div className="summary-row">
                                        <span className="summary-label">Entrega</span>
                                        <span className="summary-value">
                                            {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(deliveryDate))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="advance-payment-mini">
                                <label className="checkbox-label-mini">
                                    <input
                                        type="checkbox"
                                        checked={advancePayment > 0}
                                        onChange={(e) => updatePosOrderForm({ advancePayment: e.target.checked ? Math.min(1000, total) : 0 })}
                                    />
                                    <span className="checkbox-text-mini">Seña:</span>
                                </label>
                                {advancePayment > 0 && (
                                    <div className="advance-input-mini">
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={advancePayment}
                                            onChange={(e) => updatePosOrderForm({ advancePayment: Number(e.target.value) })}
                                            min="0"
                                            max={total}
                                        />
                                    </div>
                                )}
                            </div>

                            {advancePayment > 0 && (
                                <div className="pending-amount-mini">
                                    <span>Pendiente:</span>
                                    <span className="amount">${(total - advancePayment).toLocaleString()}</span>
                                </div>
                            )}

                            <button
                                className="btn-confirm-order-mini"
                                onClick={() => handleCheckout('cash')}
                                disabled={cart.length === 0 || !selectedCustomer || !deliveryDate}
                            >
                                <Check size={18} />
                                Confirmar Pedido
                            </button>
                        </div>
                    )}
                </div>

                {/* Cart Footer - FIXED for Sale Mode */}
                {checkoutMode === 'sale' && (
                    <div className="cart-footer">
                        <div className="sale-checkout-compact">
                            <div className="cart-totals-compact">
                                <span className="total-label">Total a Pagar</span>
                                <span className="total-amount">${total.toLocaleString()}</span>
                            </div>

                            {/* Payment Amount Input */}
                            <div className="payment-with-section">
                                <label className="payment-with-label">
                                    <Banknote size={16} />
                                    <span>Pago con:</span>
                                </label>
                                <input
                                    type="number"
                                    className="form-input payment-with-input"
                                    placeholder="Ingresá el monto con el que paga"
                                    value={paymentWithAmount}
                                    onChange={(e) => setPaymentWithAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                    min="0"
                                    step="0.01"
                                />
                                {typeof paymentWithAmount === 'number' && (
                                    <div className={`change-display ${change < 0 ? 'change-insufficient' : ''}`}>
                                        <span className="change-label">
                                            {change >= 0 ? '💵 Vuelto a devolver:' : '⚠️ Falta:'}
                                        </span>
                                        <span className={`change-amount ${change >= 0 ? 'change-positive' : 'change-negative'}`}>
                                            ${Math.abs(change).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="payment-buttons-compact">
                                <button
                                    className="payment-btn-compact payment-cash"
                                    disabled={cart.length === 0 || (typeof paymentWithAmount === 'number' && paymentWithAmount < total)}
                                    onClick={() => handleCheckout('cash')}
                                    title="Pagar en efectivo"
                                >
                                    <Banknote size={20} />
                                    <span>Efectivo</span>
                                </button>
                                <button
                                    className="payment-btn-compact payment-card"
                                    disabled={cart.length === 0}
                                    onClick={() => handleCheckout('card')}
                                    title="Pagar con tarjeta o transferencia"
                                >
                                    <CreditCard size={20} />
                                    <span>Tarjeta</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Success Modal */}
            {showSuccessModal && lastSaleData && (
                <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
                    <div className="success-modal" onClick={e => e.stopPropagation()}>
                        <button className="success-modal-close" onClick={() => setShowSuccessModal(false)}>
                            <X size={20} />
                        </button>
                        <div className="success-modal-icon">
                            <Check size={48} className="text-white" />
                        </div>
                        <h2 className="success-modal-title">¡Venta Realizada!</h2>
                        <p className="success-modal-text">
                            Se cobró <strong>${lastSaleData.total.toLocaleString()}</strong> en <strong>{lastSaleData.method}</strong>
                        </p>
                        <div className="success-modal-info">
                            <p className="text-small text-muted">Podés visualizar esta venta en:</p>
                            <ul className="success-modal-links">
                                <li><span className="link-icon">📊</span> Ventas del Día</li>
                                <li><span className="link-icon">📋</span> Historial de Movimientos</li>
                            </ul>
                        </div>
                        <div className="success-modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowSuccessModal(false)}
                            >
                                Cerrar
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    setTicketData({
                                        type: 'sale',
                                        id: lastSaleData.id,
                                        date: lastSaleData.date,
                                        items: lastSaleData.items.map(item => ({
                                            name: item.name,
                                            quantity: item.qty,
                                            unitPrice: item.price,
                                            total: item.price * item.qty
                                        })),
                                        subtotal: lastSaleData.total,
                                        total: lastSaleData.total,
                                        paymentMethod: lastSaleData.method
                                    });
                                    setShowTicketPrinter(true);
                                    setShowSuccessModal(false);
                                }}
                            >
                                <Printer size={18} />
                                Imprimir Ticket
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Success Modal */}
            {showOrderSuccessModal && (
                <div className="modal-overlay" onClick={() => setShowOrderSuccessModal(false)}>
                    <div className="order-success-modal" onClick={e => e.stopPropagation()}>
                        <div className="order-success-icon">
                            <Check size={40} className="text-white" />
                        </div>
                        <h2 className="order-success-title">¡Pedido Creado!</h2>
                        <p className="order-success-text">
                            El pedido fue registrado exitosamente
                        </p>
                        <div className="order-success-details">
                            <div className="order-success-row">
                                <span className="order-success-label">Cliente</span>
                                <span className="order-success-value">
                                    {customers.find(c => c.id === selectedCustomer)?.name}
                                </span>
                            </div>
                            <div className="order-success-row">
                                <span className="order-success-label">Entrega</span>
                                <span className="order-success-value">
                                    {deliveryDate && isValidDate(deliveryDate)
                                        ? new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(deliveryDate))
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="order-success-row">
                                <span className="order-success-label">Total</span>
                                <span className="order-success-value">${total.toLocaleString()}</span>
                            </div>
                            {advancePayment > 0 && (
                                <div className="order-success-row">
                                    <span className="order-success-label">Seña</span>
                                    <span className="order-success-value">${advancePayment.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="order-success-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowOrderSuccessModal(false)}
                            >
                                Cerrar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowOrderSuccessModal(false);
                                    // Could navigate to Orders page here
                                }}
                            >
                                Ver Pedidos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Printer */}
            {showTicketPrinter && ticketData && (
                <TicketPrinter
                    ticketData={ticketData}
                    isOpen={showTicketPrinter}
                    onClose={() => {
                        setShowTicketPrinter(false);
                        setTicketData(null);
                    }}
                    shopName="Florería Aster"
                    shopPhone="11-1234-5678"
                    shopAddress="Calle de las Rosas 789"
                />
            )}

            {/* Order Templates Modal */}
            <OrderTemplatesModal
                isOpen={showTemplatesModal}
                onClose={() => setShowTemplatesModal(false)}
                onLoadTemplate={(template) => {
                    // Cargar items de la plantilla al carrito
                    template.items.forEach(item => {
                        addToCart({
                            id: item.product_id,
                            name: item.product_name,
                            price: item.unit_price,
                            qty: item.quantity
                        });
                    });

                    // Si la plantilla tiene cliente, seleccionarlo
                    if (template.customer_id) {
                        updatePosOrderForm({ selectedCustomer: template.customer_id });
                    }

                    // Si la plantilla tiene método de entrega, usarlo
                    if (template.delivery_method) {
                        updatePosOrderForm({ deliveryMethod: template.delivery_method as any });
                    }
                }}
            />
        </div>
    );
};
