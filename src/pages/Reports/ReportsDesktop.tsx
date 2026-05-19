import { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Users,
    Package,
    Download,
    Calendar,
    Filter,
    Edit2,
    Check,
    X,
    Target,
    Scale,
    AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import { analyzeFinances } from '../Finances/utils/financesAnalyzer';
import './ReportsDesktop.css';

type Period = 'today' | 'week' | 'month' | 'custom';

export const ReportsDesktop = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const orders = useStore((state) => state.orders) || [];
    const products = useStore((state) => state.products) || [];
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadOrders = useStore((state) => state.loadOrders);

    const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
        const stored = localStorage.getItem('finances_monthly_goal');
        return stored ? parseFloat(stored) : 1500000;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState(monthlyGoal.toString());

    const [fixedCosts, setFixedCosts] = useState<number>(() => {
        const stored = localStorage.getItem('finances_fixed_costs');
        return stored ? parseFloat(stored) : 350000;
    });
    const [isEditingFixedCosts, setIsEditingFixedCosts] = useState(false);
    const [fixedCostsInput, setFixedCostsInput] = useState(fixedCosts.toString());

    const [wasteLogs] = useState<any[]>([]);
    const analytics = useMemo(() => {
        return analyzeFinances(transactions, orders, products, customers, wasteLogs, fixedCosts);
    }, [transactions, orders, products, customers, wasteLogs, fixedCosts]);

    const [period, setPeriod] = useState<Period>('month');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'customers' | 'profits'>('sales');

    const { alertModal, showAlert } = useModal();

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
                // Load general finances ledger datasets in parallel
                await Promise.allSettled([
                    loadTransactions(),
                    loadCustomers(),
                    loadOrders ? loadOrders() : Promise.resolve()
                ]);

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
            showAlert({ title: 'Error', message: 'Error al exportar: ' + error, variant: 'error' });
        }
    };

    const COLORS = ['#4F7A5A', '#3b82f6', '#4F7A5A', '#f59e0b', '#ef4444', '#ec4899', '#608d6d'];

    return (
        <div className="reports-page">
            <header className="page-header mb-6">
                <div>
                    <h1 className="text-h1">Reportes</h1>
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

            {/* TARGET TRACKER & BREAK-EVEN ANALYZER ROW */}
            <div className="reports-executive-grid mb-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Target Tracker */}
                <div className="bi-card goal-card" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)', padding: '1.25rem', borderRadius: '16px' }}>
                    <div className="bi-card-header mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Target size={20} className="text-primary" style={{ color: '#4F7A5A' }} />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>Meta Mensual de Ventas (Target Tracker)</h2>
                        </div>
                        
                        {!isEditingGoal ? (
                            <button onClick={() => { setGoalInput(monthlyGoal.toString()); setIsEditingGoal(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '0.8rem', gap: '4px' }}>
                                <Edit2 size={12} />
                                Ajustar Meta
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                    type="number"
                                    value={goalInput}
                                    onChange={e => setGoalInput(e.target.value)}
                                    style={{ width: '100px', padding: '2px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                                <button onClick={() => {
                                    const val = parseFloat(goalInput);
                                    if (val > 0) {
                                        setMonthlyGoal(val);
                                        localStorage.setItem('finances_monthly_goal', val.toString());
                                    }
                                    setIsEditingGoal(false);
                                }} style={{ background: '#4F7A5A', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={12} /></button>
                                <button onClick={() => setIsEditingGoal(false)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}><X size={12} /></button>
                            </div>
                        )}
                    </div>
                    
                    <div className="goal-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Facturado este mes: <strong style={{ color: '#1e293b' }}>${analytics.totalIncome.toLocaleString()}</strong>
                            </span>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Meta: <strong style={{ color: '#1e293b' }}>${monthlyGoal.toLocaleString()}</strong>
                            </span>
                        </div>
                        
                        {/* Progress bar */}
                        <div style={{ width: '100%', height: '14px', background: '#e2e8f0', borderRadius: '7px', overflow: 'hidden', position: 'relative', marginBottom: '8px' }}>
                            <div style={{
                                width: `${Math.min(100, (analytics.totalIncome / monthlyGoal) * 100)}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #4F7A5A 0%, #608d6d 100%)',
                                borderRadius: '7px',
                                transition: 'width 0.4s ease'
                            }}></div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 'bold', color: '#4F7A5A' }}>
                                {((analytics.totalIncome / monthlyGoal) * 100).toFixed(0)}% Alcanzado
                            </span>
                            <span style={{ color: '#475569', fontStyle: 'italic' }}>
                                {analytics.totalIncome >= monthlyGoal ? '¡Excelente! Meta superada 🥳' : '¡Fuerza! Cada venta cuenta 🌸'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Break-Even Analyzer */}
                <div className="bi-card break-even-card" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)', padding: '1.25rem', borderRadius: '16px' }}>
                    <div className="bi-card-header mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Scale size={20} className="text-amber-500" style={{ color: '#b45309' }} />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>Punto de Equilibrio (Break-Even)</h2>
                        </div>
                        
                        {!isEditingFixedCosts ? (
                            <button onClick={() => { setFixedCostsInput(fixedCosts.toString()); setIsEditingFixedCosts(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '0.8rem', gap: '4px' }}>
                                <Edit2 size={12} />
                                Ajustar Costos Fijos
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                    type="number"
                                    value={fixedCostsInput}
                                    onChange={e => setFixedCostsInput(e.target.value)}
                                    style={{ width: '100px', padding: '2px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                                <button onClick={() => {
                                    const val = parseFloat(fixedCostsInput);
                                    if (val > 0) {
                                        setFixedCosts(val);
                                        localStorage.setItem('finances_fixed_costs', val.toString());
                                    }
                                    setIsEditingFixedCosts(false);
                                }} style={{ background: '#b45309', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={12} /></button>
                                <button onClick={() => setIsEditingFixedCosts(false)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}><X size={12} /></button>
                            </div>
                        )}
                    </div>
                    
                    <div className="break-even-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.3)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Costos Fijos del Mes</span>
                                <strong style={{ fontSize: '1.1rem', color: '#be123c' }}>${fixedCosts.toLocaleString()}</strong>
                            </div>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.3)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Punto de Equilibrio</span>
                                <strong style={{ fontSize: '1.1rem', color: '#166534' }}>${fixedCosts.toLocaleString()}</strong>
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#475569', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <AlertCircle size={14} className="text-amber-500" style={{ color: '#d97706' }} />
                            <span>
                                Necesitás concretar <strong style={{ color: '#1e293b' }}>{(fixedCosts / (analytics.ticketPromedio || 4500)).toFixed(0)} pedidos</strong> de ${Math.round(analytics.ticketPromedio || 4500).toLocaleString()} promedio para cubrir gastos.
                            </span>
                        </div>
                    </div>
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
                        borderTopColor: '#4F7A5A',
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
                                            <Line type="monotone" dataKey="total_amount" stroke="#4F7A5A" strokeWidth={3} />
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
                                                label={({ method, percent }: any) => {
                                                    const config = useStore.getState().shopInfo.paymentMethods?.find((m: any) => m.name === method || m.id === method);
                                                    return `${config?.name || method}: ${(percent * 100).toFixed(0)}%`;
                                                }}
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

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
