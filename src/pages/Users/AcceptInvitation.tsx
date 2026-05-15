import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ApiClient } from '../../services/api';
import { toast } from 'react-hot-toast';
import { Mail, User, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import './AcceptInvitation.css';

const api = new ApiClient();

export const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (!token) {
      toast.error('Token de invitación no encontrado');
      navigate('/login');
      return;
    }

    const loadInvitation = async () => {
      try {
        const data = await api.getInvitationByToken(token);
        setInvitation(data);
      } catch (error: any) {
        toast.error(error.message || 'La invitación no es válida o ha expirado');
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    loadInvitation();
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.acceptInvitation({
        token,
        name: formData.name,
        username: formData.username || undefined,
        password: formData.password
      });
      
      setIsSuccess(true);
      toast.success('¡Bienvenido al equipo!');
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || 'Error al aceptar invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="accept-page-loading">
        <div className="spinner"></div>
        <p>Validando invitación...</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="accept-page success">
        <div className="accept-card text-center">
          <div className="success-icon">
            <CheckCircle2 size={64} />
          </div>
          <h1>¡Cuenta creada!</h1>
          <p>Tu cuenta ha sido vinculada exitosamente a <strong>{invitation.business_name}</strong>.</p>
          <p>Serás redirigido al inicio de sesión en unos segundos...</p>
          <button className="btn-primary w-full mt-6" onClick={() => navigate('/login')}>
            Ir al Login Ahora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="accept-page">
      <div className="accept-card">
        <header>
          <div className="brand-badge">Mi Jardín</div>
          <h1>Unirte al equipo</h1>
          <p>Has sido invitado a unirte a <strong>{invitation.business_name}</strong> como <strong>{invitation.role}</strong>.</p>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre Completo</label>
            <div className="input-with-icon">
              <User size={18} />
              <input 
                type="text" 
                required 
                placeholder="Tu nombre"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Usuario (opcional)</label>
            <div className="input-with-icon">
              <User size={18} />
              <input 
                type="text" 
                placeholder="Nombre de usuario para login"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>
            <small className="form-hint">Puedes usar esto en lugar de tu email para entrar.</small>
          </div>

          <div className="form-group">
            <label>Email de registro</label>
            <div className="input-with-icon disabled">
              <Mail size={18} />
              <input type="email" value={invitation.email} disabled />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Contraseña</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input 
                  type="password" 
                  required 
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Confirmar Contraseña</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input 
                  type="password" 
                  required 
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Procesando...' : (
              <>
                <span>Completar Registro</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
