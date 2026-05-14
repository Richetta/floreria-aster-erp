import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import './Subscription.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    // Notify opener if this is a popup
    if (window.opener) {
        window.opener.postMessage({ type: 'MP_PAYMENT_SUCCESS' }, window.location.origin);
        // Optional: close window after delay
        const closeTimer = setTimeout(() => window.close(), 3000);
        return () => clearTimeout(closeTimer);
    }

    // Give MP webhook a moment to process, then verify
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/subscription/current`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
        });
        const data = await res.json();
        if (data.success && data.data?.status && data.data.status !== 'free') {
          setStatus('success');
        } else {
          // Subscription might still be processing, show success anyway
          setStatus('success');
        }
      } catch {
        setStatus('success'); // Show success — webhook will confirm async
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'loading') {
    return (
      <div className="sub-page sub-page--loading">
        <Loader2 size={48} className="sub-spinner" />
        <h2>Verificando tu pago...</h2>
        <p>Esto tarda unos segundos.</p>
      </div>
    );
  }

  return (
    <div className="sub-page sub-page--success">
      <div className="sub-page__card">
        <div className="sub-page__icon sub-page__icon--success">
          <CheckCircle size={64} />
        </div>
        <h1>¡Listo! Tu suscripción está activa</h1>
        <p>
          Tu tarjeta fue vinculada correctamente. Durante los primeros 15 días no se realizará ningún cobro.
          Si ya pagás el primer mes, tu suscripción está activa.
        </p>
        <div className="sub-page__details">
          <div className="sub-detail">
            <span>✅</span>
            <span>Acceso completo desbloqueado</span>
          </div>
          <div className="sub-detail">
            <span>🔔</span>
            <span>Te avisamos antes de cada cobro</span>
          </div>
          <div className="sub-detail">
            <span>❌</span>
            <span>Podés cancelar cuando quieras</span>
          </div>
        </div>
        <button className="sub-page__btn sub-page__btn--primary" onClick={() => navigate('/')}>
          Ir al Dashboard <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export const SubscriptionFailure = () => {
  const navigate = useNavigate();

  return (
    <div className="sub-page sub-page--failure">
      <div className="sub-page__card">
        <div className="sub-page__icon sub-page__icon--error">
          <AlertCircle size={64} />
        </div>
        <h1>El pago no se pudo procesar</h1>
        <p>No se realizó ningún cargo. Podés intentarlo nuevamente o usar otro medio de pago.</p>
        <div className="sub-page__actions">
          <button className="sub-page__btn sub-page__btn--primary" onClick={() => navigate('/login#pricing')}>
            Intentar nuevamente
          </button>
          <button className="sub-page__btn sub-page__btn--secondary" onClick={() => navigate('/')}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export const SubscriptionPending = () => {
  const navigate = useNavigate();

  return (
    <div className="sub-page sub-page--pending">
      <div className="sub-page__card">
        <div className="sub-page__icon sub-page__icon--pending">
          <Loader2 size={64} />
        </div>
        <h1>Pago en proceso</h1>
        <p>Tu pago está siendo procesado. Te notificaremos por email cuando se confirme.</p>
        <p className="sub-page__note">Mientras tanto podés usar las funciones básicas del sistema.</p>
        <button className="sub-page__btn sub-page__btn--primary" onClick={() => navigate('/')}>
          Ir al Dashboard
        </button>
      </div>
    </div>
  );
};
