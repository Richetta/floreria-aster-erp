import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { PricingSection } from '../Login/PricingSection';
import { useSubscription } from '../../store/useSubscription';
import './PlanOnboarding.css';

export const PlanOnboarding = () => {
  const navigate = useNavigate();
  const { status } = useSubscription();
  const [loading, setLoading] = useState(false);

  // If user already has a paid plan or active trial, don't show this
  useEffect(() => {
    if (status === 'active' || status === 'trial') {
      navigate('/', { replace: true });
    }
  }, [status, navigate]);

  const handleContinueFree = () => {
    setLoading(true);
    // Mark as seen in this session
    sessionStorage.setItem('onboarding_seen', 'true');
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 500);
  };

  return (
    <div className="onboarding-page">
      {/* Background Decor */}
      <div className="onboarding-bg">
        <div className="onboarding-bg__glow onboarding-bg__glow--1"></div>
        <div className="onboarding-bg__glow onboarding-bg__glow--2"></div>
      </div>

      <div className="onboarding-content">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-logo">
            <img src="/logo-app.png" alt="Mi Jardín" />
          </div>
          <h1 className="onboarding-title">¡Te damos la bienvenida a Mi Jardín! 🌿</h1>
          <p className="onboarding-subtitle">
            Elegí cómo querés empezar a gestionar tu florería hoy mismo.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="onboarding-benefits">
          <div className="onboarding-benefit">
            <CheckCircle2 className="onboarding-benefit__icon" />
            <span>Control de Stock en tiempo real</span>
          </div>
          <div className="onboarding-benefit">
            <CheckCircle2 className="onboarding-benefit__icon" />
            <span>Punto de Venta (POS) profesional</span>
          </div>
          <div className="onboarding-benefit">
            <CheckCircle2 className="onboarding-benefit__icon" />
            <span>Gestión de Pedidos y Calendario</span>
          </div>
        </div>

        {/* Pricing Section Wrapper */}
        <div className="onboarding-plans-wrapper">
          <PricingSection />
        </div>

        {/* Footer / Skip */}
        <div className="onboarding-footer">
          <button 
            className="onboarding-btn-skip" 
            onClick={handleContinueFree}
            disabled={loading}
          >
            {loading ? 'Cargando...' : (
              <>
                Continuar con el Plan Gratuito
                <ChevronRight size={18} />
              </>
            )}
          </button>
          <p className="onboarding-footer-note">
            Podés cambiar tu plan en cualquier momento desde la configuración.
          </p>
        </div>
      </div>
    </div>
  );
};
