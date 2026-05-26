import React, { useState, useEffect, useMemo } from 'react';
import { 
    useStore, 
    type Product, 
    type Package 
} from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { api } from '../../services/api';
import { 
    Globe, 
    Save, 
    Undo, 
    Sparkles, 
    MessageCircle, 
    Instagram, 
    Search, 
    Plus, 
    Store, 
    Layers, 
    Smartphone, 
    Info 
} from 'lucide-react';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { PackageBuilderModal } from '../../components/PackageBuilder/PackageBuilderModal';
import './StorefrontCustomizer.css';

// Predefined Brand Palette Presets
const BRAND_PRESETS = [
    { id: 'forest', name: 'Verde Bosque', color: '#1e3f20', light: '#1e3f2015' },
    { id: 'rose', name: 'Rosa Carmesí', color: '#be123c', light: '#be123c15' },
    { id: 'blossom', name: 'Flor Rosa', color: '#db2777', light: '#db277715' },
    { id: 'lavender', name: 'Lavanda Real', color: '#6d28d9', light: '#6d28d915' },
    { id: 'charcoal', name: 'Gris Carbón', color: '#334155', light: '#33415515' },
    { id: 'sunset', name: 'Atardecer', color: '#c2410c', light: '#c2410c15' }
];

export const StorefrontCustomizer = () => {
    // Global Store States & Actions
    const products = useStore(state => state.products);
    const packages = useStore(state => state.packages);
    const categories = useStore(state => state.categoriesData);
    const loadProducts = useStore(state => state.loadProducts);
    const loadPackages = useStore(state => state.loadPackages);
    const loadCategories = useStore(state => state.loadCategories);
    const updateProduct = useStore(state => state.updateProduct);
    const updatePackage = useStore(state => state.updatePackage);

    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    // Page & tab navigation state
    const [activeTab, setActiveTab] = useState<'info' | 'style' | 'catalog'>('info');
    
    // UI states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [slug, setSlug] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Catalog filtering
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState<string | null>(null);

    // ERP Creation Modals
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);

    // Customizer form state
    const [form, setForm] = useState({
        active: true,
        banner_title: '',
        banner_subtitle: 'Bienvenidos a nuestra tienda online',
        whatsapp_number: '',
        theme_color: '#1e3f20',
        theme_preset: 'forest',
        price_markup: 0,
        logo_url: '',
        about_us: '',
        social_instagram: '',
        social_facebook: '',
        banner_badge: '',
        seasonal_theme: 'none' as 'none' | 'mother_day' | 'valentines' | 'spring' | 'christmas',
        promotions: {} as Record<string, { badge?: string; discount_percent?: number }>
    });

    // Reference form to track unsaved edits
    const [savedForm, setSavedForm] = useState({ ...form });

    // Load everything on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                setErrorMsg(null);
                
                // Load products, packages & categories
                await Promise.allSettled([
                    loadProducts(),
                    loadPackages(),
                    loadCategories()
                ]);

                // Fetch business settings
                const business = await api.request<any>('/business');
                if (business) {
                    setSlug(business.slug || '');
                    
                    const sf = business.settings?.storefront || {};
                    const initialForm = {
                        active: sf.active ?? true,
                        banner_title: sf.banner_title || business.name || '',
                        banner_subtitle: sf.banner_subtitle || 'Bienvenidos a nuestra tienda online',
                        whatsapp_number: sf.whatsapp_number || business.phone || '',
                        theme_color: sf.theme_color || '#1e3f20',
                        theme_preset: sf.theme_preset || 'forest',
                        price_markup: Number(sf.price_markup || 0),
                        logo_url: sf.logo_url || business.logo_url || '',
                        about_us: sf.about_us || '',
                        social_instagram: sf.social_instagram || '',
                        social_facebook: sf.social_facebook || '',
                        banner_badge: sf.banner_badge || '',
                        seasonal_theme: (sf.seasonal_theme || 'none') as 'none' | 'mother_day' | 'valentines' | 'spring' | 'christmas',
                        promotions: sf.promotions || {}
                    };
                    
                    setForm(initialForm);
                    setSavedForm(initialForm);
                }
            } catch (err: any) {
                console.error('Error fetching settings:', err);
                setErrorMsg('No se pudo cargar la configuración de la tienda.');
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Check if there are unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        return JSON.stringify(form) !== JSON.stringify(savedForm);
    }, [form, savedForm]);

    // Handle standard inputs
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Preset color selector
    const selectColorPreset = (preset: typeof BRAND_PRESETS[0]) => {
        setForm(prev => ({
            ...prev,
            theme_preset: preset.id,
            theme_color: preset.color
        }));
    };

    // Selective publishing actions
    const toggleProductPublish = async (prod: Product) => {
        const isPublished = !!prod.storefront_published;
        try {
            await updateProduct(prod.id, { storefront_published: !isPublished });
        } catch (err) {
            alert('Error al actualizar publicación del producto.');
        }
    };

    const togglePackagePublish = async (pkg: Package) => {
        const isPublished = !!pkg.storefront_published;
        try {
            await updatePackage(pkg.id, { storefront_published: !isPublished });
        } catch (err) {
            alert('Error al actualizar publicación del ramo.');
        }
    };

    // Promotion Badges inline editor
    const handleBadgeChange = (itemId: string, val: string) => {
        setForm(prev => {
            const currentPromos = { ...prev.promotions };
            if (!val.trim()) {
                delete currentPromos[itemId];
            } else {
                currentPromos[itemId] = {
                    ...currentPromos[itemId],
                    badge: val
                };
            }
            return {
                ...prev,
                promotions: currentPromos
            };
        });
    };

    // Save configuration updates
    const handleSaveSettings = async () => {
        if (!isAdmin) {
            alert('No tienes permisos suficientes para modificar ajustes.');
            return;
        }

        try {
            setSaving(true);
            setErrorMsg(null);
            setSuccessMsg(null);

            // Clean up slug properties and structure payload
            const payload = {
                settings: {
                    storefront: form
                }
            };

            await api.request('/business', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            setSavedForm({ ...form });
            setSuccessMsg('¡Ajustes de marca guardados exitosamente!');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            console.error('Error saving settings:', err);
            setErrorMsg(err.message || 'Error al guardar los ajustes.');
        } finally {
            setSaving(false);
        }
    };

    // Discard unsaved edits
    const handleDiscardChanges = () => {
        setForm({ ...savedForm });
    };

    // Dynamic catalog filtering combining Products and Packages
    const filteredCatalogItems = useMemo(() => {
        const combined: any[] = [
            ...products.map(p => ({ ...p, isCombo: false })),
            ...packages.map(p => ({ ...p, price: p.price, isCombo: true }))
        ];

        return combined.filter(item => {
            const description = item.description || '';
            const matchesSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                  description.toLowerCase().includes(catalogSearch.toLowerCase());
            
            if (catalogCategory === 'combos') {
                return matchesSearch && item.isCombo;
            }
            
            const matchesCategory = !catalogCategory || item.category_id === catalogCategory;
            return matchesSearch && matchesCategory && !item.isCombo;
        });
    }, [products, packages, catalogSearch, catalogCategory]);

    // Setup HSL brights and hover properties dynamically for phone simulator preview
    const phoneStyleProps = useMemo(() => {
        const hex = form.theme_color || '#1e3f20';
        let R = parseInt(hex.substring(1, 3), 16);
        let G = parseInt(hex.substring(3, 5), 16);
        let B = parseInt(hex.substring(5, 7), 16);

        // Compute primary light with alpha 0.15 on the fly
        const primaryLight = `rgba(${R}, ${G}, ${B}, 0.15)`;
        
        return {
            '--theme-color': hex,
            '--theme-light': primaryLight
        } as React.CSSProperties;
    }, [form.theme_color]);

    // Computed Time for phone simulator
    const formattedPhoneTime = useMemo(() => {
        const now = new Date();
        return now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }, []);

    // Generate falling seasonal preview particles
    const previewParticles = useMemo(() => {
        if (form.seasonal_theme === 'none') return [];
        
        let emojis = ['🌸', '🌹', '🌷'];
        if (form.seasonal_theme === 'valentines') emojis = ['💖', '❤️', '🌹'];
        if (form.seasonal_theme === 'christmas') emojis = ['❄️', '❄️', '✨'];
        if (form.seasonal_theme === 'spring') emojis = ['🌻', '🍃', '🌱'];

        return Array.from({ length: 15 }).map((_, idx) => {
            const emoji = emojis[idx % emojis.length];
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            const duration = 4 + Math.random() * 4;
            const scale = 0.6 + Math.random() * 0.6;
            
            return {
                id: idx,
                emoji,
                style: {
                    left: `${left}%`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                    fontSize: `${scale}rem`
                }
            };
        });
    }, [form.seasonal_theme]);

    return (
        <div style={{ padding: '0.25rem' }}>
            <header className="page-header mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-h1 flex items-center gap-2">
                        <Globe className="text-purple-600" size={28} />
                        Personalizar Tienda Online
                    </h1>
                    <p className="text-body mt-2 text-muted">
                        Diseñá la estética, logo y banners festivos de tu vitrina pública, y elegí qué publicar.
                    </p>
                </div>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                    <p style={{ fontWeight: 600 }}>Cargando configuraciones de marca...</p>
                </div>
            ) : (
                <div className="customizer-workspace">
                    
                    {/* Left Column: Form Settings Tabs */}
                    <div className="customizer-panel-left">
                        {errorMsg && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-small">
                                {errorMsg}
                            </div>
                        )}
                        {successMsg && (
                            <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-small">
                                {successMsg}
                            </div>
                        )}

                        <div className="customizer-tabs">
                            <button 
                                className={`customizer-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                                onClick={() => setActiveTab('info')}
                            >
                                <Store size={18} />
                                Marca e Info
                            </button>
                            <button 
                                className={`customizer-tab-btn ${activeTab === 'style' ? 'active' : ''}`}
                                onClick={() => setActiveTab('style')}
                            >
                                <Sparkles size={18} />
                                Diseño y Estilos
                            </button>
                            <button 
                                className={`customizer-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
                                onClick={() => setActiveTab('catalog')}
                            >
                                <Layers size={18} />
                                Catálogo Selectivo
                            </button>
                        </div>

                        {/* Tab Content: Marca e Info */}
                        {activeTab === 'info' && (
                            <div className="customizer-card">
                                <div className="customizer-card-header">
                                    <h3 className="customizer-card-title">
                                        <Store size={20} className="text-purple-500" />
                                        Información de Marca
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Paso 1 de 3</span>
                                </div>

                                <div className="customizer-form-grid">
                                    <div className="form-group-full">
                                        <label className="customizer-label">Nombre de la Tienda (Banner Principal)</label>
                                        <input 
                                            type="text" 
                                            className="customizer-input" 
                                            name="banner_title" 
                                            value={form.banner_title} 
                                            onChange={handleInputChange} 
                                            placeholder="Ej. Florería Mi Jardín"
                                        />
                                    </div>

                                    <div className="form-group-full">
                                        <label className="customizer-label">Lema / Eslogan</label>
                                        <input 
                                            type="text" 
                                            className="customizer-input" 
                                            name="banner_subtitle" 
                                            value={form.banner_subtitle} 
                                            onChange={handleInputChange} 
                                            placeholder="Ej. Expresa tus sentimientos con flores"
                                        />
                                    </div>

                                    <div>
                                        <label className="customizer-label">WhatsApp de Contacto (Pedidos)</label>
                                        <input 
                                            type="text" 
                                            className="customizer-input" 
                                            name="whatsapp_number" 
                                            value={form.whatsapp_number} 
                                            onChange={handleInputChange} 
                                            placeholder="Ej. +5491133445566"
                                        />
                                    </div>

                                    <div>
                                        <label className="customizer-label">Enlace URL del Logo</label>
                                        <input 
                                            type="text" 
                                            className="customizer-input" 
                                            name="logo_url" 
                                            value={form.logo_url} 
                                            onChange={handleInputChange} 
                                            placeholder="https://enlace-a-tu-logo.png"
                                        />
                                    </div>

                                    <div>
                                        <label className="customizer-label">Instagram (Slug de Usuario)</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>@</span>
                                            <input 
                                                type="text" 
                                                className="customizer-input" 
                                                style={{ paddingLeft: '1.75rem' }}
                                                name="social_instagram" 
                                                value={form.social_instagram} 
                                                onChange={handleInputChange} 
                                                placeholder="floreria_jardin"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="customizer-label">Facebook (Slug de Usuario)</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>fb.com/</span>
                                            <input 
                                                type="text" 
                                                className="customizer-input" 
                                                style={{ paddingLeft: '4.5rem' }}
                                                name="social_facebook" 
                                                value={form.social_facebook} 
                                                onChange={handleInputChange} 
                                                placeholder="floreria_jardin"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group-full">
                                        <label className="customizer-label">Cinta Promocional Superior (Cintillo Alert)</label>
                                        <input 
                                            type="text" 
                                            className="customizer-input" 
                                            name="banner_badge" 
                                            value={form.banner_badge} 
                                            onChange={handleInputChange} 
                                            placeholder="Ej. ¡Envío gratis a Belgrano y Palermo por compras superiores a $15.000!"
                                        />
                                    </div>

                                    <div className="form-group-full">
                                        <label className="customizer-label">Sobre Nosotros / Biografía (Pie de página)</label>
                                        <textarea 
                                            className="customizer-textarea" 
                                            name="about_us" 
                                            value={form.about_us} 
                                            onChange={handleInputChange} 
                                            placeholder="Breve historia de tu floristería para wowear a tus clientes en el pie de página..."
                                        />
                                    </div>
                                    <div className="form-group-full pt-4 border-t border-dashed mt-4 text-small" style={{ color: '#475569', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '0.75rem', borderRadius: '10px' }}>
                                            <Globe size={18} style={{ color: '#8b5cf6' }} />
                                            <span>
                                                URL de tu Tienda Pública: <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6d28d9', textDecoration: 'underline', fontWeight: 700 }}>{window.location.protocol}//{window.location.host}/{slug || 'tu-tienda'}</a>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Diseño y Estilo */}
                        {activeTab === 'style' && (
                            <div className="customizer-card">
                                <div className="customizer-card-header">
                                    <h3 className="customizer-card-title">
                                        <Sparkles size={20} className="text-purple-500" />
                                        Diseño y Estética Premium
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Paso 2 de 3</span>
                                </div>

                                <div className="form-group mb-6">
                                    <label className="customizer-label">Color de Marca (Tema Primario)</label>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <input 
                                            type="color" 
                                            name="theme_color" 
                                            value={form.theme_color} 
                                            onChange={handleInputChange}
                                            style={{ width: '48px', height: '48px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                                        />
                                        <div>
                                            <input 
                                                type="text" 
                                                className="customizer-input" 
                                                style={{ width: '120px', fontFamily: 'monospace', fontWeight: 600 }}
                                                name="theme_color" 
                                                value={form.theme_color} 
                                                onChange={handleInputChange}
                                                maxLength={7}
                                            />
                                        </div>
                                    </div>

                                    <div className="color-presets-grid mt-4">
                                        {BRAND_PRESETS.map(p => (
                                            <button 
                                                key={p.id}
                                                type="button"
                                                className={`color-preset-pill ${form.theme_preset === p.id ? 'active' : ''}`}
                                                onClick={() => selectColorPreset(p)}
                                            >
                                                <span className="color-preset-circle" style={{ backgroundColor: p.color }} />
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group pt-4 border-t border-dashed mt-6">
                                    <label className="customizer-label flex items-center gap-1">
                                        Temáticas Festivas / Fechas Especiales
                                        <Sparkles size={14} className="text-warning" />
                                    </label>
                                    <p className="text-micro text-muted mb-4">
                                        Activa animaciones fluidas (copos de nieve, corazones, pétalos flotantes) y gradientes premium según la época del año.
                                    </p>

                                    <div className="seasonal-theme-grid">
                                        <div 
                                            className={`seasonal-card ${form.seasonal_theme === 'none' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, seasonal_theme: 'none' }))}
                                        >
                                            <span className="seasonal-card-icon">🌿</span>
                                            <h4 className="seasonal-card-title">Estándar</h4>
                                            <p className="seasonal-card-desc">Limpio y atemporal</p>
                                        </div>

                                        <div 
                                            className={`seasonal-card ${form.seasonal_theme === 'valentines' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, seasonal_theme: 'valentines' }))}
                                        >
                                            <span className="seasonal-card-icon">💖</span>
                                            <h4 className="seasonal-card-title">San Valentín</h4>
                                            <p className="seasonal-card-desc">Lluvia de corazones</p>
                                        </div>

                                        <div 
                                            className={`seasonal-card ${form.seasonal_theme === 'mother_day' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, seasonal_theme: 'mother_day' }))}
                                        >
                                            <span className="seasonal-card-icon">🌸</span>
                                            <h4 className="seasonal-card-title">Día de Madre</h4>
                                            <p className="seasonal-card-desc font-bold">Lluvia de pétalos</p>
                                        </div>

                                        <div 
                                            className={`seasonal-card ${form.seasonal_theme === 'spring' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, seasonal_theme: 'spring' }))}
                                        >
                                            <span className="seasonal-card-icon">🌻</span>
                                            <h4 className="seasonal-card-title">Primavera</h4>
                                            <p className="seasonal-card-desc">Girasoles & hojas</p>
                                        </div>

                                        <div 
                                            className={`seasonal-card ${form.seasonal_theme === 'christmas' ? 'active' : ''}`}
                                            onClick={() => setForm(prev => ({ ...prev, seasonal_theme: 'christmas' }))}
                                        >
                                            <span className="seasonal-card-icon">🎄</span>
                                            <h4 className="seasonal-card-title">Navidad</h4>
                                            <p className="seasonal-card-desc">Copos de nieve</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Catálogo Selectivo */}
                        {activeTab === 'catalog' && (
                            <div className="customizer-card">
                                <div className="customizer-card-header">
                                    <h3 className="customizer-card-title">
                                        <Layers size={20} className="text-purple-500" />
                                        Selección de Catálogo & Ofertas
                                    </h3>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setIsProductModalOpen(true)}>
                                            <Plus size={14} />
                                            + Producto
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setIsPackageModalOpen(true)}>
                                            <Plus size={14} />
                                            + Combo
                                        </button>
                                    </div>
                                </div>

                                <div className="customizer-catalog-header">
                                    <div className="customizer-catalog-search">
                                        <Search size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar productos o ramos..."
                                            value={catalogSearch}
                                            onChange={e => setCatalogSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="catalog-filter-chips">
                                        <button 
                                            className={`catalog-chip ${catalogCategory === null ? 'active' : ''}`}
                                            onClick={() => setCatalogCategory(null)}
                                        >
                                            Todos ({products.length + packages.length})
                                        </button>
                                        <button 
                                            className={`catalog-chip ${catalogCategory === 'combos' ? 'active' : ''}`}
                                            onClick={() => setCatalogCategory('combos')}
                                        >
                                            Ramos & Combos ({packages.length})
                                        </button>
                                        {categories.map(cat => (
                                            <button 
                                                key={cat.id}
                                                className={`catalog-chip ${catalogCategory === cat.id ? 'active' : ''}`}
                                                onClick={() => setCatalogCategory(cat.id)}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="customizer-catalog-list">
                                    {filteredCatalogItems.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                            No se encontraron artículos en tu stock.
                                        </div>
                                    ) : (
                                        filteredCatalogItems.map((item: any) => {
                                            const published = !!item.storefront_published;
                                            const promoObj = form.promotions?.[item.id] || {};
                                            const badge = promoObj.badge || '';

                                            // Parse photo
                                            let photoUrl = '';
                                            if (item.images) {
                                                const imgArr = typeof item.images === 'string' 
                                                    ? (item.images as string).split(',') 
                                                    : (Array.isArray(item.images) ? item.images : []);
                                                if (imgArr.length > 0) photoUrl = imgArr[0];
                                            }

                                            return (
                                                <div key={item.id} className="catalog-item-row">
                                                    {photoUrl ? (
                                                        <img src={photoUrl} alt={item.name} className="catalog-item-image" />
                                                    ) : (
                                                        <div className="catalog-item-image-fallback">
                                                            {item.isCombo ? <Layers size={18} /> : <Store size={18} />}
                                                        </div>
                                                    )}

                                                    <div className="catalog-item-info">
                                                        <h4 className="catalog-item-name">
                                                            {item.name}
                                                            {item.isCombo && (
                                                                <span className="badge badge-secondary ml-2" style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem', background: '#eae7e0', color: '#425149' }}>Combo</span>
                                                            )}
                                                        </h4>
                                                        <p className="catalog-item-price">${Number(item.price || 0).toLocaleString()}</p>
                                                    </div>

                                                    {/* Promotional ribbon input */}
                                                    <div className="catalog-item-badge-input">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Cinta ej. 15% OFF" 
                                                            value={badge}
                                                            onChange={e => handleBadgeChange(item.id, e.target.value)}
                                                            title="Ej. 'Destacado', 'Oferta', '10% OFF'. Se mostrará sobre la tarjeta en el storefront público."
                                                        />
                                                    </div>

                                                    {/* Selective toggle switch */}
                                                    <div className="catalog-item-publish-toggle">
                                                        <span className="publish-status-text" style={{ color: published ? '#10b981' : '#64748b' }}>
                                                            {published ? 'Público' : 'Oculto'}
                                                        </span>
                                                        <label className="customizer-switch">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={published}
                                                                onChange={() => item.isCombo ? togglePackagePublish(item as any) : toggleProductPublish(item as any)}
                                                            />
                                                            <span className="customizer-slider"></span>
                                                        </label>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Live CSS Phone Simulator Frame */}
                    <div className="customizer-panel-right">
                        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                            <Smartphone size={16} />
                            <span>Simulador de Teléfono en Vivo</span>
                        </div>

                        <div className="phone-simulator-frame" style={phoneStyleProps}>
                            {/* Notch camera */}
                            <div className="phone-notch" />
                            
                            {/* Dynamic battery & time status bar */}
                            <div className={`phone-status-bar ${form.seasonal_theme !== 'none' ? 'phone-status-bar-dark' : ''}`}>
                                <span>{formattedPhoneTime}</span>
                                <div className="phone-status-right">
                                    <span>LTE</span>
                                    <span style={{ fontSize: '0.55rem' }}>🔋 100%</span>
                                </div>
                            </div>

                            <div className="phone-preview-content">
                                
                                {/* Dynamic Seasonal Particles Preview */}
                                {form.seasonal_theme !== 'none' && (
                                    <div className="mock-particle-container">
                                        {previewParticles.map(p => (
                                            <span 
                                                key={p.id} 
                                                className="mock-particle"
                                                style={p.style}
                                            >
                                                {p.emoji}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Premium banner alert */}
                                {form.banner_badge && (
                                    <div className="mock-promo-banner">
                                        <Sparkles size={8} />
                                        <span>{form.banner_badge}</span>
                                    </div>
                                )}

                                {/* Simulated Shop Header */}
                                <div 
                                    className="mock-shop-header" 
                                    style={{ 
                                        backgroundColor: form.theme_color, 
                                        backgroundImage: form.seasonal_theme === 'valentines' 
                                            ? 'linear-gradient(to bottom, #be123c, #9f1239)' 
                                            : form.seasonal_theme === 'mother_day'
                                            ? 'linear-gradient(to bottom, #db2777, #be185d)'
                                            : form.seasonal_theme === 'christmas'
                                            ? 'linear-gradient(to bottom, #15803d, #166534)'
                                            : form.seasonal_theme === 'spring'
                                            ? 'linear-gradient(to bottom, #4d7c0f, #3f6212)'
                                            : 'none'
                                    }}
                                >
                                    <div className="mock-shop-logo-box">
                                        {form.logo_url ? (
                                            <img src={form.logo_url} alt="Logo" className="mock-shop-logo" />
                                        ) : (
                                            <div className="mock-shop-logo-fallback">
                                                {form.banner_title ? form.banner_title.substring(0, 2).toUpperCase() : 'FL'}
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="mock-shop-name">{form.banner_title || 'Mi Florería'}</h2>
                                    <p className="mock-shop-tagline">{form.banner_subtitle}</p>

                                    <div className="mock-shop-socials">
                                        {form.whatsapp_number && (
                                            <span className="mock-social-pill">
                                                <MessageCircle size={8} />
                                                WhatsApp
                                            </span>
                                        )}
                                        {form.social_instagram && (
                                            <span className="mock-social-pill">
                                                <Instagram size={8} />
                                                Instagram
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Simulated Sticky Search & Catalog Filter */}
                                <div className="mock-shop-search">
                                    <div className="mock-search-box">
                                        <span>🔍 Buscar ramos o arreglos...</span>
                                    </div>
                                </div>

                                <div className="mock-catalog-categories">
                                    <span className="mock-cat-chip active">Todo</span>
                                    <span className="mock-cat-chip">Ramos</span>
                                    <span className="mock-cat-chip">Rosas</span>
                                    <span className="mock-cat-chip">Plantas</span>
                                </div>

                                {/* Mock catalog cards in phone simulator */}
                                <div className="mock-products-grid">
                                    {/* Mock Card 1 */}
                                    <div className="mock-product-card">
                                        <div className="mock-product-image-box">
                                            <div className="mock-product-promo-badge">🌸 Destacado</div>
                                            <div style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🌹</div>
                                        </div>
                                        <div className="mock-product-body">
                                            <h4 className="mock-product-name">Ramo Tulipanes Tulip</h4>
                                            <p className="mock-product-price" style={{ color: form.theme_color }}>$12.500</p>
                                            <button className="mock-product-btn" style={{ backgroundColor: form.theme_color }}>Comprar</button>
                                        </div>
                                    </div>

                                    {/* Mock Card 2 */}
                                    <div className="mock-product-card">
                                        <div className="mock-product-image-box">
                                            <div className="mock-product-promo-badge">🔥 Oferta</div>
                                            <div style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🌻</div>
                                        </div>
                                        <div className="mock-product-body">
                                            <h4 className="mock-product-name">Arreglo Girasoles Sol</h4>
                                            <p className="mock-product-price" style={{ color: form.theme_color }}>$9.800</p>
                                            <button className="mock-product-btn" style={{ backgroundColor: form.theme_color }}>Comprar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Simulated home indicator */}
                            <div className="phone-home-indicator" />
                        </div>
                    </div>

                    {/* Floating Save Actions Bar (only shows when form has changes) */}
                    <div className={`floating-save-bar ${hasUnsavedChanges ? 'visible' : ''}`}>
                        <div className="floating-save-bar-info">
                            <Info className="floating-save-bar-icon" size={20} />
                            <div>
                                <p className="floating-save-bar-title">Tienes cambios sin guardar</p>
                                <p className="floating-save-bar-desc">Modificaste el branding o el diseño de tu Tienda Online 3.0.</p>
                            </div>
                        </div>

                        <div className="floating-save-bar-actions">
                            <button 
                                className="btn-floating-cancel" 
                                onClick={handleDiscardChanges}
                                disabled={saving}
                            >
                                <Undo size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                                Descartar
                            </button>
                            <button 
                                className="btn-floating-save" 
                                onClick={handleSaveSettings}
                                disabled={saving}
                            >
                                <Save size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>

                </div>
            )}

            {/* Standard ERP creation modals triggered from Catalog Setup */}
            <ProductModal 
                isOpen={isProductModalOpen}
                onClose={() => {
                    setIsProductModalOpen(false);
                    loadProducts();
                }}
            />

            <PackageBuilderModal 
                isOpen={isPackageModalOpen}
                onClose={() => {
                    setIsPackageModalOpen(false);
                    loadPackages();
                }}
            />
        </div>
    );
};
export default StorefrontCustomizer;
