import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Plus,
    AlertCircle,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Calendar,
    Search,
    Users,
    Receipt,
    X,
    Check,
    Tag,
    CreditCard,
    Banknote
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal } from '../../components/ui/Modals';
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
    const isIncome = t.type === 'income';

    return (
        <div className={`transaction-item ${isIncome ? 'transaction-income' : 'transaction-expense'}`}>
            <div className="transaction-icon">
                {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
            </div>
            <div className="transaction-info">
                <div className="transaction-category">{t.category}</div>
                <div className="transaction-desc">{t.description || 'Sin descripción'}</div>
            </div>
            <div className="transaction-amount">
                <div className={`amount-value ${isIncome ? 'amount-positive' : 'amount-negative'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                </div>
                <div className="amount-date">{formatDate(t.date)}</div>
            </div>
        </div>
    );
};

// --- DEBTOR CARD COMPONENT ---
const DebtorCard = ({ debtor, onCollect }: { debtor: any; onCollect: (id: string, amount: string) => void }) => (
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
        <button className="debtor-collect-btn">
            <Receipt size={14} />
            Cobrar
        </button>
    </div>
);

// --- MAIN COMPONENT ---
export const FinancesDesktop = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const addTransaction = useStore((state) => state.addTransaction);
    const registerPayment = useStore((state) => state.registerPayment);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);

    const [isLoading, setIsLoading] = useState(true);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: 'cash' as 'cash' | 'transfer'
    });
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; customerId: string; amount: string }>({
        isOpen: false, customerId: '', amount: ''
    });

    const { confirmModal, showConfirm } = useModal();

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadTransactions(), loadCustomers()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    // --- CALCULATIONS ---
    const incomeByMethod = {
        cash: (transactions || []).filter(t => t.type === 'income' && t.method === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        card: (transactions || []).filter(t => t.type === 'income' && t.method === 'card').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        transfer: (transactions || []).filter(t => t.type === 'income' && t.method === 'transfer').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    };

    const expenseByMethod = {
        cash: (transactions || []).filter(t => t.type === 'expense' && t.method === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        transfer: (transactions || []).filter(t => t.type === 'expense' && t.method === 'transfer').reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    };

    const totalIncome = Object.values(incomeByMethod).reduce((a, b) => Number(a) + Number(b), 0);
    const totalExpense = Object.values(expenseByMethod).reduce((a, b) => Number(a) + Number(b), 0);
    const netBalance = totalIncome - totalExpense;
    const totalDebt = (customers || []).reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);
    const debtors = (customers || []).filter(c => (Number(c.debtBalance) || 0) > 0).sort((a, b) => (Number(b.debtBalance) || 0) - (Number(a.debtBalance) || 0));
    const incomeCount = (transactions || []).filter(t => t.type === 'income').length;
    const expenseCount = (transactions || []).filter(t => t.type === 'expense').length;

    // --- HANDLERS ---
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
        setExpenseForm({ amount: '', category: 'Insumos', description: '', method: 'cash' });
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
            method: 'cash',
            date: new Date().toISOString(),
            relatedId: customer.id
        });

        setPaymentModal({ isOpen: false, customerId: '', amount: '' });
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
                    method: 'cash',
                    date: new Date().toISOString(),
                    relatedId: d.id
                });
            }
            loadCustomers();
            loadTransactions();
        }
    };

    const openPaymentModal = (customerId: string, amount: string) => {
        setPaymentModal({ isOpen: true, customerId, amount });
    };

    // Payment method breakdown data
    const incomeMethods = [
        { label: 'Efectivo', value: incomeByMethod.cash, icon: Banknote, color: '#4CAF50' },
        { label: 'Transferencia', value: incomeByMethod.transfer, icon: CreditCard, color: '#4F7A5A' },
    ];

    const expenseMethods = [
        { label: 'Efectivo', value: expenseByMethod.cash, icon: Banknote, color: '#E57373' },
        { label: 'Banco', value: expenseByMethod.transfer, icon: CreditCard, color: '#FFA726' },
    ];

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

            {/* Page Header */}
            <header className="finances-header">
                <div className="header-left">
                    <div className="header-icon">
                        <Wallet size={28} />
                    </div>
                    <div className="header-text">
                        <h1>Movimientos</h1>
                        <p>Control de ingresos, egresos y cuentas pendientes</p>
                    </div>
                </div>
                <button className="btn-add-expense" onClick={() => setShowExpenseModal(true)}>
                    <Plus size={18} />
                    Registrar Gasto
                </button>
            </header>

            {/* Summary Cards */}
            <div className="summary-cards">
                {/* Income Card */}
                <div className="summary-card card-income">
                    <div className="card-top">
                        <div className="card-badge">
                            <TrendingUp size={14} />
                            Ingresos
                        </div>
                        <span className="card-count">{incomeCount} movimientos</span>
                    </div>
                    <div className="card-amount amount-green">{formatCurrency(totalIncome)}</div>
                    <div className="card-breakdown">
                        {incomeMethods.filter(m => m.value > 0).map((m, i) => (
                            <div key={i} className="breakdown-item">
                                <m.icon size={12} style={{ color: m.color }} />
                                <span>{m.label}</span>
                                <strong>{formatCurrency(m.value)}</strong>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Expense Card */}
                <div className="summary-card card-expense">
                    <div className="card-top">
                        <div className="card-badge badge-red">
                            <TrendingDown size={14} />
                            Egresos
                        </div>
                        <span className="card-count">{expenseCount} movimientos</span>
                    </div>
                    <div className="card-amount amount-red">{formatCurrency(totalExpense)}</div>
                    <div className="card-breakdown">
                        {expenseMethods.filter(m => m.value > 0).map((m, i) => (
                            <div key={i} className="breakdown-item">
                                <m.icon size={12} style={{ color: m.color }} />
                                <span>{m.label}</span>
                                <strong>{formatCurrency(m.value)}</strong>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Balance Card */}
                <div className="summary-card card-balance">
                    <div className="card-top">
                        <div className="card-badge badge-sage">
                            <DollarSign size={14} />
                            Balance
                        </div>
                        <div className="balance-indicator">
                            <Calendar size={12} />
                            <span>Hoy</span>
                        </div>
                    </div>
                    <div className={`card-amount ${netBalance >= 0 ? 'amount-sage' : 'amount-red'}`}>
                        {formatCurrency(netBalance)}
                    </div>
                    <div className="card-footer-text">
                        {netBalance >= 0 ? 'Balance positivo ✓' : 'Balance negativo ⚠'}
                    </div>
                </div>

                {/* Debt Card */}
                <div className="summary-card card-debt">
                    <div className="card-top">
                        <div className="card-badge badge-amber">
                            <AlertCircle size={14} />
                            Cuentas Fiadas
                        </div>
                        <span className="card-count">{debtors.length} clientes</span>
                    </div>
                    <div className="card-amount amount-amber">{formatCurrency(totalDebt)}</div>
                    <div className="card-footer-text">
                        {totalDebt > 0 && (
                            <button className="collect-all-btn" onClick={handleCollectAll}>
                                Cobrar todas las cuentas
                            </button>
                        )}
                        {totalDebt === 0 && <span>✨ Sin deudas pendientes</span>}
                    </div>
                </div>
            </div>

            {/* Main Content */}
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

            {/* Expense Modal */}
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
                                        onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value as any })}
                                    >
                                        <option value="cash">Efectivo</option>
                                        <option value="transfer">Transferencia</option>
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

            {/* Payment Modal */}
            {paymentModal.isOpen && (
                <div className="modal-overlay" onClick={() => setPaymentModal({ isOpen: false, customerId: '', amount: '' })}>
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
                            <button className="modal-close" onClick={() => setPaymentModal({ isOpen: false, customerId: '', amount: '' })}>
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

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setPaymentModal({ isOpen: false, customerId: '', amount: '' })}>
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
