import { useState, useEffect } from 'react';
import React from 'react';
import {
    Check, X, ArrowUpRight, CreditCard, Calendar, Shield,
    AlertTriangle, Loader2, Star, Zap, Crown, Leaf
} from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import './SubscriptionTab.css';

// ============================================
// TYPES
// ============================================

interface PlanFeature {
    feature: string;
    semilla: boolean | string;
    florecer: boolean | string;
    crecimiento: boolean | string;
    jardin: boolean | string;
}

interface Plan {
    slug: string;
    name: string;
    name_short: string;
    description: string;
    price_monthly: number;
    price_annually: number;
    max_users: number | null;
    max_products: number | null;
    max_orders_per_month: number | null;
    max_categories: number | null;
    features: Record<string, any>;
    badge_text: string | null;
}

interface SubscriptionData {
    id: string;
    status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
    billing_cycle: 'monthly' | 'annually';
    current_period_start: string;
    current_period_end: string;
    trial_ends_at: string | null;
    cancel_at_period_end: boolean;
    locked_price_monthly: number | null;
    locked_price_annually: number | null;
    orders_this_month: number;
    plan_slug: string;
    plan_name: string;
    plan_full_name: string;
    plan_description: string;
    price_monthly: number;
    price_annually: number;
    max_users: number | null;
    max_products: number | null;
    max_orders_per_month: number | null;
    max_categories: number | null;
    features: Record<string, any>;
    current_users: number;
    current_products: number;
    current_categories: number;
    current_orders: number;
}

// ============================================
// CONSTANTS
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const planIcons: Record<string, any> = {
    semilla: Leaf,
    florecer: Star,
    crecimiento: Zap,
    jardin: Crown
};

// ============================================
// MAIN COMPONENT
// ============================================

export const SubscriptionTab = () => {
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [showPlans, setShowPlans] = useState(false);
    const { alertModal, confirmModal, showAlert, showConfirm } = useModal();

    // Load subscription and plans
    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/subscription/current`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            }),
            fetch(`${API_URL}/subscription/plans`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            })
        ]).then(async ([subRes, plansRes]) => {
            const subData = await subRes.json();
            const plansData = await plansRes.json();

            if (subData.success) setSubscription(subData.data);
            if (plansData.success) setPlans(plansData.data);
            setLoading(false);
        }).catch(err => {
            console.error('Error loading subscription:', err);
            setLoading(false);
        });
    }, []);

    // Handle upgrade
    const handleUpgrade = async (planSlug: string, billingCycle: 'monthly' | 'annually' = 'monthly') => {
        const confirmed = await showConfirm({
            title: '¿Cambiar de plan?',
            message: `¿Estás seguro que querés cambiar al plan ${planSlug}? Se aplicará inmediatamente.`,
            confirmText: 'Confirmar cambio',
            variant: 'warning'
        });

        if (!confirmed) return;

        setUpgrading(true);
        try {
            const response = await fetch(`${API_URL}/subscription/upgrade`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan_slug: planSlug, billing_cycle: billingCycle }),
            });

            const data = await response.json();

            if (data.success) {
                showAlert({
                    title: '¡Plan actualizado!',
                    message: `Ahora estás en el plan ${data.data.plan.name_short}. Disfrutá las nuevas funciones.`,
                    variant: 'success'
                });
                setShowPlans(false);
                // Reload subscription
                const subRes = await fetch(`${API_URL}/subscription/current`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                const subData = await subRes.json();
                if (subData.success) setSubscription(subData.data);
            } else {
                throw new Error(data.error || 'Error al actualizar');
            }
        } catch (error: any) {
            showAlert({
                title: 'Error',
                message: error.message || 'No se pudo actualizar el plan',
                variant: 'error'
            });
        } finally {
            setUpgrading(false);
        }
    };

    // Handle cancel
    const handleCancel = async () => {
        const confirmed = await showConfirm({
            title: '¿Cancelar suscripción?',
            message: 'Perderás acceso al final del período pagado. ¿Estás seguro?',
            confirmText: 'Sí, cancelar',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/subscription/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: 'Desde settings' }),
            });

            const data = await response.json();

            if (data.success) {
                showAlert({
                    title: 'Suscripción cancelada',
                    message: `Mantenés acceso hasta ${new Date(data.data.access_until).toLocaleDateString('es-AR')}`,
                    variant: 'info'
                });
                const subRes = await fetch(`${API_URL}/subscription/current`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                const subData = await subRes.json();
                if (subData.success) setSubscription(subData.data);
            }
        } catch (error: any) {
            showAlert({
                title: 'Error',
                message: error.message || 'No se pudo cancelar',
                variant: 'error'
            });
        }
    };

    // Format currency
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    // Format usage percentage
    const usagePercent = (current: number, max: number | null) => {
        if (!max) return 100;
        return Math.min((current / max) * 100, 100);
    };

    if (loading) {
        return (
            <div className="subscription-loading">
                <Loader2 size={32} className="spinner" />
                <span>Cargando información de suscripción...</span>
            </div>
        );
    }

    if (!subscription) {
        return (
            <div className="subscription-error">
                <AlertTriangle size={48} />
                <h3>No se encontró información de suscripción</h3>
                <p>Contactá a soporte para más detalles</p>
            </div>
        );
    }

    const isTrial = subscription.status === 'trial';
    const isCancelled = subscription.cancel_at_period_end;
    const currentPlan = plans.find(p => p.slug === subscription.plan_slug);

    return (
        <div className="subscription-tab">
            {/* Current Plan Header */}
            <div className="subscription-header">
                <div className="subscription-header__icon">
                    {planIcons[subscription.plan_slug] ? React.createElement(planIcons[subscription.plan_slug], { size: 40 }) : <CreditCard size={40} />}
                </div>
                <div className="subscription-header__info">
                    <div className="subscription-header__badges">
                        <h3>{subscription.plan_name}</h3>
                        {isTrial && <span className="badge badge--trial">Período de Prueba</span>}
                        {isCancelled && <span className="badge badge--cancelled">Cancelada</span>}
                        {!isTrial && !isCancelled && <span className="badge badge--active">Activa</span>}
                    </div>
                    <p className="subscription-header__desc">{subscription.plan_description}</p>
                </div>
                <div className="subscription-header__price">
                    <div className="price-amount">
                        {subscription.locked_price_monthly
                            ? formatPrice(subscription.locked_price_monthly)
                            : formatPrice(subscription.price_monthly)
                        }
                        <span className="price-period">/mes</span>
                    </div>
                    {subscription.locked_price_monthly && (
                        <div className="price-locked">
                            <Shield size={12} />
                            <span>Precio congelado</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Usage Section */}
            <div className="subscription-usage">
                <h4>Uso del Plan</h4>
                <div className="usage-grid">
                    <UsageItem
                        label="Usuarios"
                        current={subscription.current_users}
                        max={subscription.max_users}
                        icon="👤"
                    />
                    <UsageItem
                        label="Productos"
                        current={subscription.current_products}
                        max={subscription.max_products}
                        icon="📦"
                    />
                    <UsageItem
                        label="Pedidos este mes"
                        current={subscription.current_orders}
                        max={subscription.max_orders_per_month}
                        icon="🛒"
                    />
                    <UsageItem
                        label="Categorías"
                        current={subscription.current_categories}
                        max={subscription.max_categories}
                        icon="🏷️"
                    />
                </div>
            </div>

            {/* Period Info */}
            <div className="subscription-period">
                <Calendar size={18} />
                <div>
                    <strong>Período actual:</strong>
                    <span> {new Date(subscription.current_period_start).toLocaleDateString('es-AR')} - {new Date(subscription.current_period_end).toLocaleDateString('es-AR')}</span>
                </div>
                <div className="subscription-billing-info">
                    Facturación: {subscription.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}
                </div>
            </div>

            {/* Actions */}
            <div className="subscription-actions">
                {!showPlans ? (
                    <>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => setShowPlans(true)}
                            disabled={upgrading}
                        >
                            <ArrowUpRight size={18} />
                            {subscription.plan_slug === 'semilla' ? 'Elegir un Plan' : 'Cambiar de Plan'}
                        </button>
                        {!isTrial && !isCancelled && subscription.plan_slug !== 'semilla' && (
                            <button
                                className="btn btn-danger btn-lg"
                                onClick={handleCancel}
                            >
                                <X size={18} />
                                Cancelar Suscripción
                            </button>
                        )}
                    </>
                ) : (
                    <button
                        className="btn btn-secondary btn-lg"
                        onClick={() => setShowPlans(false)}
                    >
                        ← Volver a mi plan
                    </button>
                )}
            </div>

            {/* Plans Comparison */}
            {showPlans && plans.length > 0 && (
                <div className="plans-comparison">
                    <h4>Comparativa de Planes</h4>
                    <div className="plans-grid">
                        {plans.map(plan => {
                            const isCurrent = plan.slug === subscription.plan_slug;
                            const Icon = planIcons[plan.slug] || CreditCard;

                            return (
                                <div className={`plan-card ${isCurrent ? 'plan-card--current' : ''} ${plan.badge_text ? 'plan-card--highlighted' : ''}`} key={plan.slug}>
                                    {plan.badge_text && (
                                        <div className="plan-card__badge">{plan.badge_text}</div>
                                    )}
                                    {isCurrent && <div className="plan-card__current-badge">Tu Plan</div>}

                                    <div className="plan-card__header">
                                        <Icon size={28} />
                                        <h5>{plan.name_short}</h5>
                                    </div>

                                    <div className="plan-card__price">
                                        <div className="price">
                                            {plan.price_monthly === 0 ? 'GRATIS' : formatPrice(plan.price_monthly)}
                                            {plan.price_monthly > 0 && <span className="period">/mes</span>}
                                        </div>
                                        {plan.price_annually > 0 && (
                                            <div className="annual">
                                                {formatPrice(plan.price_annually)}/año
                                            </div>
                                        )}
                                    </div>

                                    <div className="plan-card__limits">
                                        <div className="limit">
                                            <span className="limit-value">{plan.max_users || '∞'}</span>
                                            <span className="limit-label">Usuarios</span>
                                        </div>
                                        <div className="limit">
                                            <span className="limit-value">{plan.max_products || '∞'}</span>
                                            <span className="limit-label">Productos</span>
                                        </div>
                                        <div className="limit">
                                            <span className="limit-value">{plan.max_orders_per_month || '∞'}</span>
                                            <span className="limit-label">Pedidos/mes</span>
                                        </div>
                                    </div>

                                    {!isCurrent && (
                                        <button
                                            className="plan-card__btn"
                                            onClick={() => handleUpgrade(plan.slug, 'monthly')}
                                            disabled={upgrading}
                                        >
                                            {upgrading ? <Loader2 size={16} className="spinner" /> : 'Elegir este Plan'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};

// ============================================
// USAGE ITEM COMPONENT
// ============================================

interface UsageItemProps {
    label: string;
    current: number;
    max: number | null;
    icon: string;
}

const UsageItem = ({ label, current, max, icon }: UsageItemProps) => {
    const percentage = max ? Math.min((current / max) * 100, 100) : 0;
    const isUnlimited = max === null || max === undefined;
    const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;
    const isOver = !isUnlimited && percentage >= 100;

    return (
        <div className={`usage-item ${isOver ? 'usage-item--error' : isWarning ? 'usage-item--warning' : ''}`}>
            <div className="usage-item__header">
                <span className="usage-item__icon">{icon}</span>
                <span className="usage-item__label">{label}</span>
                <span className="usage-item__value">
                    {isUnlimited ? '∞' : `${current} / ${max}`}
                </span>
            </div>
            {!isUnlimited && (
                <>
                    <div className="usage-item__track">
                        <div
                            className={`usage-item__fill ${isOver ? 'usage-item__fill--error' : isWarning ? 'usage-item__fill--warning' : ''}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    {isWarning && <div className="usage-item__warning">80% usado</div>}
                    {isOver && <div className="usage-item__error">Límite alcanzado</div>}
                </>
            )}
        </div>
    );
};
