import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    AlertCircle,
    Wallet,
    Users,
    CreditCard,
    Banknote,
    Sparkles,
    AlertTriangle,
    Hourglass,
    Trash2
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api, type WasteLog } from '../../services/api';
import { analyzeFinances } from './utils/financesAnalyzer';
import './Finances.css';

// --- UTILS ---
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// --- MAIN COMPONENT ---
export const FinancesDesktop = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const orders = useStore((state) => state.orders) || [];
    const products = useStore((state) => state.products) || [];
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadOrders = useStore((state) => state.loadOrders);
    const shopInfo = useStore((state) => state.shopInfo);

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
                await Promise.all([
                    loadTransactions(), 
                    loadCustomers(),
                    loadOrders ? loadOrders() : Promise.resolve()
                ]);
                const logs = await api.getWasteLogs({ limit: 100 });
                setWasteLogs(logs || []);
            } catch (err) {
                console.error('[FINANCES DATA LOAD ERROR]', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // --- BUSINESS INTELLIGENCE ENGINE ---
    const analytics = analyzeFinances(transactions, orders, products, customers, wasteLogs, fixedCosts);

    const transactionsByMethod = (transactions || []).reduce((acc: any, t) => {
        const method = t.method || 'cash';
        if (!acc[method]) acc[method] = { income: 0, expense: 0 };
        if (t.type === 'income' || (t.type as string) === 'sale' || (t.type as string) === 'payment_received') {
            acc[method].income += (Number(t.amount) || 0);
        } else {
            acc[method].expense += (Number(t.amount) || 0);
        }
        return acc;
    }, {});

    const totalIncome = analytics.totalIncome;
    const totalDebt = (customers || []).reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);
    const debtorsCount = (customers || []).filter(c => (Number(c.debtBalance) || 0) > 0).length;
    const incomeCount = (transactions || []).filter(t => t.type === 'income' || (t.type as string) === 'sale').length;

    return (
        <div className="finances-page">
            {/* Loading State */}
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <p>Sincronizando finanzas...</p>
                    </div>
                </div>
            )}

            {/* Premium Header */}
            <header className="finances-header">
                <div className="header-left">
                    <div className="header-icon">
                        <Wallet size={24} />
                    </div>
                    <div className="header-text">
                        <h1>Cerebro de Finanzas</h1>
                        <p>Control estratégico y panel inteligente de Mi Jardín</p>
                    </div>
                </div>
            </header>

            {/* Smart Summary KPIs Cards */}
            <div className="summary-cards">
                {/* Net Income Card */}
                <div className="summary-card card-income">
                    <div className="card-top">
                        <div className="card-badge">
                            <TrendingUp size={14} />
                            Ingresos Totales
                        </div>
                        <span className="card-count">{incomeCount} ventas</span>
                    </div>
                    <div className="card-amount amount-green">{formatCurrency(totalIncome)}</div>
                    <div className="card-footer-text">
                        Sigamos impulsando la temporada
                    </div>
                </div>

                {/* Ticket Promedio */}
                <div className="summary-card card-balance">
                    <div className="card-top">
                        <div className="card-badge badge-sage">
                            <DollarSign size={14} />
                            Ticket Promedio
                        </div>
                        <span className="card-count">Pedido Medio</span>
                    </div>
                    <div className="card-amount amount-sage">{formatCurrency(analytics.ticketPromedio)}</div>
                    <div className="card-footer-text">Valor medio por cada venta</div>
                </div>

                {/* Margen de Ganancia */}
                <div className="summary-card card-debt">
                    <div className="card-top">
                        <div className="card-badge badge-amber">
                            <Sparkles size={14} />
                            Margen Estimado
                        </div>
                        <span className="card-count">Retorno Neto</span>
                    </div>
                    <div className="card-amount amount-amber">{analytics.estimatedProfitMargin}%</div>
                    <div className="card-footer-text">
                        Promedio bruto sobre costos
                    </div>
                </div>

                {/* Deudas Clientes */}
                <div className="summary-card card-expense">
                    <div className="card-top">
                        <div className="card-badge badge-red">
                            <AlertCircle size={14} />
                            Cuentas Fiadas
                        </div>
                        <span className="card-count">{debtorsCount} morosos</span>
                    </div>
                    <div className="card-amount amount-red">{formatCurrency(totalDebt)}</div>
                    <div className="card-footer-text">
                        Todo cobrado y al día
                    </div>
                </div>
            </div>

            {/* MAIN DASHBOARD GRID */}
            <div className="finances-main-grid">
                {/* Left Column: Alerts & Operational Health */}
                <div className="finances-column-left">
                    {/* Smart Alerts Box */}
                    <div className="bi-card alerts-card">
                        <div className="bi-card-header">
                            <AlertTriangle size={20} className="text-orange" />
                            <h2>Centro de Control Estratégico</h2>
                        </div>
                        <div className="alerts-container">
                            {analytics.alertas.map(alert => (
                                <div key={alert.id} className={`smart-alert alert-${alert.type}`}>
                                    <div className="alert-icon-wrap">
                                        <span className="material-symbols-rounded">{alert.icon}</span>
                                    </div>
                                    <div className="alert-content">
                                        <h3>{alert.title}</h3>
                                        <p>{alert.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Inventory & Flower Waste Diagnostics */}
                    <div className="bi-grid-two">
                        <div className="bi-card">
                            <div className="bi-card-header">
                                <Hourglass size={18} className="text-amber" />
                                <h3>Capital Inmovilizado</h3>
                            </div>
                            <div className="bi-card-body">
                                <h4 className="metric-large">{formatCurrency(analytics.dineroInmovilizado)}</h4>
                                <p className="metric-label">Dinero atascado en flores o plantas sin rotar en 30 días.</p>
                            </div>
                        </div>

                        <div className="bi-card">
                            <div className="bi-card-header">
                                <Trash2 size={18} className="text-red" />
                                <h3>Costo de Mermas</h3>
                            </div>
                            <div className="bi-card-body">
                                <h4 className="metric-large red-text">{formatCurrency(analytics.costoMermas)}</h4>
                                <p className="metric-label">Pérdida neta de capital floral por desperdicio o marchitado.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: VIP Clients & Sales Channels */}
                <div className="finances-column-right">
                    {/* VIP Customers */}
                    <div className="bi-card vip-card">
                        <div className="bi-card-header">
                            <Users size={18} className="text-sage" />
                            <h2>Top Clientes del Negocio (VIP)</h2>
                        </div>
                        <div className="vip-list">
                            {analytics.vipCustomers.length === 0 ? (
                                <p className="empty-label">Registra tus primeros pedidos para identificar clientes recurrentes.</p>
                            ) : (
                                analytics.vipCustomers.slice(0, 5).map((vip, idx) => (
                                    <div key={vip.id} className="vip-item">
                                        <div className="vip-rank">{idx + 1}</div>
                                        <div className="vip-info">
                                            <span className="vip-name">{vip.name}</span>
                                            <span className="vip-orders">{vip.orderCount} compras</span>
                                        </div>
                                        <div className="vip-amount">{formatCurrency(vip.totalSpent)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Treasury multi-boxes */}
                    <div className="bi-card treasury-card">
                        <div className="bi-card-header">
                            <Wallet size={18} className="text-emerald" />
                            <h2>Cajas de Tesorería (Disponibilidad)</h2>
                        </div>
                        <div className="treasury-grid">
                            <div className="treasury-box box-cash">
                                <div className="tbox-header">
                                    <span className="tbox-emoji">💵</span>
                                    <span className="tbox-name">Caja Chica (Efectivo)</span>
                                </div>
                                <h3 className="tbox-amount">{formatCurrency(analytics.treasury.cash)}</h3>
                                <div className="tbox-footer">Fondos físicos en local</div>
                            </div>
                            <div className="treasury-box box-mp">
                                <div className="tbox-header">
                                    <span className="tbox-emoji">📱</span>
                                    <span className="tbox-name">Mercado Pago</span>
                                </div>
                                <h3 className="tbox-amount text-blue">{formatCurrency(analytics.treasury.mercadopago)}</h3>
                                <div className="tbox-footer">Liquidez digital / QR</div>
                            </div>
                            <div className="treasury-box box-bank">
                                <div className="tbox-header">
                                    <span className="tbox-emoji">🏦</span>
                                    <span className="tbox-name">Banco & Transf.</span>
                                </div>
                                <h3 className="tbox-amount text-purple">{formatCurrency(analytics.treasury.bank)}</h3>
                                <div className="tbox-footer">Cuentas y cobro tarjeta</div>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown by Payment Methods */}
                    <div className="bi-card methods-card">
                        <div className="bi-card-header">
                            <CreditCard size={18} className="text-blue" />
                            <h2>Flujos por Medio de Cobro</h2>
                        </div>
                        <div className="methods-list">
                            {Object.entries(transactionsByMethod).map(([method, val]: any) => {
                                const methodConfig = shopInfo.paymentMethods?.find(m => m.name === method || m.id === method);
                                return (
                                    <div key={method} className="method-flow-row">
                                        <div className="flow-method-name">
                                            {methodConfig?.type === 'cash' ? <Banknote size={14} className="text-green" /> : <CreditCard size={14} className="text-blue" />}
                                            <span>{methodConfig?.name || method}</span>
                                        </div>
                                        <div className="flow-amounts">
                                            <span className="flow-income font-green">+{formatCurrency(val.income)}</span>
                                            <span className="flow-expense font-red">-{formatCurrency(val.expense)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
