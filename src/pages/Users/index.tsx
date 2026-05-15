import { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  CheckCircle2, 
  Search,
  Wallet,
  Truck,
  UserCheck,
  Ban,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { ApiClient } from '../../services/api';
import type { User, UserRole } from '../../types';
import './Users.css';

const api = new ApiClient();

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form state for new user
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'employee' as UserRole
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const usersData = await api.getUsers();
      setUsers(usersData);
    } catch (error: any) {
      console.error('[EQUIPO ERROR]', error);
      if (error.status === 403) {
        alert('No tenés permisos para ver la lista de equipo. Solo los Administradores o el Dueño pueden gestionar usuarios.');
      } else {
        alert('Error al cargar datos del equipo: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password) {
      alert('Por favor completa los campos obligatorios (Nombre, Email y Contraseña)');
      return;
    }

    try {
      await api.createUser(userForm);
      alert('Usuario creado exitosamente');
      setShowCreateModal(false);
      setUserForm({ name: '', email: '', username: '', password: '', role: 'employee' });
      fetchData();
    } catch (error: any) {
      alert(error.message || 'Error al crear usuario');
    }
  };

  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Estás seguro de ${action} a este usuario?`)) return;
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      alert(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
      fetchData();
    } catch (error) {
      alert('Error al actualizar estado');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar permanentemente a este usuario?')) return;
    try {
      await api.deleteUser(id);
      alert('Usuario eliminado');
      fetchData();
    } catch (error) {
      alert('Error al eliminar usuario');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <span className="badge badge-owner">Dueño</span>;
      case 'admin': return <span className="badge badge-admin">Admin</span>;
      case 'employee': return <span className="badge badge-employee">Empleado</span>;
      case 'finance': return <span className="badge badge-finance">Finanzas</span>;
      case 'delivery': return <span className="badge badge-delivery">Repartidor</span>;
      case 'viewer': return <span className="badge badge-viewer">Lector</span>;
      default: return <span className="badge">{role}</span>;
    }
  };

  return (
    <div className="users-page">
      <header className="page-header">
        <div className="header-left">
          <div className="header-icon">
            <Users size={24} />
          </div>
          <div>
            <h1>Equipo y Permisos</h1>
            <p>Gestiona los accesos de tu equipo. Varias cuentas pueden compartir el mismo Gmail.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus size={18} />
          <span>Agregar Usuario</span>
        </button>
      </header>

      <div className="search-bar">
        <Search size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nombre, email o usuario..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="users-section">
        <div className="section-header">
          <h2>Miembros del Equipo ({filteredUsers.length})</h2>
        </div>
        
        <div className="card-list">
          {isLoading ? (
            <div className="loading-placeholder">Cargando equipo...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">No se encontraron miembros.</div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} className={`user-card ${!user.is_active ? 'inactive' : ''}`}>
                <div className="user-card-main">
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <div className="user-name-row">
                      <h3>{user.name}</h3>
                      {getRoleBadge(user.role)}
                    </div>
                    <div className="user-meta">
                      <span><Mail size={12} /> {user.email}</span>
                      {user.username && <span><UserCheck size={12} /> @{user.username}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="user-card-actions">
                  <button 
                    className={`btn-status ${user.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                    onClick={() => handleToggleStatus(user)}
                    title={user.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {user.is_active ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                  </button>
                  <button 
                    className="btn-icon btn-delete" 
                    onClick={() => handleDeleteUser(user.id)}
                    title="Eliminar permanentemente"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header>
              <h2>Crear Nuevo Usuario</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </header>
            
            <form onSubmit={handleCreateUser}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej: Juan Pérez"
                    value={userForm.name}
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Email (Gmail) *</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="ejemplo@gmail.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Nombre de Usuario (Opcional)</label>
                  <div className="input-with-icon">
                    <UserCheck size={18} />
                    <input 
                      type="text" 
                      placeholder="usuario_unico"
                      value={userForm.username}
                      onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                    />
                  </div>
                  <small className="help-text">Útil si varios usuarios comparten el mismo Gmail.</small>
                </div>

                <div className="form-group">
                  <label>Contraseña Inicial *</label>
                  <div className="input-with-icon">
                    <Lock size={18} />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required 
                      placeholder="••••••••"
                      value={userForm.password}
                      onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                    />
                    <button 
                      type="button" 
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group mt-4">
                <label>Rol / Permisos</label>
                <div className="role-options">
                  <label className={`role-option ${userForm.role === 'employee' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="employee" 
                      checked={userForm.role === 'employee'}
                      onChange={() => setUserForm({...userForm, role: 'employee'})}
                    />
                    <div className="role-icon"><Users size={20} /></div>
                    <div className="role-info">
                      <strong>Empleado</strong>
                      <span>Ventas y gestión básica</span>
                    </div>
                  </label>

                  <label className={`role-option ${userForm.role === 'admin' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="admin" 
                      checked={userForm.role === 'admin'}
                      onChange={() => setUserForm({...userForm, role: 'admin'})}
                    />
                    <div className="role-icon"><Shield size={20} /></div>
                    <div className="role-info">
                      <strong>Administrador</strong>
                      <span>Control casi total</span>
                    </div>
                  </label>

                  <label className={`role-option ${userForm.role === 'finance' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="finance" 
                      checked={userForm.role === 'finance'}
                      onChange={() => setUserForm({...userForm, role: 'finance'})}
                    />
                    <div className="role-icon"><Wallet size={20} /></div>
                    <div className="role-info">
                      <strong>Finanzas</strong>
                      <span>Solo gestión económica</span>
                    </div>
                  </label>

                  <label className={`role-option ${userForm.role === 'delivery' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="delivery" 
                      checked={userForm.role === 'delivery'}
                      onChange={() => setUserForm({...userForm, role: 'delivery'})}
                    />
                    <div className="role-icon"><Truck size={20} /></div>
                    <div className="role-info">
                      <strong>Repartidor</strong>
                      <span>Solo logística y entregas</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
