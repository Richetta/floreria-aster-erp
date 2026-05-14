import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, X, AlertTriangle, Star, Crown } from 'lucide-react';
import { useSubscription } from '../../store/useSubscription';
import './UpgradeModal.css';

// ============================================
// UPGRADE MODAL
// Shown when user hits a plan limit or tries
// to access a feature not in their plan.
// ============================================

const NEXT_PLAN: Record<string, { slug: string; name: string; icon: React.ReactNode; price: string }> = {
  gratis: { slug: 'completo', name: 'Profesional Completo', icon: <Star size={24} />, price: '$45.000/mes' },
  completo: { slug: 'completo', name: 'Profesional Completo', icon: <Crown size={24} />, price: '$45.000/mes' },
};

export const UpgradeModal = () => {
  const { upgradeModalState, closeUpgradeModal, planSlug, planName } = useSubscription();
  const navigate = useNavigate();

  if (!upgradeModalState.open) return null;

  const { reason, blocked } = upgradeModalState;
  const nextPlan = NEXT_PLAN[planSlug] || NEXT_PLAN['semilla'];
  const isTopPlan = planSlug === 'jardin';

  const handleGoToSettings = () => {
    closeUpgradeModal();
    navigate('/bienvenido');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeUpgradeModal();
  };

  return (
    <div className="upgrade-modal-overlay" onClick={handleOverlayClick}>
      <div className="upgrade-modal">
        {/* Close button */}
        <button className="upgrade-modal__close" onClick={closeUpgradeModal}>
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="upgrade-modal__icon">
          <AlertTriangle size={32} />
        </div>

        {/* Content */}
        <div className="upgrade-modal__content">
          <h2 className="upgrade-modal__title">
            {blocked ? 'Límite de plan alcanzado' : 'Función no disponible'}
          </h2>
          <p className="upgrade-modal__reason">{reason}</p>

          {/* Limit bar if resource was blocked */}
          {blocked && (
            <div className="upgrade-modal__limit">
              <div className="upgrade-modal__limit-header">
                <span>Uso actual</span>
                <span>{blocked.current} / {blocked.max}</span>
              </div>
              <div className="upgrade-modal__limit-track">
                <div
                  className="upgrade-modal__limit-fill"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Current vs next plan */}
          {!isTopPlan && (
            <div className="upgrade-modal__plans">
              <div className="upgrade-modal__plan upgrade-modal__plan--current">
                <span className="upgrade-modal__plan-label">Tu plan actual</span>
                <span className="upgrade-modal__plan-name">{planName}</span>
              </div>
              <ArrowUpRight size={20} className="upgrade-modal__arrow" />
              <div className="upgrade-modal__plan upgrade-modal__plan--next">
                <span className="upgrade-modal__plan-label">Siguiente plan</span>
                <div className="upgrade-modal__plan-info">
                  {nextPlan.icon}
                  <span className="upgrade-modal__plan-name">{nextPlan.name}</span>
                </div>
                <span className="upgrade-modal__plan-price">{nextPlan.price}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="upgrade-modal__actions">
          {isTopPlan ? (
            <p className="upgrade-modal__top-plan">
              Ya estás en el plan máximo. Contactá a soporte para soluciones personalizadas.
            </p>
          ) : (
            <button className="upgrade-modal__btn-upgrade" onClick={handleGoToSettings}>
              <ArrowUpRight size={18} />
              Ver planes y actualizar
            </button>
          )}
          <button className="upgrade-modal__btn-cancel" onClick={closeUpgradeModal}>
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
};
