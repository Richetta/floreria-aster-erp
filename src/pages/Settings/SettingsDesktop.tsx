import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    Save, Download, Users, LogOut, 
    MapPin, CreditCard,
    Check, Shield, Wallet, HardDrive,
    Smartphone, Store, Instagram, Database, Upload, Palette, Cloud,
    BarChart3, Zap, MessageSquare, UserCheck, Mail, CheckCircle, Circle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { type PaymentMethod } from '../../store/slices/types';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import { SubscriptionTab } from './SubscriptionTab';
import './Settings.css';

export const SettingsDesktop = () => {
    const shopInfo = useStore(state => state.shopInfo);
    const updateShopInfo = useStore(state => state.updateShopInfo);
    const { logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [formData, setFormData] = useState(shopInfo);
    const [isSaved, setIsSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'data' | 'users' | 'subscription' | 'storefront'>('general');
    const [theme, setTheme] = useState('violet');

    // Storefront dynamic settings state
    const storefront = shopInfo.settings?.storefront || {};
    const [storefrontSlug, setStorefrontSlug] = useState(shopInfo.slug || '');
    const [storefrontActive, setStorefrontActive] = useState(storefront.active ?? true);
    const [bannerTitle, setBannerTitle] = useState(storefront.banner_title || shopInfo.name || '');
    const [bannerSubtitle, setBannerSubtitle] = useState(storefront.banner_subtitle || 'Bienvenidos a nuestra tienda online');
    const [whatsappNumber, setWhatsappNumber] = useState(storefront.whatsapp_number || shopInfo.phone || '');
    const [themeColor, setThemeColor] = useState(storefront.theme_color || '#1e3f20');
    const [mpEnabled, setMpEnabled] = useState(storefront.mp_enabled ?? false);
    const [mpPublicKey, setMpPublicKey] = useState(storefront.mercadopago_public_key || '');
    const [mpAccessToken, setMpAccessToken] = useState(storefront.mercadopago_access_token || '');
    const [logoUrl, setLogoUrl] = useState(shopInfo.logo || '');
    
    const [showMpToken, setShowMpToken] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        if (shopInfo) {
            const sf = shopInfo.settings?.storefront || {};
            setStorefrontSlug(shopInfo.slug || '');
            setStorefrontActive(sf.active ?? true);
            setBannerTitle(sf.banner_title || shopInfo.name || '');
            setBannerSubtitle(sf.banner_subtitle || 'Bienvenidos a nuestra tienda online');
            setWhatsappNumber(sf.whatsapp_number || shopInfo.phone || '');
            setThemeColor(sf.theme_color || '#1e3f20');
            setMpEnabled(sf.mp_enabled ?? false);
            setMpPublicKey(sf.mercadopago_public_key || '');
            setMpAccessToken(sf.mercadopago_access_token || '');
            setLogoUrl(shopInfo.logo || '');
        }
    }, [shopInfo]);

    const { alertModal, confirmModal, showAlert, showConfirm } = useModal();

    const themes = {
        violet: { primary: '#4F7A5A', name: 'Mi Jardín Violet', gradient: 'linear-gradient(135deg, #4F7A5A 0%, #5A9B6A 100%)' },
        nature: { primary: '#059669', name: 'Naturaleza', gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)' },
        sky: { primary: '#0ea5e9', name: 'Cielo', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38BDF8 100%)' },
        roses: { primary: '#f43f5e', name: 'Rosas', gradient: 'linear-gradient(135deg, #f43f5e 0%, #FB7185 100%)' }
    };

    const handleThemeChange = (newTheme: string) => {
        setTheme(newTheme);
        const root = document.documentElement;
        const color = themes[newTheme as keyof typeof themes].primary;
        root.style.setProperty('--color-primary', color);
        root.style.setProperty('--color-primary-dark', color);
        localStorage.setItem('Mi Jardín-theme', newTheme);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab') as any;
        if (tab && ['general', 'payments', 'data', 'users', 'subscription', 'storefront'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [location]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('Mi Jardín-theme');
        if (savedTheme) handleThemeChange(savedTheme);
    }, []);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        updateShopInfo(formData);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const handleExport = () => {
        const state = useStore.getState();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            customers: state.customers,
            products: state.products,
            orders: state.orders,
            shopInfo: state.shopInfo
        }));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Mi_Jardin_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (!data.products && !data.customers) throw new Error('Formato inválido');

                const confirmed = await showConfirm({
                    title: '¿Importar datos?',
                    message: 'Esto podría duplicar registros si ya existen.',
                    confirmText: 'Importar',
                    variant: 'warning'
                });

                if (confirmed) {
                    showAlert({
                        title: 'Éxito',
                        message: '¡Datos importados correctamente!',
                        variant: 'success'
                    });
                }
            } catch (error) {
                showAlert({
                    title: 'Error',
                    message: 'Error al leer el archivo. Asegurate que sea un JSON válido.',
                    variant: 'error'
                });
            }
        };
        reader.readAsText(file);
    };

    const handleLogout = async () => {
        const confirmed = await showConfirm({
            title: '¿Cerrar sesión?',
            message: 'Se cerrará tu sesión actual.',
            confirmText: 'Cerrar sesión',
            variant: 'warning'
        });
        if (confirmed) {
            logout();
        }
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <div className="settings-header-content">
                    <div className="settings-header-icon">
                        <Store size={32} />
                    </div>
                    <div className="settings-header-text">
                        <h1>Configuración del Sistema</h1>
                        <p>Personalizá tu tienda y gestioná tus datos</p>
                    </div>
                </div>
                <button className="settings-logout-btn" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>

            <div className="settings-tabs">
                <button
                    className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    <Store size={18} />
                    <span>General</span>
                </button>
                <button
                    className={`settings-tab ${activeTab === 'payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payments')}
                >
                    <Wallet size={18} />
                    <span>Métodos de Pago</span>
                </button>
                <button
                    className={`settings-tab ${activeTab === 'data' ? 'active' : ''}`}
                    onClick={() => setActiveTab('data')}
                >
                    <Database size={18} />
                    <span>Datos</span>
                </button>
                <button
                    className={`settings-tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} />
                    <span>Usuarios</span>
                </button>
                <button
                    className={`settings-tab ${activeTab === 'subscription' ? 'active' : ''}`}
                    onClick={() => setActiveTab('subscription')}
                >
                    <CreditCard size={18} />
                    <span>Suscripción</span>
                </button>
                <button
                    className={`settings-tab ${activeTab === 'storefront' ? 'active' : ''}`}
                    onClick={() => setActiveTab('storefront')}
                >
                    <Store size={18} />
                    <span>Mi Tienda Online</span>
                </button>
            </div>

            <div className="settings-content">
                {activeTab === 'general' && (
                    <div className="settings-tab-content">
                        <div className="settings-card settings-card-wide">
                            <div className="card-header">
                                <div className="card-header-icon card-header-icon-primary">
                                    <Store size={24} />
                                </div>
                                <div className="card-header-text">
                                    <h2>Identidad de la Florería</h2>
                                    <p>Información pública de tu negocio</p>
                                </div>
                            </div>

                            <form onSubmit={handleSave} className="settings-form">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Nombre del Negocio</label>
                                        <div className="input-with-icon">
                                            <Store size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Instagram / Redes</label>
                                        <div className="input-with-icon">
                                            <Instagram size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.instagram}
                                                onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                                                placeholder="@mi.jardin"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">WhatsApp de Atención</label>
                                        <div className="input-with-icon">
                                            <Smartphone size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="11-1234-5678"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Dirección / Local</label>
                                        <div className="input-with-icon">
                                            <MapPin size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="Calle 123, Ciudad"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="submit" className={`btn btn-primary ${isSaved ? 'btn-saved' : ''}`}>
                                        <Save size={18} />
                                        {isSaved ? '¡Guardado!' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="settings-grid-2">
                            <div className="settings-card">
                                <div className="card-header">
                                    <div className="card-header-icon card-header-icon-success">
                                        <Shield size={24} />
                                    </div>
                                    <div className="card-header-text">
                                        <h2>Seguridad y Datos</h2>
                                        <p>Backup y exportación</p>
                                    </div>
                                </div>

                                <div className="security-actions">
                                    <div className="security-info">
                                        <Cloud size={16} className="security-icon" />
                                        <div>
                                            <p className="security-title">Backup Local Activo</p>
                                            <p className="security-desc">Tus datos se guardan automáticamente</p>
                                        </div>
                                    </div>

                                    <div className="security-buttons">
                                        <button className="btn btn-secondary btn-block" onClick={handleExport}>
                                            <Download size={16} />
                                            <span>Exportar JSON</span>
                                        </button>
                                        <label className="btn btn-secondary btn-block">
                                            <Upload size={16} />
                                            <span>Importar JSON</span>
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleImport}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card">
                                <div className="card-header">
                                    <div className="card-header-icon card-header-icon-purple">
                                        <Palette size={24} />
                                    </div>
                                    <div className="card-header-text">
                                        <h2>Personalización UI</h2>
                                        <p>Elegí tu tema favorito</p>
                                    </div>
                                </div>

                                <div className="theme-options">
                                    {Object.entries(themes).map(([key, value]) => (
                                        <button
                                            key={key}
                                            className={`theme-option ${theme === key ? 'active' : ''}`}
                                            style={{ background: value.gradient }}
                                            onClick={() => handleThemeChange(key)}
                                        >
                                            <div className="theme-option-check">
                                                {theme === key && <Check size={20} strokeWidth={3} />}
                                            </div>
                                            <span>{value.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--explorer-border, #e2e8f0)', paddingTop: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Explorador de Negocios (BETA)</h3>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Navegación visual simplificada mediante carpetas y planillas.</p>
                                        </div>
                                        <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={localStorage.getItem('feature_explorer_enabled') === 'true'}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        localStorage.setItem('feature_explorer_enabled', 'true');
                                                    } else {
                                                        localStorage.removeItem('feature_explorer_enabled');
                                                    }
                                                    window.location.reload();
                                                }}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute',
                                                cursor: 'pointer',
                                                top: 0, left: 0, right: 0, bottom: 0,
                                                backgroundColor: localStorage.getItem('feature_explorer_enabled') === 'true' ? '#10b981' : '#cbd5e1',
                                                transition: '.2s',
                                                borderRadius: '24px'
                                            }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    content: '""',
                                                    height: '18px', width: '18px',
                                                    left: localStorage.getItem('feature_explorer_enabled') === 'true' ? '22px' : '3px',
                                                    bottom: '3px',
                                                    backgroundColor: 'white',
                                                    transition: '.2s',
                                                    borderRadius: '50%'
                                                }} />
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="settings-tab-content animate-fade-in">
                        <PaymentMethodsManager />
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="settings-tab-content">
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon stat-icon-primary">
                                    <HardDrive size={24} />
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{shopInfo?.name || '-'}</span>
                                    <span className="stat-label">Negocio</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon stat-icon-success">
                                    <BarChart3 size={24} />
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{useStore.getState().products?.length || 0}</span>
                                    <span className="stat-label">Productos</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon stat-icon-warning">
                                    <Users size={24} />
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{useStore.getState().customers?.length || 0}</span>
                                    <span className="stat-label">Clientes</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon stat-icon-purple">
                                    <Zap size={24} />
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{useStore.getState().orders?.length || 0}</span>
                                    <span className="stat-label">Pedidos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="users-managed-card">
                        <div className="managed-card-content">
                            <Users size={48} className="text-primary mb-4" />
                            <h2>Nueva Gestión de Equipo</h2>
                            <p>Ahora podés invitar empleados, asignar roles detallados y coordinar a tu equipo de forma más profesional.</p>
                            <div className="managed-actions mt-6">
                                <button 
                                    className="btn btn-primary btn-lg"
                                    onClick={() => navigate('/usuarios')}
                                >
                                    <UserCheck size={20} />
                                    Ir a Gestión de Equipo
                                </button>
                            </div>
                        </div>
                        <div className="managed-card-features">
                            <div className="feature-item">
                                <Shield size={20} className="text-success" />
                                <span>Roles de Dueño, Admin, Empleado, Repartidor y más.</span>
                            </div>
                            <div className="feature-item">
                                <Mail size={20} className="text-primary" />
                                <span>Invitaciones por email con enlaces de registro únicos.</span>
                            </div>
                            <div className="feature-item">
                                <MessageSquare size={20} className="text-purple-500" />
                                <span>Chat interno y coordinación en pedidos y clientes.</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'subscription' && (
                    <SubscriptionTab />
                )}

                {activeTab === 'storefront' && (
                    <div className="settings-tab-content">
                        <div className="settings-card settings-card-wide">
                            <div className="card-header">
                                <div className="card-header-icon card-header-icon-primary">
                                    <Smartphone size={24} />
                                </div>
                                <div className="card-header-text">
                                    <h2>Mi tienda online</h2>
                                    <p>Configurá tu catálogo digital público para vender por WhatsApp y MercadoPago</p>
                                </div>
                            </div>

                            <div className="storefront-link-preview-box" style={{
                                background: 'var(--explorer-bg-light, #f8fafc)',
                                border: '1px solid var(--explorer-border, #e2e8f0)',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                marginBottom: '2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        background: 'var(--color-primary-light, #eaf2eb)',
                                        color: 'var(--color-primary, #4F7A5A)',
                                        padding: '0.5rem',
                                        borderRadius: '8px'
                                    }}>
                                        <Store size={24} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Tu link público para compartir:</p>
                                        <p style={{ margin: '0.1rem 0 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary-dark, #2b4931)' }}>
                                            {window.location.protocol}//{window.location.host}/{storefrontSlug || 'tu-tienda'}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={() => {
                                            const link = `${window.location.protocol}//${window.location.host}/${storefrontSlug || 'tu-tienda'}`;
                                            navigator.clipboard.writeText(link);
                                            setCopySuccess(true);
                                            setTimeout(() => setCopySuccess(false), 2000);
                                        }}
                                        type="button"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                        <Check size={16} className={copySuccess ? 'text-success' : 'hidden'} style={{ display: copySuccess ? 'block' : 'none' }} />
                                        <span>{copySuccess ? 'Copiado' : 'Copiar Link'}</span>
                                    </button>
                                    <a 
                                        href={`/${storefrontSlug}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className={`btn btn-primary ${!storefrontActive ? 'btn-disabled' : ''}`}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', pointerEvents: storefrontActive ? 'auto' : 'none', opacity: storefrontActive ? 1 : 0.6 }}
                                    >
                                        Ver Catálogo
                                    </a>
                                </div>
                            </div>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                // Clean up the slug to ensure it only has lowercase letters, numbers, and hyphens
                                const cleanSlug = storefrontSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                                updateShopInfo({
                                    ...shopInfo,
                                    slug: cleanSlug,
                                    logo: logoUrl || undefined,
                                    settings: {
                                        ...shopInfo.settings,
                                        storefront: {
                                            active: storefrontActive,
                                            banner_title: bannerTitle,
                                            banner_subtitle: bannerSubtitle,
                                            whatsapp_number: whatsappNumber,
                                            theme_color: themeColor,
                                            mp_enabled: mpEnabled,
                                            mercadopago_public_key: mpPublicKey,
                                            mercadopago_access_token: mpAccessToken,
                                            payment_methods: mpEnabled ? ['whatsapp', 'mercadopago'] : ['whatsapp']
                                        }
                                    }
                                });
                                setIsSaved(true);
                                setTimeout(() => setIsSaved(false), 3000);
                            }} className="settings-form">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Dirección Web (Slug / floreriaaster)</label>
                                        <div className="input-with-icon">
                                            <Store size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={storefrontSlug}
                                                onChange={e => {
                                                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                                                    setStorefrontSlug(val);
                                                }}
                                                placeholder="nombre-de-tu-local"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Logo del Negocio (URL Imagen)</label>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            <div className="input-with-icon" style={{ flex: 1 }}>
                                                <Upload size={18} className="input-icon" />
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={logoUrl}
                                                    onChange={e => setLogoUrl(e.target.value)}
                                                    placeholder="https://ejemplo.com/tu-logo.png"
                                                />
                                            </div>
                                            {logoUrl && (
                                                <div style={{ flexShrink: 0 }}>
                                                    <img 
                                                        src={logoUrl} 
                                                        alt="Logo preview" 
                                                        style={{ 
                                                            width: '38px', 
                                                            height: '38px', 
                                                            borderRadius: '50%', 
                                                            objectFit: 'cover', 
                                                            border: '2px solid var(--color-primary-light, #eaf2eb)',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                        }} 
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <label className="form-label" style={{ marginBottom: '0.5rem' }}>Estado del Catálogo</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={storefrontActive}
                                                    onChange={e => setStorefrontActive(e.target.checked)}
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                />
                                                <span style={{
                                                    position: 'absolute',
                                                    cursor: 'pointer',
                                                    top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: storefrontActive ? '#10b981' : '#cbd5e1',
                                                    transition: '.2s',
                                                    borderRadius: '24px'
                                                }}>
                                                    <span style={{
                                                        position: 'absolute',
                                                        content: '""',
                                                        height: '18px', width: '18px',
                                                        left: storefrontActive ? '22px' : '3px',
                                                        bottom: '3px',
                                                        backgroundColor: 'white',
                                                        transition: '.2s',
                                                        borderRadius: '50%'
                                                    }} />
                                                </span>
                                            </label>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: storefrontActive ? '#10b981' : '#64748b' }}>
                                                {storefrontActive ? 'Tienda Pública Activa' : 'Mantenimiento / Pausada'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">WhatsApp de Pedidos</label>
                                        <div className="input-with-icon">
                                            <Smartphone size={18} className="input-icon" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={whatsappNumber}
                                                onChange={e => setWhatsappNumber(e.target.value)}
                                                placeholder="Ej: +5491112345678"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Color de Marca (Branding)</label>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            <input
                                                type="color"
                                                value={themeColor}
                                                onChange={e => setThemeColor(e.target.value)}
                                                style={{
                                                    border: 'none',
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    padding: 0
                                                }}
                                            />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={themeColor}
                                                onChange={e => setThemeColor(e.target.value)}
                                                style={{ maxWidth: '120px' }}
                                            />
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                backgroundColor: themeColor,
                                                border: '1px solid #cbd5e1'
                                            }} />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Título del Banner</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={bannerTitle}
                                            onChange={e => setBannerTitle(e.target.value)}
                                            placeholder="Ej: Bienvenidos a Florería Aster"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Subtítulo del Banner</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={bannerSubtitle}
                                            onChange={e => setBannerSubtitle(e.target.value)}
                                            placeholder="Ej: Flores frescas y regalos únicos"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="settings-card" style={{ marginTop: '2rem', border: '1px solid #cbd5e1', boxShadow: 'none' }}>
                                    <div className="card-header" style={{ padding: '0 0 1.25rem 0', borderBottom: '1px solid var(--explorer-border, #e2e8f0)' }}>
                                        <div className="card-header-icon card-header-icon-success" style={{ background: '#eafaf1', color: '#10b981' }}>
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="card-header-text">
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Cobros con MercadoPago</h3>
                                            <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Cobrá online con tarjeta y saldo en MercadoPago de forma descentralizada</p>
                                        </div>
                                    </div>

                                    <div style={{ padding: '1.25rem 0 0 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                            <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={mpEnabled}
                                                    onChange={e => setMpEnabled(e.target.checked)}
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                />
                                                <span style={{
                                                    position: 'absolute',
                                                    cursor: 'pointer',
                                                    top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: mpEnabled ? '#10b981' : '#cbd5e1',
                                                    transition: '.2s',
                                                    borderRadius: '24px'
                                                }}>
                                                    <span style={{
                                                        position: 'absolute',
                                                        content: '""',
                                                        height: '18px', width: '18px',
                                                        left: mpEnabled ? '22px' : '3px',
                                                        bottom: '3px',
                                                        backgroundColor: 'white',
                                                        transition: '.2s',
                                                        borderRadius: '50%'
                                                    }} />
                                                </span>
                                            </label>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: mpEnabled ? '#10b981' : '#64748b' }}>
                                                {mpEnabled ? 'Pasarela MercadoPago Habilitada' : 'Pasarela Desactivada (Solo WhatsApp)'}
                                            </span>
                                        </div>

                                        {mpEnabled && (
                                            <div className="form-grid animate-fade-in" style={{ gap: '1.25rem' }}>
                                                <div className="form-group">
                                                    <label className="form-label">MercadoPago Public Key</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={mpPublicKey}
                                                        onChange={e => setMpPublicKey(e.target.value)}
                                                        placeholder="Ej: APP_USR-..."
                                                        required={mpEnabled}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label className="form-label">MercadoPago Access Token</label>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <input
                                                            type={showMpToken ? 'text' : 'password'}
                                                            className="form-input"
                                                            value={mpAccessToken}
                                                            onChange={e => setMpAccessToken(e.target.value)}
                                                            placeholder="Ej: APP_USR-..."
                                                            required={mpEnabled}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <button 
                                                            className="btn btn-secondary"
                                                            onClick={() => setShowMpToken(!showMpToken)}
                                                            type="button"
                                                            style={{ padding: '0 0.75rem' }}
                                                        >
                                                            {showMpToken ? 'Ocultar' : 'Mostrar'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div style={{
                                                    background: '#fffbeb',
                                                    border: '1px solid #fef3c7',
                                                    color: '#b45309',
                                                    padding: '0.75rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    gridColumn: '1 / -1'
                                                }}>
                                                    <Shield size={16} style={{ flexShrink: 0 }} />
                                                    <span>
                                                        Las credenciales se almacenan en forma encriptada en la base de datos de tu local. Nunca compartas tu token con nadie.
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-actions" style={{ marginTop: '2rem' }}>
                                    <button type="submit" className={`btn btn-primary ${isSaved ? 'btn-saved' : ''}`}>
                                        <Save size={18} />
                                        {isSaved ? '¡Guardado!' : 'Guardar Configuración de Tienda'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'subscription' && (
                    <SubscriptionTab />
                )}
            </div>

            {alertModal && <AlertModal {...alertModal} />}
            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};

const PaymentMethodsManager = () => {
    const shopInfo = useStore(state => state.shopInfo);
    const updateShopInfo = useStore(state => state.updateShopInfo);
    const { showAlert } = useModal();
    const [methods, setMethods] = useState<PaymentMethod[]>(shopInfo.paymentMethods || []);

    const handleSaveMethods = () => {
        updateShopInfo({ ...shopInfo, paymentMethods: methods });
        showAlert({ title: 'Éxito', message: 'Métodos de pago actualizados', variant: 'success' });
    };

    const handleToggleMethod = (id: string) => {
        setMethods(methods.map(m => m.id === id ? { ...m, is_active: !m.is_active } : m));
    };

    const handleSurchargeChange = (id: string, surcharge: number) => {
        setMethods(methods.map(m => m.id === id ? { ...m, surcharge } : m));
    };

    return (
        <div className="settings-card settings-card-wide">
            <div className="card-header">
                <div className="card-header-icon card-header-icon-primary">
                    <Wallet size={24} />
                </div>
                <div className="card-header-text">
                    <h2>Métodos de Pago y Recargos</h2>
                    <p>Configurá cómo cobrás y los recargos automáticos</p>
                </div>
            </div>

            <div className="payment-methods-list">
                {methods.map(method => (
                    <div key={method.id} className={`payment-method-item ${!method.is_active ? 'disabled' : ''}`}>
                        <div className="method-info">
                            <div className="method-toggle" onClick={() => handleToggleMethod(method.id)}>
                                {method.is_active ? <CheckCircle className="text-primary" size={24} /> : <Circle className="text-gray-300" size={24} />}
                            </div>
                            <div className="method-name">
                                <h3>{method.name}</h3>
                                <p>{method.is_active ? 'Activo en el POS' : 'Desactivado'}</p>
                            </div>
                        </div>
                        <div className="method-settings">
                            <div className="surcharge-input">
                                <label>Recargo (%)</label>
                                <input
                                    type="number"
                                    value={method.surcharge || 0}
                                    onChange={e => handleSurchargeChange(method.id, parseFloat(e.target.value) || 0)}
                                    disabled={!method.is_active}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSaveMethods}>
                    <Save size={18} />
                    <span>Guardar Métodos</span>
                </button>
            </div>
        </div>
    );
};
