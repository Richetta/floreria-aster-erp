import { useMemo, useEffect, useState } from 'react';
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
    const registerPayment = useStore(state => state.registerPayment);

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

    return (
        <div className="dashboard-mobile-wrapper">
            {/* Header / Saludo */}
            <header className="mobile-dashboard-header">
                <div className="header-nav-row">
                    <button className="icon-btn-ghost" onClick={() => navigate('/menu')}>
                        <span className="material-symbols-rounded">menu</span>
                    </button>
                    <h1 className="header-title">Dashboard</h1>
                    <button className="icon-btn-ghost" onClick={() => navigate('/alertas')}>
                        <span className="material-symbols-rounded">notifications_active</span>
                    </button>
                </div>
                <div className="header-welcome-row">
                    <span className="welcome-text">¡Hola, {user?.name?.split(' ')[0]}! 🌱</span>
                    <h2 className="current-date">{formattedDate}</h2>
                </div>
            </header>

            {/* Métricas Hero y Secundarias */}
            <div className="metrics-dashboard-container">
                {isAdmin && (
                    <div className="hero-metric-card" onClick={() => navigate('/caja')}>
                        <div className="hero-content">
                            <span className="hero-label">Ventas de hoy</span>
                            <div className="hero-value">${metrics.todaysSales.toLocaleString()}</div>
                            <span className="hero-sub">{metrics.todaysOrders} pedidos</span>
                        </div>
                        {/* Fake SVG wave background */}
                        <div className="hero-wave-bg">
                            <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="rgba(255,255,255,0.15)" fillOpacity="1" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                            </svg>
                        </div>
                    </div>
                )}

                <div className="secondary-metrics-row">
                    <div className="secondary-metric-card" onClick={() => navigate('/pedidos')}>
                        <span className="sec-label">Pedidos hoy</span>
                        <div className="sec-value">{metrics.todaysOrders}</div>
                        <span className="sec-sub">pendientes</span>
                    </div>
                    <div className="secondary-metric-card" onClick={() => navigate('/pedidos')}>
                        <span className="sec-label">Entregas hoy</span>
                        <div className="sec-value">{metrics.upcomingOrders.length}</div>
                        <span className="sec-sub">programadas</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="quick-actions-section">
                <h3 className="section-title-inline">Accesos rápidos</h3>
                <section className="mobile-quick-actions">
                    <button className="q-action-btn" onClick={() => navigate('/pos')}>
                        <div className="q-icon-wrap line-icon">
                            <span className="material-symbols-rounded">shopping_cart</span>
                        </div>
                        <span>Vender</span>
                    </button>
                    <button className="q-action-btn" onClick={() => navigate('/pedidos')}>
                        <div className="q-icon-wrap line-icon">
                            <span className="material-symbols-rounded">receipt_long</span>
                        </div>
                        <span>Pedidos</span>
                    </button>
                    <button className="q-action-btn" onClick={() => navigate('/productos')}>
                        <div className="q-icon-wrap line-icon">
                            <span className="material-symbols-rounded">inventory_2</span>
                        </div>
                        <span>Inventario</span>
                    </button>
                    <button className="q-action-btn" onClick={() => navigate('/clientes')}>
                        <div className="q-icon-wrap line-icon">
                            <span className="material-symbols-rounded">group</span>
                        </div>
                        <span>Clientes</span>
                    </button>
                    <button className="q-action-btn" onClick={() => navigate('/proveedores')}>
                        <div className="q-icon-wrap line-icon">
                            <span className="material-symbols-rounded">local_shipping</span>
                        </div>
                        <span>Proveedores</span>
                    </button>
                    <button className="q-action-btn" onClick={() => navigate('/reportes')}>
                        <div className="q-icon-wrap line-icon">
                            <span className="material-symbols-rounded">bar_chart</span>
                        </div>
                        <span>Reportes</span>
                    </button>
                </section>
            </div>

            {/* List Sections */}
            <div className="mobile-dashboard-lists">
                {/* ⚠️ Stock Crítico (solo si hay alertas) */}
                {isAdmin && metrics.criticalProducts.length > 0 && (
                    <section className="mobile-section">
                        <div className="section-head">
                            <h3>⚠️ Stock Crítico</h3>
                            <button onClick={() => navigate('/reposicion')}>Reponer</button>
                        </div>
                        <div className="mobile-list-track">
                            {metrics.criticalProducts.slice(0, 5).map(item => (
                                <div key={item.id} className="mobile-list-item stock-alert-item" onClick={() => navigate('/reposicion')}>
                                    <div className="item-leading">
                                        <div className="initial-circle stock-alert-icon">
                                            <span className="material-symbols-rounded" style={{ fontSize: '20px', color: '#ef4444' }}>warning</span>
                                        </div>
                                    </div>
                                    <div className="item-content">
                                        <div className="item-title">{item.name}</div>
                                        <div className="item-subtitle">
                                            Stock: <strong>{item.stock}</strong> (Mín: {item.min})
                                        </div>
                                    </div>
                                    <div className="item-trailing-status critical">
                                        {item.stock === 0 ? 'Agotado' : 'Bajo'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 💰 Deudores (solo si hay deudas) */}
                {isAdmin && metrics.debtors.length > 0 && (
                    <section className="mobile-section">
                        <div className="section-head">
                            <h3>💰 Cuentas a Cobrar</h3>
                            <button onClick={() => navigate('/clientes?filter=debt')}>Ver Todos</button>
                        </div>
                        <div className="mobile-list-track">
                            {metrics.debtors.map(customer => (
                                <div key={customer.id} className="mobile-list-item debtor-item">
                                    <div className="item-leading">
                                        <div className="initial-circle debtor-avatar">
                                            {customer.name.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="item-content">
                                        <div className="item-title">{customer.name}</div>
                                        <div className="item-subtitle">
                                            ${Number(customer.debtBalance).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="debtor-actions">
                                        <button
                                            className="debtor-action-btn collect-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDebtPaymentModal({
                                                    open: true,
                                                    customerId: customer.id,
                                                    customerName: customer.name,
                                                    maxAmount: Number(customer.debtBalance) || 0
                                                });
                                            }}
                                        >
                                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>payments</span>
                                        </button>
                                        <button
                                            className="debtor-action-btn whatsapp-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                sendWhatsAppReminder(customer);
                                            }}
                                        >
                                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>chat</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

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
                            <button
                                className="debt-cancel-btn"
                                onClick={() => setDebtPaymentModal({ open: false, customerId: '', customerName: '', maxAmount: 0 })}
                            >
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
