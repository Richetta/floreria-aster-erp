import { useState, useEffect } from 'react';
import {
    Store,
    Smartphone,
    MapPin,
    Instagram,
    Database,
    Download,
    Upload,
    Shield,
    Palette,
    Save,
    Share2,
    LogOut,
    Users,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    Eye,
    EyeOff
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { api, type User } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import './Settings.css';

type UserFormData = {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'seller' | 'driver' | 'viewer';
};

export const Settings = () => {
    const shopInfo = useStore(state => state.shopInfo);
    const updateShopInfo = useStore(state => state.updateShopInfo);
    const { user: currentUser, logout } = useAuth();

    const [formData, setFormData] = useState(shopInfo);
    const [isSaved, setIsSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'data' | 'users'>('general');
    const [theme, setTheme] = useState('violet');

    const { alertModal, confirmModal, showAlert, showConfirm } = useModal();

    // Themes Mapping
    const themes = {
        violet: { primary: '#9b51e0', name: 'Aster Violet' },
        nature: { primary: '#059669', name: 'Naturaleza' },
        sky: { primary: '#0ea5e9', name: 'Cielo' },
        roses: { primary: '#f43f5e', name: 'Rosas' }
    };

    const handleThemeChange = (newTheme: string) => {
        setTheme(newTheme);
        const root = document.documentElement;
        const color = themes[newTheme as keyof typeof themes].primary;
        root.style.setProperty('--color-primary', color);
        root.style.setProperty('--color-primary-dark', color); // Simplified for now
        localStorage.setItem('aster-theme', newTheme);
    };

    // Load theme on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('aster-theme');
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

    // Load users on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('aster-theme');
        if (savedTheme) handleThemeChange(savedTheme);
        
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
            showAlert({ title: 'Error', message: 'Error al cargar usuarios: ' + error.message, variant: 'error' });
        }
        setIsLoadingUsers(false);
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
        downloadAnchorNode.setAttribute("download", `aster_erp_backup_${new Date().toISOString().split('T')[0]}.json`);
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
                // Simple validation
                if (!data.products && !data.customers) throw new Error('Formato inválido');
                
                if (await showConfirm({
                    title: '¿Importar datos?',
                    message: 'Esto podría duplicar registros si ya existen.',
                    confirmText: 'Importar',
                    variant: 'warning'
                })) {
                    showAlert({ title: 'Éxito', message: '¡Datos leídos correctamente! (Fase de importación masiva finalizada)', variant: 'success' });
                }
            } catch (error) {
                showAlert({ title: 'Error', message: 'Error al leer el archivo. Asegurate que sea un JSON válido exportado del sistema.', variant: 'error' });
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

    // User management functions
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
            setUserForm({
                name: '',
                email: '',
                password: '',
                role: 'viewer'
            });
        }
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userForm.name || !userForm.email) {
            showAlert({ title: 'Campos requeridos', message: 'Nombre y email son obligatorios', variant: 'warning' });
            return;
        }

        if (!userToEdit && !userForm.password) {
            showAlert({ title: 'Contraseña requerida', message: 'La contraseña es obligatoria para nuevos usuarios', variant: 'warning' });
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
                showAlert({ title: 'Éxito', message: 'Usuario actualizado exitosamente', variant: 'success' });
            } else {
                await api.createUser({
                    name: userForm.name,
                    email: userForm.email,
                    password: userForm.password,
                    role: userForm.role
                });
                showAlert({ title: 'Éxito', message: 'Usuario creado exitosamente', variant: 'success' });
            }
            setIsUserModalOpen(false);
            loadUsers();
        } catch (error: any) {
            console.error('Error saving user:', error);
            showAlert({ title: 'Error', message: 'Error al guardar usuario: ' + (error.message || 'Error desconocido'), variant: 'error' });
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (user.id === currentUser?.id) {
            showAlert({ title: 'Acción no permitida', message: 'No puedes eliminar tu propia cuenta', variant: 'warning' });
            return;
        }

        const confirmed = await showConfirm({
            title: '¿Eliminar usuario?',
            message: `Se eliminará al usuario "${user.name}". Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            variant: 'danger'
        });
        if (confirmed) {
            try {
                await api.deleteUser(user.id);
                showAlert({ title: 'Éxito', message: 'Usuario eliminado exitosamente', variant: 'success' });
                loadUsers();
            } catch (error: any) {
                console.error('Error deleting user:', error);
                showAlert({ title: 'Error', message: 'Error al eliminar usuario: ' + error.message, variant: 'error' });
            }
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-danger text-white';
            case 'seller': return 'bg-primary text-white';
            case 'driver': return 'bg-warning text-white';
            default: return 'bg-surface text-muted';
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
        <div className="settings-page p-6">
            <header className="page-header mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-h1">Configuración del Sistema</h1>
                    <p className="text-body mt-2 text-muted">Personaliza tu tienda y gestiona tus datos.</p>
                </div>
                <button className="btn btn-secondary text-danger border-danger hover:bg-danger hover:text-white" onClick={handleLogout}>
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </header>

            {/* Tabs de navegación */}
            <div className="flex gap-2 mb-6 border-b border-border pb-2">
                <button
                    className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('general')}
                >
                    <Store size={18} />
                    General
                </button>
                <button
                    className={`btn ${activeTab === 'data' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('data')}
                >
                    <Database size={18} />
                    Datos
                </button>
                <button
                    className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} />
                    Usuarios
                </button>
            </div>

            {/* Tab: General */}
            {activeTab === 'general' && (
                <div className="settings-grid">
                    <div className="card settings-card col-span-2">
                        <h2 className="text-h3 mb-6 flex items-center gap-2">
                            <Store size={24} className="text-primary" />
                            Identidad de la Florería
                        </h2>

                        <form onSubmit={handleSave} className="grid grid-cols-2 gap-6">
                            <div className="form-group">
                                <label className="form-label">Nombre del Negocio</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Instagram / Redes</label>
                                <div className="flex bg-background border border-border rounded-lg overflow-hidden">
                                    <div className="p-3 bg-surface border-r border-border"><Instagram size={18} /></div>
                                    <input
                                        type="text"
                                        className="form-input border-none"
                                        value={formData.instagram}
                                        onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">WhatsApp de Atención</label>
                                <div className="flex bg-background border border-border rounded-lg overflow-hidden">
                                    <div className="p-3 bg-surface border-r border-border"><Smartphone size={18} /></div>
                                    <input
                                        type="text"
                                        className="form-input border-none"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dirección / Local</label>
                                <div className="flex bg-background border border-border rounded-lg overflow-hidden">
                                    <div className="p-3 bg-surface border-r border-border"><MapPin size={18} /></div>
                                    <input
                                        type="text"
                                        className="form-input border-none"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="col-span-2 flex justify-end mt-4">
                                <button type="submit" className="btn btn-primary flex items-center gap-2 px-8">
                                    <Save size={20} />
                                    {isSaved ? '¡Guardado!' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="card settings-card">
                        <h2 className="text-h3 mb-6 flex items-center gap-2">
                            <Database size={24} className="text-primary" />
                            Seguridad y Datos
                        </h2>

                        <div className="space-y-4">
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-small font-bold flex items-center gap-2 mb-2">
                                    <Shield size={16} className="text-success" />
                                    Backup Local Activo
                                </p>
                                <p className="text-micro text-muted mb-4">Tus datos se guardan automáticamente en este navegador.</p>
                                <div className="flex gap-2">
                                    <button className="btn btn-secondary text-micro flex-1 flex items-center justify-center gap-2" onClick={handleExport}>
                                        <Download size={14} /> Exportar JSON
                                    </button>
                                    <label className="btn btn-secondary text-micro flex-1 flex items-center justify-center gap-2 cursor-pointer">
                                        <Upload size={14} /> Importar
                                        <input type="file" accept=".json" onChange={handleImport} style={{display: 'none'}} />
                                    </label>
                                </div>
                            </div>

                            <button className="btn btn-secondary w-full text-small flex items-center justify-center gap-2">
                                <Share2 size={16} /> Compartir Acceso (Read Only)
                            </button>
                        </div>
                    </div>

                    <div className="card settings-card">
                        <h2 className="text-h3 mb-6 flex items-center gap-2">
                            <Palette size={24} className="text-primary" />
                            Personalización UI
                        </h2>

                        <div className="theme-options grid grid-cols-2 gap-3">
                            <div 
                                className={`theme-preview ${theme === 'violet' ? 'active' : ''}`} 
                                style={{ background: themes.violet.primary }}
                                onClick={() => handleThemeChange('violet')}
                            >
                                <div className="preview-dot" />
                                <span>{themes.violet.name}</span>
                            </div>
                            <div 
                                className={`theme-preview ${theme === 'nature' ? 'active' : ''}`} 
                                style={{ background: themes.nature.primary }}
                                onClick={() => handleThemeChange('nature')}
                            >
                                <div className="preview-dot" />
                                <span>{themes.nature.name}</span>
                            </div>
                            <div 
                                className={`theme-preview ${theme === 'sky' ? 'active' : ''}`} 
                                style={{ background: themes.sky.primary }}
                                onClick={() => handleThemeChange('sky')}
                            >
                                <div className="preview-dot" />
                                <span>{themes.sky.name}</span>
                            </div>
                            <div 
                                className={`theme-preview ${theme === 'roses' ? 'active' : ''}`} 
                                style={{ background: themes.roses.primary }}
                                onClick={() => handleThemeChange('roses')}
                            >
                                <div className="preview-dot" />
                                <span>{themes.roses.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Usuarios */}
            {activeTab === 'users' && (
                <div className="users-management-card">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-h2 flex items-center gap-3">
                                <Users size={28} className="text-primary" />
                                Usuarios del Sistema
                            </h2>
                            <p className="text-body text-muted mt-1">
                                Gestiona los usuarios y permisos de acceso al sistema
                            </p>
                        </div>
                        <button className="btn btn-primary flex items-center gap-2" onClick={() => handleOpenUserModal()}>
                            <Plus size={20} />
                            Nuevo Usuario
                        </button>
                    </div>

                    {isLoadingUsers ? (
                        <div className="loading-state text-center py-12">
                            <div className="spinner" style={{
                                width: 40,
                                height: 40,
                                border: '4px solid #e5e7eb',
                                borderTopColor: '#9b51e0',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 1rem'
                            }}></div>
                            <p className="text-muted">Cargando usuarios...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="card text-center py-12">
                            <Users size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="text-h3 mb-2">No hay usuarios</h3>
                            <p className="text-body text-muted mb-4">Comenzá creando el primer usuario del sistema.</p>
                            <button className="btn btn-primary" onClick={() => handleOpenUserModal()}>
                                <Plus size={20} />
                                Crear Primer Usuario
                            </button>
                        </div>
                    ) : (
                        <div className="users-grid">
                            {users.map(user => (
                                <div key={user.id} className="card user-card">
                                    <div className="user-card-header">
                                        <div className="user-avatar">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="user-info">
                                            <h4 className="text-h4 font-bold">{user.name}</h4>
                                            <p className="text-small text-muted">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="user-card-body">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`role-badge ${getRoleBadgeColor(user.role)}`}>
                                                {getRoleLabel(user.role)}
                                            </span>
                                        </div>
                                        <div className="user-meta text-small text-muted space-y-1">
                                            <p className="flex items-center gap-2">
                                                <Shield size={14} />
                                                ID: {user.id.substring(0, 8)}...
                                            </p>
                                        </div>
                                    </div>
                                    <div className="user-card-actions">
                                        <button
                                            className="btn btn-secondary flex-1 text-small flex items-center justify-center gap-2"
                                            onClick={() => handleOpenUserModal(user)}
                                        >
                                            <Edit2 size={14} />
                                            Editar
                                        </button>
                                        {user.id !== currentUser?.id && (
                                            <button
                                                className="btn btn-outline-danger flex-1 text-small flex items-center justify-center gap-2"
                                                onClick={() => handleDeleteUser(user)}
                                            >
                                                <Trash2 size={14} />
                                                Eliminar
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
                            <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                                <div className="modal-header flex justify-between items-center mb-6">
                                    <h2 className="text-h2">
                                        {userToEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
                                    </h2>
                                    <button className="btn-icon" onClick={() => setIsUserModalOpen(false)}>
                                        <X size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleSaveUser} className="space-y-4">
                                    <div className="form-group">
                                        <label className="form-label">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={userForm.name}
                                            onChange={e => setUserForm({...userForm, name: e.target.value})}
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
                                            onChange={e => setUserForm({...userForm, email: e.target.value})}
                                            placeholder="juan@floreriaaster.com"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Rol *</label>
                                        <select
                                            className="form-input"
                                            value={userForm.role}
                                            onChange={e => setUserForm({...userForm, role: e.target.value as any})}
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
                                        <div className="input-with-icon">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="form-input"
                                                value={userForm.password}
                                                onChange={e => setUserForm({...userForm, password: e.target.value})}
                                                placeholder={userToEdit ? '••••••••' : 'Mínimo 6 caracteres'}
                                                required={!userToEdit}
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle-btn"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6 pt-6 border-t border-border">
                                        <button
                                            type="button"
                                            className="btn btn-secondary flex-1"
                                            onClick={() => setIsUserModalOpen(false)}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                                        >
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

            {alertModal && <AlertModal {...alertModal} />}
            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};
