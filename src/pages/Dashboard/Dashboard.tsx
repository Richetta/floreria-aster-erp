import { useMemo, useEffect } from 'react';
import {
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    Clock,
    Users,
    Package,
    ShoppingCart,
    MessageCircle,
    DollarSign,
    Sun
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationsPanel } from '../../components/Notifications/NotificationsPanel';
import './Dashboard.css';

export const Dashboard = () => {
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

    // Load data from backend on mount
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
                console.error("Error loading dashboard data:", err);
            }
        };
        loadData();
    }, []);

    // Fecha dinámica
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(today);

    // Calcular KPIs según el rol del usuario
    const metrics = useMemo(() => {
        const isToday = (dateStr: string) => {
            if (!dateStr) return false;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return false;
                const dStr = d.toISOString().split('T')[0];
                const tStr = new Date().toISOString().split('T')[0];
                return dStr === tStr;
            } catch {
                return false;
            }
        };

        // Sum all actual money that came in today (sales + order advance payments)
        const tSales = transactions
            .filter(t => t.type === 'income' && isToday(t.date))
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        // Count pending/assembling orders scheduled for today
        const tOrders = orders.filter(o => isToday(o.date) && o.status !== 'delivered').length;

        // Products at or below minimum stock
        const cProducts = products.filter(p => p.stock <= p.min);

        // Total money owed by clients
        const tDebt = customers.reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);

        // Closest upcoming orders (Max 5)
        const uOrders = orders
            .filter(o => o.status !== 'delivered')
            .sort((a, b) => {
                const da = a.date ? new Date(a.date).getTime() : 0;
                const db = b.date ? new Date(b.date).getTime() : 0;
                return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
            })
            .slice(0, 5);

        return {
            todaysSales: tSales,
            todaysOrders: tOrders,
            criticalProducts: cProducts,
            totalDebt: tDebt,
            upcomingOrders: uOrders
        };
    }, [products, transactions, orders, customers]);

    const { todaysSales, todaysOrders, criticalProducts, totalDebt, upcomingOrders } = metrics;

    // Determinar si es dueña (admin) o empleado
    const isAdmin = user?.role === 'admin';

    return (
        <div className="dashboard">
            <header className="dashboard-header mb-6">
                <div>
                    <h1 className="text-h1">
                        ¡Buen día{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                        <Sun size={28} className="text-warning" style={{ display: 'inline', marginLeft: '0.5rem', verticalAlign: 'middle' }} />
                    </h1>
                    <p className="text-body mt-2">
                        {isAdmin
                            ? 'Aquí tenés el resumen completo de hoy.'
                            : 'Aquí tenés lo que necesitas para hoy.'}
                        <br />
                        {formattedDate}.
                    </p>
                </div>
                <button className="btn btn-primary start-sale-btn" onClick={() => navigate('/pos')}>
                    Nueva Venta Rápida
                </button>
            </header>

            {/* KPI Cards - Diferentes según el rol */}
            <section className="kpi-grid mb-6">
                {/* Ventas del Día - Solo para Admin */}
                {isAdmin && (
                    <div className="card kpi-card">
                        <div className="kpi-icon-wrapper bg-success-light">
                            <TrendingUp className="text-success" size={24} />
                        </div>
                        <div className="kpi-content">
                            <h3 className="text-small">Ventas del Día</h3>
                            <p className="text-h2">${todaysSales.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {/* Pedidos para Hoy - Para todos */}
                <div className="card kpi-card">
                    <div className="kpi-icon-wrapper bg-warning-light">
                        <Clock className="text-warning" size={24} />
                    </div>
                    <div className="kpi-content">
                        <h3 className="text-small">Pedidos para Hoy</h3>
                        <p className="text-h2">{todaysOrders}</p>
                    </div>
                </div>

                {/* Deudas - Solo para Admin */}
                {isAdmin && (
                    <div className="card kpi-card">
                        <div className="kpi-icon-wrapper bg-danger-light">
                            <AlertCircle className="text-danger" size={24} />
                        </div>
                        <div className="kpi-content">
                            <h3 className="text-small">Deudas a Cobrar</h3>
                            <p className="text-h2">${totalDebt.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {/* Stock Crítico - Para todos */}
                <div className="card kpi-card">
                    <div className="kpi-icon-wrapper bg-primary-light">
                        <AlertTriangle className="text-primary" size={24} />
                    </div>
                    <div className="kpi-content">
                        <h3 className="text-small">Alertas de Stock</h3>
                        <p className="text-h2">{criticalProducts.length} Items</p>
                    </div>
                </div>
            </section>

            {/* Secondary stats - compact row */}
            {isAdmin && (
                <section className="kpi-secondary mb-6">
                    <div className="kpi-secondary-item">
                        <Users size={18} className="text-primary" />
                        <span className="text-small">{customers.length} clientes</span>
                    </div>
                    <div className="kpi-secondary-item">
                        <Package size={18} className="text-success" />
                        <span className="text-small">{products.length} productos en stock</span>
                    </div>
                </section>
            )}

            {/* KPIs para Empleado */}
            {!isAdmin && (
                <section className="kpi-secondary mb-6">
                    <div className="kpi-secondary-item">
                        <ShoppingCart size={18} className="text-success" />
                        <span className="text-small">{products.filter(p => p.stock > 0).length} productos disponibles</span>
                    </div>
                </section>
            )}

            <div className="dashboard-grid">
                {/* Urgent Actions / Orders */}
                <section className="card">
                    <h2 className="text-h3 mb-4">Pedidos más próximos</h2>
                    <div className="order-list">
                        {upcomingOrders.length === 0 ? (
                            <p className="text-body text-center py-4 text-muted">No hay pedidos pendientes ✨</p>
                        ) : (
                            upcomingOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="order-item cursor-pointer hover:bg-surface-hover rounded-lg transition-colors p-2"
                                    onClick={() => navigate('/pedidos')}
                                >
                                    <div className="order-info flex-1">
                                        <h4 className="font-bold flex items-center justify-between">
                                            {order.customerName}
                                            <span className={`badge ${order.status === 'pending' ? 'badge-warning' : 'badge-primary'}`}>
                                                {order.status === 'pending' ? 'Pendiente' : 'En Armado'}
                                            </span>
                                        </h4>
                                        <p className="text-small text-muted flex items-center gap-1 mt-1">
                                            <Clock size={14} />
                                            {(() => {
                                                try {
                                                    if (!order.date) return '';
                                                    const d = new Date(order.date);
                                                    if (isNaN(d.getTime())) return order.date;
                                                    return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
                                                } catch { return order.date || ''; }
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Low Stock Alerts */}
                <section className="card">
                    <h2 className="text-h3 mb-4">Stock Crítico</h2>
                    <div className="stock-list">
                        {criticalProducts.length === 0 ? (
                            <p className="text-body text-center py-4 text-muted">Todo el stock está en orden</p>
                        ) : (
                            criticalProducts.map((item) => (
                                <div key={item.id} className="stock-item flex justify-between items-center bg-surface p-3 rounded-lg border border-danger-light mb-2">
                                    <div className="stock-info">
                                        <h4 className="font-bold">{item.name}</h4>
                                        <p className="text-small text-danger mt-1">
                                            Quedan {item.stock} (Mín: {item.min})
                                        </p>
                                    </div>
                                    <Link to="/productos" className="btn btn-secondary text-small bg-white hover:bg-surface border-border">Reponer</Link>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* Notifications Panel */}
            <section className="card mt-6">
                <NotificationsPanel />
            </section>

            {/* Recordatorio de Deudas - Solo Admin */}
            {isAdmin && totalDebt > 0 && (
                <section className="card mt-6 bg-warning-light border border-warning">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-h3 flex items-center gap-2">
                            <DollarSign size={24} className="text-warning" />
                            Recordatorio de Deudas
                        </h2>
                        <span className="badge badge-danger text-large">
                            ${totalDebt.toLocaleString()}
                        </span>
                    </div>

                    <div className="debtors-quick-list">
                        {customers
                            .filter(c => c.debtBalance > 0)
                            .slice(0, 5)
                            .map(customer => (
                                <div key={customer.id} className="debtor-row flex justify-between items-center py-2 border-b border-border last:border-0">
                                    <div>
                                        <p className="font-bold">{customer.name}</p>
                                        <p className="text-small text-muted">{customer.phone}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-danger font-bold">
                                            ${customer.debtBalance.toLocaleString()}
                                        </span>
                                        <a
                                            href={`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                                `Hola ${customer.name}! Te recordamos que tenés una deuda de $${customer.debtBalance.toLocaleString()} en Florería Aster. ¿Podés pasar a abonar? ¡Gracias!`
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-success btn-sm"
                                        >
                                            <MessageCircle size={16} />
                                            Enviar recordatorio
                                        </a>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    {customers.filter(c => c.debtBalance > 0).length > 5 && (
                        <div className="text-center mt-4">
                            <button
                                className="btn btn-secondary"
                                onClick={() => navigate('/clientes?filter=debt')}
                            >
                                Ver todos los deudores ({customers.filter(c => c.debtBalance > 0).length})
                            </button>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};
