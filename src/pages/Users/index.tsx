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
  EyeOff,
  Edit2,
  Phone
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../store/useAuth';
import type { User, UserRole } from '../../types';
import './Users.css';

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const { user: currentUser } = useAuth();
  const isAdminOrOwner = currentUser?.role === 'admin' || currentUser?.role === 'owner';

  // Form state for new user
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'employee' as UserRole,
    phone: ''
  });

  // Form state for editing user
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'employee' as UserRole,
    phone: ''
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
      await api.createUser({
        name: userForm.name,
        email: userForm.email,
        username: userForm.username || undefined,
        password: userForm.password,
        role: userForm.role,
        phone: userForm.phone || undefined
      });
      alert('Usuario creado exitosamente');
      setShowCreateModal(false);
      setUserForm({ name: '', email: '', username: '', password: '', role: 'employee', phone: '' });
      fetchData();
    } catch (error: any) {
      alert(error.message || 'Error al crear usuario');
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      username: user.username || '',
      password: '', // Kept blank unless resetting password
      role: user.role || 'employee',
      phone: user.phone || ''
    });
    setShowEditPassword(false);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.name || !editForm.email) {
      alert('Por favor completa los campos obligatorios (Nombre y Email)');
      return;
    }

    try {
      const payload: any = {
        name: editForm.name,
        email: editForm.email,
        username: editForm.username || null,
        role: editForm.role,
        phone: editForm.phone || null
      };

      if (editForm.password) {
        payload.password = editForm.password;
      }

      await api.updateUser(editingUser.id, payload);
      alert('Usuario actualizado exitosamente');
      setShowEditModal(false);
      setEditingUser(null);

      // If updating oneself, update the active session user state in Zustand
      if (editingUser.id === currentUser?.id) {
        useAuth.setState({
          user: {
            ...currentUser,
            name: editForm.name,
            email: editForm.email,
            role: editForm.role,
            phone: editForm.phone || undefined
          } as any
        });
        localStorage.setItem('user', JSON.stringify({
          ...currentUser,
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          phone: editForm.phone || undefined
        }));
      }

      fetchData();
    } catch (error: any) {
      alert(error.message || 'Error al actualizar usuario');
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
        {isAdminOrOwner && (
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={18} />
            <span>Agregar Usuario</span>
          </button>
        )}
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
                      {user.phone && <span><Phone size={12} /> {user.phone}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="user-card-actions">
                  {isAdminOrOwner && (
                    <button 
                      className="btn-icon btn-edit" 
                      onClick={() => handleEditClick(user)}
                      title="Editar usuario"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {isAdminOrOwner && user.id !== currentUser?.id && (
                    <>
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
                    </>
                  )}
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
                  <div className="users-input-with-icon">
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
                  <label>Teléfono (Opcional)</label>
                  <div className="users-input-with-icon">
                    <Phone size={18} />
                    <input 
                      type="text" 
                      placeholder="+54 9 11 ..."
                      value={userForm.phone}
                      onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Contraseña Inicial *</label>
                  <div className="users-input-with-icon">
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

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header>
              <h2>Editar Usuario: {editingUser.name}</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </header>
            
            <form onSubmit={handleUpdateUser}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej: Juan Pérez"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Email (Gmail) *</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="ejemplo@gmail.com"
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Nombre de Usuario (Opcional)</label>
                  <div className="users-input-with-icon">
                    <UserCheck size={18} />
                    <input 
                      type="text" 
                      placeholder="usuario_unico"
                      value={editForm.username}
                      onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                    />
                  </div>
                  <small className="help-text">Útil si varios usuarios comparten el mismo Gmail.</small>
                </div>

                <div className="form-group">
                  <label>Teléfono (Opcional)</label>
                  <div className="users-input-with-icon">
                    <Phone size={18} />
                    <input 
                      type="text" 
                      placeholder="+54 9 11 ..."
                      value={editForm.phone}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Contraseña (Opcional)</label>
                  <div className="users-input-with-icon">
                    <Lock size={18} />
                    <input 
                      type={showEditPassword ? 'text' : 'password'} 
                      placeholder="Ingresa nueva para cambiar..."
                      value={editForm.password}
                      onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                    />
                    <button 
                      type="button" 
                      className="password-toggle"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <small className="help-text">Dejar en blanco para conservar la contraseña actual.</small>
                </div>
              </div>

              {editingUser.id !== currentUser?.id && (
                <div className="form-group mt-4">
                  <label>Rol / Permisos</label>
                  <div className="role-options">
                    <label className={`role-option ${editForm.role === 'employee' ? 'selected' : ''}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        value="employee" 
                        checked={editForm.role === 'employee'}
                        onChange={() => setEditForm({...editForm, role: 'employee'})}
                      />
                      <div className="role-icon"><Users size={20} /></div>
                      <div className="role-info">
                        <strong>Empleado</strong>
                        <span>Ventas y gestión básica</span>
                      </div>
                    </label>

                    <label className={`role-option ${editForm.role === 'admin' ? 'selected' : ''}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        value="admin" 
                        checked={editForm.role === 'admin'}
                        onChange={() => setEditForm({...editForm, role: 'admin'})}
                      />
                      <div className="role-icon"><Shield size={20} /></div>
                      <div className="role-info">
                        <strong>Administrador</strong>
                        <span>Control casi total</span>
                      </div>
                    </label>

                    <label className={`role-option ${editForm.role === 'finance' ? 'selected' : ''}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        value="finance" 
                        checked={editForm.role === 'finance'}
                        onChange={() => setEditForm({...editForm, role: 'finance'})}
                      />
                      <div className="role-icon"><Wallet size={20} /></div>
                      <div className="role-info">
                        <strong>Finanzas</strong>
                        <span>Solo gestión económica</span>
                      </div>
                    </label>

                    <label className={`role-option ${editForm.role === 'delivery' ? 'selected' : ''}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        value="delivery" 
                        checked={editForm.role === 'delivery'}
                        onChange={() => setEditForm({...editForm, role: 'delivery'})}
                      />
                      <div className="role-icon"><Truck size={20} /></div>
                      <div className="role-info">
                        <strong>Repartidor</strong>
                        <span>Solo logística y entregas</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
