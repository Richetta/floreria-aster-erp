import { useMemo, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { api, type WasteLog } from '../../services/api';
import { analyzeFinances } from './utils/financesAnalyzer';
import './FinancesMobile.css';

export const FinancesMobile = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const orders = useStore((state) => state.orders) || [];
    const products = useStore((state) => state.products) || [];
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadOrders = useStore((state) => state.loadOrders);

    const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
    const [fixedCosts] = useState<number>(() => {
        const stored = localStorage.getItem('finances_fixed_costs');
        return stored ? parseFloat(stored) : 350000;
    });

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
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
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // --- BUSINESS INTELLIGENCE CALCULATIONS ---
    const analytics = useMemo(() => {
        return analyzeFinances(transactions, orders, products, customers, wasteLogs, fixedCosts);
    }, [transactions, orders, products, customers, wasteLogs, fixedCosts]);

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

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="finances-mobile-wrapper">
            {/* Header */}
            <header className="mobile-finances-header">
                <div className="finances-header-top">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2>Cerebro BI</h2>
                        <span className="mobile-subtitle">Control estratégico en vivo</span>
                    </div>
                </div>
            </header>

            {/* Loading State */}
            {isLoading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    Sincronizando diagnóstico...
                </div>
            )}

            <div className="finances-scroll-content">
                {/* Apple Health style Diagnosis card */}
                <section className="m-diagnosis-card">
                    <div className="diag-header">
                        <span className="material-symbols-rounded spark-icon">sparky</span>
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
            </div>
        </div>
    );
};
