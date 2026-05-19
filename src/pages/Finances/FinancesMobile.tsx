import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { useNavigate } from 'react-router-dom';
import { AlertModal } from '../../components/ui/Modals';
import { api, type WasteLog } from '../../services/api';
import { analyzeFinances } from './utils/financesAnalyzer';
import './FinancesMobile.css';

export const FinancesMobile = () => {
    const navigate = useNavigate();
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const orders = useStore((state) => state.orders) || [];
    const products = useStore((state) => state.products) || [];
    const addTransaction = useStore((state) => state.addTransaction);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadOrders = useStore((state) => state.loadOrders);
    const shopInfo = useStore((state) => state.shopInfo);
    const packages = useStore((state) => state.packages);

    // --- COCKPIT STATES ---
    const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
    const [monthlyGoal] = useState<number>(() => {
        const stored = localStorage.getItem('finances_monthly_goal');
        return stored ? parseFloat(stored) : 1500000;
    });
    const [fixedCosts] = useState<number>(() => {
        const stored = localStorage.getItem('finances_fixed_costs');
        return stored ? parseFloat(stored) : 350000;
    });
    const [showExpenseSheet, setShowExpenseSheet] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mobileTab, setMobileTab] = useState<'control' | 'history'>('control');
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: shopInfo.paymentMethods?.[0]?.name || 'cash'
    });

    const { alertModal, showAlert } = useModal();

    useEffect(() => {
        const loadData = async () => {
            try {
                await Promise.allSettled([
                    loadTransactions(), 
                    loadCustomers(),
                    loadOrders ? loadOrders() : Promise.resolve()
                ]);
                const logs = await api.getWasteLogs({ limit: 50 });
                setWasteLogs(logs || []);
            } catch (err) {
                console.error('[FINANCES MOBILE LOAD ERROR]', err);
            }
        };
        loadData();
    }, []);

    // --- BUSINESS INTELLIGENCE CALCULATIONS ---
    const analytics = useMemo(() => {
        return analyzeFinances(transactions, orders, products, customers, wasteLogs, fixedCosts);
    }, [transactions, orders, products, customers, wasteLogs, fixedCosts]);

    const goalPercentage = Math.min(100, Math.round((analytics.totalIncome / monthlyGoal) * 100));

    // --- NATURAL LANGUAGE COGNITIVE DIAGNOSIS (Apple Health Style) ---
    const healthDiagnosis = useMemo(() => {
        const balance = analytics.netBalance;
        if (balance > 100000) {
            return `¡Excelente! Tus ingresos superan tus gastos por ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(balance)} este mes. El ticket promedio ronda los ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(analytics.ticketPromedio)}.`;
        } else if (balance >= 0) {
            return `Tus finanzas están estables. Balance positivo de ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(balance)}. Sugerimos activar deudores para robustecer caja.`;
        } else {
            return `Alerta: Registras un saldo negativo temporal de ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Math.abs(balance))}. Revisa el dinero inmovilizado y los gastos operativos.`;
        }
    }, [analytics]);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(expenseForm.amount);
        if (!amt || amt <= 0) return;

        await addTransaction({
            id: generateIdWithPrefix('t'),
            type: 'expense',
            amount: amt,
            category: expenseForm.category,
            description: expenseForm.description || 'Gasto Operativo',
            method: expenseForm.method,
            date: new Date().toISOString()
        });

        setShowExpenseSheet(false);
        setExpenseForm({ amount: '', category: 'Insumos', description: '', method: shopInfo.paymentMethods?.[0]?.name || 'cash' });
        loadTransactions();
        showAlert({ title: 'Gasto registrado', message: 'Se ha asentado el movimiento correctamente.', variant: 'success' });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="finances-mobile-wrapper">
            {/* Header */}
            <header className="mobile-finances-header">
                <div className="finances-header-top">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2>Cockpit Finanzas</h2>
                        <span className="mobile-subtitle">Control estratégico en vivo</span>
                    </div>
                    <button className="add-expense-btn" onClick={() => setShowExpenseSheet(true)}>
                        <span className="material-symbols-rounded">add</span>
                        Gasto
                    </button>
                </div>

                {/* Sub Tab Navigation */}
                <div className="mobile-tabs-container">
                    <button 
                        className={`m-tab-btn ${mobileTab === 'control' ? 'active' : ''}`}
                        onClick={() => setMobileTab('control')}
                    >
                        <span className="material-symbols-rounded">analytics</span>
                        Salud del Local
                    </button>
                    <button 
                        className={`m-tab-btn ${mobileTab === 'history' ? 'active' : ''}`}
                        onClick={() => setMobileTab('history')}
                    >
                        <span className="material-symbols-rounded">receipt_long</span>
                        Movimientos
                    </button>
                </div>
            </header>

            <div className="finances-scroll-content">
                {mobileTab === 'control' ? (
                    <>
                        {/* Apple Health style Diagnosis card */}
                        <section className="m-diagnosis-card">
                            <div className="diag-header">
                                <span className="material-symbols-rounded spark-icon">spark</span>
                                <h3>DIAGNÓSTICO COMERCIAL</h3>
                            </div>
                            <p className="diag-text">{healthDiagnosis}</p>
                            <div className="diag-footer">
                                <span>Estación: {analytics.seasonality.currentSeasonName}</span>
                            </div>
                        </section>

                        {/* Balance Hero */}
                        <section className="finances-hero-card">
                            <div className="hero-main">
                                <span className="hero-label">Balance Neto Real</span>
                                <h2 className={`hero-val ${analytics.netBalance >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(analytics.netBalance)}</h2>
                            </div>
                            <div className="hero-grid">
                                <div className="h-stat">
                                    <span className="h-stat-label">Ingresos</span>
                                    <span className="h-stat-val pos">{formatCurrency(analytics.totalIncome)}</span>
                                </div>
                                <div className="h-stat">
                                    <span className="h-stat-label">Egresos</span>
                                    <span className="h-stat-val neg">{formatCurrency(analytics.totalExpense)}</span>
                                </div>
                            </div>
                        </section>

                        {/* Smart Alerts Horizontal Scroll */}
                        <section className="m-alerts-section">
                            <h3 className="section-title-sm">Alertas del Cerebro de Ventas</h3>
                            <div className="m-alerts-carousel">
                                {analytics.alertas.map(alert => (
                                    <div key={alert.id} className={`m-alert-slide type-${alert.type}`}>
                                        <div className="m-alert-header">
                                            <span className="material-symbols-rounded m-alert-icon">{alert.icon}</span>
                                            <h4>{alert.title}</h4>
                                        </div>
                                        <p>{alert.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Monthly target gamification bar */}
                        <section className="m-target-card">
                            <div className="m-target-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="material-symbols-rounded text-emerald">target</span>
                                    <h3>Meta de Facturación</h3>
                                </div>
                                <span className="m-target-percentage">{goalPercentage}%</span>
                            </div>
                            
                            <div className="m-progress-track">
                                <div className="m-progress-fill" style={{ width: `${goalPercentage}%` }}></div>
                            </div>
                            
                            <div className="m-progress-footer">
                                <span>Facturado: {formatCurrency(analytics.totalIncome)}</span>
                                <span>Meta: {formatCurrency(monthlyGoal)}</span>
                            </div>
                        </section>

                        {/* Treasury Boxes */}
                        <section className="m-target-card mt-3">
                            <div className="m-target-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="material-symbols-rounded text-emerald">wallet</span>
                                    <h3>Cajas de Tesorería</h3>
                                </div>
                            </div>
                            <div className="m-treasury-boxes-grid">
                                <div className="m-treasury-box">
                                    <span className="mtb-label">💵 Efectivo</span>
                                    <span className="mtb-val">{formatCurrency(analytics.treasury.cash)}</span>
                                </div>
                                <div className="m-treasury-box">
                                    <span className="mtb-label">📱 MPago</span>
                                    <span className="mtb-val text-blue">{formatCurrency(analytics.treasury.mercadopago)}</span>
                                </div>
                                <div className="m-treasury-box">
                                    <span className="mtb-label">🏦 Banco</span>
                                    <span className="mtb-val text-purple">{formatCurrency(analytics.treasury.bank)}</span>
                                </div>
                            </div>
                        </section>

                        {/* Break Even Card */}
                        <section className="m-target-card mt-3">
                            <div className="m-target-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="material-symbols-rounded text-blue">account_balance</span>
                                    <h3>Punto de Equilibrio</h3>
                                </div>
                                <span className="m-target-percentage text-blue">{analytics.breakEven.progressPercentage}%</span>
                            </div>
                            <div className="m-progress-track">
                                <div className="m-progress-fill bar-fill-blue" style={{ width: `${analytics.breakEven.progressPercentage}%` }}></div>
                            </div>
                            <div className="m-progress-footer">
                                <span>Costo Fijo: {formatCurrency(fixedCosts)}</span>
                                <span>Margen: {analytics.estimatedProfitMargin}%</span>
                            </div>
                            <p className="m-breakeven-motivation">
                                {analytics.breakEven.status === 'rentable' 
                                    ? '🎉 ¡Costos fijos mensuales 100% cubiertos!' 
                                    : `Faltan ${formatCurrency(analytics.breakEven.gapToCover)} para cubrir costos fijos.`}
                            </p>
                        </section>

                        {/* Seasonality Quick Banner */}
                        <section className="m-season-banner">
                            <div className="m-season-left">
                                <span className="material-symbols-rounded">calendar_month</span>
                                <div>
                                    <h4>Faltan {analytics.seasonality.daysToNextKeyDate} días</h4>
                                    <p>Para {analytics.seasonality.nextKeyDateName}</p>
                                </div>
                            </div>
                            <span className="m-season-badge">{analytics.seasonality.seasonType.toUpperCase()}</span>
                        </section>

                        {/* Debt Banner */}
                        {analytics.deudaCriticaRatio > 0 && (
                            <section className="finances-debt-banner" onClick={() => navigate('/clientes')}>
                                <div className="d-icon">
                                    <span className="material-symbols-rounded">person_alert</span>
                                </div>
                                <div className="d-info">
                                    <span className="d-label">Cuentas Pendientes ({analytics.deudaCriticaRatio}% deuda)</span>
                                    <span className="d-val">{formatCurrency(customers.reduce((sum, c) => sum + (c.debtBalance || 0), 0))}</span>
                                </div>
                                <span className="material-symbols-rounded d-arrow">chevron_right</span>
                            </section>
                        )}

                        {/* Operational insights cards */}
                        <section className="m-insights-grid">
                            <div className="m-insight-card">
                                <span className="material-symbols-rounded i-icon text-amber">hourglass_empty</span>
                                <h4>Stock Inmovilizado</h4>
                                <p>{formatCurrency(analytics.dineroInmovilizado)}</p>
                            </div>
                            <div className="m-insight-card">
                                <span className="material-symbols-rounded i-icon text-red">delete_forever</span>
                                <h4>Costo de Mermas</h4>
                                <p>{formatCurrency(analytics.costoMermas)}</p>
                            </div>
                        </section>
                    </>
                ) : (
                    /* Ledgers history screen */
                    <section className="finances-history-sec">
                        <div className="sec-header">
                            <h3>Historial Completo</h3>
                            <button onClick={loadTransactions}>Actualizar</button>
                        </div>
                        <div className="m-history-list">
                            {(transactions || []).slice().reverse().map(t => {
                                const isExpanded = expandedId === t.id;
                                const items = t.metadata?.items || [];
                                const hasDetails = items.length > 0 || t.notes;
                                const isIncome = t.type === 'income';

                                return (
                                    <div 
                                        key={t.id} 
                                        className={`m-history-item-container ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : t.id)}
                                    >
                                        <div className="m-history-item">
                                            <div className={`m-h-icon ${isIncome ? 'income' : 'expense'}`}>
                                                <span className="material-symbols-rounded">
                                                    {isIncome ? 'arrow_upward' : 'arrow_downward'}
                                                </span>
                                            </div>
                                            <div className="m-h-info">
                                                <span className="m-h-cat">{t.category}</span>
                                                <span className="m-h-desc">{t.description || 'Sin descripción'}</span>
                                            </div>
                                            <div className="m-h-amount-wrap">
                                                <div className={`m-h-amount ${isIncome ? 'income' : 'expense'}`}>
                                                    {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                                                </div>
                                                {hasDetails && (
                                                    <span className={`material-symbols-rounded expand-icon ${isExpanded ? 'rotated' : ''}`}>
                                                        expand_more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="m-history-details">
                                                {items.length > 0 && (
                                                    <div className="m-details-items">
                                                        {items.map((item: any, idx: number) => (
                                                            <div key={idx} className="m-detail-row">
                                                                <div className="m-detail-main">
                                                                    <span className="m-detail-qty">{item.qty || item.quantity}x</span>
                                                                    <span className="m-detail-name">
                                                                        {item.name || item.product_name || 
                                                                         (item.product_id ? products.find(p => p.id === item.product_id)?.name : null) ||
                                                                         (item.package_id ? packages.find(p => p.id === item.package_id)?.name : null) ||
                                                                         'Producto'}
                                                                    </span>
                                                                </div>
                                                                <span className="m-detail-total">{formatCurrency((item.price || item.unit_price) * (item.qty || item.quantity))}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {t.notes && (
                                                    <div className="m-details-notes">
                                                        <span className="notes-tag">Nota:</span>
                                                        <p>{t.notes}</p>
                                                    </div>
                                                )}
                                                <div className="m-details-meta">
                                                    <span>ID: {t.id.slice(-6).toUpperCase()}</span>
                                                    <span>•</span>
                                                    <span>{new Date(t.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            {/* Expense Bottom Sheet */}
            {showExpenseSheet && (
                <div className="bottom-sheet-overlay" onClick={() => setShowExpenseSheet(false)}>
                    <div className="bottom-sheet-content" onClick={e => e.stopPropagation()}>
                        <div className="sheet-handle"></div>
                        <h3>Asentar Nuevo Gasto</h3>
                        <form onSubmit={handleAddExpense}>
                            <div className="m-form-group">
                                <label>Monto</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={expenseForm.amount}
                                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="m-form-group">
                                <label>Categoría</label>
                                <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                                    <option value="Sueldos/Jornales">Sueldos/Jornales</option>
                                    <option value="Insumos">Insumos Varios</option>
                                    <option value="Mercadería (Flores)">Mercadería (Flores)</option>
                                    <option value="Logística/Moto">Logística/Moto</option>
                                    <option value="Servicios/Luz/Internet">Servicios Diarios</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>
                            <div className="m-form-group">
                                <label>Medio de Pago</label>
                                <select value={expenseForm.method} onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value })}>
                                    {(shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0) ? (
                                        shopInfo.paymentMethods.map(m => (
                                            <option key={m.id} value={m.name}>{m.name}</option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="cash">Efectivo</option>
                                            <option value="transfer">Transferencia</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            <div className="m-form-group">
                                <label>Descripción</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pago de flete"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="m-submit-btn neg">Registrar Salida</button>
                        </form>
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
