import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { useModal } from '../../hooks/useModal';
import { useNavigate } from 'react-router-dom';
import { AlertModal, ConfirmModal } from '../../components/ui/Modals';
import { Check, CreditCard, Shield, Save, ArrowLeft, Percent } from 'lucide-react';
import './SettingsMobile.css';

export const SettingsMobile = () => {
    const navigate = useNavigate();
    const shopInfo = useStore(state => state.shopInfo);
    const updateShopInfo = useStore(state => state.updateShopInfo);
    const { user, logout } = useAuth();

    const [theme, setTheme] = useState(localStorage.getItem('Mi Jardín-theme') || 'violet');
    const { alertModal, confirmModal, showAlert, showConfirm } = useModal();

    const [showStorefrontConfig, setShowStorefrontConfig] = useState(false);
    
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
    const [mpAccessToken, setMpAccessToken] = useState(storefront.mp_access_token || storefront.mercadopago_access_token || '');
    const [logoUrl, setLogoUrl] = useState(shopInfo.logo || '');
    const [priceMarkup, setPriceMarkup] = useState<number>(storefront.price_markup || 0);
    
    const [showMpToken, setShowMpToken] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

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
            setMpAccessToken(sf.mp_access_token || sf.mercadopago_access_token || '');
            setLogoUrl(shopInfo.logo || '');
            setPriceMarkup(sf.price_markup || 0);
        }
    }, [shopInfo]);

    const themes = [
        { id: 'violet', color: '#4F7A5A', name: 'Mi Jardín Violet' },
        { id: 'nature', color: '#059669', name: 'Naturaleza' },
        { id: 'sky', color: '#0ea5e9', name: 'Cielo' },
        { id: 'roses', color: '#f43f5e', name: 'Rosas' }
    ];

    const handleThemeChange = (id: string) => {
        setTheme(id);
        const themeObj = themes.find(t => t.id === id);
        if (themeObj) {
            document.documentElement.style.setProperty('--color-primary', themeObj.color);
            localStorage.setItem('Mi Jardín-theme', id);
            showAlert({ title: 'Tema actualizado', message: `Se aplicó el estilo ${themeObj.name}`, variant: 'success' });
        }
    };

    const handleLogout = async () => {
        const confirmed = await showConfirm({
            title: '¿Cerrar sesión?',
            message: 'Tendrás que ingresar tus credenciales nuevamente.',
            confirmText: 'Cerrar sesión',
            variant: 'warning'
        });
        if (confirmed) logout();
    };

    return (
        <div className="settings-mobile-wrapper">
            <header className="mobile-settings-header">
                <h2>Configuración</h2>
                <div className="user-mini-card">
                    <div className="u-avatar">{user?.name?.charAt(0) || 'U'}</div>
                    <div className="u-info">
                        <span className="u-name">{user?.name}</span>
                        <span className="u-role">{user?.role}</span>
                    </div>
                </div>
            </header>

            <div className="settings-scroll-content">
                {/* Section: Apariencia */}
                <section className="settings-section">
                    <h3 className="section-title">Apariencia</h3>
                    <div className="theme-selector-grid">
                        {themes.map(t => (
                            <button
                                key={t.id}
                                className={`theme-circle ${theme === t.id ? 'active' : ''}`}
                                style={{ backgroundColor: t.color }}
                                onClick={() => handleThemeChange(t.id)}
                            >
                                {theme === t.id && <span className="material-symbols-rounded">check</span>}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Section: Empresa */}
                <section className="settings-section">
                    <h3 className="section-title">Mi Negocio</h3>
                    <div className="settings-menu-list">
                        <div className="menu-item-row" onClick={() => navigate('/configuracion')}>
                            <span className="material-symbols-rounded m-icon">storefront</span>
                            <div className="m-text">
                                <span className="m-title">Información General</span>
                                <span className="m-sub">{shopInfo.name}</span>
                            </div>
                            <span className="material-symbols-rounded m-arrow">chevron_right</span>
                        </div>
                        <div className="menu-item-row" onClick={() => navigate('/configuracion')}>
                            <span className="material-symbols-rounded m-icon">map</span>
                            <div className="m-text">
                                <span className="m-title">Dirección y Contacto</span>
                                <span className="m-sub">{shopInfo.address}</span>
                            </div>
                            <span className="material-symbols-rounded m-arrow">chevron_right</span>
                        </div>
                        <div className="menu-item-row" onClick={() => setShowStorefrontConfig(true)}>
                            <span className="material-symbols-rounded m-icon">language</span>
                            <div className="m-text">
                                <span className="m-title">Mi Tienda Online</span>
                                <span className="m-sub">{storefrontActive ? 'Habilitada' : 'Pausada'}</span>
                            </div>
                            <span className="material-symbols-rounded m-arrow">chevron_right</span>
                        </div>
                    </div>
                </section>

                {/* Section: Sistema */}
                <section className="settings-section">
                    <h3 className="section-title">Sistema</h3>
                    <div className="settings-menu-list">
                        <div className="menu-item-row" onClick={() => {
                            // TODO: Navigate to subscription when mobile view exists
                            console.log('Navigate to subscription');
                        }}>
                            <span className="material-symbols-rounded m-icon">credit_card</span>
                            <div className="m-text">
                                <span className="m-title">Suscripción y Plan</span>
                                <span className="m-sub">Ver límites y cambiar plan</span>
                            </div>
                            <span className="material-symbols-rounded m-arrow">chevron_right</span>
                        </div>
                        <div className="menu-item-row" onClick={() => {
                            // TODO: Implement data export
                            console.log('Export data');
                        }}>
                            <span className="material-symbols-rounded m-icon">cloud_download</span>
                            <div className="m-text">
                                <span className="m-title">Exportar Datos</span>
                                <span className="m-sub">Descargar copia de seguridad</span>
                            </div>
                            <span className="material-symbols-rounded m-arrow">download</span>
                        </div>
                        <div className="menu-item-row" style={{ cursor: 'pointer' }} onClick={() => {
                            const active = localStorage.getItem('feature_explorer_enabled') === 'true';
                            if (active) {
                                  localStorage.removeItem('feature_explorer_enabled');
                            } else {
                                  localStorage.setItem('feature_explorer_enabled', 'true');
                            }
                            window.location.reload();
                        }}>
                            <span className="material-symbols-rounded m-icon">layers</span>
                            <div className="m-text" style={{ flex: 1 }}>
                                <span className="m-title">Explorador de Negocios (BETA)</span>
                                <span className="m-sub">Ver listados como carpetas y planillas</span>
                            </div>
                            <div className="toggle-switch-wrapper" style={{ marginRight: '5px' }}>
                                <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', pointerEvents: 'none' }}>
                                    <span style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundColor: localStorage.getItem('feature_explorer_enabled') === 'true' ? '#10b981' : '#cbd5e1',
                                        transition: '.2s',
                                        borderRadius: '20px'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            height: '14px', width: '14px',
                                            left: localStorage.getItem('feature_explorer_enabled') === 'true' ? '21px' : '3px',
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
                </section>

                {/* Danger Zone */}
                <section className="settings-section">
                    <button className="logout-full-btn" onClick={handleLogout}>
                        <span className="material-symbols-rounded">logout</span>
                        Cerrar Sesión
                    </button>
                    <p className="app-version">Florería Mi Jardín ERP v2.5.0</p>
                </section>
            </div>

            {/* Mobile Storefront Config Full-Screen Overlay */}
            {showStorefrontConfig && (
                <div className="mobile-storefront-overlay" style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: '#ffffff',
                    zIndex: 2000,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <header className="mobile-settings-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid #cbd5e1', flexShrink: 0 }}>
                        <button 
                            onClick={() => setShowStorefrontConfig(false)} 
                            style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            type="button"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Configurar Tienda Online</h2>
                    </header>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                        <div style={{
                            background: 'var(--explorer-bg-light, #f8fafc)',
                            border: '1px solid var(--explorer-border, #e2e8f0)',
                            borderRadius: '12px',
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Link de tu catálogo público:</p>
                                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-primary-dark, #2b4931)', wordBreak: 'break-all' }}>
                                    {window.location.protocol}//{window.location.host}/{storefrontSlug || 'tu-tienda'}
                                </p>
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
                                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
                                >
                                    <Check size={16} className={copySuccess ? 'text-success' : 'hidden'} style={{ display: copySuccess ? 'block' : 'none' }} />
                                    <span>{copySuccess ? 'Copiado' : 'Copiar Link'}</span>
                                </button>
                                <a 
                                    href={`/${storefrontSlug}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`btn btn-primary ${!storefrontActive ? 'btn-disabled' : ''}`}
                                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', pointerEvents: storefrontActive ? 'auto' : 'none', opacity: storefrontActive ? 1 : 0.6 }}
                                >
                                    Ver Catálogo
                                </a>
                            </div>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
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
                                            price_markup: Number(priceMarkup) || 0,
                                            mp_enabled: mpEnabled,
                                            mercadopago_public_key: mpPublicKey,
                                            mercadopago_access_token: mpAccessToken,
                                            payment_methods: mpEnabled ? ['whatsapp', 'mercadopago'] : ['whatsapp']
                                        }
                                    }
                            });
                            setIsSaved(true);
                            setTimeout(() => setIsSaved(false), 3000);
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Slug Comercial (URL)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={storefrontSlug}
                                        onChange={e => setStorefrontSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                        placeholder="nombre-de-tu-local"
                                        required
                                        style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Logo del Negocio (URL Imagen)</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={logoUrl}
                                            onChange={e => setLogoUrl(e.target.value)}
                                            placeholder="https://ejemplo.com/tu-logo.png"
                                            style={{ flex: 1, padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                        />
                                        {logoUrl && (
                                            <img 
                                                src={logoUrl} 
                                                alt="Logo preview" 
                                                style={{ 
                                                    width: '38px', 
                                                    height: '38px', 
                                                    borderRadius: '50%', 
                                                    objectFit: 'cover', 
                                                    border: '1px solid #cbd5e1'
                                                }} 
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Habilitar Catálogo Público</label>
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
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>WhatsApp de Pedidos</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={whatsappNumber}
                                        onChange={e => setWhatsappNumber(e.target.value)}
                                        placeholder="Ej: +5491112345678"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Color de Marca</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={themeColor}
                                            onChange={e => setThemeColor(e.target.value)}
                                            style={{ border: 'none', width: '36px', height: '36px', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                                        />
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={themeColor}
                                            onChange={e => setThemeColor(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Recargo de Precios en la Web (%)</label>
                                    <div style={{ position: 'relative' }}>
                                        <Percent size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={priceMarkup}
                                            onChange={e => setPriceMarkup(Math.max(0, Number(e.target.value)))}
                                            placeholder="Ej: 10 para aumentar 10% los precios"
                                            min="0"
                                            step="0.01"
                                            style={{ width: '100%', padding: '0.65rem 0.65rem 0.65rem 2.2rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Título de Portada</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={bannerTitle}
                                        onChange={e => setBannerTitle(e.target.value)}
                                        placeholder="Ej: Florería Aster"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Subtítulo de Portada</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={bannerSubtitle}
                                        onChange={e => setBannerSubtitle(e.target.value)}
                                        placeholder="Ej: Flores frescas y hermosas"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                {/* MercadoPago sub-panel */}
                                <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CreditCard size={20} className="text-primary" />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cobros con MercadoPago</span>
                                        </div>
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
                                    </div>

                                    {mpEnabled && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
                                            <div>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Public Key</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={mpPublicKey}
                                                    onChange={e => setMpPublicKey(e.target.value)}
                                                    placeholder="APP_USR-..."
                                                    required={mpEnabled}
                                                    style={{ width: '100%', fontSize: '0.85rem' }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Access Token</label>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        type={showMpToken ? 'text' : 'password'}
                                                        className="form-input"
                                                        value={mpAccessToken}
                                                        onChange={e => setMpAccessToken(e.target.value)}
                                                        placeholder="APP_USR-..."
                                                        required={mpEnabled}
                                                        style={{ flex: 1, fontSize: '0.85rem' }}
                                                    />
                                                    <button 
                                                        className="btn btn-secondary"
                                                        onClick={() => setShowMpToken(!showMpToken)}
                                                        type="button"
                                                        style={{ padding: '0 0.5rem', fontSize: '0.8rem' }}
                                                    >
                                                        {showMpToken ? 'Ocultar' : 'Mostrar'}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                                <Shield size={14} style={{ flexShrink: 0 }} />
                                                <span>Guardado seguro con encriptación.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    type="submit" 
                                    className={`btn btn-primary ${isSaved ? 'btn-saved' : ''}`}
                                    style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Save size={18} />
                                    <span>{isSaved ? '¡Configuración Guardada!' : 'Guardar Configuración'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};
