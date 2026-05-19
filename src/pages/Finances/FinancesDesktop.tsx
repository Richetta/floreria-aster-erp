import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    Plus,
    AlertCircle,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Users,
    Receipt,
    X,
    Check,
    CreditCard,
    Banknote,
    ChevronDown,
    Target,
    Sparkles,
    Clock,
    Settings,
    AlertTriangle,
    CheckCircle2,
    CalendarDays,
    Hourglass,
    Trash2,
    TrendingUp as TrendUpIcon
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal } from '../../components/ui/Modals';
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

const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    }).format(new Date(dateString));
};

// --- TRANSACTION ITEM COMPONENT ---
const TransactionItem = ({ t }: { t: any }) => {
    const isIncome = t.type === 'income' || t.type === 'sale' || t.type === 'payment_received';
    const [isExpanded, setIsExpanded] = useState(false);
    const products = useStore(state => state.products);
    const packages = useStore(state => state.packages);

    const getMethodIcon = (methodName: string) => {
        const name = (methodName || '').toLowerCase();
        if (name.includes('mercado pago') || name.includes('mercadopago') || name.includes('mp')) {
            return <img src="https://www.mercadopago.com/org-rc/vendors/mptools/assets/logo.png" alt="MP" style={{ width: '14px', height: 'auto', marginRight: '4px' }} />;
        }
        if (name.includes('efectivo')) return <Banknote size={12} className="mr-1" />;
        return <CreditCard size={12} className="mr-1" />;
    };

    const items = t.metadata?.items || [];
    const hasDetails = items.length > 0 || t.notes || (t.description && !isIncome);

    return (
        <div className={`transaction-item-container ${isExpanded ? 'expanded' : ''}`}>
            <div 
                className={`transaction-item ${isIncome ? 'transaction-income' : 'transaction-expense'} ${hasDetails ? 'clickable' : ''}`}
                onClick={() => hasDetails && setIsExpanded(!isExpanded)}
            >
                <div className="transaction-icon">
                    {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                </div>
                <div className="transaction-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="transaction-category">{t.category}</div>
                        <div className="method-badge-sm" style={{ 
                            fontSize: '0.65rem', 
                            padding: '1px 6px', 
                            background: '#f1f5f9', 
                            borderRadius: '4px', 
                            display: 'flex', 
                            alignItems: 'center',
                            color: '#64748b'
                        }}>
                            {getMethodIcon(t.method)}
                            {t.method || 'S/A'}
                        </div>
                    </div>
                    <div className="transaction-desc">{t.description || 'Sin descripción'}</div>
                </div>
                <div className="transaction-amount-wrap">
                    <div className="transaction-amount">
                        <div className={`amount-value ${isIncome ? 'amount-positive' : 'amount-negative'}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                        </div>
                        <div className="amount-date">{formatDate(t.date)}</div>
                    </div>
                    {hasDetails && (
                        <div className={`expand-arrow ${isExpanded ? 'rotated' : ''}`}>
                            <ChevronDown size={16} />
                        </div>
                    )}
                </div>
            </div>
            
            {isExpanded && (
                <div className="transaction-details-expanded">
                    {items.length > 0 && (
                        <div className="details-items-table">
                            <div className="details-table-header">
                                <span>Producto</span>
                                <span className="text-center">Cant.</span>
                                <span className="text-right">Precio</span>
                                <span className="text-right">Subtotal</span>
                            </div>
                            {items.map((item: any, idx: number) => (
                                <div key={idx} className="details-table-row">
                                    <span className="detail-name">
                                        {item.name || item.product_name || 
                                         (item.product_id ? products.find(p => p.id === item.product_id)?.name : null) ||
                                         (item.package_id ? packages.find(p => p.id === item.package_id)?.name : null) ||
                                         'Producto'}
                                    </span>
                                    <span className="text-center">{item.qty || item.quantity}</span>
                                    <span className="text-right">{formatCurrency(item.price || item.unit_price)}</span>
                                    <span className="text-right">{formatCurrency((item.price || item.unit_price) * (item.qty || item.quantity))}</span>
                                </div>
                            ))}
                            <div className="details-table-footer">
                                <span>Total Detallado</span>
                                <span className="total-val">{formatCurrency(t.amount)}</span>
                            </div>
                        </div>
                    )}
                    
                    {(t.notes || (t.description && !items.length)) && (
                        <div className="details-notes">
                            <span className="notes-label">Notas / Info Adicional:</span>
                            <p>{t.notes || t.description}</p>
                        </div>
                    )}
                    
                    <div className="details-meta">
                        <span>ID: {t.id.toUpperCase()}</span>
                        <span>•</span>
                        <span>Fecha: {new Date(t.date).toLocaleString('es-AR')}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DEBTOR CARD COMPONENT ---
const DebtorCard = ({ debtor, onCollect }: { debtor: any; onCollect: (id: string, amount: string) => void }) => {
    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        const phoneClean = (debtor.phone || '').replace(/[^0-9]/g, '');
        // Usar formato internacional si no empieza con prefijo. Asumimos Argentina +54 9 si tiene 10 dígitos.
        const phoneFormatted = phoneClean.length === 10 ? `549${phoneClean}` : phoneClean;
        const msg = encodeURIComponent(`¡Hola ${debtor.name}! Te escribimos de Florería Aster para enviarte un saludo y recordarte de manera amigable tu saldo pendiente en cuenta corriente por un total de ${formatCurrency(debtor.debtBalance)}. Te adjuntamos tu resumen. ¡Muchas gracias por tu confianza de siempre! 🌸`);
        window.open(`https://api.whatsapp.com/send?phone=${phoneFormatted}&text=${msg}`, '_blank');
    };

    return (
        <div className="debtor-card" onClick={() => onCollect(debtor.id, debtor.debtBalance.toString())}>
            <div className="debtor-avatar">
                <span>{debtor.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="debtor-details">
                <div className="debtor-name">{debtor.name}</div>
                <div className="debtor-contact">{debtor.phone || 'Sin teléfono'}</div>
            </div>
            <div className="debtor-balance">
                <div className="debtor-label">Debe</div>
                <div className="debtor-value">{formatCurrency(debtor.debtBalance)}</div>
            </div>
            <div className="debtor-actions">
                <button className="debtor-whatsapp-btn" onClick={handleWhatsApp} title="Recordar por WhatsApp">
                    💬 WhatsApp
                </button>
                <button className="debtor-collect-btn">
                    <Receipt size={14} />
                    Cobrar
                </button>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const FinancesDesktop = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const orders = useStore((state) => state.orders) || [];
    const products = useStore((state) => state.products) || [];
    const addTransaction = useStore((state) => state.addTransaction);
    const registerPayment = useStore((state) => state.registerPayment);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadOrders = useStore((state) => state.loadOrders);
    const shopInfo = useStore((state) => state.shopInfo);

    // --- COCKPIT STATES ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'planning' | 'history'>('dashboard');
    const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
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

    const [isLoading, setIsLoading] = useState(true);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: shopInfo.paymentMethods?.[0]?.name || 'cash'
    });
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; customerId: string; amount: string; method: string }>({
        isOpen: false, customerId: '', amount: '', method: shopInfo.paymentMethods?.[0]?.name || 'cash'
    });

    const { confirmModal, showConfirm } = useModal();

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
        if (t.type === 'income') acc[method].income += (Number(t.amount) || 0);
        else acc[method].expense += (Number(t.amount) || 0);
        return acc;
    }, {});

    const totalIncome = analytics.totalIncome;
    const totalDebt = (customers || []).reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);
    const debtors = (customers || []).filter(c => (Number(c.debtBalance) || 0) > 0).sort((a, b) => (Number(b.debtBalance) || 0) - (Number(a.debtBalance) || 0));
    const incomeCount = (transactions || []).filter(t => t.type === 'income').length;
    const expenseCount = (transactions || []).filter(t => t.type === 'expense').length;

    // --- GOAL PROGRESS ---
    const goalPercentage = Math.min(100, Math.round((totalIncome / monthlyGoal) * 100));

    // --- HANDLERS ---
    const handleSaveGoal = () => {
        const parsed = parseFloat(goalInput);
        if (parsed > 0) {
            setMonthlyGoal(parsed);
            localStorage.setItem('finances_monthly_goal', parsed.toString());
            setIsEditingGoal(false);
        }
    };

    const handleSaveFixedCosts = () => {
        const parsed = parseFloat(fixedCostsInput);
        if (parsed >= 0) {
            setFixedCosts(parsed);
            localStorage.setItem('finances_fixed_costs', parsed.toString());
            setIsEditingFixedCosts(false);
        }
    };

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

        setShowExpenseModal(false);
        setExpenseForm({ amount: '', category: 'Insumos', description: '', method: shopInfo.paymentMethods?.[0]?.name || 'cash' });
        loadTransactions();
    };

    const handleProcessDebtPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(paymentModal.amount);
        if (!amt || amt <= 0 || !paymentModal.customerId) return;

        const customer = customers.find(c => c.id === paymentModal.customerId);
        if (!customer) return;

        await registerPayment(customer.id, amt);
        await addTransaction({
            id: generateIdWithPrefix('t'),
            type: 'income',
            amount: amt,
            category: 'Cobro Deuda',
            description: `Pago sobre cuenta de ${customer.name}`,
            method: paymentModal.method,
            date: new Date().toISOString(),
            relatedId: customer.id
        });

        setPaymentModal({ isOpen: false, customerId: '', amount: '', method: shopInfo.paymentMethods?.[0]?.name || 'cash' });
        loadCustomers();
        loadTransactions();
    };

    const handleCollectAll = async () => {
        if (totalDebt === 0) return;
        const confirmed = await showConfirm({
            title: '¿Cobrar todas las deudas?',
            message: `Se cobrarán ${formatCurrency(totalDebt)} en efectivo de ${debtors.length} clientes.`,
            confirmText: 'Cobrar todo',
            variant: 'warning'
        });
        if (confirmed) {
            for (const d of debtors) {
                await registerPayment(d.id, d.debtBalance);
                await addTransaction({
                    id: generateIdWithPrefix('t'),
                    type: 'income',
                    amount: d.debtBalance,
                    category: 'Cobro Masivo',
                    description: `Cobro total de cuenta: ${d.name}`,
                    method: shopInfo.paymentMethods?.find(m => m.type === 'cash')?.name || 'cash',
                    date: new Date().toISOString(),
                    relatedId: d.id
                });
            }
            loadCustomers();
            loadTransactions();
        }
    };

    const openPaymentModal = (customerId: string, amount: string) => {
        setPaymentModal({ isOpen: true, customerId, amount, method: shopInfo.paymentMethods?.[0]?.name || 'cash' });
    };

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
                
                {/* Navigation Tabs */}
                <div className="finances-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <Sparkles size={16} />
                        Panel Inteligente
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'planning' ? 'active' : ''}`}
                        onClick={() => setActiveTab('planning')}
                    >
                        <Target size={16} />
                        Metas y Proyecciones
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <Clock size={16} />
                        Libro Diario
                    </button>
                </div>

                <button className="btn-add-expense" onClick={() => setShowExpenseModal(true)}>
                    <Plus size={18} />
                    Registrar Gasto
                </button>
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
                        {goalPercentage >= 80 ? '🔥 ¡Excelente ritmo de ventas!' : '💪 Sigamos impulsando la temporada'}
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
                        <span className="card-count">{debtors.length} morosos</span>
                    </div>
                    <div className="card-amount amount-red">{formatCurrency(totalDebt)}</div>
                    <div className="card-footer-text">
                        {totalDebt > 0 ? (
                            <button className="collect-all-btn-sm" onClick={handleCollectAll}>
                                Cobrar todas las cuentas
                            </button>
                        ) : '✨ Todo cobrado y al día'}
                    </div>
                </div>
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'dashboard' && (
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
                                    analytics.vipCustomers.map((vip, idx) => (
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
            )}

            {/* TAB CONTENT: PLANNING & GOALS */}
            {activeTab === 'planning' && (
                <div className="planning-tab-container">
                    {/* Monthly Targets Card */}
                    <div className="bi-card target-progress-card">
                        <div className="target-header-row">
                            <div className="target-title-block">
                                <Target size={24} className="text-emerald" />
                                <div>
                                    <h2>Meta Mensual de Ventas</h2>
                                    <p>Gamificación y evolución del negocio</p>
                                </div>
                            </div>
                            <div className="target-actions">
                                {isEditingGoal ? (
                                    <div className="goal-edit-input-wrap">
                                        <input 
                                            type="number" 
                                            value={goalInput}
                                            onChange={e => setGoalInput(e.target.value)}
                                            className="goal-input-inline"
                                            autoFocus
                                        />
                                        <button className="goal-save-btn" onClick={handleSaveGoal}>
                                            <Check size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button className="goal-settings-btn" onClick={() => { setGoalInput(monthlyGoal.toString()); setIsEditingGoal(true); }}>
                                        <Settings size={16} />
                                        Ajustar Meta
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Gamified progress bar */}
                        <div className="gamified-progress-bar-container">
                            <div className="progress-labels">
                                <span className="progress-current">{formatCurrency(totalIncome)}</span>
                                <span className="progress-percent-badge">{goalPercentage}%</span>
                                <span className="progress-max">{formatCurrency(monthlyGoal)}</span>
                            </div>
                            <div className="progress-bar-track">
                                <div 
                                    className={`progress-bar-fill ${goalPercentage >= 100 ? 'gold-glow' : ''}`}
                                    style={{ width: `${goalPercentage}%` }}
                                >
                                    {goalPercentage >= 100 && <Sparkles size={12} className="star-sparkle" />}
                                </div>
                            </div>
                            <div className="progress-motivation-text">
                                {goalPercentage >= 100 
                                    ? '🏆 ¡Felicidades! Has superado con creces el objetivo mensual del local.' 
                                    : `Faltan ${formatCurrency(Math.max(0, monthlyGoal - totalIncome))} para concretar tu meta mensual.`}
                            </div>
                        </div>
                    </div>

                    {/* Operational Break-Even Card */}
                    <div className="bi-card target-progress-card mt-4">
                        <div className="target-header-row">
                            <div className="target-title-block">
                                <Wallet size={24} className="text-blue" />
                                <div>
                                    <h2>Punto de Equilibrio Operativo</h2>
                                    <p>Gastos fijos y rentabilidad del local comercial</p>
                                </div>
                            </div>
                            <div className="target-actions">
                                {isEditingFixedCosts ? (
                                    <div className="goal-edit-input-wrap">
                                        <input 
                                            type="number" 
                                            value={fixedCostsInput}
                                            onChange={e => setFixedCostsInput(e.target.value)}
                                            className="goal-input-inline"
                                            autoFocus
                                        />
                                        <button className="goal-save-btn" onClick={handleSaveFixedCosts}>
                                            <Check size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button className="goal-settings-btn btn-blue-border" onClick={() => { setFixedCostsInput(fixedCosts.toString()); setIsEditingFixedCosts(true); }}>
                                        <Settings size={16} />
                                        Ajustar Costos Fijos
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="breakeven-info-grid">
                            <div className="breakeven-stat">
                                <span className="stat-label">Gastos Fijos Cargados</span>
                                <h3 className="stat-value">{formatCurrency(fixedCosts)}</h3>
                            </div>
                            <div className="breakeven-stat">
                                <span className="stat-label">Margen de Ganancia Promedio</span>
                                <h3 className="stat-value text-amber">{analytics.estimatedProfitMargin}%</h3>
                            </div>
                            <div className="breakeven-stat">
                                <span className="stat-label">Facturación Necesaria</span>
                                <h3 className="stat-value text-blue">{formatCurrency(analytics.breakEven.breakEvenRevenue)}</h3>
                            </div>
                            <div className="breakeven-stat">
                                <span className="stat-label">Pedidos Mínimos</span>
                                <h3 className="stat-value text-purple">{analytics.breakEven.breakEvenTickets} ordenes</h3>
                            </div>
                        </div>

                        {/* Break-Even progress bar */}
                        <div className="gamified-progress-bar-container">
                            <div className="progress-labels">
                                <span className="progress-current">{formatCurrency(totalIncome)}</span>
                                <span className="progress-percent-badge badge-blue">{analytics.breakEven.progressPercentage}%</span>
                                <span className="progress-max">{formatCurrency(analytics.breakEven.breakEvenRevenue)}</span>
                            </div>
                            <div className="progress-bar-track">
                                <div 
                                    className={`progress-bar-fill bar-fill-blue ${analytics.breakEven.status === 'rentable' ? 'blue-glow' : ''}`}
                                    style={{ width: `${analytics.breakEven.progressPercentage}%` }}
                                >
                                    {analytics.breakEven.status === 'rentable' && <Sparkles size={12} className="star-sparkle" />}
                                </div>
                            </div>
                            <div className="progress-motivation-text">
                                {analytics.breakEven.status === 'rentable' 
                                    ? '🎉 ¡Negocio en Zona de Rentabilidad! Los costos fijos mensuales están cubiertos al 100%.' 
                                    : `Faltan ${formatCurrency(analytics.breakEven.gapToCover)} de facturación neta para superar el punto de equilibrio.`}
                            </div>
                        </div>
                    </div>

                    <div className="bi-grid-two mt-4">
                        {/* Florist Seasonality */}
                        <div className="bi-card seasonality-card">
                            <div className="bi-card-header">
                                <CalendarDays size={20} className="text-purple" />
                                <h2>Estacionalidad & Temporada</h2>
                            </div>
                            <div className="seasonality-details">
                                <div className="season-hero">
                                    <div className="season-tag">{analytics.seasonality.currentSeasonName}</div>
                                    <div className={`season-intensity ${analytics.seasonality.seasonType}`}>
                                        Demanda {analytics.seasonality.seasonType.toUpperCase()}
                                    </div>
                                </div>
                                <p className="season-desc">{analytics.seasonality.description}</p>
                                
                                <div className="season-countdown-box">
                                    <div className="countdown-number">{analytics.seasonality.daysToNextKeyDate}</div>
                                    <div className="countdown-info">
                                        <h4>Días para {analytics.seasonality.nextKeyDateName}</h4>
                                        <p>Preparación operativa y logística recomendada.</p>
                                    </div>
                                </div>

                                <div className="recommended-actions">
                                    <h4>🎯 Acciones Estratégicas Sugeridas:</h4>
                                    <ul>
                                        {analytics.seasonality.recommendedActions.map((action, idx) => (
                                            <li key={idx}>
                                                <CheckCircle2 size={14} className="text-emerald" />
                                                <span>{action}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Forecast Prediction Card */}
                        <div className="bi-card forecast-card">
                            <div className="bi-card-header">
                                <TrendUpIcon size={20} className="text-emerald" />
                                <h2>Predicción de Ventas</h2>
                            </div>
                            <div className="forecast-body">
                                <div className="forecast-hero">
                                    <span className="forecast-label">Proyección Próxima Semana</span>
                                    <h3 className="forecast-val">{formatCurrency(analytics.forecast.projectedNextWeekSales)}</h3>
                                    <div className={`forecast-trend trend-${analytics.forecast.trendDirection}`}>
                                        {analytics.forecast.trendDirection === 'up' ? '↗' : analytics.forecast.trendDirection === 'down' ? '↘' : '→'}
                                        {analytics.forecast.trendPercentage}%
                                    </div>
                                </div>
                                <div className="forecast-interpretation">
                                    <p>{analytics.forecast.humanInterpretation}</p>
                                </div>
                                <div className="forecast-meta-info">
                                    <AlertCircle size={14} className="text-blue" />
                                    <span>Calculado dinámicamente mediante regresión lineal sobre las últimas 4 semanas de pedidos y compras.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: HISTORY & LEDGER (Preserves all original functionalities) */}
            {activeTab === 'history' && (
                <div className="finances-main">
                    {/* Transactions Section */}
                    <section className="finances-section transactions-section">
                        <div className="section-header">
                            <div className="section-title">
                                <Receipt size={20} />
                                <h2>Historial de Movimientos</h2>
                            </div>
                            <div className="section-badges">
                                <span className="badge-green">{incomeCount} ingresos</span>
                                <span className="badge-red">{expenseCount} egresos</span>
                            </div>
                        </div>

                        <div className="transactions-grid">
                            {/* Income Column */}
                            <div className="transactions-column">
                                <div className="column-header header-green">
                                    <div className="header-dot dot-green"></div>
                                    <span>Ingresos</span>
                                </div>
                                <div className="transactions-list">
                                    {(transactions || []).filter(t => t.type === 'income').length === 0 ? (
                                        <div className="empty-column">
                                            <div className="empty-icon">📥</div>
                                            <p>Sin ingresos aún</p>
                                        </div>
                                    ) : (
                                        [...(transactions || [])].filter(t => t.type === 'income').map(t => (
                                            <TransactionItem key={t.id} t={t} />
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Expense Column */}
                            <div className="transactions-column">
                                <div className="column-header header-red">
                                    <div className="header-dot dot-red"></div>
                                    <span>Egresos</span>
                                </div>
                                <div className="transactions-list">
                                    {(transactions || []).filter(t => t.type === 'expense').length === 0 ? (
                                        <div className="empty-column">
                                            <div className="empty-icon">📤</div>
                                            <p>Sin egresos aún</p>
                                        </div>
                                    ) : (
                                        [...(transactions || [])].filter(t => t.type === 'expense').map(t => (
                                            <TransactionItem key={t.id} t={t} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Debtors Section */}
                    <section className="finances-section debtors-section">
                        <div className="section-header">
                            <div className="section-title">
                                <Users size={20} />
                                <h2>Cuentas Fiadas</h2>
                            </div>
                            {debtors.length > 0 && (
                                <span className="badge-amber">{debtors.length} pendientes</span>
                            )}
                        </div>

                        <div className="debtors-list">
                            {debtors.length === 0 ? (
                                <div className="empty-debtors">
                                    <div className="empty-debtors-icon">✅</div>
                                    <h3>¡Todo al día!</h3>
                                    <p>No hay cuentas pendientes</p>
                                </div>
                            ) : (
                                debtors.map(d => (
                                    <DebtorCard key={d.id} debtor={d} onCollect={openPaymentModal} />
                                ))
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* Expense Modal (Preserved exactly) */}
            {showExpenseModal && (
                <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-custom">
                            <div className="modal-title-wrap">
                                <div className="modal-icon-red">
                                    <ArrowDownLeft size={22} />
                                </div>
                                <div>
                                    <h2>Registrar Gasto</h2>
                                    <p>Completa los datos del movimiento</p>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setShowExpenseModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddExpense} className="modal-form">
                            <div className="form-field">
                                <label>Monto del gasto</label>
                                <div className="input-with-icon">
                                    <DollarSign size={18} />
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        placeholder="0"
                                        value={expenseForm.amount}
                                        onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-field">
                                    <label>Categoría</label>
                                    <select
                                        value={expenseForm.category}
                                        onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                    >
                                        <option value="Sueldos/Jornales">Sueldos/Jornales</option>
                                        <option value="Insumos">Insumos Varios</option>
                                        <option value="Mercadería (Flores)">Mercadería (Flores)</option>
                                        <option value="Logística/Moto">Logística/Moto</option>
                                        <option value="Servicios/Luz/Internet">Servicios Diarios</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Medio de pago</label>
                                    <select
                                        value={expenseForm.method}
                                        onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value })}
                                    >
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
                            </div>

                            <div className="form-field">
                                <label>Concepto</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pago de flete flores..."
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowExpenseModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-submit btn-submit-red">
                                    <Check size={16} />
                                    Confirmar Gasto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal (Preserved exactly) */}
            {paymentModal.isOpen && (
                <div className="modal-overlay" onClick={() => setPaymentModal({ ...paymentModal, isOpen: false, customerId: '', amount: '' })}>
                    <div className="modal-container modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-custom">
                            <div className="modal-title-wrap">
                                <div className="modal-icon-green">
                                    <ArrowUpRight size={22} />
                                </div>
                                <div>
                                    <h2>Cobrar Deuda</h2>
                                    <p>Registrá el pago del cliente</p>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setPaymentModal({ ...paymentModal, isOpen: false, customerId: '', amount: '' })}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleProcessDebtPayment} className="modal-form">
                            <div className="form-field">
                                <label>Monto a recibir</label>
                                <div className="input-with-icon input-green">
                                    <DollarSign size={18} />
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        max={customers.find(c => c.id === paymentModal.customerId)?.debtBalance}
                                        value={paymentModal.amount}
                                        onChange={e => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label>Cuenta de cobro</label>
                                <select
                                    value={paymentModal.method}
                                    onChange={e => setPaymentModal({ ...paymentModal, method: e.target.value })}
                                >
                                    {(shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0) ? (
                                        shopInfo.paymentMethods.map(m => (
                                            <option key={m.id} value={m.name}>{m.name}</option>
                                        ))
                                    ) : (
                                        <option value="cash">Efectivo</option>
                                    )}
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setPaymentModal({ ...paymentModal, isOpen: false, customerId: '', amount: '' })}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-submit">
                                    <Check size={16} />
                                    Registrar Cobro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};
