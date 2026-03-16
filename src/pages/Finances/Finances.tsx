import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Plus,
    FileText,
    AlertCircle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import './Finances.css';

const LedgerItem = ({ t }: { t: any }) => (
    <div className="ledger-mini-item mb-2 p-2 border border-border rounded bg-background">
        <div className="flex justify-between items-center">
            <span className="text-tiny font-bold truncate max-w-[100px]">{t.category}</span>
            <span className={`text-tiny font-bold ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
            </span>
        </div>
        <div className="flex justify-between items-center mt-1">
            <span className="text-micro text-muted truncate max-w-[80px]">{t.description}</span>
            <span className="text-micro text-muted">
                {new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(t.date))}
            </span>
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

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load data from backend on mount
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

    // Total numbers
    const totalAccountsReceivable = customers.reduce((sum, c) => sum + c.debtBalance, 0);

    // Totals by Method
    const incomeByMethod = {
        cash: transactions.filter(t => t.type === 'income' && t.method === 'cash').reduce((sum, t) => sum + t.amount, 0),
        card: transactions.filter(t => t.type === 'income' && t.method === 'card').reduce((sum, t) => sum + t.amount, 0),
        transfer: transactions.filter(t => t.type === 'income' && t.method === 'transfer').reduce((sum, t) => sum + t.amount, 0),
    };

    const expenseByMethod = {
        cash: transactions.filter(t => t.type === 'expense' && t.method === 'cash').reduce((sum, t) => sum + t.amount, 0),
        transfer: transactions.filter(t => t.type === 'expense' && t.method === 'transfer').reduce((sum, t) => sum + t.amount, 0),
    };

    // Debtors List
    const debtors = customers.filter(c => c.debtBalance > 0).sort((a, b) => b.debtBalance - a.debtBalance);

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(expenseForm.amount);
        if (!amt || amt <= 0) return;

        addTransaction({
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
    };

    const handleProcessDebtPayment = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(paymentModal.amount);
        if (!amt || amt <= 0 || !paymentModal.customerId) return;

        const customer = customers.find(c => c.id === paymentModal.customerId);
        if (!customer) return;

        // 1. Lower debt
        registerPayment(customer.id, amt);

        // 2. Add income to Caja
        addTransaction({
            id: generateIdWithPrefix('t'),
            type: 'income',
            amount: amt,
            category: 'Cobro Deuda',
            description: `Pago sobre cuenta de ${customer.name}`,
            method: 'cash', // Making it cash by default for speed, can be enhanced
            date: new Date().toISOString(),
            relatedId: customer.id
        });

        alert(`Se cobraron $${amt.toLocaleString()} exitosamente de la cuenta de ${customer.name}`);
        setPaymentModal({ isOpen: false, customerId: '', amount: '' });
    };

    const handleCollectAll = () => {
        const totalToCollect = debtors.reduce((sum, d) => sum + d.debtBalance, 0);
        if (totalToCollect === 0) return;

        if (confirm(`¿Estás segura de cobrar el TOTAL de las deudas ($${totalToCollect.toLocaleString()}) en efectivo?`)) {
            debtors.forEach(d => {
                registerPayment(d.id, d.debtBalance);
                addTransaction({
                    id: generateIdWithPrefix('t'),
                    type: 'income',
                    amount: d.debtBalance,
                    category: 'Cobro Masivo',
                    description: `Cobro total de cuenta: ${d.name}`,
                    method: 'cash',
                    date: new Date().toISOString(),
                    relatedId: d.id
                });
            });
            alert("¡Todas las cuentas han sido saldadas y el dinero ingresó a Caja!");
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
                    zIndex: 1000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: 50,
                            height: 50,
                            border: '4px solid #e5e7eb',
                            borderTopColor: '#9b51e0',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p style={{ color: '#64748b', fontWeight: 500 }}>Cargando finanzas...</p>
                    </div>
                </div>
            )}

            <header className="page-header mb-6">
                <div>
                    <h1 className="text-h1">Caja y Finanzas</h1>
                    <p className="text-body mt-2">Control de ingresos, pagos y cuentas por cobrar.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
                    <Plus size={20} />
                    Asentar Gasto (Egreso)
                </button>
            </header>

            {/* Top Metric Cards */}
            <div className="metrics-grid mb-6">
                <div className="metric-card income">
                    <div className="metric-icon"><TrendingUp size={24} /></div>
                    <div className="metric-data">
                        <span className="text-small text-muted">Ingresos (Caja)</span>
                        <h2 className="text-h2">${Object.values(incomeByMethod).reduce((a, b) => a + b, 0).toLocaleString()}</h2>
                        <div className="method-breakdown mt-2">
                            <span className="text-tiny bg-success-light px-1 rounded">Ef: ${incomeByMethod.cash.toLocaleString()}</span>
                            <span className="text-tiny bg-primary-light px-1 rounded mx-1">Tarj: ${incomeByMethod.card.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card expense">
                    <div className="metric-icon"><TrendingDown size={24} /></div>
                    <div className="metric-data">
                        <span className="text-small text-muted">Egresos (Gastos)</span>
                        <h2 className="text-h2">${Object.values(expenseByMethod).reduce((a, b) => a + b, 0).toLocaleString()}</h2>
                        <div className="method-breakdown mt-2">
                            <span className="text-tiny bg-danger-light px-1 rounded">Caja: ${expenseByMethod.cash.toLocaleString()}</span>
                            <span className="text-tiny bg-surface-hover px-1 rounded ml-1">Banc: ${expenseByMethod.transfer.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card balance">
                    <div className="metric-icon"><DollarSign size={24} /></div>
                    <div className="metric-data">
                        <span className="text-small text-muted">Balance Real Hoy</span>
                        <h2 className="text-h2">${(Object.values(incomeByMethod).reduce((a, b) => a + b, 0) - Object.values(expenseByMethod).reduce((a, b) => a + b, 0)).toLocaleString()}</h2>
                    </div>
                </div>

                <div className="metric-card debt">
                    <div className="metric-icon"><AlertCircle size={24} /></div>
                    <div className="metric-data">
                        <span className="text-small text-muted">A Cobrar (Fiado)</span>
                        <h2 className="text-h2 text-warning">${totalAccountsReceivable.toLocaleString()}</h2>
                    </div>
                </div>
            </div>

            {/* Split View: Transactions vs Debtors */}
            <div className="finances-split">

                {/* Left: Transaction Ledger split in 2 columns as requested */}
                <div className="card ledger-panel">
                    <h3 className="text-h3 flex items-center gap-2 mb-4">
                        <FileText size={20} className="text-primary" />
                        Libro Mayor / Caja Diaria
                    </h3>

                    <div className="ledger-columns-container">
                        <div className="ledger-column">
                            <h4 className="text-small font-bold text-success mb-2 uppercase tracking-wider">Ingresos</h4>
                            <div className="ledger-scroll">
                                {transactions.filter(t => t.type === 'income').slice().reverse().map(t => (
                                    <LedgerItem key={t.id} t={t} />
                                ))}
                                {transactions.filter(t => t.type === 'income').length === 0 && <p className="text-tiny text-muted italic">Sin ingresos.</p>}
                            </div>
                        </div>

                        <div className="ledger-column">
                            <h4 className="text-small font-bold text-danger mb-2 uppercase tracking-wider">Egresos</h4>
                            <div className="ledger-scroll">
                                {transactions.filter(t => t.type === 'expense').slice().reverse().map(t => (
                                    <LedgerItem key={t.id} t={t} />
                                ))}
                                {transactions.filter(t => t.type === 'expense').length === 0 && <p className="text-tiny text-muted italic">Sin egresos.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Debtors Panel for quick collection */}
                <div className="card debtors-panel">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-small font-bold text-warning uppercase tracking-wider">Cuentas por Cobrar</h4>
                        {debtors.length > 0 && (
                            <button
                                className="btn btn-secondary text-tiny px-2"
                                onClick={handleCollectAll}
                            >
                                Cobrar Todo
                            </button>
                        )}
                    </div>

                    <div className="debtors-list overflow-y-auto pr-2" style={{ maxHeight: '500px' }}>
                        {debtors.length === 0 ? (
                            <div className="text-center py-8 opacity-60">
                                <span className="text-h1 block mb-2">🎉</span>
                                <p className="text-body text-success">¡Excelente! Nadie debe dinero.</p>
                            </div>
                        ) : (
                            debtors.map(d => (
                                <div key={d.id} className="debtor-card mb-3 p-3 border border-border rounded-lg bg-surface flex justify-between items-center">
                                    <div>
                                        <h4 className="font-semibold text-body">{d.name}</h4>
                                        <p className="text-small text-muted font-mono">{d.phone}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className="text-small text-muted block">Debe</span>
                                            <span className="font-bold text-danger">${d.debtBalance.toLocaleString()}</span>
                                        </div>
                                        <button
                                            className="btn btn-primary px-3 py-1 text-small"
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
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2 className="text-h2 mb-4 text-danger">Asentar Salida de Dinero</h2>
                        <form onSubmit={handleAddExpense} className="flex flex-col gap-4">

                            <div>
                                <label className="form-label">Monto ($)</label>
                                <input required type="number" min="1" className="form-input text-h3" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} autoFocus placeholder="Ej: 5000" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Categoría</label>
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
                                    <label className="form-label">De dónde se pagó</label>
                                    <select className="form-input" value={expenseForm.method} onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value as any })}>
                                        <option value="cash">Efectivo de la Caja</option>
                                        <option value="transfer">Transferencia / Tarjeta del Banco</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Descripción (Opcional)</label>
                                <input type="text" className="form-input" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ej: Combustible para la fiorino..." />
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                                <button type="button" className="btn bg-surface" onClick={() => setShowExpenseModal(false)}>Cancelar</button>
                                <button type="submit" className="btn bg-danger text-white">Retirar Dinero</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Process Debt Payment */}
            {paymentModal.isOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2 className="text-h2 mb-4 text-primary">Cobrar Deuda</h2>
                        <p className="text-body text-muted mb-4">Ingresa cuánto dinero te entregó el cliente hoy. Esto cancelará la deuda parcial o totalmente, y sumará el monto a la Caja de hoy.</p>

                        <form onSubmit={handleProcessDebtPayment} className="flex flex-col gap-4">
                            <div>
                                <label className="form-label">Monto a Cobrar ($)</label>
                                <input required type="number" min="1" max={customers.find(c => c.id === paymentModal.customerId)?.debtBalance} className="form-input text-h3 font-bold text-success" value={paymentModal.amount} onChange={e => setPaymentModal({ ...paymentModal, amount: e.target.value })} autoFocus />
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                                <button type="button" className="btn bg-surface" onClick={() => setPaymentModal({ isOpen: false, customerId: '', amount: '' })}>Cancelar</button>
                                <button type="submit" className="btn btn-primary text-white">Aceptar Cobro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
