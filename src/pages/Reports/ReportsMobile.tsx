import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './ReportsMobile.css';

type Period = 'today' | 'week' | 'month' | 'custom';

export const ReportsMobile = () => {
    const [period, setPeriod] = useState<Period>('month');
    const [fromDate] = useState('');
    const [toDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'customers' | 'profits'>('sales');

    const [salesSummary, setSalesSummary] = useState<any>(null);
    const [salesByPeriod, setSalesByPeriod] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [topCustomers, setTopCustomers] = useState<any[]>([]);
    const [profits, setProfits] = useState<any>(null);

    const getDateRange = () => {
        const today = new Date();
        let from = '';
        let to = today.toISOString().split('T')[0];

        switch (period) {
            case 'today': from = to; break;
            case 'week': from = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0]; break;
            case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; break;
            case 'custom': from = fromDate || to; to = toDate || to; break;
        }
        return { from, to };
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const { from, to } = getDateRange();
            try {
                if (activeTab === 'sales') {
                    const [summary, byPeriod] = await Promise.all([
                        api.getSalesSummary(from, to),
                        api.getSalesByPeriod(from, to, 'day')
                    ]);
                    setSalesSummary(summary);
                    setSalesByPeriod(byPeriod);
                } else if (activeTab === 'products') {
                    const products = await api.getTopProducts(from, to, 10);
                    setTopProducts(products);
                } else if (activeTab === 'customers') {
                    const customers = await api.getTopCustomers(from, to, 10);
                    setTopCustomers(customers);
                } else if (activeTab === 'profits') {
                    const profitsData = await api.getProfits(from, to);
                    setProfits(profitsData);
                }
            } catch (error) {
                console.error('Error loading reports:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [period, fromDate, toDate, activeTab]);

    const handleExport = async () => {
        const { from, to } = getDateRange();
        try {
            const csv = await api.exportSales(from, to);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ventas_${from}_${to}.csv`;
            a.click();
        } catch (error) {
            console.error('Export error:', error);
        }
    };

    const COLORS = ['#4F7A5A', '#3b82f6', '#4F7A5A', '#f59e0b', '#ef4444', '#ec4899', '#608d6d'];

    return (
        <div className="reports-mobile-wrapper">
            <header className="reports-mobile-header">
                <h2>Reportes</h2>
                <button className="icon-btn-ghost" onClick={handleExport}>
                    <span className="material-symbols-rounded">download</span>
                </button>
            </header>

            {/* Period Selector */}
            <div className="reports-period-scroll">
                {[
                    { id: 'today', label: 'Hoy' },
                    { id: 'week', label: '7 días' },
                    { id: 'month', label: 'Mes' },
                    { id: 'custom', label: 'Custom' }
                ].map(p => (
                    <button
                        key={p.id}
                        className={`period-chip ${period === p.id ? 'active' : ''}`}
                        onClick={() => setPeriod(p.id as Period)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="reports-tabs-scroll">
                {[
                    { id: 'sales', label: 'Ventas', icon: 'payments' },
                    { id: 'products', label: 'Productos', icon: 'inventory' },
                    { id: 'customers', label: 'Clientes', icon: 'people' },
                    { id: 'profits', label: 'Ganancias', icon: 'trending_up' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`report-tab-mobile ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        <span className="material-symbols-rounded">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="reports-loading">
                    <div className="spinner-small"></div>
                    <p>Cargando...</p>
                </div>
            ) : (
                <div className="reports-content-mobile">
                    {/* SALES TAB */}
                    {activeTab === 'sales' && (
                        <>
                            <div className="metrics-cards-row">
                                <div className="metric-mini-card">
                                    <span className="material-symbols-rounded icon-payments">payments</span>
                                    <div className="metric-mini-value">${salesSummary?.total_sales?.toLocaleString() || '0'}</div>
                                    <div className="metric-mini-label">Vendido</div>
                                </div>
                                <div className="metric-mini-card">
                                    <span className="material-symbols-rounded icon-shopping">shopping_cart</span>
                                    <div className="metric-mini-value">{salesSummary?.total_transactions || 0}</div>
                                    <div className="metric-mini-label">Transacciones</div>
                                </div>
                                <div className="metric-mini-card">
                                    <span className="material-symbols-rounded icon-avg">calculate</span>
                                    <div className="metric-mini-value">
                                        ${salesSummary?.total_transactions
                                            ? Math.round(salesSummary.total_sales / salesSummary.total_transactions).toLocaleString()
                                            : '0'}
                                    </div>
                                    <div className="metric-mini-label">Promedio</div>
                                </div>
                            </div>

                            {salesByPeriod.length > 0 && (
                                <div className="mobile-chart-box">
                                    <h4>Ventas por Día</h4>
                                    <div className="chart-container-small">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <LineChart data={salesByPeriod}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D1CDBF" />
                                                <XAxis dataKey="period" tick={{fontSize: 10}} />
                                                <YAxis tick={{fontSize: 10}} />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="total_amount" stroke="#4F7A5A" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {salesSummary?.by_payment_method && (
                                <div className="mobile-chart-box">
                                    <h4>Métodos de Pago</h4>
                                    <div className="chart-container-small">
                                        <ResponsiveContainer width="100%" height={160}>
                                            <PieChart>
                                                <Pie
                                                    data={salesSummary.by_payment_method}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={35}
                                                    outerRadius={55}
                                                    paddingAngle={2}
                                                    dataKey="total"
                                                >
                                                    {salesSummary.by_payment_method.map((_: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="payment-legend">
                                        {salesSummary.by_payment_method.map((method: any, idx: number) => (
                                            <div key={idx} className="payment-legend-item">
                                                <div className="legend-dot" style={{background: COLORS[idx % COLORS.length]}}></div>
                                                <span>{method.method}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* PRODUCTS TAB */}
                    {activeTab === 'products' && (
                        <div className="mobile-list-compact">
                            {topProducts.map((product, index) => (
                                <div key={product.product_id} className="mobile-list-item-compact">
                                    <div className="rank-badge-sm">{index + 1}</div>
                                    <div className="list-item-body flex-1">
                                        <div className="list-item-title">{product.product_name}</div>
                                        <div className="list-item-subtitle">{product.product_code}</div>
                                    </div>
                                    <div className="list-item-value">
                                        <div className="value-primary">${product.total_revenue?.toLocaleString()}</div>
                                        <div className="value-secondary">{product.total_quantity} und</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CUSTOMERS TAB */}
                    {activeTab === 'customers' && (
                        <div className="mobile-list-compact">
                            {topCustomers.map((customer, index) => (
                                <div key={customer.id} className="mobile-list-item-compact">
                                    <div className="rank-badge-sm">{index + 1}</div>
                                    <div className="list-item-body flex-1">
                                        <div className="list-item-title">{customer.name}</div>
                                        <div className="list-item-subtitle">{customer.phone || 'Sin teléfono'}</div>
                                    </div>
                                    <div className="list-item-value">
                                        <div className="value-primary">${customer.total_spent?.toLocaleString()}</div>
                                        {customer.debt_balance > 0 && (
                                            <div className="value-debt">${customer.debt_balance.toLocaleString()}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PROFITS TAB */}
                    {activeTab === 'profits' && (
                        <>
                            <div className="metrics-cards-row">
                                <div className="metric-mini-card success">
                                    <span className="material-symbols-rounded">arrow_upward</span>
                                    <div className="metric-mini-value">${profits?.summary?.total_revenue?.toLocaleString() || '0'}</div>
                                    <div className="metric-mini-label">Ingresos</div>
                                </div>
                                <div className="metric-mini-card danger">
                                    <span className="material-symbols-rounded">arrow_downward</span>
                                    <div className="metric-mini-value">${profits?.summary?.total_expenses?.toLocaleString() || '0'}</div>
                                    <div className="metric-mini-label">Egresos</div>
                                </div>
                                <div className="metric-mini-card primary">
                                    <span className="material-symbols-rounded">account_balance</span>
                                    <div className="metric-mini-value">${profits?.summary?.total_profit?.toLocaleString() || '0'}</div>
                                    <div className="metric-mini-label">Neto</div>
                                </div>
                            </div>

                            {profits?.top_profitable_products && (
                                <div className="mobile-section-box">
                                    <h4>Top Productos Rentables</h4>
                                    <div className="mobile-list-compact">
                                        {profits.top_profitable_products.map((product: any, index: number) => (
                                            <div key={product.product_id} className="mobile-list-item-compact">
                                                <div className="rank-badge-sm">{index + 1}</div>
                                                <div className="list-item-body flex-1">
                                                    <div className="list-item-title">{product.product_name}</div>
                                                    <div className="list-item-subtitle">{product.total_sold} vendidos</div>
                                                </div>
                                                <div className="list-item-value">
                                                    <div className="value-success">${product.profit?.toLocaleString()}</div>
                                                    <div className="value-secondary">{product.margin?.toFixed(1)}%</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
