import { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  CheckCircle2, 
  Clock,
  MoreVertical,
  UserCheck,
  Ban,
  Search,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { ApiClient } from '../services/api';
import { User, UserInvitation, UserRole } from '../types';
import { toast } from 'react-hot-toast';
import './Users.css';

const api = new ApiClient();

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form state for new invitation
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'employee' as UserRole
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [usersData, invData] = await Promise.all([
        api.getUsers(),
        api.getInvitations()
      ]);
      setUsers(usersData);
      setInvitations(invData);
    } catch (error) {
      toast.error('Error al cargar datos del equipo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.createInvitation(inviteForm);
      toast.success('Invitación enviada');
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'employee' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar invitación');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('¿Estás seguro de revocar esta invitación?')) return;
    try {
      await api.revokeInvitation(id);
      toast.success('Invitación revocada');
      fetchData();
    } catch (error) {
      toast.error('Error al revocar invitación');
    }
  };

  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Estás seguro de ${action} a este usuario?`)) return;
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const copyInviteLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success('Enlace copiado al portapapeles');
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
            <p>Gestiona quién tiene acceso a tu negocio y qué puede hacer.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
          <UserPlus size={18} />
          <span>Invitar Miembro</span>
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

      <div className="users-grid">
        <section className="users-section">
          <div className="section-header">
            <h2>Miembros Activos ({filteredUsers.length})</h2>
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
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="invitations-section">
          <div className="section-header">
            <h2>Invitaciones Pendientes ({invitations.length})</h2>
          </div>

          <div className="card-list">
            {invitations.length === 0 ? (
              <div className="empty-state">No hay invitaciones pendientes.</div>
            ) : (
              invitations.map(inv => (
                <div key={inv.id} className="invitation-card">
                  <div className="inv-details">
                    <div className="inv-email-row">
                      <strong>{inv.email}</strong>
                      {getRoleBadge(inv.role)}
                    </div>
                    <div className="inv-meta">
                      <span><Clock size={12} /> Expira: {new Date(inv.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="inv-actions">
                    <button 
                      className="btn-icon" 
                      onClick={() => inv.invite_link && copyInviteLink(inv.invite_link, inv.id)}
                      title="Copiar enlace de invitación"
                    >
                      {copiedToken === inv.id ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                    <button 
                      className="btn-icon btn-delete" 
                      onClick={() => handleRevoke(inv.id)}
                      title="Revocar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header>
              <h2>Invitar nuevo miembro</h2>
              <button className="close-btn" onClick={() => setShowInviteModal(false)}>×</button>
            </header>
            
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input 
                    type="email" 
                    required 
                    placeholder="ejemplo@correo.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Rol / Permisos</label>
                <div className="role-options">
                  <label className={`role-option ${inviteForm.role === 'employee' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="employee" 
                      checked={inviteForm.role === 'employee'}
                      onChange={() => setInviteForm({...inviteForm, role: 'employee'})}
                    />
                    <div className="role-icon"><Users size={20} /></div>
                    <div className="role-info">
                      <strong>Empleado</strong>
                      <span>Ventas y gestión básica</span>
                    </div>
                  </label>

                  <label className={`role-option ${inviteForm.role === 'admin' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="admin" 
                      checked={inviteForm.role === 'admin'}
                      onChange={() => setInviteForm({...inviteForm, role: 'admin'})}
                    />
                    <div className="role-icon"><Shield size={20} /></div>
                    <div className="role-info">
                      <strong>Administrador</strong>
                      <span>Control casi total</span>
                    </div>
                  </label>

                  <label className={`role-option ${inviteForm.role === 'finance' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="finance" 
                      checked={inviteForm.role === 'finance'}
                      onChange={() => setInviteForm({...inviteForm, role: 'finance'})}
                    />
                    <div className="role-icon"><Wallet size={20} /></div>
                    <div className="role-info">
                      <strong>Finanzas</strong>
                      <span>Solo gestión económica</span>
                    </div>
                  </label>

                  <label className={`role-option ${inviteForm.role === 'delivery' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="delivery" 
                      checked={inviteForm.role === 'delivery'}
                      onChange={() => setInviteForm({...inviteForm, role: 'delivery'})}
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
                <button type="button" className="btn-secondary" onClick={() => setShowInviteModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Enviar Invitación</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
