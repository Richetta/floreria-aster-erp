import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowUpRight, Check, X } from 'lucide-react';
import './UsageWarning.css';

// ============================================
// TYPES
// ============================================

interface UsageLimit {
  current: number;
  max: number | null; // null = unlimited
}

interface UsageData {
  users: UsageLimit;
  products: UsageLimit;
  orders: UsageLimit;
  categories: UsageLimit;
}

interface SubscriptionInfo {
  plan_slug: string;
  plan_name: string;
  status: string;
  trial_ends_at?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
}

// ============================================
// API FUNCTIONS
// ============================================

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_URL = import.meta.env.PROD
  ? '/api'
  : (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`);

async function fetchUsage(): Promise<UsageData | null> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch(`${API_URL}/subscription/usage`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.limits || null;
  } catch (error) {
    console.error('Error fetching usage:', error);
    return null;
  }
}

async function fetchSubscription(): Promise<SubscriptionInfo | null> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch(`${API_URL}/subscription/current`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
}

// ============================================
// USAGE BAR COMPONENT
// ============================================

interface UsageBarProps {
  label: string;
  icon: string;
  current: number;
  max: number | null;
  warningThreshold?: number;
  onUpgradeClick?: () => void;
}

const UsageBar = ({ 
  label, 
  icon, 
  current, 
  max, 
  warningThreshold = 80,
  onUpgradeClick 
}: UsageBarProps) => {
  // Unlimited
  if (max === null || max === undefined) {
    return (
      <div className="usage-bar usage-bar--unlimited">
        <div className="usage-bar__header">
          <span className="usage-bar__icon">{icon}</span>
          <span className="usage-bar__label">{label}</span>
          <span className="usage-bar__value">Ilimitado</span>
        </div>
        <div className="usage-bar__track usage-bar__track--full">
          <div className="usage-bar__fill usage-bar__fill--unlimited" />
        </div>
      </div>
    );
  }

  const percentage = Math.min((current / max) * 100, 100);
  const isWarning = percentage >= warningThreshold && percentage < 100;
  const isOver = percentage >= 100;
  
  let variant = 'normal';
  if (isOver) variant = 'error';
  else if (isWarning) variant = 'warning';

  return (
    <div className={`usage-bar usage-bar--${variant}`}>
      <div className="usage-bar__header">
        <span className="usage-bar__icon">{icon}</span>
        <span className="usage-bar__label">{label}</span>
        <span className="usage-bar__value">
          {current} / {max}
        </span>
      </div>
      <div className="usage-bar__track">
        <div 
          className={`usage-bar__fill usage-bar__fill--${variant}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isWarning && (
        <div className="usage-bar__warning">
          <AlertTriangle size={14} />
          <span>¡Casi llegás al límite!</span>
        </div>
      )}
      {isOver && (
        <div className="usage-bar__error">
          <X size={14} />
          <span>Límite alcanzado</span>
          <button className="usage-bar__upgrade-btn" onClick={onUpgradeClick}>
            <ArrowUpRight size={14} />
            Cambiar de plan
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// TRIAL BANNER COMPONENT
// ============================================

interface TrialBannerProps {
  trialEndsAt: string;
  planName: string;
  onUpgradeClick: () => void;
}

const TrialBanner = ({ trialEndsAt, planName, onUpgradeClick }: TrialBannerProps) => {
  const endDate = new Date(trialEndsAt);
  const now = new Date();
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft <= 0) {
    return (
      <div className="trial-banner trial-banner--expired">
        <div className="trial-banner__content">
          <AlertTriangle size={20} />
          <div className="trial-banner__text">
            <strong>Tu prueba de 14 días ha terminado</strong>
            <p>Elegí un plan para seguir usando todas las funciones</p>
          </div>
          <button className="trial-banner__btn" onClick={onUpgradeClick}>
            Ver Planes
          </button>
        </div>
      </div>
    );
  }

  if (daysLeft <= 3) {
    return (
      <div className="trial-banner trial-banner--urgent">
        <div className="trial-banner__content">
          <AlertTriangle size={20} />
          <div className="trial-banner__text">
            <strong>Tu prueba gratuita termina en {daysLeft} {daysLeft === 1 ? 'día' : 'días'}</strong>
            <p>Pasá al plan {planName} para no perder acceso</p>
          </div>
          <button className="trial-banner__btn trial-banner__btn--urgent" onClick={onUpgradeClick}>
            Comenzar Prueba de 14 Días
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trial-banner">
      <div className="trial-banner__content">
        <Check size={20} />
        <div className="trial-banner__text">
          <strong>Estás en período de prueba · {daysLeft} días restantes</strong>
          <p>Disfrutá todas las funciones del plan {planName} gratis</p>
        </div>
        <button className="trial-banner__btn" onClick={onUpgradeClick}>
          Suscribirse Ahora
        </button>
      </div>
    </div>
  );
};

// ============================================
// CANCELLATION BANNER
// ============================================

interface CancellationBannerProps {
  periodEnd: string;
  onReactivate: () => void;
}

const CancellationBanner = ({ periodEnd, onReactivate }: CancellationBannerProps) => {
  const endDate = new Date(periodEnd);
  const formatted = endDate.toLocaleDateString('es-AR', { 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="trial-banner trial-banner--cancelled">
      <div className="trial-banner__content">
        <AlertTriangle size={20} />
        <div className="trial-banner__text">
          <strong>Suscripción cancelada</strong>
          <p>Tenés acceso hasta el {formatted}. ¿Querés reactivarla?</p>
        </div>
        <button className="trial-banner__btn" onClick={onReactivate}>
          Reactivar
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN USAGE DASHBOARD COMPONENT
// ============================================

interface UsageDashboardProps {
  compact?: boolean;
  onUpgradeClick?: () => void;
}

export const UsageDashboard = ({ compact = false, onUpgradeClick }: UsageDashboardProps) => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchUsage(), fetchSubscription()]).then(([usageData, subData]) => {
      setUsage(usageData);
      setSubscription(subData);
      setLoading(false);
    });
  }, []);

  const handleUpgradeClick = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Store selected plan and redirect
      localStorage.setItem('upgrade_flow', 'true');
      window.location.href = '/login?upgrade=true';
    }
  };

  const handleReactivate = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      await fetch(`${API_URL}/subscription/reactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Refresh data
      const subData = await fetchSubscription();
      setSubscription(subData);
    } catch (error) {
      console.error('Error reactivating:', error);
    }
  };

  if (loading) {
    return (
      <div className="usage-dashboard usage-dashboard--loading">
        <div className="usage-dashboard__spinner" />
        <span>Cargando uso...</span>
      </div>
    );
  }

  // No subscription info
  if (!subscription) {
    return null;
  }

  return (
    <div className={`usage-dashboard ${compact ? 'usage-dashboard--compact' : ''}`}>
      {/* Trial Banner */}
      {subscription.status === 'trial' && subscription.trial_ends_at && (
        <TrialBanner
          trialEndsAt={subscription.trial_ends_at}
          planName={subscription.plan_name}
          onUpgradeClick={handleUpgradeClick}
        />
      )}

      {/* Cancellation Banner */}
      {subscription.cancel_at_period_end && subscription.current_period_end && (
        <CancellationBanner
          periodEnd={subscription.current_period_end}
          onReactivate={handleReactivate}
        />
      )}

      {/* Usage Bars */}
      {usage && !compact && (
        <div className="usage-dashboard__content">
          <div className="usage-dashboard__header">
            <h3>Uso del Plan</h3>
            <span className="usage-dashboard__plan-badge">
              {subscription.plan_name}
            </span>
          </div>
          <div className="usage-dashboard__bars">
            <UsageBar
              label="Usuarios"
              icon="👤"
              current={usage.users.current}
              max={usage.users.max}
              onUpgradeClick={handleUpgradeClick}
            />
            <UsageBar
              label="Productos"
              icon="📦"
              current={usage.products.current}
              max={usage.products.max}
              onUpgradeClick={handleUpgradeClick}
            />
            <UsageBar
              label="Pedidos este mes"
              icon="🛒"
              current={usage.orders.current}
              max={usage.orders.max}
              onUpgradeClick={handleUpgradeClick}
            />
            <UsageBar
              label="Categorías"
              icon="🏷️"
              current={usage.categories.current}
              max={usage.categories.max}
              onUpgradeClick={handleUpgradeClick}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MINI USAGE WIDGET (for sidebar/dashboard)
// ============================================

interface MiniUsageWidgetProps {
  onUpgradeClick?: () => void;
}

export const MiniUsageWidget = ({ onUpgradeClick }: MiniUsageWidgetProps) => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    Promise.all([fetchUsage(), fetchSubscription()]).then(([usageData, subData]) => {
      setUsage(usageData);
      setSubscription(subData);
    });
  }, []);

  if (!usage || !subscription) return null;

  // Find the most critical limit
  const limits = [
    { label: 'Usuarios', ...usage.users },
    { label: 'Productos', ...usage.products },
    { label: 'Pedidos', ...usage.orders },
    { label: 'Categorías', ...usage.categories },
  ];

  const critical = limits
    .filter(l => l.max !== null && l.max !== undefined)
    .sort((a, b) => {
      const pctA = (a.current / a.max!) * 100;
      const pctB = (b.current / b.max!) * 100;
      return pctB - pctA;
    })[0];

  if (!critical || critical.max === null) return null;

  const percentage = (critical.current / critical.max) * 100;
  const isWarning = percentage >= 80;
  const isOver = percentage >= 100;

  return (
    <div className={`mini-usage-widget ${isOver ? 'mini-usage-widget--error' : isWarning ? 'mini-usage-widget--warning' : ''}`}>
      <div className="mini-usage-widget__header">
        <span className="mini-usage-widget__label">{critical.label}</span>
        <span className="mini-usage-widget__value">
          {critical.current}/{critical.max}
        </span>
      </div>
      <div className="mini-usage-widget__track">
        <div 
          className={`mini-usage-widget__fill ${
            isOver ? 'mini-usage-widget__fill--error' : isWarning ? 'mini-usage-widget__fill--warning' : ''
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {isWarning && !isOver && (
        <div className="mini-usage-widget__alert">
          <AlertTriangle size={12} />
          <span>80% usado</span>
        </div>
      )}
      {isOver && (
        <button 
          className="mini-usage-widget__upgrade"
          onClick={onUpgradeClick || (() => window.location.href = '/login?upgrade=true')}
        >
          <ArrowUpRight size={12} />
          Cambiar de plan
        </button>
      )}
    </div>
  );
};

// Export all components
export { UsageBar, TrialBanner };
