import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../store/useAuth';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import './DashboardMobile.css';

export const DashboardMobile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const products = useStore(state => state.products);
    const orders = useStore(state => state.orders);
    const customers = useStore(state => state.customers);
    const transactions = useStore(state => state.transactions);
    const suppliers = useStore(state => state.suppliers);
    const registerPayment = useStore(state => state.registerPayment);
    const notificationsLastSeenCount = useStore(state => state.notificationsLastSeenCount);

    const loadProducts = useStore(state => state.loadProducts);
    const loadOrders = useStore(state => state.loadOrders);
    const loadCustomers = useStore(state => state.loadCustomers);
    const loadTransactions = useStore(state => state.loadTransactions);

    // Modal cobro de deuda
    const [debtPaymentModal, setDebtPaymentModal] = useState<{ open: boolean; customerId: string; customerName: string; maxAmount: number }>({
        open: false, customerId: '', customerName: '', maxAmount: 0
    });
    const [paymentAmount, setPaymentAmount] = useState('');

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

    // Calculate total notifications count
    const notificationCount = useMemo(() => {
        let count = 0;
        const getDaysDiff = (dateStr: string) => {
            if (!dateStr) return 999;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
            const nextTarget = new Date(today.getFullYear(), target.getMonth(), target.getDate());
            if (nextTarget < today) nextTarget.setFullYear(today.getFullYear() + 1);
            return Math.ceil((nextTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        };
        customers.forEach(c => {
            if (c.birthday && getDaysDiff(c.birthday) <= 7) count++;
            if (c.anniversary && getDaysDiff(c.anniversary) <= 7) count++;
            if (c.debtBalance > 0) count++;
        });
        products.forEach(p => { if (p.stock <= p.min) count++; });
        suppliers?.forEach(s => {
            if (s.lastVisit) {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const visitDate = new Date(s.lastVisit); visitDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((visitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntil >= 0 && daysUntil <= 3) count++;
            }
        });
        return count > notificationsLastSeenCount ? count : 0;
    }, [customers, products, suppliers, notificationsLastSeenCount]);

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

        const debtors = (customers || [])
            .filter(c => (Number(c.debtBalance) || 0) > 0)
            .sort((a, b) => (Number(b.debtBalance) || 0) - (Number(a.debtBalance) || 0))
            .slice(0, 5);

        return {
            todaysSales: tSales,
            todaysOrders: tOrders,
            criticalProducts: cProducts,
            totalDebt: tDebt,
            upcomingOrders: uOrders,
            debtors
        };
    }, [products, transactions, orders, customers]);

    const handleCollectDebt = async () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0 || amount > debtPaymentModal.maxAmount) return;

        try {
            await registerPayment(debtPaymentModal.customerId, amount);
            setDebtPaymentModal({ open: false, customerId: '', customerName: '', maxAmount: 0 });
            setPaymentAmount('');
            await loadCustomers();
        } catch (err) {
            console.error('Error registering payment:', err);
        }
    };

    const sendWhatsAppReminder = (customer: any) => {
        const phone = customer.phone.replace(/\D/g, '');
        const debt = Number(customer.debtBalance) || 0;
        const message = `Hola ${customer.name}! Te recordamos que tenés una deuda de $${debt.toLocaleString()} en Mi Jardín. ¿Podés pasar a abonar? ¡Gracias!`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const formattedDate = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
    const isAdmin = user?.role === 'admin';

    const quickActions = [
        { label: 'Vender', icon: 'point_of_sale', path: '/pos', color: '#5E9B7E', bg: '#D7EFE1' },
        { label: 'Tienda', icon: 'storefront', path: '/personalizar-tienda', color: '#8B5CF6', bg: '#EDF0FD' },
        { label: 'Pedidos', icon: 'receipt_long', path: '/pedidos', color: '#6FAE8D', bg: '#EAE7E0' },
        { label: 'Stock', icon: 'inventory_2', path: '/productos', color: '#DFA6A0', bg: '#F6F5F1' },
        { label: 'Clientes', icon: 'group', path: '/clientes', color: '#D8C3A5', bg: '#F6F5F1' },
        { label: 'Proveedores', icon: 'local_shipping', path: '/proveedores', color: '#425149', bg: '#EAE7E0' },
        { label: 'Reportes', icon: 'bar_chart', path: '/reportes', color: '#5E9B7E', bg: '#F6F5F1' },
        { label: 'Caja', icon: 'payments', path: '/caja', color: '#6FAE8D', bg: '#D7EFE1' },
        { label: 'Ajustes', icon: 'settings', path: '/configuracion', color: '#425149', bg: '#F6F5F1' },
    ];

    return (
        <div className="dashboard-mobile-wrapper bento-layout">
            {/* Header - Bento Style */}
            <header className="mobile-dashboard-header bento-header">
                <div className="header-greeting">
                    <div className="greeting-left">
                        <span className="welcome-text">¡Hola, {user?.name?.split(' ')[0]}! 🌿</span>
                        <span className="current-date">{formattedDate}</span>
                    </div>
                    <div className="header-actions">
                        <button 
                            className="inline-notification-bell" 
                            onClick={() => window.dispatchEvent(new CustomEvent('open-notifications'))}
                        >
                            <Bell size={22} />
                            {notificationCount > 0 && (
                                <span className="bell-badge">{notificationCount > 9 ? '9+' : notificationCount}</span>
                            )}
                        </button>
                        <div className="greeting-avatar">
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Métricas */}
            <div className="metrics-container">
                {isAdmin && (
                    <div className="metric-hero" onClick={() => navigate('/caja')}>
                        <div className="metric-hero-inner">
                            <span className="material-symbols-rounded metric-hero-icon">trending_up</span>
                            <div className="metric-hero-text">
                                <span className="metric-hero-label">Ventas de hoy</span>
                                <span className="metric-hero-value">${metrics.todaysSales.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="hero-wave-bg">
                            <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="rgba(255,255,255,0.12)" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                            </svg>
                        </div>
                    </div>
                )}
                <div className="metrics-row">
                    <div className="metric-card metric-orders" onClick={() => navigate('/pedidos')}>
                        <span className="material-symbols-rounded mc-icon">local_mall</span>
                        <span className="mc-value">{metrics.todaysOrders}</span>
                        <span className="mc-label">Pedidos</span>
                    </div>
                    <div className="metric-card metric-deliveries" onClick={() => navigate('/pedidos')}>
                        <span className="material-symbols-rounded mc-icon">local_shipping</span>
                        <span className="mc-value">{metrics.upcomingOrders.length}</span>
                        <span className="mc-label">Entregas</span>
                    </div>
                    <div className="metric-card metric-stock" onClick={() => navigate('/productos')}>
                        <span className="material-symbols-rounded mc-icon">warning</span>
                        <span className="mc-value">{metrics.criticalProducts.length}</span>
                        <span className="mc-label">Alertas</span>
                    </div>
                    {isAdmin && (
                        <div className="metric-card metric-debt" onClick={() => navigate('/clientes?filter=debt')}>
                            <span className="material-symbols-rounded mc-icon">account_balance</span>
                            <span className="mc-value">${metrics.totalDebt > 999 ? Math.round(metrics.totalDebt / 1000) + 'k' : metrics.totalDebt.toLocaleString()}</span>
                            <span className="mc-label">Deudas</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Accesos Rápidos - Scroll Horizontal */}
            <div className="quick-scroll-section">
                <div className="quick-scroll-track">
                    {quickActions.map(action => (
                        <button key={action.label} className="qa-chip" onClick={() => navigate(action.path)}>
                            <div className="qa-chip-icon" style={{ background: action.bg, color: action.color }}>
                                <span className="material-symbols-rounded">{action.icon}</span>
                            </div>
                            <span className="qa-chip-label">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Listas */}
            <div className="dashboard-lists">
                {/* Stock Crítico */}
                {isAdmin && metrics.criticalProducts.length > 0 && (
                    <section className="dash-section">
                        <div className="dash-section-head">
                            <h3>⚠️ Stock Crítico</h3>
                            <button onClick={() => navigate('/reposicion')}>Reponer</button>
                        </div>
                        <div className="dash-list">
                            {metrics.criticalProducts.slice(0, 4).map(item => (
                                <div key={item.id} className="dash-list-item stock-alert" onClick={() => navigate('/reposicion')}>
                                    <div className="dli-icon dli-icon-red">
                                        <span className="material-symbols-rounded">warning</span>
                                    </div>
                                    <div className="dli-content">
                                        <span className="dli-title">{item.name}</span>
                                        <span className="dli-sub">Stock: <strong>{item.stock}</strong> / Mín: {item.min}</span>
                                    </div>
                                    <span className="dli-badge dli-badge-red">{item.stock === 0 ? 'Agotado' : 'Bajo'}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Deudores */}
                {isAdmin && metrics.debtors.length > 0 && (
                    <section className="dash-section">
                        <div className="dash-section-head">
                            <h3>💰 Cuentas a Cobrar</h3>
                            <button onClick={() => navigate('/clientes?filter=debt')}>Ver Todos</button>
                        </div>
                        <div className="dash-list">
                            {metrics.debtors.map(customer => (
                                <div key={customer.id} className="dash-list-item">
                                    <div className="dli-icon dli-icon-amber">
                                        {customer.name.charAt(0)}
                                    </div>
                                    <div className="dli-content">
                                        <span className="dli-title">{customer.name}</span>
                                        <span className="dli-sub">${Number(customer.debtBalance).toLocaleString()}</span>
                                    </div>
                                    <div className="dli-actions">
                                        <button className="dli-action-btn dli-collect" onClick={(e) => {
                                            e.stopPropagation();
                                            setDebtPaymentModal({ open: true, customerId: customer.id, customerName: customer.name, maxAmount: Number(customer.debtBalance) || 0 });
                                        }}>
                                            <span className="material-symbols-rounded">payments</span>
                                        </button>
                                        <button className="dli-action-btn dli-wa" onClick={(e) => {
                                            e.stopPropagation();
                                            sendWhatsAppReminder(customer);
                                        }}>
                                            <span className="material-symbols-rounded">chat</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Próximas Entregas */}
                <section className="dash-section">
                    <div className="dash-section-head">
                        <h3>Próximas Entregas</h3>
                        <button onClick={() => navigate('/pedidos')}>Ver Todo</button>
                    </div>
                    <div className="dash-list">
                        {metrics.upcomingOrders.length === 0 ? (
                            <div className="dash-empty">Sin entregas pendientes 🎉</div>
                        ) : (
                            metrics.upcomingOrders.map(order => (
                                <div key={order.id} className="dash-list-item" onClick={() => navigate('/pedidos')}>
                                    <div className="dli-icon dli-icon-blue">
                                        {order.customerName.charAt(0)}
                                    </div>
                                    <div className="dli-content">
                                        <span className="dli-title">{order.customerName}</span>
                                        <span className="dli-sub">
                                            {new Date(order.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} • {order.deliveryTimeSlot}
                                        </span>
                                    </div>
                                    <span className={`dli-badge dli-badge-${order.status}`}>
                                        {order.status === 'pending' ? 'Pte' : order.status === 'assembling' ? 'Armando' : order.status === 'ready' ? 'Listo' : order.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* Modal Cobro de Deuda */}
            {debtPaymentModal.open && (
                <div className="debt-payment-overlay" onClick={() => setDebtPaymentModal({ open: false, customerId: '', customerName: '', maxAmount: 0 })}>
                    <div className="debt-payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="debt-modal-header">
                            <h3>Cobrar a {debtPaymentModal.customerName}</h3>
                            <button onClick={() => setDebtPaymentModal({ open: false, customerId: '', customerName: '', maxAmount: 0 })}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div className="debt-modal-body">
                            <div className="debt-amount-display">
                                <span className="debt-label-sm">Deuda total:</span>
                                <span className="debt-value-sm">${debtPaymentModal.maxAmount.toLocaleString()}</span>
                            </div>
                            <label>Monto a cobrar:</label>
                            <input
                                type="number"
                                className="debt-payment-input"
                                placeholder="Ingresar monto..."
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                max={debtPaymentModal.maxAmount}
                                min={0}
                                step={100}
                                autoFocus
                            />
                            <button
                                className="debt-payment-full-btn"
                                onClick={() => setPaymentAmount(String(debtPaymentModal.maxAmount))}
                            >
                                Cobrar todo (${debtPaymentModal.maxAmount.toLocaleString()})
                            </button>
                        </div>
                        <div className="debt-modal-footer">
                            <button className="debt-cancel-btn" onClick={() => setDebtPaymentModal({ open: false, customerId: '', customerName: '', maxAmount: 0 })}>
                                Cancelar
                            </button>
                            <button
                                className="debt-confirm-btn"
                                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > debtPaymentModal.maxAmount}
                                onClick={handleCollectDebt}
                            >
                                Confirmar Cobro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
