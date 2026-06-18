import { useState, useEffect, useCallback } from 'react';
import { 
    useStore 
} from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { api } from '../../services/api';
import { 
    Globe, Save, Undo, Sparkles, Instagram, Facebook,
    Search, Plus, Store, Image,
    Info, ExternalLink, Copy, Check,
    Settings, ShoppingBag, Star, Trash2, Edit3,
    Eye, EyeOff, Shield, CreditCard, Percent, ChevronUp, ChevronDown,
    X, ArrowRight, Palette, Camera, UploadCloud, Type, AlignCenter, AlignLeft, AlignRight, Tag
} from 'lucide-react';
import { CloudinaryUploadWidget } from '../../components/CloudinaryUploadWidget/CloudinaryUploadWidget';
import { ProductModal } from '../../components/ProductModal/ProductModal';
import { PackageBuilderModal } from '../../components/PackageBuilder/PackageBuilderModal';
import './StorefrontCustomizer.css';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface HeroSlide {
    id: string;
    image_url: string;
    title?: string;
    subtitle?: string;
    cta_text?: string;
}

interface StorefrontPost {
    id: string;
    title: string;
    description: string;
    price: number;
    image_url: string;
    image_position?: string; // 'center', 'top', 'bottom', 'left', 'right'
    image_zoom?: number;     // 100-200 (percentage)
    badge?: string;
    is_featured: boolean;
    category_tag: string;
    active: boolean;
    created_at: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const BRAND_PRESETS = [
    { id: 'forest',   name: 'Verde Bosque',  color: '#1e3f20', accent: '#4ade80' },
    { id: 'rose',     name: 'Rosa Carmesí',  color: '#be123c', accent: '#fb7185' },
    { id: 'blossom',  name: 'Flor Rosa',     color: '#9d174d', accent: '#f9a8d4' },
    { id: 'lavender', name: 'Lavanda Real',  color: '#5b21b6', accent: '#a78bfa' },
    { id: 'earth',    name: 'Tierra Cálida', color: '#7c2d12', accent: '#fb923c' },
    { id: 'sage',     name: 'Salvia',        color: '#3d6b4f', accent: '#86efac' },
    { id: 'charcoal', name: 'Carbón Premium',color: '#1e293b', accent: '#94a3b8' },
    { id: 'sunset',   name: 'Atardecer',     color: '#c2410c', accent: '#fbbf24' },
];

const SEASONAL_THEMES = [
    { id: 'none',       emoji: '🌿', name: 'Estándar',         desc: 'Sin efectos especiales',           bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    { id: 'valentines', emoji: '💖', name: 'San Valentín',     desc: 'Corazones flotantes, fondo rosa',  bg: 'linear-gradient(135deg,#fff0f6,#fce7f3)' },
    { id: 'mother_day', emoji: '🌸', name: 'Día de la Madre',  desc: 'Pétalos suaves, lila pastel',      bg: 'linear-gradient(135deg,#fdf4ff,#f0abfc20)' },
    { id: 'spring',     emoji: '🌻', name: 'Primavera',        desc: 'Flores y hojas, fondo luminoso',   bg: 'linear-gradient(135deg,#fefce8,#ecfccb)' },
    { id: 'christmas',  emoji: '🎄', name: 'Navidad',          desc: 'Nieve cayendo, verde esmeralda',   bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
];

const CATEGORY_TAGS = ['Destacado', 'Novedad', 'Temporada', 'Romántico', 'Cumpleaños', 'Condolencias', 'Corporativo', 'Otro'];

const IMAGE_POSITIONS = [
    { value: 'center', label: 'Centro' },
    { value: 'top', label: 'Arriba' },
    { value: 'bottom', label: 'Abajo' },
    { value: 'left center', label: 'Izquierda' },
    { value: 'right center', label: 'Derecha' },
];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export const StorefrontCustomizer = () => {
    const products = useStore(state => state.products);
    const packages = useStore(state => state.packages);
    const categories = useStore(state => state.categoriesData);
    const loadProducts = useStore(state => state.loadProducts);
    const loadPackages = useStore(state => state.loadPackages);
    const loadCategories = useStore(state => state.loadCategories);
    const updateProduct = useStore(state => state.updateProduct);
    const updatePackage = useStore(state => state.updatePackage);
    const loadShopInfo = useStore(state => state.loadShopInfo);

    const { user: _user } = useAuth();

    // ── Navigation ──────────────────────────────
    const [activeTab, setActiveTab] = useState<'inicio' | 'marca' | 'diseno' | 'publicaciones' | 'banners' | 'config'>('inicio');

    // ── UI States ───────────────────────────────
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [slug, setSlug] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [showMpToken, setShowMpToken] = useState(false);

    // ── Catalog ─────────────────────────────────
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState<string | null>(null);

    // ── Modals ───────────────────────────────────
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);

    // ── Post editor state ───────────────────────
    const [editingPost, setEditingPost] = useState<StorefrontPost | null>(null);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [postForm, setPostForm] = useState<Partial<StorefrontPost>>({
        title: '', description: '', price: 0, image_url: '',
        image_position: 'center', image_zoom: 100,
        badge: '', is_featured: false, category_tag: 'Destacado', active: true
    });

    // ── Hero slide editor ───────────────────────
    const [slideForm, setSlideForm] = useState<Partial<HeroSlide>>({ image_url: '', title: '', subtitle: '', cta_text: '' });

    // ── Main form ────────────────────────────────
    const [form, setForm] = useState({
        // Marca
        active: true,
        banner_title: '',
        banner_subtitle: 'Bienvenidos a nuestra tienda online',
        whatsapp_number: '',
        logo_url: '',
        profile_image_url: '',
        about_us: '',
        social_instagram: '',
        social_facebook: '',
        banner_badge: '',
        delivery_zones: '',
        delivery_days: '',
        // Diseño
        theme_color: '#1e3f20',
        theme_preset: 'forest',
        seasonal_theme: 'none' as 'none' | 'mother_day' | 'valentines' | 'spring' | 'christmas',
        font_family: 'Inter',
        banner_alignment: 'center' as 'left' | 'center' | 'right',
        marquee_text: '',
        web_categories: [] as string[],
        // Publicaciones (array stored as JSON)
        storefront_posts: [] as StorefrontPost[],
        // Banners
        hero_slides: [] as HeroSlide[],
        featured_collection_title: 'Nuestros Destacados',
        // Config
        price_markup: 0,
        mp_enabled: false,
        mercadopago_public_key: '',
        mercadopago_access_token: '',
        promotions: {} as Record<string, { badge?: string; discount_percent?: number }>
    });

    const [savedForm, setSavedForm] = useState({ ...form });
    const hasChanges = JSON.stringify(form) !== JSON.stringify(savedForm);

    // ── Load initial data ─────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                await Promise.allSettled([loadProducts(), loadPackages(), loadCategories()]);
                const data = await api.request('/business') as any;
                const sf = data.settings?.storefront || {};
                setSlug(data.slug || '');

                const loadedForm = {
                    active: sf.active ?? true,
                    banner_title: sf.banner_title || data.name || '',
                    banner_subtitle: sf.banner_subtitle || 'Bienvenidos a nuestra tienda online',
                    whatsapp_number: sf.whatsapp_number || data.phone || '',
                    logo_url: sf.logo_url || (data as any).logo_url || '',
                    profile_image_url: sf.profile_image_url || '',
                    about_us: sf.about_us || '',
                    social_instagram: sf.social_instagram || '',
                    social_facebook: sf.social_facebook || '',
                    banner_badge: sf.banner_badge || '',
                    delivery_zones: sf.delivery_zones || '',
                    delivery_days: sf.delivery_days || '',
                    theme_color: sf.theme_color || '#1e3f20',
                    theme_preset: sf.theme_preset || 'forest',
                    seasonal_theme: sf.seasonal_theme || 'none',
                    font_family: sf.font_family || 'Inter',
                    banner_alignment: sf.banner_alignment || 'center',
                    marquee_text: sf.marquee_text || '',
                    web_categories: sf.web_categories || [],
                    storefront_posts: sf.storefront_posts || [],
                    hero_slides: sf.hero_slides || [],
                    featured_collection_title: sf.featured_collection_title || 'Nuestros Destacados',
                    price_markup: sf.price_markup || 0,
                    mp_enabled: sf.mp_enabled ?? false,
                    mercadopago_public_key: sf.mercadopago_public_key || '',
                    mercadopago_access_token: sf.mercadopago_access_token || sf.mp_access_token || '',
                    promotions: sf.promotions || {}
                };
                setForm(loadedForm);
                setSavedForm(loadedForm);
            } catch (err: any) {
                setErrorMsg('Error al cargar la configuración');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // ── Save ──────────────────────────────────────
    const handleSave = async () => {
        try {
            setSaving(true);
            setErrorMsg(null);
            const data = await api.request('/business') as any;
            const currentSettings = (data as any).settings || {};
            await api.request('/business', {
                method: 'PUT',
                body: JSON.stringify({
                    settings: {
                        ...currentSettings,
                        storefront: {
                            ...(currentSettings.storefront || {}),
                            ...form
                        }
                    }
                })
            });
            setSavedForm({ ...form });
            await loadShopInfo();
            setSuccessMsg('✅ ¡Configuración guardada con éxito!');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            setErrorMsg('Error al guardar: ' + (err.message || 'Error desconocido'));
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => setForm({ ...savedForm });

    // ── Field helpers ─────────────────────────────
    const setField = useCallback(<K extends keyof typeof form>(key: K, value: typeof form[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    }, []);

    // ── Catalog publish toggle ─────────────────────
    const handlePublishToggle = async (item: any, isCombo: boolean) => {
        const newVal = !item.storefront_published;
        try {
            if (isCombo) {
                await api.request(`/packages/${item.id}`, { method: 'PUT', body: JSON.stringify({ storefront_published: newVal }) } as any);
                updatePackage(item.id, { storefront_published: newVal } as any);
            } else {
                await api.request(`/products/${item.id}`, { method: 'PUT', body: JSON.stringify({ storefront_published: newVal }) } as any);
                updateProduct(item.id, { storefront_published: newVal } as any);
            }
        } catch { setErrorMsg('Error al actualizar publicación'); }
    };

    // ── Posts CRUD ─────────────────────────────────
    const openNewPost = () => {
        setEditingPost(null);
        setPostForm({ title: '', description: '', price: 0, image_url: '', image_position: 'center', image_zoom: 100, badge: '', is_featured: false, category_tag: 'Destacado', active: true });
        setIsPostModalOpen(true);
    };

    const openEditPost = (post: StorefrontPost) => {
        setEditingPost(post);
        setPostForm({ ...post });
        setIsPostModalOpen(true);
    };

    const handleSavePost = () => {
        const newPost: StorefrontPost = {
            id: editingPost?.id || `post_${Date.now()}`,
            title: postForm.title || '',
            description: postForm.description || '',
            price: Number(postForm.price) || 0,
            image_url: postForm.image_url || '',
            image_position: postForm.image_position || 'center',
            image_zoom: postForm.image_zoom || 100,
            badge: postForm.badge || '',
            is_featured: postForm.is_featured ?? false,
            category_tag: postForm.category_tag || 'Destacado',
            active: postForm.active ?? true,
            created_at: editingPost?.created_at || new Date().toISOString()
        };

        setForm(prev => {
            const posts = editingPost
                ? prev.storefront_posts.map(p => p.id === editingPost.id ? newPost : p)
                : [...prev.storefront_posts, newPost];
            return { ...prev, storefront_posts: posts };
        });
        setIsPostModalOpen(false);
    };

    const handleDeletePost = (id: string) => {
        setForm(prev => ({ ...prev, storefront_posts: prev.storefront_posts.filter(p => p.id !== id) }));
    };

    const handleTogglePostActive = (id: string) => {
        setForm(prev => ({
            ...prev,
            storefront_posts: prev.storefront_posts.map(p => p.id === id ? { ...p, active: !p.active } : p)
        }));
    };

    // ── Hero Slides CRUD ───────────────────────────
    const handleAddSlide = () => {
        if (!slideForm.image_url?.trim()) return;
        const newSlide: HeroSlide = {
            id: `slide_${Date.now()}`,
            image_url: slideForm.image_url || '',
            title: slideForm.title || '',
            subtitle: slideForm.subtitle || '',
            cta_text: slideForm.cta_text || ''
        };
        setForm(prev => ({ ...prev, hero_slides: [...prev.hero_slides, newSlide] }));
        setSlideForm({ image_url: '', title: '', subtitle: '', cta_text: '' });
    };

    const handleDeleteSlide = (id: string) => {
        setForm(prev => ({ ...prev, hero_slides: prev.hero_slides.filter(s => s.id !== id) }));
    };

    const handleMoveSlide = (id: string, dir: 'up' | 'down') => {
        setForm(prev => {
            const slides = [...prev.hero_slides];
            const idx = slides.findIndex(s => s.id === id);
            if (dir === 'up' && idx > 0) [slides[idx], slides[idx - 1]] = [slides[idx - 1], slides[idx]];
            if (dir === 'down' && idx < slides.length - 1) [slides[idx], slides[idx + 1]] = [slides[idx + 1], slides[idx]];
            return { ...prev, hero_slides: slides };
        });
    };

    // ── Catalog filter ──────────────────────────────
    const allCatalogItems = [
        ...products.map(p => ({ ...p, isCombo: false })),
        ...packages.map(p => ({ ...p, isCombo: true, price: (p as any).suggested_price }))
    ].filter(item => {
        const q = catalogSearch.toLowerCase();
        const matchSearch = !q || item.name.toLowerCase().includes(q);
        const matchCat = !catalogCategory || (item as any).category_id === catalogCategory;
        return matchSearch && matchCat;
    });

    // ── Copy URL ────────────────────────────────────
    const storeUrl = slug ? `${window.location.protocol}//${window.location.host}/${slug}` : '';
    const handleCopyUrl = () => {
        if (!storeUrl) return;
        navigator.clipboard.writeText(storeUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="sc-loading">
                <div className="sc-loading-spinner" />
                <p>Cargando centro de control...</p>
            </div>
        );
    }

    return (
        <div className="sc-wrapper">

            {/* ── Header ─────────────────────────────── */}
            <div className="sc-header">
                <div className="sc-header-left">
                    <div className="sc-header-icon"><Globe size={20} /></div>
                    <div>
                        <h1 className="sc-header-title">Tienda Online</h1>
                        <p className="sc-header-sub">Centro de control de tu vitrina digital</p>
                    </div>
                </div>
                <div className="sc-header-right">
                    {storeUrl && (
                        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="sc-btn-ghost">
                            <ExternalLink size={15} />
                            <span>Ver tienda</span>
                        </a>
                    )}
                    <div className={`sc-status-pill ${form.active ? 'active' : 'paused'}`}>
                        <span className="sc-status-dot" />
                        {form.active ? 'Tienda Activa' : 'Pausada'}
                    </div>
                </div>
            </div>

            {/* ── Tabs ───────────────────────────────── */}
            <div className="sc-tabs-bar">
                {[
                    { id: 'inicio',         icon: Store,       label: 'Inicio' },
                    { id: 'marca',          icon: Camera,      label: 'Marca' },
                    { id: 'diseno',         icon: Palette,     label: 'Diseño' },
                    { id: 'publicaciones',  icon: ShoppingBag, label: 'Publicaciones' },
                    { id: 'banners',        icon: Image,       label: 'Banners' },
                    { id: 'config',         icon: Settings,    label: 'Configuración' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`sc-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        <tab.icon size={16} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Alerts ─────────────────────────────── */}
            {errorMsg && (
                <div className="sc-alert sc-alert-error">
                    <X size={16} /><span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)}><X size={14} /></button>
                </div>
            )}
            {successMsg && (
                <div className="sc-alert sc-alert-success">
                    <Check size={16} /><span>{successMsg}</span>
                </div>
            )}

            {/* ── Content ────────────────────────────── */}
            <div className="sc-content">

                {/* ════════════════ TAB: INICIO ════════════════ */}
                {activeTab === 'inicio' && (
                    <div className="sc-tab-content">
                        <div className="sc-inicio-grid">

                            {/* Store Status Card */}
                            <div className="sc-card sc-card-status">
                                <div className="sc-card-header">
                                    <Globe size={20} />
                                    <h2>Estado de tu Tienda</h2>
                                </div>
                                <div className="sc-status-url-box">
                                    <div className="sc-url-label">URL pública de tu tienda:</div>
                                    <div className="sc-url-row">
                                        <span className="sc-url-text">{storeUrl || '— Aún no configurado —'}</span>
                                        {storeUrl && (
                                            <button className="sc-url-copy" onClick={handleCopyUrl}>
                                                {copySuccess ? <Check size={15} /> : <Copy size={15} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="sc-inicio-actions">
                                    {storeUrl && (
                                        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="sc-btn-primary">
                                            <ExternalLink size={15} /><span>Abrir tienda</span>
                                        </a>
                                    )}
                                    <button className="sc-btn-secondary" onClick={() => setActiveTab('config')}>
                                        <Settings size={15} /><span>Configurar</span>
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="sc-inicio-stats">
                                <div className="sc-stat-card">
                                    <span className="sc-stat-num">{products.filter(p => p.storefront_published).length}</span>
                                    <span className="sc-stat-label">Productos publicados</span>
                                </div>
                                <div className="sc-stat-card">
                                    <span className="sc-stat-num">{packages.filter(p => p.storefront_published).length}</span>
                                    <span className="sc-stat-label">Combos publicados</span>
                                </div>
                                <div className="sc-stat-card">
                                    <span className="sc-stat-num">{form.storefront_posts.filter(p => p.active).length}</span>
                                    <span className="sc-stat-label">Publicaciones activas</span>
                                </div>
                                <div className="sc-stat-card">
                                    <span className="sc-stat-num">{form.hero_slides.length}</span>
                                    <span className="sc-stat-label">Slides del banner</span>
                                </div>
                            </div>

                            {/* Quick Access */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Sparkles size={18} /><h2>Accesos Rápidos</h2></div>
                                <div className="sc-quicklinks">
                                    {[
                                        { label: 'Editar marca y logo',    icon: Camera,      tab: 'marca' },
                                        { label: 'Cambiar colores y tema', icon: Palette,     tab: 'diseno' },
                                        { label: 'Crear publicación',      icon: ShoppingBag, tab: 'publicaciones' },
                                        { label: 'Editar banner hero',     icon: Image,       tab: 'banners' },
                                        { label: 'MercadoPago y slug',     icon: Settings,    tab: 'config' },
                                    ].map(link => (
                                        <button key={link.tab} className="sc-quicklink-btn" onClick={() => setActiveTab(link.tab as any)}>
                                            <link.icon size={16} />
                                            <span>{link.label}</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ TAB: MARCA ════════════════ */}
                {activeTab === 'marca' && (
                    <div className="sc-tab-content">
                        <div className="sc-form-grid">
                            <div className="sc-card sc-card-wide">
                                <div className="sc-card-header"><Camera size={18} /><h2>Identidad Visual</h2></div>

                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label">Logo de la Tienda (URL)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input type="url" className="sc-input" style={{ flex: 1 }} value={form.logo_url} onChange={e => setField('logo_url', e.target.value)} placeholder="https://..." />
                                            <CloudinaryUploadWidget onSuccess={(url) => setField('logo_url', url)} options={{ cropping: true, showSkipCropButton: false }}>
                                                {(open) => (
                                                    <button type="button" className="sc-btn-secondary" onClick={open} title="Subir Imagen"><UploadCloud size={15} /></button>
                                                )}
                                            </CloudinaryUploadWidget>
                                        </div>
                                        {form.logo_url && (
                                            <div className="sc-img-preview">
                                                <img src={form.logo_url} alt="Logo preview" onError={e => (e.currentTarget.style.display = 'none')} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label">Foto de Perfil de la Tienda (URL)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input type="url" className="sc-input" style={{ flex: 1 }} value={form.profile_image_url} onChange={e => setField('profile_image_url', e.target.value)} placeholder="https://..." />
                                            <CloudinaryUploadWidget onSuccess={(url) => setField('profile_image_url', url)} options={{ cropping: true, showSkipCropButton: false }}>
                                                {(open) => (
                                                    <button type="button" className="sc-btn-secondary" onClick={open} title="Subir Imagen"><UploadCloud size={15} /></button>
                                                )}
                                            </CloudinaryUploadWidget>
                                        </div>
                                        {form.profile_image_url && (
                                            <div className="sc-img-preview sc-img-preview-round">
                                                <img src={form.profile_image_url} alt="Perfil preview" onError={e => (e.currentTarget.style.display = 'none')} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label">Nombre de la Tienda *</label>
                                        <input type="text" className="sc-input" value={form.banner_title} onChange={e => setField('banner_title', e.target.value)} placeholder="Ej: Florería Aster" />
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label">Eslogan / Subtítulo</label>
                                        <input type="text" className="sc-input" value={form.banner_subtitle} onChange={e => setField('banner_subtitle', e.target.value)} placeholder="Ej: Flores con alma, desde 1998" />
                                    </div>
                                </div>

                                <div className="sc-form-group">
                                    <label className="sc-label">Sobre Nosotros (aparece en el footer de la tienda)</label>
                                    <textarea className="sc-textarea" rows={3} value={form.about_us} onChange={e => setField('about_us', e.target.value)} placeholder="Contá la historia de tu florería, tu pasión por las flores, tu experiencia..." />
                                </div>

                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label">WhatsApp de Contacto *</label>
                                        <input type="tel" className="sc-input" value={form.whatsapp_number} onChange={e => setField('whatsapp_number', e.target.value)} placeholder="+5491112345678" />
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label">Cinta Promocional Superior</label>
                                        <input type="text" className="sc-input" value={form.banner_badge} onChange={e => setField('banner_badge', e.target.value)} placeholder="Ej: ✨ Envíos gratis en compras +$10.000" />
                                    </div>
                                </div>

                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label"><Instagram size={14} style={{ display: 'inline', marginRight: 4 }} />Instagram (usuario sin @)</label>
                                        <input type="text" className="sc-input" value={form.social_instagram} onChange={e => setField('social_instagram', e.target.value)} placeholder="floreria_aster" />
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label"><Facebook size={14} style={{ display: 'inline', marginRight: 4 }} />Facebook (usuario sin fb.com/)</label>
                                        <input type="text" className="sc-input" value={form.social_facebook} onChange={e => setField('social_facebook', e.target.value)} placeholder="floreria.aster" />
                                    </div>
                                </div>

                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label">Zonas de Entrega</label>
                                        <input type="text" className="sc-input" value={form.delivery_zones} onChange={e => setField('delivery_zones', e.target.value)} placeholder="Ej: Belgrano, Palermo, Recoleta, CABA" />
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label">Horarios de Entrega</label>
                                        <input type="text" className="sc-input" value={form.delivery_days} onChange={e => setField('delivery_days', e.target.value)} placeholder="Ej: Lun-Sáb 9 a 19hs, Dom 10 a 14hs" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ TAB: DISEÑO ════════════════ */}
                {activeTab === 'diseno' && (
                    <div className="sc-tab-content">
                        <div className="sc-form-grid">
                            
                            {/* Typography Section */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Type size={18} /><h2>Tipografía Global</h2></div>
                                <div className="sc-presets-grid">
                                    {['Inter', 'Outfit', 'Playfair Display', 'Caveat', 'Lora', 'Roboto'].map(font => (
                                        <button
                                            key={font}
                                            className={`sc-preset-btn ${form.font_family === font ? 'active' : ''}`}
                                            onClick={() => setField('font_family', font)}
                                            style={{ fontFamily: font, fontWeight: 600, fontSize: '1rem' }}
                                        >
                                            <span>{font}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Banner Layout */}
                            <div className="sc-card">
                                <div className="sc-card-header"><AlignCenter size={18} /><h2>Estilo de Banner</h2></div>
                                <div className="sc-form-row">
                                    <div className="sc-form-group">
                                        <label className="sc-label">Alineación de Texto</label>
                                        <div className="sc-btn-group">
                                            {[
                                                { val: 'left', icon: AlignLeft, label: 'Izq' },
                                                { val: 'center', icon: AlignCenter, label: 'Centro' },
                                                { val: 'right', icon: AlignRight, label: 'Der' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.val}
                                                    className={`sc-btn-option ${form.banner_alignment === opt.val ? 'active' : ''}`}
                                                    onClick={() => setField('banner_alignment', opt.val as any)}
                                                >
                                                    <opt.icon size={15} style={{ marginRight: 4 }} /> {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="sc-form-group">
                                        <label className="sc-label">Cinta Infinita en movimiento (Marquee)</label>
                                        <input type="text" className="sc-input" value={form.marquee_text} onChange={e => setField('marquee_text', e.target.value)} placeholder="Ej: ✨ ENVÍOS GRATIS A TODO CABA ✨" />
                                    </div>
                                </div>
                            </div>

                            {/* Color Section */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Palette size={18} /><h2>Color de Marca</h2></div>
                                <div className="sc-presets-grid">
                                    {BRAND_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            className={`sc-preset-btn ${form.theme_preset === preset.id ? 'active' : ''}`}
                                            onClick={() => { setField('theme_preset', preset.id); setField('theme_color', preset.color); }}
                                        >
                                            <div className="sc-preset-swatch" style={{ background: `linear-gradient(135deg, ${preset.color}, ${preset.accent})` }} />
                                            <span>{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="sc-color-custom">
                                    <label className="sc-label">Color personalizado</label>
                                    <div className="sc-color-row">
                                        <input type="color" className="sc-color-picker" value={form.theme_color} onChange={e => { setField('theme_color', e.target.value); setField('theme_preset', 'custom'); }} />
                                        <input type="text" className="sc-input sc-input-sm" value={form.theme_color} onChange={e => { setField('theme_color', e.target.value); setField('theme_preset', 'custom'); }} />
                                        <div className="sc-color-preview" style={{ backgroundColor: form.theme_color }} />
                                    </div>
                                </div>
                            </div>

                            {/* Seasonal Theme */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Sparkles size={18} /><h2>Tema Estacional</h2></div>
                                <p className="sc-card-desc">El tema activo aplica efectos de partículas flotantes y colores especiales en la tienda pública.</p>
                                <div className="sc-seasonal-grid">
                                    {SEASONAL_THEMES.map(theme => (
                                        <button
                                            key={theme.id}
                                            className={`sc-seasonal-btn ${form.seasonal_theme === theme.id ? 'active' : ''}`}
                                            onClick={() => setField('seasonal_theme', theme.id as any)}
                                            style={{ '--seasonal-bg': theme.bg } as any}
                                        >
                                            <span className="sc-seasonal-emoji">{theme.emoji}</span>
                                            <span className="sc-seasonal-name">{theme.name}</span>
                                            <span className="sc-seasonal-desc">{theme.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ TAB: PUBLICACIONES ════════════════ */}
                {activeTab === 'publicaciones' && (
                    <div className="sc-tab-content">

                        {/* Own Posts Section */}
                        <div className="sc-card sc-card-wide">
                            <div className="sc-card-header">
                                <ShoppingBag size={18} />
                                <h2>Publicaciones Propias</h2>
                                <button className="sc-btn-primary sc-btn-sm" onClick={openNewPost}>
                                    <Plus size={15} /><span>Nueva publicación</span>
                                </button>
                            </div>
                            <p className="sc-card-desc">Creá publicaciones exclusivas para tu tienda, independientes del inventario. Ideal para paquetes especiales, servicios, o productos únicos.</p>

                            {form.storefront_posts.length === 0 ? (
                                <div className="sc-empty-state">
                                    <ShoppingBag size={36} />
                                    <p>Aún no tenés publicaciones propias.</p>
                                    <button className="sc-btn-primary" onClick={openNewPost}><Plus size={15} />Crear primera publicación</button>
                                </div>
                            ) : (
                                <div className="sc-posts-grid">
                                    {form.storefront_posts.map(post => (
                                        <div key={post.id} className={`sc-post-card ${!post.active ? 'inactive' : ''}`}>
                                            <div className="sc-post-img" style={{
                                                backgroundImage: post.image_url ? `url(${post.image_url})` : undefined,
                                                backgroundPosition: post.image_position || 'center',
                                                backgroundSize: `${post.image_zoom || 100}%`
                                            }}>
                                                {!post.image_url && <Image size={28} />}
                                                {post.badge && <div className="sc-post-badge">{post.badge}</div>}
                                                {post.is_featured && <div className="sc-post-featured"><Star size={12} />Destacado</div>}
                                            </div>
                                            <div className="sc-post-info">
                                                <p className="sc-post-tag">{post.category_tag}</p>
                                                <h3 className="sc-post-title">{post.title}</h3>
                                                <p className="sc-post-price">${post.price.toLocaleString('es-AR')}</p>
                                            </div>
                                            <div className="sc-post-actions">
                                                <button className="sc-icon-btn" onClick={() => handleTogglePostActive(post.id)} title={post.active ? 'Ocultar' : 'Publicar'}>
                                                    {post.active ? <EyeOff size={15} /> : <Eye size={15} />}
                                                </button>
                                                <button className="sc-icon-btn" onClick={() => openEditPost(post)} title="Editar">
                                                    <Edit3 size={15} />
                                                </button>
                                                <button className="sc-icon-btn sc-icon-btn-danger" onClick={() => handleDeletePost(post.id)} title="Eliminar">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stock Catalog Section */}
                        <div className="sc-card sc-card-wide" style={{ marginTop: '1.5rem' }}>
                            <div className="sc-card-header">
                                <Store size={18} />
                                <h2>Publicar desde Inventario</h2>
                                <div className="sc-catalog-tools">
                                    <div className="sc-search-box">
                                        <Search size={15} />
                                        <input type="text" placeholder="Buscar..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
                                    </div>
                                    <button className="sc-btn-ghost sc-btn-sm" onClick={() => setIsProductModalOpen(true)}><Plus size={14} />Producto</button>
                                    <button className="sc-btn-ghost sc-btn-sm" onClick={() => setIsPackageModalOpen(true)}><Plus size={14} />Combo</button>
                                </div>
                            </div>
                            <p className="sc-card-desc">Activá el toggle para publicar un producto o combo existente en tu tienda online.</p>

                            {/* Category filter chips */}
                            <div className="sc-filter-chips">
                                <button className={`sc-chip ${!catalogCategory ? 'active' : ''}`} onClick={() => setCatalogCategory(null)}>Todos</button>
                                {categories.map(cat => (
                                    <button key={cat.id} className={`sc-chip ${catalogCategory === cat.id ? 'active' : ''}`} onClick={() => setCatalogCategory(cat.id)}>{cat.name}</button>
                                ))}
                            </div>

                            {/* Web Categories Management */}
                            <div className="sc-card sc-card-wide" style={{ marginTop: '1.5rem' }}>
                                <div className="sc-card-header"><Tag size={18} /><h2>Categorías de la Web</h2></div>
                                <p className="sc-card-desc">Crea secciones exclusivas para organizar tu tienda online (ej: Ramos, Cajas, Combos).</p>
                                <div className="sc-form-row">
                                    <div className="sc-form-group" style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input 
                                                type="text" 
                                                className="sc-input" 
                                                placeholder="Nueva categoría web... y presiona Enter" 
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                        const v = e.currentTarget.value.trim();
                                                        if (!form.web_categories.includes(v)) {
                                                            setField('web_categories', [...form.web_categories, v]);
                                                        }
                                                        e.currentTarget.value = '';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="sc-filter-chips" style={{ marginTop: '0.5rem' }}>
                                    {form.web_categories.map(wc => (
                                        <div key={wc} className="sc-chip" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingRight: '0.25rem' }}>
                                            {wc}
                                            <button className="sc-icon-btn" style={{ padding: 2, margin: 0, width: 20, height: 20 }} onClick={() => setField('web_categories', form.web_categories.filter(c => c !== wc))}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {form.web_categories.length === 0 && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Aún no hay categorías personalizadas.</span>}
                                </div>
                            </div>

                            <div className="sc-catalog-list" style={{ marginTop: '1.5rem' }}>
                                {allCatalogItems.length === 0 ? (
                                    <div className="sc-empty-state"><Store size={36} /><p>No hay productos en tu inventario todavía.</p></div>
                                ) : allCatalogItems.map(item => (
                                    <div key={item.id} className={`sc-catalog-row ${item.storefront_published ? 'published' : ''}`}>
                                        <div className="sc-catalog-img">
                                            {(item as any).images?.[0] || (item as any).image_url ? (
                                                <img src={(item as any).images?.[0] || (item as any).image_url} alt={item.name} />
                                            ) : <Sparkles size={18} />}
                                        </div>
                                        <div className="sc-catalog-info">
                                            <span className="sc-catalog-name">{item.name}</span>
                                            <span className="sc-catalog-meta">
                                                {item.isCombo ? '🎁 Combo' : '🌸 Producto'} · ${Number(item.price || 0).toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                        <div className="sc-catalog-badge-input" style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                placeholder='Etiqueta (ej: "15% OFF")'
                                                value={form.promotions[item.id]?.badge || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    promotions: { ...prev.promotions, [item.id]: { ...prev.promotions[item.id], badge: e.target.value } }
                                                }))}
                                            />
                                            <select 
                                                className="sc-input" 
                                                style={{ minWidth: 120, height: 38 }}
                                                value={(form.promotions[item.id] as any)?.web_category || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    promotions: { ...prev.promotions, [item.id]: { ...prev.promotions[item.id], web_category: e.target.value } }
                                                }))}
                                            >
                                                <option value="">Sin Categoría Web</option>
                                                {form.web_categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <label className="sc-toggle">
                                            <input type="checkbox" checked={!!item.storefront_published} onChange={() => handlePublishToggle(item, item.isCombo)} />
                                            <span className="sc-toggle-slider" />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ TAB: BANNERS ════════════════ */}
                {activeTab === 'banners' && (
                    <div className="sc-tab-content">
                        <div className="sc-card sc-card-wide">
                            <div className="sc-card-header"><Image size={18} /><h2>Banner Hero (Deslizable)</h2></div>
                            <p className="sc-card-desc">Agregá hasta 5 slides que rotan automáticamente en la parte superior de tu tienda. Usá imágenes de alta calidad (mínimo 1200×600px).</p>

                            {/* Slide list */}
                            {form.hero_slides.length > 0 && (
                                <div className="sc-slides-list">
                                    {form.hero_slides.map((slide, idx) => (
                                        <div key={slide.id} className="sc-slide-row">
                                            <div className="sc-slide-preview" style={{ backgroundImage: `url(${slide.image_url})` }}>
                                                {!slide.image_url && <Image size={20} />}
                                            </div>
                                            <div className="sc-slide-info">
                                                <p className="sc-slide-title">{slide.title || '(Sin título)'}</p>
                                                <p className="sc-slide-url">{slide.image_url || 'Sin imagen'}</p>
                                                {slide.cta_text && <span className="sc-slide-cta">{slide.cta_text}</span>}
                                            </div>
                                            <div className="sc-slide-controls">
                                                <button className="sc-icon-btn" onClick={() => handleMoveSlide(slide.id, 'up')} disabled={idx === 0}><ChevronUp size={15} /></button>
                                                <button className="sc-icon-btn" onClick={() => handleMoveSlide(slide.id, 'down')} disabled={idx === form.hero_slides.length - 1}><ChevronDown size={15} /></button>
                                                <button className="sc-icon-btn sc-icon-btn-danger" onClick={() => handleDeleteSlide(slide.id)}><Trash2 size={15} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add slide form */}
                            {form.hero_slides.length < 5 && (
                                <div className="sc-add-slide-form">
                                    <h3 className="sc-form-section-title">+ Agregar slide</h3>
                                    <div className="sc-form-row">
                                        <div className="sc-form-group">
                                            <label className="sc-label">URL de imagen *</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input type="url" className="sc-input" style={{ flex: 1 }} value={slideForm.image_url} onChange={e => setSlideForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                                                <CloudinaryUploadWidget onSuccess={(url) => setSlideForm(p => ({ ...p, image_url: url }))} options={{ cropping: true, showSkipCropButton: false }}>
                                                    {(open) => (
                                                        <button type="button" className="sc-btn-secondary" onClick={open} title="Subir Imagen"><UploadCloud size={15} /></button>
                                                    )}
                                                </CloudinaryUploadWidget>
                                            </div>
                                        </div>
                                        <div className="sc-form-group">
                                            <label className="sc-label">Título del slide</label>
                                            <input type="text" className="sc-input" value={slideForm.title} onChange={e => setSlideForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej: Flores para este Día de la Madre" />
                                        </div>
                                    </div>
                                    <div className="sc-form-row">
                                        <div className="sc-form-group">
                                            <label className="sc-label">Subtítulo</label>
                                            <input type="text" className="sc-input" value={slideForm.subtitle} onChange={e => setSlideForm(p => ({ ...p, subtitle: e.target.value }))} placeholder="Ej: Pedí antes de las 14hs y llega hoy" />
                                        </div>
                                        <div className="sc-form-group">
                                            <label className="sc-label">Texto del botón CTA</label>
                                            <input type="text" className="sc-input" value={slideForm.cta_text} onChange={e => setSlideForm(p => ({ ...p, cta_text: e.target.value }))} placeholder="Ej: Ver colección →" />
                                        </div>
                                    </div>
                                    {slideForm.image_url && (
                                        <div className="sc-slide-img-preview">
                                            <img src={slideForm.image_url} alt="Preview" onError={e => (e.currentTarget.style.display = 'none')} />
                                        </div>
                                    )}
                                    <button className="sc-btn-primary" onClick={handleAddSlide} disabled={!slideForm.image_url?.trim()}>
                                        <Plus size={16} /><span>Agregar slide</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Featured section title */}
                        <div className="sc-card" style={{ marginTop: '1.5rem' }}>
                            <div className="sc-card-header"><Star size={18} /><h2>Sección Destacados</h2></div>
                            <div className="sc-form-group">
                                <label className="sc-label">Título de la sección de destacados</label>
                                <input type="text" className="sc-input" value={form.featured_collection_title} onChange={e => setField('featured_collection_title', e.target.value)} placeholder="Nuestros Destacados" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ TAB: CONFIGURACIÓN ════════════════ */}
                {activeTab === 'config' && (
                    <div className="sc-tab-content">
                        <div className="sc-form-grid">

                            {/* Status & URL */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Globe size={18} /><h2>URL y Estado</h2></div>
                                <div className="sc-form-group">
                                    <label className="sc-label">Dirección web de tu tienda (slug)</label>
                                    <div className="sc-url-display">
                                        <span className="sc-url-prefix">{window.location.host}/</span>
                                        <span className="sc-url-slug">{slug}</span>
                                    </div>
                                    <p className="sc-hint"><Info size={12} /> El slug se define en la configuración general de tu negocio para proteger URLs ya indexadas.</p>
                                </div>

                                <div className="sc-form-group">
                                    <label className="sc-label">Estado del catálogo público</label>
                                    <div className="sc-toggle-row">
                                        <label className="sc-toggle">
                                            <input type="checkbox" checked={form.active} onChange={e => setField('active', e.target.checked)} />
                                            <span className="sc-toggle-slider" />
                                        </label>
                                        <span className={`sc-toggle-label ${form.active ? 'on' : 'off'}`}>
                                            {form.active ? '✅ Tienda Pública Activa' : '⏸️ En Mantenimiento / Pausada'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="sc-card">
                                <div className="sc-card-header"><Percent size={18} /><h2>Recargo de Precios</h2></div>
                                <div className="sc-form-group">
                                    <label className="sc-label">Porcentaje de recargo en precios web (%)</label>
                                    <input type="number" className="sc-input" value={form.price_markup} onChange={e => setField('price_markup', Math.max(0, Number(e.target.value)))} min="0" step="0.5" placeholder="0" />
                                    <p className="sc-hint"><Info size={12} /> Un recargo del 10% aplicará automáticamente sobre los precios del catálogo en la tienda pública.</p>
                                </div>
                            </div>

                            {/* MercadoPago */}
                            <div className="sc-card sc-card-wide">
                                <div className="sc-card-header"><CreditCard size={18} /><h2>Cobros con MercadoPago</h2></div>
                                <div className="sc-toggle-row" style={{ marginBottom: '1.25rem' }}>
                                    <label className="sc-toggle">
                                        <input type="checkbox" checked={form.mp_enabled} onChange={e => setField('mp_enabled', e.target.checked)} />
                                        <span className="sc-toggle-slider" />
                                    </label>
                                    <span className={`sc-toggle-label ${form.mp_enabled ? 'on' : 'off'}`}>
                                        {form.mp_enabled ? 'MercadoPago habilitado' : 'Solo WhatsApp (sin MercadoPago)'}
                                    </span>
                                </div>

                                {form.mp_enabled && (
                                    <div className="sc-form-row">
                                        <div className="sc-form-group">
                                            <label className="sc-label">Public Key</label>
                                            <input type="text" className="sc-input" value={form.mercadopago_public_key} onChange={e => setField('mercadopago_public_key', e.target.value)} placeholder="APP_USR-..." />
                                        </div>
                                        <div className="sc-form-group">
                                            <label className="sc-label">Access Token (secreto)</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input type={showMpToken ? 'text' : 'password'} className="sc-input" style={{ flex: 1 }} value={form.mercadopago_access_token} onChange={e => setField('mercadopago_access_token', e.target.value)} placeholder="APP_USR-..." />
                                                <button className="sc-btn-ghost" onClick={() => setShowMpToken(v => !v)} type="button">{showMpToken ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                                            </div>
                                        </div>
                                        <div className="sc-alert sc-alert-warning" style={{ gridColumn: '1/-1' }}>
                                            <Shield size={15} /><span>Tus credenciales se almacenan encriptadas. Nunca las compartas con nadie.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Floating Save Bar ─────────────────────── */}
            {hasChanges && (
                <div className="sc-save-bar">
                    <span className="sc-save-hint">Tenés cambios sin guardar</span>
                    <button className="sc-btn-ghost" onClick={handleDiscard}><Undo size={15} />Descartar</button>
                    <button className="sc-btn-save" onClick={handleSave} disabled={saving}>
                        <Save size={15} />
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            )}

            {/* ── Post Modal ───────────────────────────── */}
            {isPostModalOpen && (
                <div className="sc-modal-overlay" onClick={() => setIsPostModalOpen(false)}>
                    <div className="sc-modal" onClick={e => e.stopPropagation()}>
                        <div className="sc-modal-header">
                            <h2>{editingPost ? 'Editar publicación' : 'Nueva publicación'}</h2>
                            <button className="sc-icon-btn" onClick={() => setIsPostModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="sc-modal-body">
                            <div className="sc-form-row">
                                <div className="sc-form-group">
                                    <label className="sc-label">Título *</label>
                                    <input type="text" className="sc-input" value={postForm.title} onChange={e => setPostForm(p => ({ ...p, title: e.target.value }))} />
                                </div>
                                <div className="sc-form-group">
                                    <label className="sc-label">Precio *</label>
                                    <input type="number" className="sc-input" value={postForm.price} onChange={e => setPostForm(p => ({ ...p, price: Number(e.target.value) }))} min="0" />
                                </div>
                            </div>
                            <div className="sc-form-group">
                                <label className="sc-label">Descripción</label>
                                <textarea className="sc-textarea" rows={2} value={postForm.description} onChange={e => setPostForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div className="sc-form-group">
                                <label className="sc-label">URL de imagen</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="url" className="sc-input" style={{ flex: 1 }} value={postForm.image_url} onChange={e => setPostForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                                    <CloudinaryUploadWidget onSuccess={(url) => setPostForm(p => ({ ...p, image_url: url }))} options={{ cropping: true, showSkipCropButton: false }}>
                                        {(open) => (
                                            <button type="button" className="sc-btn-secondary" onClick={open} title="Subir Imagen"><UploadCloud size={15} /></button>
                                        )}
                                    </CloudinaryUploadWidget>
                                </div>
                            </div>

                            {/* Image Editor */}
                            {postForm.image_url && (
                                <div className="sc-img-editor">
                                    <div className="sc-img-editor-preview" style={{
                                        backgroundImage: `url(${postForm.image_url})`,
                                        backgroundPosition: postForm.image_position || 'center',
                                        backgroundSize: `${postForm.image_zoom || 100}%`
                                    }} />
                                    <div className="sc-img-editor-controls">
                                        <div className="sc-form-group">
                                            <label className="sc-label">Posición de imagen</label>
                                            <div className="sc-btn-group">
                                                {IMAGE_POSITIONS.map(pos => (
                                                    <button key={pos.value} className={`sc-btn-option ${postForm.image_position === pos.value ? 'active' : ''}`} onClick={() => setPostForm(p => ({ ...p, image_position: pos.value }))}>
                                                        {pos.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="sc-form-group">
                                            <label className="sc-label">Zoom: {postForm.image_zoom}%</label>
                                            <input type="range" min="100" max="200" step="5" value={postForm.image_zoom} onChange={e => setPostForm(p => ({ ...p, image_zoom: Number(e.target.value) }))} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="sc-form-row">
                                <div className="sc-form-group">
                                    <label className="sc-label">Categoría</label>
                                    <select className="sc-input" value={postForm.category_tag} onChange={e => setPostForm(p => ({ ...p, category_tag: e.target.value }))}>
                                        {form.web_categories.length > 0 ? (
                                            <>
                                                <optgroup label="Mis Categorías Web">
                                                    {form.web_categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </optgroup>
                                                <optgroup label="Etiquetas Estándar">
                                                    {CATEGORY_TAGS.map(t => <option key={t}>{t}</option>)}
                                                </optgroup>
                                            </>
                                        ) : (
                                            CATEGORY_TAGS.map(t => <option key={t}>{t}</option>)
                                        )}
                                    </select>
                                </div>
                                <div className="sc-form-group">
                                    <label className="sc-label">Etiqueta especial (ej: "20% OFF")</label>
                                    <input type="text" className="sc-input" value={postForm.badge} onChange={e => setPostForm(p => ({ ...p, badge: e.target.value }))} />
                                </div>
                            </div>

                            <div className="sc-toggles-row">
                                <label className="sc-toggle-label-inline">
                                    <input type="checkbox" checked={postForm.is_featured} onChange={e => setPostForm(p => ({ ...p, is_featured: e.target.checked }))} />
                                    <Star size={14} /> Destacado
                                </label>
                                <label className="sc-toggle-label-inline">
                                    <input type="checkbox" checked={postForm.active} onChange={e => setPostForm(p => ({ ...p, active: e.target.checked }))} />
                                    <Eye size={14} /> Publicado
                                </label>
                            </div>
                        </div>
                        <div className="sc-modal-footer">
                            <button className="sc-btn-ghost" onClick={() => setIsPostModalOpen(false)}>Cancelar</button>
                            <button className="sc-btn-primary" onClick={handleSavePost} disabled={!postForm.title?.trim()}>
                                <Save size={15} />{editingPost ? 'Guardar cambios' : 'Crear publicación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ERP Modals ───────────────────────────── */}
            {isProductModalOpen && (
                <ProductModal
                    isOpen={isProductModalOpen}
                    onClose={() => { loadProducts(); setIsProductModalOpen(false); }}
                />
            )}
            {isPackageModalOpen && (
                <PackageBuilderModal
                    isOpen={isPackageModalOpen}
                    onClose={() => { loadPackages(); setIsPackageModalOpen(false); }}
                />
            )}
        </div>
    );
};
