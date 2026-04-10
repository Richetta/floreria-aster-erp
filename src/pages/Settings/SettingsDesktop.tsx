import { useState, useEffect } from 'react';
import {
    Store, Smartphone, MapPin, Instagram, Database, Download, Upload,
    Shield, Palette, Save, Share2, LogOut, Users, Plus, Edit2, Trash2,
    Check, X, Eye, EyeOff, CreditCard, Key, Cloud, HardDrive,
    BarChart3, Zap
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { api, type User } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import { SubscriptionTab } from './SubscriptionTab';
import './Settings.css';

type UserFormData = {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'seller' | 'driver' | 'viewer';
};

export const SettingsDesktop = () => {
    const shopInfo = useStore(state => state.shopInfo);
    const updateShopInfo = useStore(state => state.updateShopInfo);
    const { user: currentUser, logout } = useAuth();

    const [formData, setFormData] = useState(shopInfo);
    const [isSaved, setIsSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'data' | 'users' | 'subscription'>('general');
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
        const savedTheme = localStorage.getItem('Mi Jardín-theme');
        if (savedTheme) handleThemeChange(savedTheme);
    }, []);

    // Users state
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [userForm, setUserForm] = useState<UserFormData>({
        name: '',
        email: '',
        password: '',
        role: 'viewer'
    });

    useEffect(() => {
        if (activeTab === 'users') {
            loadUsers();
        }
    }, [activeTab]);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const usersList = await api.getUsers();
            setUsers(usersList);
        } catch (error: any) {
            console.error('Error loading users:', error);
            showAlert({
                title: 'Error al cargar usuarios',
                message: 'Verificá tu conexión e intentá de nuevo',
                variant: 'error'
            });
        } finally {
            setIsLoadingUsers(false);
        }
    };

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

                if (await showConfirm({
                    title: '¿Importar datos?',
                    message: 'Esto podría duplicar registros si ya existen.',
                    confirmText: 'Importar',
                    variant: 'warning'
                })) {
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

    const handleOpenUserModal = (user?: User) => {
        if (user) {
            setUserToEdit(user);
            setUserForm({
                name: user.name,
                email: user.email,
                password: '',
                role: user.role
            });
        } else {
            setUserToEdit(null);
            setUserForm({ name: '', email: '', password: '', role: 'viewer' });
        }
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userForm.name || !userForm.email) {
            showAlert({
                title: 'Campos requeridos',
                message: 'Nombre y email son obligatorios',
                variant: 'warning'
            });
            return;
        }

        if (!userToEdit && !userForm.password) {
            showAlert({
                title: 'Contraseña requerida',
                message: 'La contraseña es obligatoria para nuevos usuarios',
                variant: 'warning'
            });
            return;
        }

        try {
            if (userToEdit) {
                await api.updateUser(userToEdit.id, {
                    name: userForm.name,
                    email: userForm.email,
                    role: userForm.role,
                    ...(userForm.password && { password: userForm.password })
                });
                showAlert({
                    title: 'Éxito',
                    message: 'Usuario actualizado exitosamente',
                    variant: 'success'
                });
            } else {
                await api.createUser({
                    name: userForm.name,
                    email: userForm.email,
                    password: userForm.password,
                    role: userForm.role
                });
                showAlert({
                    title: 'Éxito',
                    message: 'Usuario creado exitosamente',
                    variant: 'success'
                });
            }
            setIsUserModalOpen(false);
            loadUsers();
        } catch (error: any) {
            showAlert({
                title: 'Error',
                message: error.message || 'Error al guardar usuario',
                variant: 'error'
            });
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (user.id === currentUser?.id) {
            showAlert({
                title: 'Acción no permitida',
                message: 'No puedes eliminar tu propia cuenta',
                variant: 'warning'
            });
            return;
        }

        const confirmed = await showConfirm({
            title: '¿Eliminar usuario?',
            message: `Se eliminará "${user.name}" permanentmente.`,
            confirmText: 'Eliminar',
            variant: 'danger'
        });
        if (confirmed) {
            try {
                await api.deleteUser(user.id);
                showAlert({
                    title: 'Éxito',
                    message: 'Usuario eliminado exitosamente',
                    variant: 'success'
                });
                loadUsers();
            } catch (error: any) {
                showAlert({
                    title: 'Error',
                    message: error.message || 'Error al eliminar usuario',
                    variant: 'error'
                });
            }
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'badge-danger';
            case 'seller': return 'badge-primary';
            case 'driver': return 'badge-warning';
            default: return 'badge-secondary';
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return 'Administrador';
            case 'seller': return 'Vendedor';
            case 'driver': return 'Repartidor';
            default: return 'Visualizador';
        }
    };

    return (
        <div className="settings-page">
            {/* Header */}
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

            {/* Navigation Tabs */}
            <div className="settings-tabs">
                <button
                    className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    <Store size={18} />
                    <span>General</span>
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

            {/* Tab Content */}
            <div className="settings-content">
                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="settings-tab-content">
                        {/* Shop Identity Card */}
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

                        {/* Security & Theme Cards */}
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

                                    <button className="btn btn-secondary btn-block btn-compact">
                                        <Share2 size={16} />
                                        <span>Compartir Acceso (Read Only)</span>
                                    </button>
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

                {/* DATA TAB */}
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

                        <div className="data-management">
                            <div className="settings-card">
                                <div className="card-header">
                                    <div className="card-header-icon card-header-icon-primary">
                                        <Database size={24} />
                                    </div>
                                    <div className="card-header-text">
                                        <h2>Gestión de Datos</h2>
                                        <p>Importá y exportá tu información</p>
                                    </div>
                                </div>

                                <div className="data-actions-grid">
                                    <div className="data-action-card">
                                        <Download size={32} className="data-action-icon" />
                                        <h3>Exportar Datos</h3>
                                        <p>Descargá un backup completo en JSON</p>
                                        <button className="btn btn-primary" onClick={handleExport}>
                                            <Download size={16} />
                                            <span>Exportar Ahora</span>
                                        </button>
                                    </div>

                                    <div className="data-action-card">
                                        <Upload size={32} className="data-action-icon" />
                                        <h3>Importar Datos</h3>
                                        <p>Cargá un archivo JSON previamente exportado</p>
                                        <label className="btn btn-secondary">
                                            <Upload size={16} />
                                            <span>Seleccionar Archivo</span>
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
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="settings-tab-content">
                        <div className="users-header">
                            <div className="users-header-content">
                                <div className="users-header-icon">
                                    <Users size={28} />
                                </div>
                                <div className="users-header-text">
                                    <h2>Usuarios del Sistema</h2>
                                    <p>Gestioná los usuarios y permisos de acceso</p>
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={() => handleOpenUserModal()}>
                                <Plus size={18} />
                                <span>Nuevo Usuario</span>
                            </button>
                        </div>

                        {isLoadingUsers ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Cargando usuarios...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="empty-state">
                                <Users size={64} className="empty-state-icon" />
                                <h3>No hay usuarios</h3>
                                <p>Comenzá creando el primer usuario del sistema</p>
                                <button className="btn btn-primary" onClick={() => handleOpenUserModal()}>
                                    <Plus size={18} />
                                    <span>Crear Primer Usuario</span>
                                </button>
                            </div>
                        ) : (
                            <div className="users-grid">
                                {users.map(user => (
                                    <div key={user.id} className="user-card">
                                        <div className="user-card-header">
                                            <div className="user-avatar">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="user-info">
                                                <h4>{user.name}</h4>
                                                <p className="user-email">{user.email}</p>
                                            </div>
                                        </div>
                                        <div className="user-card-body">
                                            <div className="user-role-section">
                                                <span className={`role-badge ${getRoleBadgeColor(user.role)}`}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </div>
                                            <div className="user-meta">
                                                <div className="user-meta-item">
                                                    <Shield size={14} />
                                                    <span>ID: {user.id.substring(0, 8)}...</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="user-card-actions">
                                            <button
                                                className="btn btn-secondary btn-compact"
                                                onClick={() => handleOpenUserModal(user)}
                                            >
                                                <Edit2 size={14} />
                                                <span>Editar</span>
                                            </button>
                                            {user.id !== currentUser?.id && (
                                                <button
                                                    className="btn btn-danger btn-compact"
                                                    onClick={() => handleDeleteUser(user)}
                                                >
                                                    <Trash2 size={14} />
                                                    <span>Eliminar</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* User Modal */}
                        {isUserModalOpen && (
                            <div className="modal-overlay" onClick={() => setIsUserModalOpen(false)}>
                                <div className="modal-content" onClick={e => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <div className="modal-header-content">
                                            <div className="modal-header-icon">
                                                <Key size={24} />
                                            </div>
                                            <h2>{userToEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                                        </div>
                                        <button className="modal-close-btn" onClick={() => setIsUserModalOpen(false)}>
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSaveUser} className="modal-form">
                                        <div className="form-group">
                                            <label className="form-label">Nombre Completo *</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={userForm.name}
                                                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                                                placeholder="Ej: Juan Pérez"
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Email *</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={userForm.email}
                                                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                                placeholder="juan@mijardin.com"
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Rol *</label>
                                            <select
                                                className="form-input form-select"
                                                value={userForm.role}
                                                onChange={e => setUserForm({ ...userForm, role: e.target.value as any })}
                                            >
                                                <option value="admin">Administrador (Acceso completo)</option>
                                                <option value="seller">Vendedor (Ventas, productos, clientes)</option>
                                                <option value="driver">Repartidor (Solo entregas)</option>
                                                <option value="viewer">Visualizador (Solo lectura)</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">
                                                Contraseña {userToEdit && '(dejar vacío para no cambiar)'}
                                            </label>
                                            <div className="input-with-icon password-input">
                                                <Key size={18} className="input-icon" />
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    className="form-input"
                                                    value={userForm.password}
                                                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                                    placeholder={userToEdit ? '••••••••' : 'Mínimo 6 caracteres'}
                                                    required={!userToEdit}
                                                />
                                                <button
                                                    type="button"
                                                    className="password-toggle"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="modal-footer">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setIsUserModalOpen(false)}
                                            >
                                                Cancelar
                                            </button>
                                            <button type="submit" className="btn btn-primary">
                                                <Check size={18} />
                                                {userToEdit ? 'Actualizar' : 'Crear Usuario'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SUBSCRIPTION TAB */}
                {activeTab === 'subscription' && (
                    <SubscriptionTab />
                )}
            </div>

            {alertModal && <AlertModal {...alertModal} />}
            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};
