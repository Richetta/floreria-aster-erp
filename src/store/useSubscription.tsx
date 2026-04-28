import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ============================================
// TYPES
// ============================================

export interface PlanLimits {
  users: { current: number; max: number | null };
  products: { current: number; max: number | null };
  orders: { current: number; max: number | null };
  categories: { current: number; max: number | null };
}

export interface SubscriptionState {
  planSlug: string;
  planName: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'free';
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits | null;
  isLoading: boolean;
  // Feature flags derived from plan
  features: {
    reports: boolean;
    cashRegister: boolean;
    waste: boolean;
    barcode: boolean;
    calendar: boolean;
    logistics: boolean;
    reminders: boolean;
    exportCsv: boolean;
    importProducts: boolean;
    ocr: boolean;
    packages: boolean;
    purchases: boolean;
    restock: boolean;
    stockMovements: boolean;
    crmFull: boolean;
    multiBranch: boolean;
    apiAccess: boolean;
  };
}

interface BlockedAction {
  resource: 'products' | 'orders' | 'users' | 'categories';
  current: number;
  max: number;
}

interface SubscriptionContextType extends SubscriptionState {
  refresh: () => Promise<void>;
  checkLimit: (resource: keyof PlanLimits) => BlockedAction | null;
  showUpgradeModal: (reason?: string, blocked?: BlockedAction | null) => void;
  upgradeModalState: { open: boolean; reason: string; blocked: BlockedAction | null };
  closeUpgradeModal: () => void;
}

// ============================================
// PLAN FEATURE FLAGS
// ============================================

const PLAN_FEATURES: Record<string, SubscriptionState['features']> = {
  gratis: {
    reports: false, cashRegister: false, waste: false, barcode: true,
    calendar: false, logistics: false, reminders: false, exportCsv: false,
    importProducts: false, ocr: false, packages: false, purchases: false,
    restock: false, stockMovements: false, crmFull: false,
    multiBranch: false, apiAccess: false,
  },
  completo: {
    reports: true, cashRegister: true, waste: true, barcode: true,
    calendar: true, logistics: true, reminders: true, exportCsv: true,
    importProducts: true, ocr: true, packages: true, purchases: true,
    restock: true, stockMovements: true, crmFull: true,
    multiBranch: true, apiAccess: true,
  },
};

// Legacy mapping for compatibility with old slugs
const SLUG_MAP: Record<string, string> = {
  semilla: 'gratis',
  florecer: 'completo',
  crecimiento: 'completo',
  jardin: 'completo',
};


const DEFAULT_FEATURES = PLAN_FEATURES['completo']; // Permissive default during loading

// ============================================
// CONTEXT
// ============================================

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ============================================
// PROVIDER
// ============================================

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SubscriptionState>({
    planSlug: 'semilla',
    planName: 'Semilla',
    status: 'free',
    trialEndsAt: null,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    limits: null,
    isLoading: true,
    features: DEFAULT_FEATURES,
  });

  const [upgradeModalState, setUpgradeModalState] = useState<{
    open: boolean;
    reason: string;
    blocked: BlockedAction | null;
  }>({ open: false, reason: '', blocked: null });

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setState(s => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const [subRes, usageRes] = await Promise.all([
        fetch(`${API_URL}/subscription/current`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/subscription/usage`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const subData = subRes.ok ? await subRes.json() : null;
      const usageData = usageRes.ok ? await usageRes.json() : null;

      const sub = subData?.data;
      const usage = usageData?.data?.limits;

      if (sub) {
        const normalizedSlug = SLUG_MAP[sub.slug] || sub.slug || 'gratis';
        setState({
          planSlug: normalizedSlug,
          planName: sub.plan_name || sub.name_short || (normalizedSlug === 'gratis' ? 'Gratis' : 'Profesional Completo'),
          status: sub.status || 'free',
          trialEndsAt: sub.trial_ends_at || null,
          periodEnd: sub.current_period_end || null,
          cancelAtPeriodEnd: sub.cancel_at_period_end || false,
          limits: usage || null,
          isLoading: false,
          features: PLAN_FEATURES[normalizedSlug] || PLAN_FEATURES['gratis'],
        });
      } else {
        setState(s => ({ ...s, isLoading: false }));
      }
    } catch (err) {
      console.error('[SubscriptionProvider] fetch error:', err);
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const checkLimit = useCallback(
    (resource: keyof PlanLimits): BlockedAction | null => {
      if (!state.limits) return null;
      const limit = state.limits[resource];
      if (limit.max === null || limit.max === undefined) return null; // unlimited
      if (limit.current >= limit.max) {
        return { resource, current: limit.current, max: limit.max };
      }
      return null;
    },
    [state.limits]
  );

  const showUpgradeModal = useCallback(
    (reason = 'Necesitás un plan superior para usar esta función.', blocked: BlockedAction | null = null) => {
      setUpgradeModalState({ open: true, reason, blocked });
    },
    []
  );

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalState({ open: false, reason: '', blocked: null });
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        refresh: fetchData,
        checkLimit,
        showUpgradeModal,
        upgradeModalState,
        closeUpgradeModal,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return ctx;
};

// ============================================
// GUARD HOOK — call before creating a resource
// Returns { allowed: boolean, block: () => void }
// ============================================

export const usePlanGuard = (resource: keyof PlanLimits) => {
  const { checkLimit, showUpgradeModal } = useSubscription();

  const guard = useCallback(
    (onAllowed: () => void) => {
      const blocked = checkLimit(resource);
      if (blocked) {
        const labels: Record<string, string> = {
          products: 'productos',
          orders: 'pedidos',
          users: 'usuarios',
          categories: 'categorías',
        };
        showUpgradeModal(
          `Alcanzaste el límite de ${labels[resource] || resource} de tu plan actual (${blocked.max} máximo). Actualizá tu plan para continuar.`,
          blocked
        );
        return false;
      }
      onAllowed();
      return true;
    },
    [resource, checkLimit, showUpgradeModal]
  );

  return { guard };
};

// ============================================
// FEATURE GUARD HOOK — check if feature is enabled in plan
// ============================================

export const useFeatureGuard = () => {
  const { features, planSlug, showUpgradeModal } = useSubscription();

  const requireFeature = useCallback(
    (feature: keyof SubscriptionState['features'], onAllowed: () => void) => {
      if (features[feature]) {
        onAllowed();
        return true;
      }

      const featureNames: Record<string, string> = {
        reports: 'Reportes completos',
        cashRegister: 'Caja diaria',
        waste: 'Gestión de mermas',
        barcode: 'Código de barras',
        calendar: 'Calendario de pedidos',
        logistics: 'Logística de entregas',
        reminders: 'Recordatorios automáticos',
        exportCsv: 'Exportación CSV',
        importProducts: 'Importación de productos',
        ocr: 'OCR de listas de precios',
        packages: 'Paquetes y Ramos',
        purchases: 'Compras a proveedores',
        restock: 'Reposición automática',
        stockMovements: 'Auditoría de stock',
        crmFull: 'CRM completo',
        afip: 'Facturación AFIP',
        mercadopago: 'Integración MercadoPago',
        multiBranch: 'Multi-sucursal',
        apiAccess: 'API Access',
      };

      showUpgradeModal(
        `"${featureNames[feature] || feature}" no está disponible en tu plan actual (${planSlug}). Actualizá para acceder a esta función.`
      );
      return false;
    },
    [features, planSlug, showUpgradeModal]
  );

  return { requireFeature, features };
};

// ============================================
// FEATURE ROUTE GUARD
// ============================================

import { Navigate } from 'react-router-dom';

export const FeatureRouteGuard = ({ 
  feature, 
  children 
}: { 
  feature: keyof SubscriptionState['features']; 
  children: ReactNode 
}) => {
  const { features, planSlug, showUpgradeModal } = useSubscription();

  if (!features[feature]) {
    // Show modal on next tick to avoid React warning during render
    setTimeout(() => {
      showUpgradeModal(`Esta sección no está disponible en tu plan actual (${planSlug}).`);
    }, 0);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
