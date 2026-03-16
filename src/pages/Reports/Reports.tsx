import { useState, useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Users,
    Package,
    Download,
    Calendar,
    Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Reports.css';

type Period = 'today' | 'week' | 'month' | 'custom';

export const Reports = () => {
    const [period, setPeriod] = useState<Period>('month');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'customers' | 'profits'>('sales');

    // Data states
    const [salesSummary, setSalesSummary] = useState<any>(null);
    const [salesByPeriod, setSalesByPeriod] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [topCustomers, setTopCustomers] = useState<any[]>([]);
    const [profits, setProfits] = useState<any>(null);

    // Get date range based on period
    const getDateRange = () => {
        const today = new Date();
        let from = '';
        let to = today.toISOString().split('T')[0];

        switch (period) {
            case 'today':
                from = to;
                break;
            case 'week':
                from = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
                break;
            case 'month':
                from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                break;
            case 'custom':
                from = fromDate || to;
                to = toDate || to;
                break;
        }

        return { from, to };
    };

    // Load data when period or tab changes
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
                    const products = await api.getTopProducts(from, to, 15);
                    setTopProducts(products);
                } else if (activeTab === 'customers') {
                    const customers = await api.getTopCustomers(from, to, 15);
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

    // Export sales
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
            alert('Error al exportar: ' + error);
        }
    };

    const COLORS = ['#9b51e0', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

    return (
        <div className="reports-page">
            <header className="page-header mb-6">
                <div>
                    <h1 className="text-h1">Reportes y Estadísticas</h1>
                    <p className="text-body mt-2">Analizá el rendimiento de tu negocio</p>
                </div>
                <button className="btn btn-secondary" onClick={handleExport}>
                    <Download size={20} />
                    Exportar Ventas
                </button>
            </header>

            {/* Period Filters */}
            <div className="reports-filters card mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={20} className="text-primary" />
                    <h3 className="text-h3">Filtros</h3>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <div className="period-buttons flex gap-2">
                        <button
                            className={`period-btn ${period === 'today' ? 'active' : ''}`}
                            onClick={() => setPeriod('today')}
                        >
                            Hoy
                        </button>
                        <button
                            className={`period-btn ${period === 'week' ? 'active' : ''}`}
                            onClick={() => setPeriod('week')}
                        >
                            7 días
                        </button>
                        <button
                            className={`period-btn ${period === 'month' ? 'active' : ''}`}
                            onClick={() => setPeriod('month')}
                        >
                            Este Mes
                        </button>
                        <button
                            className={`period-btn ${period === 'custom' ? 'active' : ''}`}
                            onClick={() => setPeriod('custom')}
                        >
                            Personalizado
                        </button>
                    </div>

                    {period === 'custom' && (
                        <div className="custom-dates flex gap-2 items-center">
                            <Calendar size={18} className="text-muted" />
                            <input
                                type="date"
                                className="form-input"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                            <span>-</span>
                            <input
                                type="date"
                                className="form-input"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="reports-tabs mb-6">
                <button
                    className={`report-tab ${activeTab === 'sales' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sales')}
                >
                    <DollarSign size={18} />
                    Ventas
                </button>
                <button
                    className={`report-tab ${activeTab === 'products' ? 'active' : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    <Package size={18} />
                    Productos
                </button>
                <button
                    className={`report-tab ${activeTab === 'customers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('customers')}
                >
                    <Users size={18} />
                    Clientes
                </button>
                <button
                    className={`report-tab ${activeTab === 'profits' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profits')}
                >
                    <TrendingUp size={18} />
                    Ganancias
                </button>
            </div>

            {isLoading ? (
                <div className="loading-state text-center py-12">
                    <div className="spinner" style={{
                        width: 50,
                        height: 50,
                        border: '4px solid #e5e7eb',
                        borderTopColor: '#9b51e0',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }}></div>
                    <p className="text-muted">Cargando reportes...</p>
                </div>
            ) : (
                <>
                    {/* SALES TAB */}
                    {activeTab === 'sales' && (
                        <div className="reports-content">
                            {/* Summary Cards */}
                            <div className="metrics-grid mb-6">
                                <div className="metric-card">
                                    <div className="metric-icon bg-success-light">
                                        <DollarSign size={24} className="text-success" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Total Vendido</span>
                                        <h2 className="text-h2">
                                            ${salesSummary?.total_sales?.toLocaleString() || '0'}
                                        </h2>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <div className="metric-icon bg-primary-light">
                                        <ShoppingCart size={24} className="text-primary" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Transacciones</span>
                                        <h2 className="text-h2">{salesSummary?.total_transactions || 0}</h2>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <div className="metric-icon bg-warning-light">
                                        <TrendingUp size={24} className="text-warning" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Ticket Promedio</span>
                                        <h2 className="text-h2">
                                            ${salesSummary?.total_transactions 
                                                ? Math.round(salesSummary.total_sales / salesSummary.total_transactions).toLocaleString()
                                                : '0'
                                            }
                                        </h2>
                                    </div>
                                </div>
                            </div>

                            {/* Sales Chart */}
                            <div className="card mb-6">
                                <h3 className="text-h3 mb-4">Ventas por Día</h3>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={salesByPeriod}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="period" />
                                            <YAxis />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="total_amount" stroke="#9b51e0" strokeWidth={3} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="card">
                                <h3 className="text-h3 mb-4">Ventas por Método de Pago</h3>
                                <div style={{ height: '250px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={salesSummary?.by_payment_method || []}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ method, percent }: any) => `${method}: ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="total"
                                            >
                                                {salesSummary?.by_payment_method?.map((_: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRODUCTS TAB */}
                    {activeTab === 'products' && (
                        <div className="reports-content">
                            <div className="card">
                                <h3 className="text-h3 mb-4">Top 15 Productos Más Vendidos</h3>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Código</th>
                                                <th className="text-right">Cantidad</th>
                                                <th className="text-right">Precio Prom.</th>
                                                <th className="text-right">Total Vendido</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topProducts.map((product, index) => (
                                                <tr key={product.product_id}>
                                                    <td>
                                                        <div className="flex items-center gap-2">
                                                            <span className="rank-badge">{index + 1}</span>
                                                            {product.product_name}
                                                        </div>
                                                    </td>
                                                    <td className="text-muted">{product.product_code}</td>
                                                    <td className="text-right font-bold">{product.total_quantity}</td>
                                                    <td className="text-right">${product.avg_price?.toLocaleString()}</td>
                                                    <td className="text-right font-bold text-primary">
                                                        ${product.total_revenue?.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CUSTOMERS TAB */}
                    {activeTab === 'customers' && (
                        <div className="reports-content">
                            <div className="card">
                                <h3 className="text-h3 mb-4">Top 15 Clientes</h3>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Cliente</th>
                                                <th>Teléfono</th>
                                                <th className="text-center">Pedidos</th>
                                                <th className="text-right">Total Gastado</th>
                                                <th className="text-right">Deuda</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topCustomers.map((customer, index) => (
                                                <tr key={customer.id}>
                                                    <td>
                                                        <div className="flex items-center gap-2">
                                                            <span className="rank-badge">{index + 1}</span>
                                                            <div>
                                                                <div className="font-bold">{customer.name}</div>
                                                                {customer.email && (
                                                                    <div className="text-micro text-muted">{customer.email}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{customer.phone}</td>
                                                    <td className="text-center">{customer.total_orders}</td>
                                                    <td className="text-right font-bold text-primary">
                                                        ${customer.total_spent?.toLocaleString()}
                                                    </td>
                                                    <td className="text-right">
                                                        {customer.debt_balance > 0 ? (
                                                            <span className="text-danger font-bold">
                                                                ${customer.debt_balance.toLocaleString()}
                                                            </span>
                                                        ) : (
                                                            <span className="text-success">✓</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROFITS TAB */}
                    {activeTab === 'profits' && (
                        <div className="reports-content">
                            {/* Summary */}
                            <div className="metrics-grid mb-6">
                                <div className="metric-card">
                                    <div className="metric-icon bg-success-light">
                                        <DollarSign size={24} className="text-success" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Ingresos</span>
                                        <h2 className="text-h2 text-success">
                                            ${profits?.summary?.total_revenue?.toLocaleString() || '0'}
                                        </h2>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <div className="metric-icon bg-danger-light">
                                        <TrendingDown size={24} className="text-danger" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Egresos</span>
                                        <h2 className="text-h2 text-danger">
                                            ${profits?.summary?.total_expenses?.toLocaleString() || '0'}
                                        </h2>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <div className="metric-icon bg-primary-light">
                                        <TrendingUp size={24} className="text-primary" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Ganancia Neta</span>
                                        <h2 className="text-h2">
                                            ${profits?.summary?.total_profit?.toLocaleString() || '0'}
                                        </h2>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <div className="metric-icon bg-warning-light">
                                        <DollarSign size={24} className="text-warning" />
                                    </div>
                                    <div className="metric-data">
                                        <span className="text-small text-muted">Margen</span>
                                        <h2 className="text-h2">
                                            {profits?.summary?.profit_margin?.toFixed(1) || '0'}%
                                        </h2>
                                    </div>
                                </div>
                            </div>

                            {/* Top Profitable Products */}
                            <div className="card">
                                <h3 className="text-h3 mb-4">Productos Más Rentables</h3>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th className="text-right">Vendidos</th>
                                                <th className="text-right">Ingresos</th>
                                                <th className="text-right">Costo</th>
                                                <th className="text-right">Ganancia</th>
                                                <th className="text-right">Margen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {profits?.by_product?.slice(0, 15).map((product: any, index: number) => {
                                                const margin = product.total_revenue > 0 
                                                    ? ((product.profit / product.total_revenue) * 100) 
                                                    : 0;
                                                return (
                                                    <tr key={product.product_id}>
                                                        <td>
                                                            <div className="flex items-center gap-2">
                                                                <span className="rank-badge">{index + 1}</span>
                                                                {product.product_name}
                                                            </div>
                                                        </td>
                                                        <td className="text-right">{product.quantity_sold}</td>
                                                        <td className="text-right">${product.total_revenue?.toLocaleString()}</td>
                                                        <td className="text-right text-danger">${product.total_cost?.toLocaleString()}</td>
                                                        <td className="text-right font-bold text-success">
                                                            ${product.profit?.toLocaleString()}
                                                        </td>
                                                        <td className="text-right">
                                                            <span className={`margin-badge ${margin >= 50 ? 'high' : margin >= 30 ? 'medium' : 'low'}`}>
                                                                {margin.toFixed(0)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
