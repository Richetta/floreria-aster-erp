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
    const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'data' | 'users' | 'subscription'>('general');
    const [theme, setTheme] = useState('violet');

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
        if (tab && ['general', 'payments', 'data', 'users', 'subscription'].includes(tab)) {
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
