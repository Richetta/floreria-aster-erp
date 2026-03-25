import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Plus,
    FileText,
    AlertCircle,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Calendar,
    Search
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    }).format(new Date(dateString));
};

// --- COMPONENTS ---
const LedgerItemPremium = ({ t }: { t: any }) => (
    <div className="ledger-item">
        <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
                <span className="text-small font-bold text-text">{t.category}</span>
                <span className="text-micro text-muted uppercase tracking-tighter">{t.description || 'Sin descripción'}</span>
            </div>
            <div className="text-right">
                <div className={`font-bold flex items-center gap-1 ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                    {t.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                    {formatCurrency(t.amount)}
                </div>
                <span className="text-micro text-muted font-medium">{formatDate(t.date)}</span>
            </div>
        </div>
    </div>
);

export const Finances = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const addTransaction = useStore((state) => state.addTransaction);
    const registerPayment = useStore((state) => state.registerPayment);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadTransactions(), loadCustomers()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: 'cash' as 'cash' | 'transfer'
    });

    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, customerId: string, amount: string }>({
        isOpen: false, customerId: '', amount: ''
    });

    const { confirmModal, showConfirm } = useModal();

    // --- CALCULATIONS (SAFE NUMERIC REDUCTION) ---
    const totalAccountsReceivable = (customers || []).reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);

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
    const netBalance = Number(totalIncome) - Number(totalExpense);

    const debtors = (customers || []).filter(c => (Number(c.debtBalance) || 0) > 0)
        .sort((a, b) => (Number(b.debtBalance) || 0) - (Number(a.debtBalance) || 0));

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
        loadTransactions(); // Reload to be sure
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
        const totalToCollect = debtors.reduce((sum, d) => sum + (Number(d.debtBalance) || 0), 0);
        if (totalToCollect === 0) return;

        const confirmed = await showConfirm({
            title: '¿Cobrar todas las deudas?',
            message: `Se cobrarán ${formatCurrency(totalToCollect)} en efectivo de ${debtors.length} clientes. Esta acción no se puede deshacer.`,
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

    return (
        <div className="finances-page">
            {/* Loading State */}
            {isLoading && (
                <div className="loading-overlay" style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(255,255,255,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: 60,
                            height: 60,
                            border: '5px solid #f3f4f6',
                            borderTopColor: '#9b51e0',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1.5rem'
                        }}></div>
                        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '1.1rem' }}>Sincronizando finanzas...</p>
                    </div>
                </div>
            )}

            <header className="page-header">
                <div>
                    <h1 className="text-h1 flex items-center gap-3">
                        <Wallet className="text-primary" size={32} />
                        Caja y Finanzas
                    </h1>
                    <p className="text-body text-muted mt-1">Gestión integral de flujos de caja y proyecciones.</p>
                </div>
                <button className="btn btn-primary shadow-lg hover:translate-y-[-2px] transition-all" onClick={() => setShowExpenseModal(true)}>
                    <Plus size={20} />
                    Asentar Gasto
                </button>
            </header>

            {/* Premium Metric Cards */}
            <div className="metrics-grid">
                <div className="glass-panel metric-card income">
                    <div className="metric-header">
                        <span className="text-small font-bold text-muted uppercase">Ingresos Totales</span>
                        <div className="metric-icon-box"><TrendingUp size={20} /></div>
                    </div>
                    <h2 className="metric-value text-success">{formatCurrency(totalIncome)}</h2>
                    <div className="metric-footer">
                        <span className="pill bg-success-light">Ef: {formatCurrency(incomeByMethod.cash)}</span>
                        <span className="pill bg-primary-light">Tr: {formatCurrency(incomeByMethod.transfer)}</span>
                    </div>
                </div>

                <div className="glass-panel metric-card expense">
                    <div className="metric-header">
                        <span className="text-small font-bold text-muted uppercase">Egresos / Salidas</span>
                        <div className="metric-icon-box"><TrendingDown size={20} /></div>
                    </div>
                    <h2 className="metric-value text-danger">{formatCurrency(totalExpense)}</h2>
                    <div className="metric-footer">
                        <span className="pill bg-danger-light">Caja: {formatCurrency(expenseByMethod.cash)}</span>
                        <span className="pill bg-surface-hover">Banco: {formatCurrency(expenseByMethod.transfer)}</span>
                    </div>
                </div>

                <div className="glass-panel metric-card balance">
                    <div className="metric-header">
                        <span className="text-small font-bold text-muted uppercase">Balance Neto</span>
                        <div className="metric-icon-box"><DollarSign size={20} /></div>
                    </div>
                    <h2 className={`metric-value ${netBalance >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(netBalance)}</h2>
                    <div className="metric-footer">
                        <span className="text-micro text-muted font-bold flex items-center gap-1">
                            <Calendar size={12} />
                            Estado al momento
                        </span>
                    </div>
                </div>

                <div className="glass-panel metric-card debt">
                    <div className="metric-header">
                        <span className="text-small font-bold text-muted uppercase">Cuentas Pendientes</span>
                        <div className="metric-icon-box"><AlertCircle size={20} /></div>
                    </div>
                    <h2 className="metric-value text-warning">{formatCurrency(totalAccountsReceivable)}</h2>
                    <div className="metric-footer">
                        <button className="text-micro text-primary font-bold hover:underline" onClick={handleCollectAll}>
                            Saldar Cuentas
                        </button>
                    </div>
                </div>
            </div>

            <div className="finances-content">
                {/* Ledger Panel */}
                <div className="glass-panel ledger-container">
                    <div className="ledger-header">
                        <h3 className="text-h3 flex items-center gap-2">
                            <FileText size={24} className="text-primary" />
                            Historial de Movimientos
                        </h3>
                        <div className="flex gap-2">
                            <span className="pill bg-success-light">Ingresos</span>
                            <span className="pill bg-danger-light">Egresos</span>
                        </div>
                    </div>

                    <div className="ledger-columns">
                        <div className="ledger-column">
                            <span className="column-title">
                                <TrendingUp size={16} className="text-success" />
                                Entradas de Caja
                            </span>
                            <div className="ledger-scroll">
                                {[...(transactions || [])].filter(t => t.type === 'income').map(t => (
                                    <LedgerItemPremium key={t.id} t={t} />
                                ))}
                                {(transactions || []).filter(t => t.type === 'income').length === 0 && (
                                    <div className="text-center py-10 opacity-40 italic">No hay ingresos registrados hoy</div>
                                )}
                            </div>
                        </div>

                        <div className="ledger-column">
                            <span className="column-title">
                                <TrendingDown size={16} className="text-danger" />
                                Salidas de Caja
                            </span>
                            <div className="ledger-scroll">
                                {[...(transactions || [])].filter(t => t.type === 'expense').map(t => (
                                    <LedgerItemPremium key={t.id} t={t} />
                                ))}
                                {(transactions || []).filter(t => t.type === 'expense').length === 0 && (
                                    <div className="text-center py-10 opacity-40 italic">No hay egresos registrados hoy</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Debtors Panel */}
                <div className="glass-panel debtors-container">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-h3 flex items-center gap-2">
                            <Search size={22} className="text-warning" />
                            Cuentas Fiadas
                        </h3>
                        <span className="pill bg-warning-light">{debtors.length} Clientes</span>
                    </div>

                    <div className="debtors-list overflow-y-auto pr-2" style={{ maxHeight: '600px' }}>
                        {debtors.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-h1 mb-4">✨</div>
                                <h4 className="text-success font-bold">¡Todo cobrado!</h4>
                                <p className="text-small text-muted">No hay deudas pendientes en el sistema.</p>
                            </div>
                        ) : (
                            debtors.map(d => (
                                <div key={d.id} className="debtor-card-premium">
                                    <div className="debtor-info">
                                        <h4>{d.name}</h4>
                                        <p>{d.phone}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="debt-amount">
                                            <span className="text-micro text-muted font-bold uppercase">Balance</span>
                                            <span className="debt-value">{formatCurrency(d.debtBalance)}</span>
                                        </div>
                                        <button
                                            className="btn btn-primary px-4 py-2 text-small shadow-sm"
                                            onClick={() => setPaymentModal({ isOpen: true, customerId: d.id, amount: d.debtBalance.toString() })}
                                        >
                                            Cobrar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: New Expense */}
            {showExpenseModal && (
                <div className="modal-backdrop backdrop-blur-md">
                    <div className="modal-content glass-panel p-8 max-w-lg w-full">
                        <h2 className="text-h2 mb-4 text-danger flex items-center gap-2">
                            <ArrowDownLeft size={28} />
                            Asentar Salida
                        </h2>
                        <form onSubmit={handleAddExpense} className="flex flex-col gap-5">
                            <div>
                                <label className="form-label text-muted font-bold">Monto del Gasto</label>
                                <div className="relative mt-1">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
                                    <input required type="number" min="1" className="form-input text-h3 pl-10" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} autoFocus placeholder="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label text-muted">Categoría</label>
                                    <select className="form-input" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                                        <option value="Sueldos/Jornales">Sueldos/Jornales</option>
                                        <option value="Insumos">Insumos Varios</option>
                                        <option value="Mercadería (Flores)">Mercadería (Flores)</option>
                                        <option value="Logística/Moto">Logística/Moto</option>
                                        <option value="Servicios/Luz/Internet">Servicios Diarios</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label text-muted">Medio de Pago</label>
                                    <select className="form-input" value={expenseForm.method} onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value as any })}>
                                        <option value="cash">Efectivo (Caja)</option>
                                        <option value="transfer">Banco (Transf/Tarj)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="form-label text-muted">Concepto / Detalle</label>
                                <input type="text" className="form-input" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ej: Pago de flete flores..." />
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" className="btn bg-surface border border-border" onClick={() => setShowExpenseModal(false)}>Cancelar</button>
                                <button type="submit" className="btn bg-danger text-white hover:bg-red-600 transition-colors">Confirmar Salida</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Process Debt Payment */}
            {paymentModal.isOpen && (
                <div className="modal-backdrop backdrop-blur-md">
                    <div className="modal-content glass-panel p-8 max-w-lg w-full">
                        <h2 className="text-h2 mb-4 text-primary flex items-center gap-2">
                            <ArrowUpRight size={28} />
                            Cobrar Deuda
                        </h2>
                        <form onSubmit={handleProcessDebtPayment} className="flex flex-col gap-6">
                            <div>
                                <label className="form-label text-muted font-bold">Monto a Recibir</label>
                                <div className="relative mt-1">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-success" size={24} />
                                    <input required type="number" min="1" max={customers.find(c => c.id === paymentModal.customerId)?.debtBalance} className="form-input text-h2 font-bold text-success pl-10" value={paymentModal.amount} onChange={e => setPaymentModal({ ...paymentModal, amount: e.target.value })} autoFocus />
                                </div>
                                <p className="text-tiny text-muted mt-2 italic">El dinero ingresará directamente al flujo de caja de hoy.</p>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" className="btn bg-surface border border-border" onClick={() => setPaymentModal({ isOpen: false, customerId: '', amount: '' })}>Cancelar</button>
                                <button type="submit" className="btn btn-primary text-white shadow-lg">Registrar Cobro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmModal && <ConfirmModal {...confirmModal} />}
        </div>
    );
};
