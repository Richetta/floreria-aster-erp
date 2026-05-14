import { useState, useEffect } from 'react';
import React from 'react';
import {
    X, ArrowUpRight, CreditCard, Calendar, Shield,
    AlertTriangle, Loader2, Star, Zap, Crown, Leaf,
    CheckCircle, RefreshCw, ExternalLink, Clock,
    Users, Package, ShoppingCart, Tags
} from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal, AlertModal } from '../../components/ui/Modals';
import './SubscriptionTab.css';

// ============================================
// TYPES
// ============================================

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
    status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'free';
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
    mp_preapproval_id?: string;
}

interface MpStatus {
    mp_status: string;
    next_payment_date: string | null;
    payer_email: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 
    (window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : 'https://mijardin-erp-backend.onrender.com/api');

const planIcons: Record<string, any> = {
    semilla: Leaf,
    florecer: Star,
    crecimiento: Zap,
    jardin: Crown
};

const authHeader = () => ({
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    'Content-Type': 'application/json'
});

// ============================================
// MAIN COMPONENT
// ============================================

export const SubscriptionTab = () => {
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [mpStatus, setMpStatus] = useState<MpStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [showPlans, setShowPlans] = useState(false);
    const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'annually'>('monthly');
    const { alertModal, confirmModal, showAlert, showConfirm } = useModal();
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [subRes, plansRes, mpRes] = await Promise.all([
                fetch(`${API_URL}/subscription/current`, { headers: authHeader() }),
                fetch(`${API_URL}/subscription/plans`, { headers: authHeader() }),
                fetch(`${API_URL}/subscription/mp-status`, { headers: authHeader() }),
            ]);

            // Check for non-200 responses
            if (!subRes.ok) {
                const errText = await subRes.text();
                console.error('Subscription Fetch Error:', subRes.status, errText);
                throw new Error(`Error ${subRes.status}: No se pudo obtener la suscripción`);
            }

            const [subData, plansData, mpData] = await Promise.all([
                subRes.json(), plansRes.json(), mpRes.json()
            ]);
            
            if (subData.success) setSubscription(subData.data);
            else throw new Error(subData.message || 'La respuesta del servidor no fue exitosa');

            if (plansData.success) setPlans(plansData.data);
            if (mpData.success && mpData.data) setMpStatus(mpData.data);
        } catch (err: any) {
            console.error('Error loading subscription:', err);
            setError(err.message || 'Error de conexión con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Handle checkout via MercadoPago
    const handleCheckout = async (planSlug: string, includeTrial = true) => {
        setUpgrading(true);
        try {
            const response = await fetch(`${API_URL}/subscription/create-checkout`, {
                method: 'POST',
                headers: authHeader(),
                body: JSON.stringify({
                    plan_slug: planSlug,
                    billing_cycle: selectedBilling,
                    include_trial: includeTrial
                }),
            });
            const data = await response.json();

            if (data.error === 'payment_not_configured') {
                showAlert({
                    title: 'Sistema de pagos en configuración',
                    message: 'El sistema de pagos está siendo configurado. Por ahora podés activar el plan directamente para probarlo.',
                    variant: 'info'
                });
                // Fallback: direct upgrade for testing
                await handleDirectUpgrade(planSlug);
                return;
            }

            if (!data.success || !data.data?.init_point) {
                throw new Error(data.message || 'No se pudo crear el enlace de pago');
            }

            // Redirect to MercadoPago
            window.location.href = data.data.init_point;
        } catch (error: any) {
            showAlert({
                title: 'Error al procesar el pago',
                message: error.message || 'No se pudo iniciar el proceso de pago',
                variant: 'error'
            });
        } finally {
            setUpgrading(false);
        }
    };

    // Activate free plan
    const handleActivateFree = async () => {
        setUpgrading(true);
        try {
            const response = await fetch(`${API_URL}/subscription/create-free`, {
                method: 'POST',
                headers: authHeader(),
            });
            const data = await response.json();
            if (data.success) {
                showAlert({ title: '¡Plan activado!', message: 'Ya estás usando el Plan Gratuito.', variant: 'success' });
                await loadData();
            }
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'No se pudo activar el plan', variant: 'error' });
        } finally {
            setUpgrading(false);
        }
    };

    // Direct upgrade (fallback / admin)
    const handleDirectUpgrade = async (planSlug: string) => {
        const response = await fetch(`${API_URL}/subscription/upgrade`, {
            method: 'POST',
            headers: authHeader(),
            body: JSON.stringify({ plan_slug: planSlug, billing_cycle: selectedBilling }),
        });
        const data = await response.json();
        if (data.success) {
            showAlert({ title: '¡Plan activado!', message: `Ahora estás en el plan ${data.data.plan.name_short}.`, variant: 'success' });
            setShowPlans(false);
            await loadData();
        } else {
            throw new Error(data.error || 'Error al actualizar');
        }
    };

    // Cancel subscription
    const handleCancel = async () => {
        const confirmed = await showConfirm({
            title: '¿Cancelar suscripción?',
            message: 'Se cancelará el débito automático. Mantenés el acceso hasta el final del período pagado.',
            confirmText: 'Sí, cancelar débito',
            variant: 'danger'
        });
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/subscription/cancel`, {
                method: 'POST',
                headers: authHeader(),
                body: JSON.stringify({ reason: 'Cancelado desde configuración' }),
            });
            const data = await response.json();
            if (data.success) {
                showAlert({
                    title: 'Débito cancelado',
                    message: `Mantenés acceso hasta ${new Date(data.data.access_until).toLocaleDateString('es-AR')}`,
                    variant: 'info'
                });
                await loadData();
            }
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'No se pudo cancelar', variant: 'error' });
        }
    };

    // Reactivate subscription
    const handleReactivate = async () => {
        try {
            const response = await fetch(`${API_URL}/subscription/reactivate`, {
                method: 'POST',
                headers: authHeader(),
            });
            const data = await response.json();
            if (data.success) {
                showAlert({ title: 'Suscripción reactivada', message: 'El débito automático fue reactivado.', variant: 'success' });
                await loadData();
            }
        } catch (error: any) {
            showAlert({ title: 'Error', message: 'No se pudo reactivar', variant: 'error' });
        }
    };

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(price);

    const getDaysLeft = (date: string | null) => {
        if (!date) return null;
        const diff = new Date(date).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
                <h3>No se pudo cargar la información</h3>
                <p>{error || 'Contactá a soporte para más detalles'}</p>
                <button className="btn btn-primary mt-4" onClick={loadData}>
                    <RefreshCw size={18} className="mr-2" />
                    Reintentar conexión
                </button>
            </div>
        );
    }

    const isFree = subscription.status === 'free' || subscription.plan_slug === 'semilla';
    const isTrial = subscription.status === 'trial';
    const isPastDue = subscription.status === 'past_due';
    const isCancelled = subscription.cancel_at_period_end;
    const trialDaysLeft = isTrial ? getDaysLeft(subscription.trial_ends_at) : null;
    const hasAutoDebit = !!subscription.mp_preapproval_id;

    return (
        <div className="subscription-tab">

            {/* Past Due Warning */}
            {isPastDue && (
                <div className="subscription-alert subscription-alert--error">
                    <AlertTriangle size={20} />
                    <div>
                        <strong>Pago rechazado</strong>
                        <p>Tu último pago no pudo procesarse. Por favor actualizá tu método de pago en MercadoPago para continuar.</p>
                    </div>
                </div>
            )}

            {/* Trial Banner */}
            {isTrial && trialDaysLeft !== null && (
                <div className={`subscription-alert ${trialDaysLeft <= 3 ? 'subscription-alert--warning' : 'subscription-alert--info'}`}>
                    <Clock size={20} />
                    <div>
                        <strong>Período de prueba activo</strong>
                        <p>
                            {trialDaysLeft > 0
                                ? `Te quedan ${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} de prueba gratis. Al vencer, se realizará el primer cobro automáticamente.`
                                : 'Tu período de prueba venció. El primer cobro se procesará próximamente.'
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Cancelled Warning */}
            {isCancelled && (
                <div className="subscription-alert subscription-alert--warning">
                    <AlertTriangle size={20} />
                    <div>
                        <strong>Débito automático cancelado</strong>
                        <p>
                            Mantenés acceso hasta el {new Date(subscription.current_period_end).toLocaleDateString('es-AR')}.
                            {' '}<button className="sub-link" onClick={handleReactivate}>Reactivar débito automático</button>
                        </p>
                    </div>
                </div>
            )}

            {/* Current Plan Header */}
            <div className="subscription-header">
                <div className="subscription-header__icon">
                    {planIcons[subscription.plan_slug]
                        ? React.createElement(planIcons[subscription.plan_slug], { size: 40 })
                        : <CreditCard size={40} />}
                </div>
                <div className="subscription-header__info">
                    <div className="subscription-header__badges">
                        <h3>{subscription.plan_name || subscription.plan_full_name}</h3>
                        {isTrial && <span className="badge badge--trial">Período de Prueba</span>}
                        {isCancelled && <span className="badge badge--cancelled">Cancelada</span>}
                        {isPastDue && <span className="badge badge--error">Pago Fallido</span>}
                        {!isTrial && !isCancelled && !isPastDue && subscription.status === 'active' && (
                            <span className="badge badge--active">Activa</span>
                        )}
                        {isFree && <span className="badge badge--free">Gratuito</span>}
                    </div>
                    <p className="subscription-header__desc">{subscription.plan_description}</p>
                </div>
                <div className="subscription-header__price">
                    <div className="price-amount">
                        {subscription.plan_slug === 'semilla' ? 'GRATIS' : (
                            <>
                                {formatPrice(subscription.locked_price_monthly || subscription.price_monthly)}
                                <span className="price-period">/mes</span>
                            </>
                        )}
                    </div>
                    {subscription.locked_price_monthly && (
                        <div className="price-locked">
                            <Shield size={12} />
                            <span>Precio congelado</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Auto-debit status */}
            {!isFree && (
                <div className="subscription-debit">
                    <div className="debit-status">
                        {hasAutoDebit ? (
                            <>
                                <CheckCircle size={16} className="debit-icon debit-icon--on" />
                                <span>Débito automático <strong>activado</strong></span>
                                {mpStatus?.next_payment_date && (
                                    <span className="debit-next">
                                        · Próximo cobro: {new Date(mpStatus.next_payment_date).toLocaleDateString('es-AR')}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <CreditCard size={16} className="debit-icon debit-icon--off" />
                                <span>Sin débito automático configurado</span>
                            </>
                        )}
                    </div>
                    {mpStatus?.payer_email && (
                        <div className="debit-email">Tarjeta vinculada a: {mpStatus.payer_email}</div>
                    )}
                </div>
            )}

            {/* Usage Section */}
            <div className="subscription-usage">
                <h4>Uso del Plan</h4>
                <div className="usage-grid">
                    <UsageItem label="Usuarios" current={subscription.current_users} max={subscription.max_users} icon={<Users size={18} />} />
                    <UsageItem label="Productos" current={subscription.current_products} max={subscription.max_products} icon={<Package size={18} />} />
                    <UsageItem label="Pedidos este mes" current={subscription.current_orders} max={subscription.max_orders_per_month} icon={<ShoppingCart size={18} />} />
                    <UsageItem label="Categorías" current={subscription.current_categories} max={subscription.max_categories} icon={<Tags size={18} />} />

                </div>
            </div>

            {/* Period Info */}
            {!isFree && (
                <div className="subscription-period">
                    <Calendar size={18} />
                    <div>
                        <strong>Período actual: </strong>
                        <span>
                            {new Date(subscription.current_period_start).toLocaleDateString('es-AR')} –{' '}
                            {new Date(subscription.current_period_end).toLocaleDateString('es-AR')}
                        </span>
                    </div>
                    <div className="subscription-billing-info">
                        Facturación: {subscription.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}
                    </div>
                </div>
            )}

            {/* Billing Cycle Toggle for plan selection */}
            {showPlans && (
                <div className="subscription-billing-toggle">
                    <button
                        className={`billing-btn ${selectedBilling === 'monthly' ? 'billing-btn--active' : ''}`}
                        onClick={() => setSelectedBilling('monthly')}
                    >
                        Mensual
                    </button>
                    <button
                        className={`billing-btn ${selectedBilling === 'annually' ? 'billing-btn--active' : ''}`}
                        onClick={() => setSelectedBilling('annually')}
                    >
                        Anual
                        <span className="billing-savings">Ahorrás 2 meses</span>
                    </button>
                </div>
            )}

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
                            {isFree ? 'Ver Planes con Prueba Gratis' : 'Cambiar de Plan'}
                        </button>
                        {!isFree && !isCancelled && !isTrial && (
                            <button className="btn btn-danger btn-lg" onClick={handleCancel}>
                                <X size={18} />
                                Cancelar Débito Automático
                            </button>
                        )}
                        {isCancelled && (
                            <button className="btn btn-secondary btn-lg" onClick={handleReactivate}>
                                <RefreshCw size={18} />
                                Reactivar Débito Automático
                            </button>
                        )}
                    </>
                ) : (
                    <button className="btn btn-secondary btn-lg" onClick={() => setShowPlans(false)}>
                        ← Volver a mi plan
                    </button>
                )}
            </div>

            {/* Plans Comparison */}
            {showPlans && plans.length > 0 && (
                <div className="plans-comparison">
                    <h4>Elegí el plan perfecto para tu florería</h4>
                    <p className="plans-comparison__note">
                        Manejá tu negocio con tranquilidad. Podés cambiar de plan o cancelar cuando quieras.
                        {selectedBilling === 'monthly'
                            ? <span className="plans-comparison__detail"><br/>Los primeros 15 días son gratis — no se cobra nada hasta que venza la prueba.</span>
                            : <span className="plans-comparison__detail"><br/>Pago anual con 2 meses de descuento. Se cobra inmediatamente por el año completo.</span>
                        }
                    </p>
                    <div className="plans-grid">
                        {plans.map(plan => {
                            const isCurrentPlan = plan.slug === subscription.plan_slug;
                            const isCurrentBilling = selectedBilling === subscription.billing_cycle;
                            const isCurrent = isCurrentPlan && isCurrentBilling;
                            
                            const Icon = planIcons[plan.slug] || CreditCard;
                            const monthlyEquiv = selectedBilling === 'annually' ? Math.round(plan.price_annually / 12) : plan.price_monthly;

                            return (
                                <div
                                    className={`plan-card ${isCurrent ? 'plan-card--current' : ''} ${plan.badge_text ? 'plan-card--highlighted' : ''}`}
                                    key={plan.slug}
                                >
                                    {plan.badge_text && <div className="plan-card__badge">{plan.badge_text}</div>}
                                    {isCurrent && <div className="plan-card__current-badge">Tu Plan Actual</div>}

                                    <div className="plan-card__header">
                                        <Icon size={28} />
                                        <h5>{plan.name_short}</h5>
                                    </div>

                                    <div className="plan-card__price">
                                        <div className="price">
                                            {Number(plan.price_monthly) === 0 ? 'GRATIS' : formatPrice(monthlyEquiv)}
                                            {Number(plan.price_monthly) > 0 && <span className="period">/mes</span>}
                                        </div>
                                        {Number(plan.price_annually) > 0 && selectedBilling === 'annually' && (
                                            <div className="annual">{formatPrice(plan.price_annually)}/año</div>
                                        )}
                                    </div>

                                    <div className="plan-card__limits">
                                        <div className="limit"><span className="limit-value">{plan.max_users || '∞'}</span><span className="limit-label">Usuarios</span></div>
                                        <div className="limit"><span className="limit-value">{plan.max_products || '∞'}</span><span className="limit-label">Productos</span></div>
                                        <div className="limit"><span className="limit-value">{plan.max_orders_per_month || '∞'}</span><span className="limit-label">Pedidos/mes</span></div>
                                    </div>

                                    {!isCurrent && (
                                        <div className="plan-card__actions">
                                            {Number(plan.price_monthly) === 0 ? (
                                                <button
                                                    className="plan-card__btn plan-card__btn--free"
                                                    onClick={handleActivateFree}
                                                    disabled={upgrading}
                                                >
                                                    {upgrading ? <Loader2 size={16} className="spinner" /> : 'Activar Plan Gratuito'}
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        className="plan-card__btn plan-card__btn--mp"
                                                        onClick={() => handleCheckout(plan.slug, selectedBilling === 'monthly')}
                                                        disabled={upgrading}
                                                    >
                                                        {upgrading ? <Loader2 size={16} className="spinner" /> : (
                                                            <>
                                                                <ExternalLink size={14} />
                                                                {isCurrentPlan ? `Cambiar a pago ${selectedBilling === 'monthly' ? 'mensual' : 'anual'}` : (selectedBilling === 'monthly' ? 'Probar 15 días gratis' : 'Elegir Plan Anual')}
                                                            </>
                                                        )}
                                                    </button>
                                                    <p className="plan-card__mp-note">Pagás seguro con MercadoPago</p>
                                                </>
                                            )}
                                        </div>
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

interface UsageItemProps { label: string; current: number; max: number | null; icon: React.ReactNode; }

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
                <span className="usage-item__value">{isUnlimited ? '∞' : `${current} / ${max}`}</span>
            </div>
            {!isUnlimited && (
                <>
                    <div className="usage-item__track">
                        <div
                            className={`usage-item__fill ${isOver ? 'usage-item__fill--error' : isWarning ? 'usage-item__fill--warning' : ''}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    {isWarning && <div className="usage-item__warning">⚠️ {Math.round(percentage)}% usado</div>}
                    {isOver && <div className="usage-item__error">Límite alcanzado</div>}
                </>
            )}
        </div>
    );
};
