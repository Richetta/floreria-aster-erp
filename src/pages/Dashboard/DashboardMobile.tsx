import { useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { useNavigate } from 'react-router-dom';
import './DashboardMobile.css';

export const DashboardMobile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const products = useStore(state => state.products);
    const orders = useStore(state => state.orders);
    const customers = useStore(state => state.customers);
    const transactions = useStore(state => state.transactions);
    
    const loadProducts = useStore(state => state.loadProducts);
    const loadOrders = useStore(state => state.loadOrders);
    const loadCustomers = useStore(state => state.loadCustomers);
    const loadTransactions = useStore(state => state.loadTransactions);

    useEffect(() => {
        const loadData = async () => {
            try {
                await Promise.allSettled([
                    loadProducts(),
                    loadOrders(),
                    loadCustomers(),
                    loadTransactions()
                ]);
            } catch (err) {
                console.error("DashboardMobile: Data load error", err);
            }
        };
        loadData();
    }, []);

    const metrics = useMemo(() => {
        const isToday = (dateStr: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            return d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
        };

        const tSales = transactions
            .filter(t => t.type === 'income' && isToday(t.date))
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        
        const tOrders = (orders || []).filter(o => isToday(o.date) && o.status !== 'delivered').length;
        const cProducts = (products || []).filter(p => p.stock <= p.min);
        const tDebt = (customers || []).reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);

        const uOrders = orders
            .filter(o => o.status !== 'delivered')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5);

        return { todaysSales: tSales, todaysOrders: tOrders, criticalProducts: cProducts, totalDebt: tDebt, upcomingOrders: uOrders };
    }, [products, transactions, orders, customers]);

    const formattedDate = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
    const isAdmin = user?.role === 'admin';

    return (
        <div className="dashboard-mobile-wrapper">
            {/* Header / Saludo */}
            <header className="mobile-dashboard-header">
                <div className="header-top">
                    <div className="user-info">
                        <span className="welcome-text">¡Hola, {user?.name?.split(' ')[0]}! 👋</span>
                        <h2 className="current-date">{formattedDate}</h2>
                    </div>
                </div>
            </header>

            {/* Métricas Apiladas (1 per row) */}
            <div className="metrics-stack-container">
                <div className="metrics-stack-track">
                    {isAdmin && (
                        <div className="metric-card income" onClick={() => navigate('/caja')}>
                            <div className="m-card-content">
                                <span className="m-card-label">Ingresos Hoy</span>
                                <div className="m-card-value">${metrics.todaysSales.toLocaleString()}</div>
                            </div>
                            <span className="material-symbols-rounded m-card-icon">payments</span>
                        </div>
                    )}
                    
                    <div className="metric-card orders" onClick={() => navigate('/pedidos')}>
                        <div className="m-card-content">
                            <span className="m-card-label">Pedidos Hoy</span>
                            <div className="m-card-value">{metrics.todaysOrders}</div>
                        </div>
                        <span className="material-symbols-rounded m-card-icon">local_shipping</span>
                    </div>

                    {isAdmin && metrics.totalDebt > 0 && (
                        <div className="metric-card debt" onClick={() => navigate('/clientes')}>
                            <div className="m-card-content">
                                <span className="m-card-label">Cuentas Corrientes</span>
                                <div className="m-card-value">${metrics.totalDebt.toLocaleString()}</div>
                            </div>
                            <span className="material-symbols-rounded m-card-icon">person_alert</span>
                        </div>
                    )}

                    <div className="metric-card stock" onClick={() => navigate('/productos')}>
                        <div className="m-card-content">
                            <span className="m-card-label">Stock Crítico</span>
                            <div className="m-card-value">{metrics.criticalProducts.length} Items</div>
                        </div>
                        <span className="material-symbols-rounded m-card-icon">warning</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <section className="mobile-quick-actions">
                <button className="q-action-btn" onClick={() => navigate('/pos')}>
                    <div className="q-icon-wrap pos-bg">
                        <span className="material-symbols-rounded">add_shopping_cart</span>
                    </div>
                    <span>Nueva Venta</span>
                </button>
                <button className="q-action-btn" onClick={() => navigate('/pedidos')}>
                    <div className="q-icon-wrap orders-bg">
                        <span className="material-symbols-rounded">format_list_bulleted</span>
                    </div>
                    <span>Ver Pedidos</span>
                </button>
                <button className="q-action-btn" onClick={() => navigate('/productos')}>
                    <div className="q-icon-wrap cat-bg">
                        <span className="material-symbols-rounded">package_2</span>
                    </div>
                    <span>Inventario</span>
                </button>
                <button className="q-action-btn" onClick={() => navigate('/caja')}>
                    <div className="q-icon-wrap cash-bg">
                        <span className="material-symbols-rounded">account_balance_wallet</span>
                    </div>
                    <span>Caja</span>
                </button>
            </section>

            {/* List Sections */}
            <div className="mobile-dashboard-lists">
                {/* Entregas Próximas */}
                <section className="mobile-section">
                    <div className="section-head">
                        <h3>Próximas Entregas</h3>
                        <button onClick={() => navigate('/pedidos')}>Ver Todo</button>
                    </div>
                    <div className="mobile-list-track">
                        {metrics.upcomingOrders.length === 0 ? (
                            <div className="empty-state-list">No hay entregas pendientes</div>
                        ) : (
                            metrics.upcomingOrders.map(order => (
                                <div key={order.id} className="mobile-list-item" onClick={() => navigate('/pedidos')}>
                                    <div className="item-leading">
                                        <div className="initial-circle">
                                            {order.customerName.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="item-content">
                                        <div className="item-title">{order.customerName}</div>
                                        <div className="item-subtitle">
                                            {new Date(order.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} • {order.deliveryTimeSlot}
                                        </div>
                                    </div>
                                    <div className={`item-trailing-status ${order.status}`}>
                                        {order.status === 'pending' ? 'Pte' : 'Armando'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                </div>
            </div>
    );
};
