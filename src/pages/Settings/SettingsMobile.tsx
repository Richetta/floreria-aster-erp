import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { useModal } from '../../hooks/useModal';
import { useNavigate } from 'react-router-dom';
import { AlertModal, ConfirmModal } from '../../components/ui/Modals';
import './SettingsMobile.css';

export const SettingsMobile = () => {
    const navigate = useNavigate();
    const shopInfo = useStore(state => state.shopInfo);
    const { user, logout } = useAuth();

    const [theme, setTheme] = useState(localStorage.getItem('Mi Jard�n-theme') || 'violet');
    const { alertModal, confirmModal, showAlert, showConfirm } = useModal();

    const themes = [
        { id: 'violet', color: '#4F7A5A', name: 'Mi Jard�n Violet' },
        { id: 'nature', color: '#059669', name: 'Naturaleza' },
        { id: 'sky', color: '#0ea5e9', name: 'Cielo' },
        { id: 'roses', color: '#f43f5e', name: 'Rosas' }
    ];

    const handleThemeChange = (id: string) => {
        setTheme(id);
        const themeObj = themes.find(t => t.id === id);
        if (themeObj) {
            document.documentElement.style.setProperty('--color-primary', themeObj.color);
            localStorage.setItem('Mi Jard�n-theme', id);
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
                    <p className="app-version">Florería Mi Jard�n ERP v2.5.0</p>
                </section>
            </div>

            {alertModal && <AlertModal {...alertModal} />}
            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};
