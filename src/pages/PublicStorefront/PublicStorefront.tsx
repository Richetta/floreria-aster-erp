import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
    ShoppingBag, Search, Plus, Minus, X, Check, 
    MessageCircle, MapPin, Calendar, Clock,
    ShoppingCart, Sparkles, Send, Store,
    Star, ChevronLeft, ChevronRight
} from 'lucide-react';
import './PublicStorefront.css';

// API Configuration
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`);

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    images?: string[];
}

export const PublicStorefront = () => {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const [searchParams] = useSearchParams();
    
    // Config and data states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [storeConfig, setStoreConfig] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [combos, setCombos] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    
    // UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'success'>('cart');
    const [mpStatus, setMpStatus] = useState<string | null>(null);
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
    
    // Detailed Item & Reviews States
    const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);
    const [detailReviews, setDetailReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [reviewAuthor, setReviewAuthor] = useState('');
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isAddingReview, setIsAddingReview] = useState(false);
    const [detailQty, setDetailQty] = useState(1);

    // General store reviews states
    const [generalReviews, setGeneralReviews] = useState<any[]>([]);
    const [isGeneralReviewsOpen, setIsGeneralReviewsOpen] = useState(false);
    const [isAddingGeneralReview, setIsAddingGeneralReview] = useState(false);
    
    // Checkout form state
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formDeliveryMethod, setFormDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
    const [formDeliveryDate, setFormDeliveryDate] = useState('');
    const [formDeliverySlot, setFormDeliverySlot] = useState<'morning' | 'afternoon' | 'evening' | 'allday'>('allday');
    const [formStreet, setFormStreet] = useState('');
    const [formNumber, setFormNumber] = useState('');
    const [formFloor, setFormFloor] = useState('');
    const [formCity, setFormCity] = useState('');
    const [formReference, setFormReference] = useState('');
    const [formCardMessage, setFormCardMessage] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formPaymentMethod, setFormPaymentMethod] = useState<'whatsapp' | 'mercadopago'>('whatsapp');
    
    // Submitting order loader
    const [submittingOrder, setSubmittingOrder] = useState(false);
    
    // Load Outfit Font dynamically
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Load store configuration and products
    useEffect(() => {
        const fetchStoreConfig = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API_BASE_URL}/storefront/config/${storeSlug}`);
                if (!response.ok) {
                    throw new Error('No se pudo encontrar la tienda pública especificada.');
                }
                const data = await response.json();
                setStoreConfig(data);
                setProducts(data.products || []);
                setCombos(data.combos || []);
                setCategories(data.categories || []);
                setError(null);
            } catch (err: any) {
                setError(err.message || 'Error al cargar la tienda online.');
            } finally {
                setLoading(false);
            }
        };

        if (storeSlug) {
            fetchStoreConfig();
        }
    }, [storeSlug]);

    // Check MercadoPago redirect query params on load
    useEffect(() => {
        const status = searchParams.get('mp_status');
        const orderId = searchParams.get('order_id');
        if (status && orderId) {
            setMpStatus(status);
            setCreatedOrderId(orderId);
            setCheckoutStep('success');
            setIsCartOpen(true);
        }
    }, [searchParams]);

    // Set brand theme colors dynamically
    useEffect(() => {
        if (storeConfig?.settings?.theme_color) {
            const color = storeConfig.settings.theme_color;
            document.documentElement.style.setProperty('--storefront-primary', color);
            document.documentElement.style.setProperty('--storefront-primary-light', `${color}15`);
            document.documentElement.style.setProperty('--storefront-primary-hover', adjustColorBrightness(color, -15));
        }
    }, [storeConfig]);

    // Fetch reviews for selected product/combo
    useEffect(() => {
        const fetchItemReviews = async () => {
            if (!selectedDetailItem || !storeSlug) return;
            try {
                setLoadingReviews(true);
                const itemIdQuery = selectedDetailItem.isCombo 
                    ? `package_id=${selectedDetailItem.id}` 
                    : `product_id=${selectedDetailItem.id}`;
                const response = await fetch(`${API_BASE_URL}/storefront/reviews/${storeSlug}?${itemIdQuery}`);
                if (response.ok) {
                    const data = await response.json();
                    setDetailReviews(data || []);
                }
            } catch (err) {
                console.error('Error fetching reviews:', err);
            } finally {
                setLoadingReviews(false);
            }
        };

        fetchItemReviews();
        setActiveImageIndex(0);
        setIsAddingReview(false);
        setDetailQty(1);
    }, [selectedDetailItem, storeSlug]);

    // Fetch general reviews for the storefront
    useEffect(() => {
        const fetchGeneralReviews = async () => {
            if (!storeSlug) return;
            try {
                const response = await fetch(`${API_BASE_URL}/storefront/reviews/${storeSlug}?type=general`);
                if (response.ok) {
                    const data = await response.json();
                    setGeneralReviews(data || []);
                }
            } catch (err) {
                console.error('Error fetching general reviews:', err);
            }
        };

        fetchGeneralReviews();
    }, [storeSlug]);

    // Submit review handler
    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewAuthor.trim() || !storeSlug) return;

        try {
            setSubmittingReview(true);
            const payload = {
                author_name: reviewAuthor,
                rating: reviewRating,
                comment: reviewComment || null,
                product_id: selectedDetailItem?.isCombo ? null : selectedDetailItem?.id,
                package_id: selectedDetailItem?.isCombo ? selectedDetailItem?.id : null
            };

            const response = await fetch(`${API_BASE_URL}/storefront/reviews/${storeSlug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const newRev = await response.json();
                setDetailReviews(prev => [newRev, ...prev]);
                setReviewAuthor('');
                setReviewComment('');
                setReviewRating(5);
                setIsAddingReview(false);
                alert('¡Gracias por tu reseña! Tu opinión es muy importante.');
            } else {
                throw new Error('Error al enviar la reseña');
            }
        } catch (err: any) {
            alert(err.message || 'Error al enviar la reseña.');
        } finally {
            setSubmittingReview(false);
        }
    };

    // Submit general store review handler
    const handleGeneralReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewAuthor.trim() || !storeSlug) return;

        try {
            setSubmittingReview(true);
            const payload = {
                author_name: reviewAuthor,
                rating: reviewRating,
                comment: reviewComment || null,
                product_id: null,
                package_id: null
            };

            const response = await fetch(`${API_BASE_URL}/storefront/reviews/${storeSlug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const newRev = await response.json();
                setGeneralReviews(prev => [newRev, ...prev]);
                setReviewAuthor('');
                setReviewComment('');
                setReviewRating(5);
                setIsAddingGeneralReview(false);
                alert('¡Gracias por calificar nuestra tienda!');
            } else {
                throw new Error('Error al enviar la reseña');
            }
        } catch (err: any) {
            alert(err.message || 'Error al enviar la calificación.');
        } finally {
            setSubmittingReview(false);
        }
    };

    // Utility: Adjust Hex Color Brightness for hover effects
    const adjustColorBrightness = (hex: string, percent: number) => {
        let R = parseInt(hex.substring(1, 3), 16);
        let G = parseInt(hex.substring(3, 5), 16);
        let B = parseInt(hex.substring(5, 7), 16);

        R = Math.max(0, Math.min(255, R + percent));
        G = Math.max(0, Math.min(255, G + percent));
        B = Math.max(0, Math.min(255, B + percent));

        const rHex = R.toString(16).padStart(2, '0');
        const gHex = G.toString(16).padStart(2, '0');
        const bHex = B.toString(16).padStart(2, '0');

        return `#${rHex}${gHex}${bHex}`;
    };

    // Cart Helper Actions
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { id: product.id, name: product.name, price: Number(product.price), quantity: 1, images: product.images }];
        });
    };

    // Cart Helper with specific quantity
    const addToCartWithQty = (product: any, qty: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
            }
            return [...prev, { id: product.id, name: product.name, price: Number(product.price), quantity: qty, images: product.images }];
        });
    };

    const updateQuantity = (productId: string, amount: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === productId) {
                    const newQty = item.quantity + amount;
                    return newQty > 0 ? { ...item, quantity: newQty } : null;
                }
                return item;
            }).filter((item): item is CartItem => item !== null);
        });
    };

    const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalCartAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Dynamic catalog filtering (combines products & published combos)
    const filteredItems = [
        ...products.map(p => ({ ...p, isCombo: false })),
        ...combos.map(c => ({ ...c, price: c.suggested_price, isCombo: true }))
    ].filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
        
        if (selectedCategory === 'combos') {
            return matchesSearch && item.isCombo;
        }
        
        const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
        return matchesSearch && matchesCategory && !item.isCombo;
    });

    // Formatting currency ARS
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(amount);
    };

    // Submit Guest Order Flow
    const handleCheckoutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0 || !storeSlug || !storeConfig) return;

        try {
            setSubmittingOrder(true);
            
            // 1. Prepare Order Payload
            const orderPayload = {
                slug: storeSlug,
                guest_name: formName,
                guest_phone: formPhone,
                delivery_date: formDeliveryDate,
                delivery_method: formDeliveryMethod,
                delivery_address: formDeliveryMethod === 'delivery' ? {
                    street: formStreet,
                    number: formNumber,
                    floor: formFloor,
                    city: formCity,
                    reference: formReference
                } : undefined,
                delivery_time_slot: formDeliverySlot,
                contact_phone: formPhone,
                card_message: formCardMessage || undefined,
                notes: formNotes || undefined,
                payment_method: formPaymentMethod,
                items: cart.map(item => ({
                    product_id: item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price
                }))
            };

            // 2. Call backend to create the pending order
            const orderResponse = await fetch(`${API_BASE_URL}/storefront/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!orderResponse.ok) {
                throw new Error('Error al registrar el pedido en el ERP.');
            }

            const orderResult = await orderResponse.json();
            console.log('[Storefront Checkout] Created local pending order:', orderResult);

            // 3. Handle Flow by Payment Method
            if (formPaymentMethod === 'whatsapp') {
                // WhatsApp Flow: construct click-to-chat redirect text
                const orderNum = orderResult.order_number || orderResult.id.substring(0, 8);
                const businessPhone = storeConfig.settings?.whatsapp_number || storeConfig.business?.phone || '';
                
                const itemsText = cart.map(item => `• *${item.quantity}x* ${item.name} (${formatCurrency(item.price * item.quantity)})`).join('\n');
                
                const deliveryText = formDeliveryMethod === 'delivery'
                    ? `📍 *Envío a domicilio*:\n  Calle: ${formStreet} ${formNumber}\n  Piso/Dpto: ${formFloor || '-'}\n  Localidad: ${formCity}\n  Referencia: ${formReference || '-'}`
                    : `🏪 *Retiro en local* (Take Away)`;

                const waMessage = `Hola! Quiero confirmar mi Pedido *#${orderNum}* realizado desde tu Tienda Online:\n\n` +
                                  `👤 *Cliente*: ${formName}\n` +
                                  `📞 *Contacto*: ${formPhone}\n\n` +
                                  `🛒 *Detalle del Pedido*:\n${itemsText}\n\n` +
                                  `🚚 *Entrega*: ${formDeliveryDate} (${formDeliverySlot === 'morning' ? 'Mañana' : formDeliverySlot === 'afternoon' ? 'Tarde' : formDeliverySlot === 'evening' ? 'Noche' : 'Todo el día'})\n` +
                                  `${deliveryText}\n\n` +
                                  (formCardMessage ? `💌 *Mensaje de Tarjeta*:\n"${formCardMessage}"\n\n` : '') +
                                  `💵 *Total del Pedido*: *${formatCurrency(totalCartAmount)}*\n\n` +
                                  `Por favor, indícame los detalles de transferencia/efectivo para completar mi pedido. ¡Gracias!`;

                // Clean phone number
                const cleanPhone = businessPhone.replace(/[^0-9]/g, '');
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
                
                // Clear cart and redirect
                setCart([]);
                setIsCartOpen(false);
                setCheckoutStep('cart');
                window.open(waUrl, '_blank');

            } else if (formPaymentMethod === 'mercadopago') {
                // MercadoPago Flow: call backend to create checkout preference
                const preferencePayload = {
                    slug: storeSlug,
                    order_id: orderResult.id,
                    items: cart.map(item => ({
                        title: item.name,
                        quantity: item.quantity,
                        unit_price: item.price
                    }))
                };

                const mpResponse = await fetch(`${API_BASE_URL}/storefront/mercadopago/preference`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(preferencePayload)
                });

                if (!mpResponse.ok) {
                    throw new Error('Error al inicializar la pasarela de pagos.');
                }

                const mpResult = await mpResponse.json();
                console.log('[Storefront Checkout] Created MP Preference:', mpResult);

                // Redirect to MercadoPago
                window.location.href = mpResult.init_point;
            }

        } catch (err: any) {
            alert(err.message || 'Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
        } finally {
            setSubmittingOrder(false);
        }
    };

    // WhatsApp Confirm Receipt for Paid orders
    const handleSendPaidReceipt = () => {
        if (!storeConfig) return;
        const businessPhone = storeConfig.settings?.whatsapp_number || storeConfig.business?.phone || '';
        const cleanPhone = businessPhone.replace(/[^0-9]/g, '');
        
        const message = `¡Hola! Acabo de pagar en línea mi Pedido con id: #${createdOrderId?.substring(0, 8)} desde tu Tienda Online.\n` +
                        `Por favor, confirmarías si ya recibieron el pago? ¡Gracias!`;
                        
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    if (loading) {
        return (
            <div className="store-loading-screen">
                <div className="spinner"></div>
                <p>Cargando catálogo...</p>
            </div>
        );
    }

    if (error || !storeConfig) {
        return (
            <div className="store-error-screen">
                <div className="error-card">
                    <X size={48} className="text-error" />
                    <h2>Tienda no disponible</h2>
                    <p>{error || 'No pudimos cargar la configuración del catálogo.'}</p>
                </div>
            </div>
        );
    }

    // Inactive Store View
    if (storeConfig.settings?.active === false) {
        return (
            <div className="store-closed-screen">
                <div className="closed-card">
                    <Store size={64} className="closed-icon" />
                    <h2>{storeConfig.business?.name || 'Tienda cerrada'}</h2>
                    <p>En este momento nuestro catálogo online se encuentra cerrado por mantenimiento. ¡Volveremos pronto!</p>
                    {storeConfig.business?.phone && (
                        <a 
                            href={`https://wa.me/${storeConfig.business.phone.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-primary closed-contact-btn"
                        >
                            <MessageCircle size={18} />
                            Contactar por WhatsApp
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="storefront-wrapper">
            
            {/* Header banner */}
            <header className="store-header" style={{
                background: `linear-gradient(135deg, var(--storefront-primary) 0%, ${adjustColorBrightness(storeConfig.settings?.theme_color || '#1e3f20', 30)} 100%)`
            }}>
                <div className="store-header-content">
                    <div className="store-logo-wrapper">
                        {storeConfig.business?.logo_url ? (
                            <img src={storeConfig.business.logo_url} alt={storeConfig.business.name} className="store-logo" />
                        ) : (
                            <div className="store-logo-fallback">
                                {storeConfig.business?.name?.charAt(0).toUpperCase() || 'F'}
                            </div>
                        )}
                    </div>
                    <h1 className="store-title">{storeConfig.settings?.banner_title || storeConfig.business?.name}</h1>
                    <p className="store-subtitle">{storeConfig.settings?.banner_subtitle || 'Bienvenidos a nuestra tienda online'}</p>
                    
                    <div className="store-quick-links">
                        {storeConfig.settings?.whatsapp_number && (
                            <a 
                                href={`https://wa.me/${storeConfig.settings.whatsapp_number.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="quick-link-pill"
                            >
                                <MessageCircle size={14} />
                                <span>WhatsApp</span>
                            </a>
                        )}
                        {storeConfig.business?.address && (
                            <div className="quick-link-pill">
                                <MapPin size={14} />
                                <span>{storeConfig.business.address.split(',')[0]}</span>
                            </div>
                        )}
                        <div 
                            className="shop-rating-pill" 
                            onClick={() => setIsGeneralReviewsOpen(true)}
                        >
                            <Star size={14} className="star-filled" />
                            <span>
                                {generalReviews.length > 0
                                    ? `${(generalReviews.reduce((sum, r) => sum + r.rating, 0) / generalReviews.length).toFixed(1)} (${generalReviews.length} opin.)`
                                    : 'Calificar Tienda'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Catalog content */}
            <main className="store-catalog-container">
                
                {/* Search and Filters */}
                <div className="catalog-filters-sticky">
                    <div className="store-search-bar">
                        <Search size={18} className="search-bar-icon" />
                        <input
                            type="text"
                            placeholder="Buscar flores, ramos o plantas..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="clear-search" onClick={() => setSearchQuery('')}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Category pills */}
                    <div className="category-scroll-wrapper">
                        <button
                            className={`category-pill ${selectedCategory === null ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            Todos
                        </button>
                        {combos.length > 0 && (
                            <button
                                className={`category-pill ${selectedCategory === 'combos' ? 'active' : ''}`}
                                onClick={() => setSelectedCategory('combos')}
                            >
                                🎁 Combos Especiales
                            </button>
                        )}
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="products-grid-section">
                    {filteredItems.length === 0 ? (
                        <div className="empty-catalog-box">
                            <Sparkles size={36} className="text-gray-300" />
                            <p>No encontramos productos en esta sección.</p>
                        </div>
                    ) : (
                        <div className="public-products-grid">
                            {filteredItems.map(product => {
                                const outOfStock = Number(product.stock_quantity) <= 0;
                                const isLowStock = !outOfStock && Number(product.stock_quantity) <= 4;
                                
                                return (
                                    <div 
                                        key={product.id} 
                                        className={`public-product-card ${outOfStock ? 'out-of-stock' : ''}`}
                                        onClick={() => setSelectedDetailItem(product)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="p-img-box">
                                            {product.isCombo && (
                                                <div className="badge-combo-card">Combo Especial</div>
                                            )}
                                            {product.images && product.images.length > 0 ? (
                                                <img src={product.images[0]} alt={product.name} className="product-card-img" />
                                            ) : (
                                                <div className="product-card-img-placeholder">
                                                    <Sparkles size={32} />
                                                </div>
                                            )}
                                            
                                            {outOfStock ? (
                                                <div className="badge-oos">Agotado</div>
                                            ) : isLowStock ? (
                                                <div className="badge-low">Últimas unidades</div>
                                            ) : null}
                                        </div>
                                        <div className="p-details">
                                            <h3 className="p-name">{product.name}</h3>
                                            <p className="p-desc">{product.description || (product.isCombo ? 'Combo especial de productos seleccionados.' : 'Flores y frescura garantizada.')}</p>
                                            <div className="p-price-action" onClick={e => e.stopPropagation()}>
                                                <span className="p-price">{formatCurrency(product.price)}</span>
                                                <button 
                                                    className={`btn btn-primary add-to-cart-btn ${outOfStock ? 'disabled' : ''}`}
                                                    onClick={() => addToCart(product)}
                                                    disabled={outOfStock}
                                                >
                                                    <Plus size={16} />
                                                    <span>Agregar</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Permanent Floating Cart Button */}
            {totalCartItems > 0 && !isCartOpen && (
                <div className="floating-cart-wrapper" onClick={() => {
                    setCheckoutStep('cart');
                    setIsCartOpen(true);
                }}>
                    <div className="floating-cart-btn" style={{
                        backgroundColor: 'var(--storefront-primary)'
                    }}>
                        <div className="fc-qty-icon">
                            <ShoppingCart size={20} />
                            <span className="fc-qty-count">{totalCartItems}</span>
                        </div>
                        <span className="fc-text">Ver Carrito</span>
                        <span className="fc-amount">{formatCurrency(totalCartAmount)}</span>
                    </div>
                </div>
            )}

            {/* Cart & Checkout Slide-Over Drawer Overlay */}
            {isCartOpen && (
                <div className="cart-drawer-overlay">
                    <div className="cart-drawer-backdrop" onClick={() => {
                        // Prevent closing during submit
                        if (!submittingOrder) setIsCartOpen(false);
                    }}></div>
                    
                    <div className="cart-drawer" style={{
                        animation: 'slideUp 0.25s ease-out'
                    }}>
                        <header className="drawer-header">
                            <div className="dh-title-box">
                                <ShoppingBag size={20} />
                                <h2>
                                    {checkoutStep === 'cart' ? 'Mi Carrito' : 
                                     checkoutStep === 'details' ? 'Detalles de Entrega' : '¡Pedido Confirmado!'}
                                </h2>
                            </div>
                            {!submittingOrder && (
                                <button className="drawer-close" onClick={() => setIsCartOpen(false)}>
                                    <X size={24} />
                                </button>
                            )}
                        </header>

                        <div className="drawer-scroll-body">
                            
                            {/* STEP 1: CART ITEMS CHECKLIST */}
                            {checkoutStep === 'cart' && (
                                <div className="cart-step-wrapper">
                                    {cart.length === 0 ? (
                                        <div className="drawer-empty-cart">
                                            <ShoppingCart size={48} className="text-gray-300 mb-2" />
                                            <p>Tu carrito está vacío.</p>
                                        </div>
                                    ) : (
                                        <div className="drawer-items-list">
                                            {cart.map(item => (
                                                <div key={item.id} className="drawer-cart-item">
                                                    <div className="d-item-details">
                                                        <span className="d-item-name">{item.name}</span>
                                                        <span className="d-item-price">{formatCurrency(item.price)}</span>
                                                    </div>
                                                    <div className="d-item-qty-actions">
                                                        <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn">
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className="qty-count">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn">
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <div className="drawer-summary-block">
                                                <div className="summary-row">
                                                    <span>Subtotal</span>
                                                    <span>{formatCurrency(totalCartAmount)}</span>
                                                </div>
                                                <div className="summary-row grand-total">
                                                    <span>Total</span>
                                                    <span>{formatCurrency(totalCartAmount)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: CHECKOUT INFO FORM */}
                            {checkoutStep === 'details' && (
                                <form onSubmit={handleCheckoutSubmit} className="checkout-step-wrapper">
                                    <div className="checkout-form-fields">
                                        <div className="c-field-group">
                                            <label>Nombre y Apellido *</label>
                                            <input 
                                                type="text" 
                                                required 
                                                value={formName} 
                                                onChange={e => setFormName(e.target.value)}
                                                placeholder="Ej: Juan Pérez"
                                            />
                                        </div>

                                        <div className="c-field-group">
                                            <label>Teléfono de Contacto *</label>
                                            <input 
                                                type="tel" 
                                                required 
                                                value={formPhone} 
                                                onChange={e => setFormPhone(e.target.value)}
                                                placeholder="Ej: 1112345678"
                                            />
                                        </div>

                                        <div className="c-field-group">
                                            <label>Método de Entrega *</label>
                                            <div className="delivery-selector-grid">
                                                <button 
                                                    type="button" 
                                                    className={`selector-btn ${formDeliveryMethod === 'pickup' ? 'active' : ''}`}
                                                    onClick={() => setFormDeliveryMethod('pickup')}
                                                >
                                                    🏪 Retiro en Local
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className={`selector-btn ${formDeliveryMethod === 'delivery' ? 'active' : ''}`}
                                                    onClick={() => setFormDeliveryMethod('delivery')}
                                                >
                                                    🚚 Envío a Domicilio
                                                </button>
                                            </div>
                                        </div>

                                        <div className="form-grid-2">
                                            <div className="c-field-group">
                                                <label>Fecha de Entrega *</label>
                                                <div className="input-icon-wrapper">
                                                    <Calendar size={16} className="i-icon" />
                                                    <input 
                                                        type="date" 
                                                        required 
                                                        value={formDeliveryDate} 
                                                        onChange={e => setFormDeliveryDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="c-field-group">
                                                <label>Horario *</label>
                                                <div className="input-icon-wrapper">
                                                    <Clock size={16} className="i-icon" />
                                                    <select 
                                                        value={formDeliverySlot} 
                                                        onChange={e => setFormDeliverySlot(e.target.value as any)}
                                                    >
                                                        <option value="morning">Mañana (08:00 a 12:00)</option>
                                                        <option value="afternoon">Tarde (12:00 a 17:00)</option>
                                                        <option value="evening">Noche (17:00 a 21:00)</option>
                                                        <option value="allday">Todo el día (08:00 a 21:00)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Address Fields for Delivery */}
                                        {formDeliveryMethod === 'delivery' && (
                                            <div className="delivery-address-subform animate-fade-in">
                                                <div className="form-grid-2">
                                                    <div className="c-field-group">
                                                        <label>Calle *</label>
                                                        <input 
                                                            type="text" 
                                                            required={formDeliveryMethod === 'delivery'} 
                                                            value={formStreet} 
                                                            onChange={e => setFormStreet(e.target.value)}
                                                            placeholder="Ej: Av. Rivadavia"
                                                        />
                                                    </div>
                                                    <div className="c-field-group">
                                                        <label>Número *</label>
                                                        <input 
                                                            type="text" 
                                                            required={formDeliveryMethod === 'delivery'} 
                                                            value={formNumber} 
                                                            onChange={e => setFormNumber(e.target.value)}
                                                            placeholder="Ej: 1420"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="form-grid-2">
                                                    <div className="c-field-group">
                                                        <label>Piso / Depto</label>
                                                        <input 
                                                            type="text" 
                                                            value={formFloor} 
                                                            onChange={e => setFormFloor(e.target.value)}
                                                            placeholder="Ej: 3ro B"
                                                        />
                                                    </div>
                                                    <div className="c-field-group">
                                                        <label>Localidad *</label>
                                                        <input 
                                                            type="text" 
                                                            required={formDeliveryMethod === 'delivery'} 
                                                            value={formCity} 
                                                            onChange={e => setFormCity(e.target.value)}
                                                            placeholder="Ej: CABA"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="c-field-group">
                                                    <label>Referencia de Dirección</label>
                                                    <input 
                                                        type="text" 
                                                        value={formReference} 
                                                        onChange={e => setFormReference(e.target.value)}
                                                        placeholder="Ej: Reja verde / Entre calles X e Y"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="c-field-group">
                                            <label>Mensaje para la Tarjeta (Dedicatoria)</label>
                                            <textarea 
                                                value={formCardMessage} 
                                                onChange={e => setFormCardMessage(e.target.value)}
                                                placeholder="Ej: Con todo mi cariño para mamá en su día..."
                                                rows={2}
                                            />
                                        </div>

                                        <div className="c-field-group">
                                            <label>Notas para el Florista / Repartidor</label>
                                            <textarea 
                                                value={formNotes} 
                                                onChange={e => setFormNotes(e.target.value)}
                                                placeholder="Ej: Tocar timbre que no anda portero..."
                                                rows={2}
                                            />
                                        </div>

                                        {/* Payment method selector */}
                                        <div className="c-field-group">
                                            <label>Método de Pago *</label>
                                            <div className="payment-method-selector-grid">
                                                <button 
                                                    type="button" 
                                                    className={`selector-btn ${formPaymentMethod === 'whatsapp' ? 'active' : ''}`}
                                                    onClick={() => setFormPaymentMethod('whatsapp')}
                                                >
                                                    🟢 Pedir y Acordar por WhatsApp
                                                </button>
                                                {storeConfig.settings?.mp_enabled && (
                                                    <button 
                                                        type="button" 
                                                        className={`selector-btn ${formPaymentMethod === 'mercadopago' ? 'active' : ''}`}
                                                        onClick={() => setFormPaymentMethod('mercadopago')}
                                                    >
                                                        🔵 Pagar Online (MercadoPago)
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="drawer-footer">
                                        <button 
                                            type="submit" 
                                            className={`btn btn-primary submit-order-btn ${submittingOrder ? 'loading' : ''}`}
                                            disabled={submittingOrder}
                                            style={{ backgroundColor: 'var(--storefront-primary)' }}
                                        >
                                            {submittingOrder ? (
                                                <>
                                                    <div className="spinner-mini"></div>
                                                    <span>Procesando Pedido...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={18} />
                                                    <span>{formPaymentMethod === 'whatsapp' ? 'Confirmar Pedido vía WhatsApp' : 'Ir a Pagar con MercadoPago'}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* STEP 3: MERCADOPAGO PAYMENT LANDING SUCCESS */}
                            {checkoutStep === 'success' && (
                                <div className="payment-success-wrapper animate-fade-in">
                                    <div className="success-icon-badge">
                                        {mpStatus === 'success' ? (
                                            <Check size={48} className="text-success" />
                                        ) : (
                                            <Clock size={48} className="text-warning" />
                                        )}
                                    </div>
                                    
                                    <h2>
                                        {mpStatus === 'success' ? '¡Pago Aprobado con Éxito!' : 'Pago Pendiente'}
                                    </h2>
                                    
                                    <p>
                                        {mpStatus === 'success' 
                                            ? 'Recibimos tu pago online de forma correcta. El comercio ya tiene registrado tu pedido en su ERP y está preparando tus flores.' 
                                            : 'Tu pago se encuentra en proceso. Una vez confirmado, el negocio iniciará la preparación de tu pedido.'}
                                    </p>
                                    
                                    <div className="success-order-box">
                                        <span className="sob-label">Referencia del Pedido:</span>
                                        <span className="sob-id">#{createdOrderId?.substring(0, 8).toUpperCase()}</span>
                                    </div>
                                    
                                    <button 
                                        className="btn btn-primary send-success-wa-btn" 
                                        onClick={handleSendPaidReceipt}
                                        style={{ backgroundColor: '#25D366', border: 'none' }}
                                    >
                                        <MessageCircle size={18} />
                                        <span>Enviar confirmación por WhatsApp</span>
                                    </button>
                                </div>
                            )}

                        </div>

                        {/* Standard Cart Footer for Step 1 */}
                        {checkoutStep === 'cart' && cart.length > 0 && (
                            <footer className="drawer-footer">
                                <button 
                                    className="btn btn-primary next-step-btn"
                                    onClick={() => setCheckoutStep('details')}
                                    style={{ backgroundColor: 'var(--storefront-primary)' }}
                                >
                                    <span>Continuar con mi pedido</span>
                                </button>
                            </footer>
                        )}
                    </div>
                </div>
            )}

            {/* Detailed Product Page Modal Overlay */}
            {selectedDetailItem && (() => {
                const outOfStock = Number(selectedDetailItem.stock_quantity) <= 0;
                const isLowStock = !outOfStock && Number(selectedDetailItem.stock_quantity) <= 4;
                const imagesList = selectedDetailItem.images && selectedDetailItem.images.length > 0
                    ? selectedDetailItem.images
                    : [];

                const avgRating = detailReviews.length > 0
                    ? (detailReviews.reduce((sum, r) => sum + r.rating, 0) / detailReviews.length).toFixed(1)
                    : null;

                return (
                    <div className="detail-drawer-overlay">
                        <div className="detail-drawer-backdrop" onClick={() => setSelectedDetailItem(null)}></div>
                        
                        <div className="detail-drawer animate-slide-up">
                            <header className="drawer-header">
                                <div className="dh-title-box">
                                    <ShoppingBag size={20} />
                                    <h2>Detalle del Producto</h2>
                                </div>
                                <button className="drawer-close" onClick={() => setSelectedDetailItem(null)}>
                                    <X size={24} />
                                </button>
                            </header>

                            <div className="drawer-scroll-body drawer-detail-body">
                                {/* Tactile swipeable/slider photo gallery carousel */}
                                <div className="image-carousel-container">
                                    {imagesList.length > 0 ? (
                                        <>
                                            <div 
                                                className="carousel-track" 
                                                style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
                                            >
                                                {imagesList.map((img: string, idx: number) => (
                                                    <div key={idx} className="carousel-slide">
                                                        <img src={img} alt={`${selectedDetailItem.name} ${idx}`} className="carousel-img" />
                                                    </div>
                                                ))}
                                            </div>
                                            {imagesList.length > 1 && (
                                                <>
                                                    <button 
                                                        className="carousel-nav-btn prev"
                                                        onClick={() => setActiveImageIndex(prev => (prev === 0 ? imagesList.length - 1 : prev - 1))}
                                                    >
                                                        <ChevronLeft size={20} />
                                                    </button>
                                                    <button 
                                                        className="carousel-nav-btn next"
                                                        onClick={() => setActiveImageIndex(prev => (prev === imagesList.length - 1 ? 0 : prev + 1))}
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                    <div className="carousel-indicators">
                                                        {imagesList.map((_: any, idx: number) => (
                                                            <div 
                                                                key={idx} 
                                                                className={`carousel-dot ${activeImageIndex === idx ? 'active' : ''}`}
                                                                onClick={() => setActiveImageIndex(idx)}
                                                            />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="product-card-img-placeholder" style={{ height: '100%' }}>
                                            <Sparkles size={48} />
                                        </div>
                                    )}
                                </div>

                                {/* Title, Combo Badge, Price */}
                                {selectedDetailItem.isCombo && (
                                    <div className="badge-combo">
                                        <Sparkles size={12} />
                                        <span>Combo Especial</span>
                                    </div>
                                )}
                                <h1 className="detail-p-name">{selectedDetailItem.name}</h1>
                                <div className="detail-p-price">{formatCurrency(selectedDetailItem.price)}</div>
                                
                                {isLowStock && (
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1rem' }}>
                                        <span>⚠️ ¡Últimas unidades disponibles!</span>
                                    </div>
                                )}
                                
                                <p className="detail-p-desc">
                                    {selectedDetailItem.description || (selectedDetailItem.isCombo ? 'Llevate este combo especial de productos seleccionados con descuento garantizado.' : 'Flores de la mejor calidad y frescura garantizada por nuestros floristas locales.')}
                                </p>

                                {/* Reviews Header */}
                                <div className="reviews-section-header">
                                    <h4>Opiniones de clientes</h4>
                                    <div className="reviews-summary-badge">
                                        <Star size={16} className="star-filled" />
                                        <span>{avgRating ? `${avgRating} (${detailReviews.length})` : 'Sin opiniones'}</span>
                                    </div>
                                </div>

                                {/* Review form toggler */}
                                {!isAddingReview ? (
                                    <button 
                                        className="btn-toggle-review mb-4"
                                        onClick={() => setIsAddingReview(true)}
                                    >
                                        + Dejar una opinión
                                    </button>
                                ) : (
                                    <form onSubmit={handleReviewSubmit} className="review-form-box">
                                        <h5>Dejanos tu calificación</h5>
                                        <div className="star-rating-input">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star 
                                                    key={star}
                                                    size={24}
                                                    className={`star-interactive ${star <= reviewRating ? 'star-filled' : 'star-empty'}`}
                                                    onClick={() => setReviewRating(star)}
                                                />
                                            ))}
                                        </div>
                                        <div className="c-field-group mb-2">
                                            <label>Tu Nombre *</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={reviewAuthor}
                                                onChange={e => setReviewAuthor(e.target.value)}
                                                placeholder="Ej: Alejandra R."
                                                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                            />
                                        </div>
                                        <div className="c-field-group mb-2">
                                            <label>Comentario (Opcional)</label>
                                            <textarea 
                                                value={reviewComment}
                                                onChange={e => setReviewComment(e.target.value)}
                                                placeholder="¿Qué te pareció este ramo/flor?"
                                                rows={3}
                                                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                type="button" 
                                                className="btn"
                                                onClick={() => setIsAddingReview(false)}
                                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                type="submit" 
                                                className="btn btn-primary submit-review-btn"
                                                disabled={submittingReview}
                                                style={{ flex: 2, backgroundColor: 'var(--storefront-primary)' }}
                                            >
                                                {submittingReview ? 'Enviando...' : 'Enviar Calificación'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Reviews List */}
                                <div className="reviews-grid-list">
                                    {loadingReviews ? (
                                        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--storefront-text-muted)' }}>Cargando opiniones...</p>
                                    ) : detailReviews.length === 0 ? (
                                        <div className="empty-reviews-prompt">
                                            Sé el primero en calificar este producto y compartir tu experiencia.
                                        </div>
                                    ) : (
                                        detailReviews.map((rev) => (
                                            <div key={rev.id} className="review-card-item animate-fade-in">
                                                <div className="review-card-header">
                                                    <span className="review-author">{rev.author_name}</span>
                                                    <span className="review-date">{new Date(rev.created_at).toLocaleDateString('es-AR')}</span>
                                                </div>
                                                <div className="review-stars">
                                                    {[1,2,3,4,5].map(s => (
                                                        <Star 
                                                            key={s} 
                                                            size={14} 
                                                            className={s <= rev.rating ? 'star-filled' : 'star-empty'} 
                                                        />
                                                    ))}
                                                </div>
                                                {rev.comment && (
                                                    <p className="review-comment-text">{rev.comment}</p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Sticky Buy/Add controls bar */}
                            <footer className="detail-purchase-bar">
                                {!outOfStock && (
                                    <div className="detail-qty-control">
                                        <button 
                                            className="detail-qty-btn"
                                            onClick={() => setDetailQty(prev => Math.max(1, prev - 1))}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="detail-qty-count">{detailQty}</span>
                                        <button 
                                            className="detail-qty-btn"
                                            onClick={() => setDetailQty(prev => prev + 1)}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                )}
                                <button 
                                    className={`btn btn-primary btn-detail-add ${outOfStock ? 'disabled' : ''}`}
                                    onClick={() => {
                                        addToCartWithQty(selectedDetailItem, detailQty);
                                        setSelectedDetailItem(null);
                                    }}
                                    disabled={outOfStock}
                                    style={{ backgroundColor: 'var(--storefront-primary)' }}
                                >
                                    <ShoppingCart size={18} />
                                    <span>{outOfStock ? 'Agotado' : 'Agregar al carrito'}</span>
                                </button>
                            </footer>
                        </div>
                    </div>
                );
            })()}

            {/* General Shop Reviews Testimonials Modal Overlay */}
            {isGeneralReviewsOpen && (
                <div className="detail-drawer-overlay">
                    <div className="detail-drawer-backdrop" onClick={() => setIsGeneralReviewsOpen(false)}></div>
                    
                    <div className="detail-drawer animate-slide-up">
                        <header className="drawer-header">
                            <div className="dh-title-box">
                                <Star size={20} className="star-filled" />
                                <h2>Opiniones de la Tienda</h2>
                            </div>
                            <button className="drawer-close" onClick={() => setIsGeneralReviewsOpen(false)}>
                                <X size={24} />
                            </button>
                        </header>

                        <div className="drawer-scroll-body drawer-detail-body">
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--storefront-text-main)' }}>
                                    {generalReviews.length > 0
                                        ? (generalReviews.reduce((sum, r) => sum + r.rating, 0) / generalReviews.length).toFixed(1)
                                        : '0.0'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '0.5rem 0' }}>
                                    {[1,2,3,4,5].map(s => {
                                        const avg = generalReviews.length > 0 ? (generalReviews.reduce((sum, r) => sum + r.rating, 0) / generalReviews.length) : 0;
                                        return (
                                            <Star 
                                                key={s} 
                                                size={20} 
                                                className={s <= Math.round(avg) ? 'star-filled' : 'star-empty'} 
                                            />
                                        );
                                    })}
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--storefront-text-muted)' }}>
                                    Basado en {generalReviews.length} valoraciones de compradores reales
                                </p>
                            </div>

                            {/* General reviews submission toggler */}
                            {!isAddingGeneralReview ? (
                                <button 
                                    className="btn btn-primary submit-review-btn mb-4"
                                    onClick={() => setIsAddingGeneralReview(true)}
                                    style={{ backgroundColor: 'var(--storefront-primary)', width: 'auto', margin: '0 auto 1.5rem', display: 'flex' }}
                                >
                                    Dejar un comentario del local
                                </button>
                            ) : (
                                <form onSubmit={handleGeneralReviewSubmit} className="review-form-box" style={{ textAlign: 'left' }}>
                                    <h5>Calificar el local y servicio</h5>
                                    <div className="star-rating-input">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <Star 
                                                key={star}
                                                size={24}
                                                className={`star-interactive ${star <= reviewRating ? 'star-filled' : 'star-empty'}`}
                                                onClick={() => setReviewRating(star)}
                                            />
                                        ))}
                                    </div>
                                    <div className="c-field-group mb-2">
                                        <label>Tu Nombre *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={reviewAuthor}
                                            onChange={e => setReviewAuthor(e.target.value)}
                                            placeholder="Ej: Marcelo T."
                                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                        />
                                    </div>
                                    <div className="c-field-group mb-2">
                                        <label>Comentario sobre el servicio (Opcional)</label>
                                        <textarea 
                                            value={reviewComment}
                                            onChange={e => setReviewComment(e.target.value)}
                                            placeholder="¿Qué tal fue la atención, entrega o calidad de la tienda?"
                                            rows={3}
                                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            type="button" 
                                            className="btn"
                                            onClick={() => setIsAddingGeneralReview(false)}
                                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="btn btn-primary submit-review-btn"
                                            disabled={submittingReview}
                                            style={{ flex: 2, backgroundColor: 'var(--storefront-primary)' }}
                                        >
                                            {submittingReview ? 'Enviando...' : 'Enviar Calificación'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Reviews List */}
                            <div className="reviews-grid-list">
                                {generalReviews.length === 0 ? (
                                    <div className="empty-reviews-prompt">
                                        Aún no hay opiniones de la tienda. ¡Sé el primero en calificar tu compra!
                                    </div>
                                ) : (
                                    generalReviews.map((rev) => (
                                        <div key={rev.id} className="review-card-item animate-fade-in">
                                            <div className="review-card-header">
                                                <span className="review-author">{rev.author_name}</span>
                                                <span className="review-date">{new Date(rev.created_at).toLocaleDateString('es-AR')}</span>
                                            </div>
                                            <div className="review-stars">
                                                {[1,2,3,4,5].map(s => (
                                                    <Star 
                                                        key={s} 
                                                        size={14} 
                                                        className={s <= rev.rating ? 'star-filled' : 'star-empty'} 
                                                    />
                                                ))}
                                            </div>
                                            {rev.comment && (
                                                <p className="review-comment-text">{rev.comment}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default PublicStorefront;
