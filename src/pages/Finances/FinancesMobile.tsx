import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { useNavigate } from 'react-router-dom';
import { AlertModal } from '../../components/ui/Modals';
import './FinancesMobile.css';

export const FinancesMobile = () => {
    const navigate = useNavigate();
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const addTransaction = useStore((state) => state.addTransaction);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);

    const [showExpenseSheet, setShowExpenseSheet] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: 'cash' as 'cash' | 'transfer'
    });

    const { alertModal, showAlert } = useModal();

    useEffect(() => {
        const loadData = async () => {
            await Promise.allSettled([loadTransactions(), loadCustomers()]);
        };
        loadData();
    }, []);

    const metrics = useMemo(() => {
        const income = (transactions || []).filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const expense = (transactions || []).filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const debt = (customers || []).reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);
        return { income, expense, balance: income - expense, debt };
    }, [transactions, customers]);

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

        setShowExpenseSheet(false);
        setExpenseForm({ amount: '', category: 'Insumos', description: '', method: 'cash' });
        loadTransactions();
        showAlert({ title: 'Gasto registrado', message: 'Se ha asentado el movimiento correctamente.', variant: 'success' });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    };

    return (
        <div className="finances-mobile-wrapper">
            <header className="mobile-finances-header">
                <div className="finances-header-top">
                    <h2>Movimientos</h2>
                    <button className="add-expense-btn" onClick={() => setShowExpenseSheet(true)}>
                        <span className="material-symbols-rounded">add</span>
                        Gasto
                    </button>
                </div>
            </header>

            <div className="finances-scroll-content">
                {/* Balance Hero */}
                <section className="finances-hero-card">
                    <div className="hero-main">
                        <span className="hero-label">Balance Neto</span>
                        <h2 className={`hero-val ${metrics.balance >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(metrics.balance)}</h2>
                    </div>
                    <div className="hero-grid">
                        <div className="h-stat">
                            <span className="h-stat-label">Ingresos</span>
                            <span className="h-stat-val pos">{formatCurrency(metrics.income)}</span>
                        </div>
                        <div className="h-stat">
                            <span className="h-stat-label">Egresos</span>
                            <span className="h-stat-val neg">{formatCurrency(metrics.expense)}</span>
                        </div>
                    </div>
                </section>

                {/* Debt Call to Action */}
                {metrics.debt > 0 && (
                    <section className="finances-debt-banner" onClick={() => navigate('/clientes')}>
                        <div className="d-icon">
                            <span className="material-symbols-rounded">person_alert</span>
                        </div>
                        <div className="d-info">
                            <span className="d-label">Cuentas por Cobrar</span>
                            <span className="d-val">{formatCurrency(metrics.debt)}</span>
                        </div>
                        <span className="material-symbols-rounded d-arrow">chevron_right</span>
                    </section>
                )}

                {/* Recent Transactions List */}
                <section className="finances-history-sec">
                    <div className="sec-header">
                        <h3>Últimos Movimientos</h3>
                        <button onClick={loadTransactions}>Ver Todo</button>
                    </div>
                    <div className="m-history-list">
                        {(transactions || []).slice(0, 15).reverse().map(t => (
                            <div key={t.id} className="m-history-item">
                                <div className={`m-h-icon ${t.type}`}>
                                    <span className="material-symbols-rounded">
                                        {t.type === 'income' ? 'arrow_upward' : 'arrow_downward'}
                                    </span>
                                </div>
                                <div className="m-h-info">
                                    <span className="m-h-cat">{t.category}</span>
                                    <span className="m-h-desc">{t.description}</span>
                                </div>
                                <div className={`m-h-amount ${t.type}`}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Expense Bottom Sheet */}
            {showExpenseSheet && (
                <div className="bottom-sheet-overlay" onClick={() => setShowExpenseSheet(false)}>
                    <div className="bottom-sheet-content" onClick={e => e.stopPropagation()}>
                        <div className="sheet-handle"></div>
                        <h3>Asentar Nuevo Gasto</h3>
                        <form onSubmit={handleAddExpense}>
                            <div className="m-form-group">
                                <label>Monto</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={expenseForm.amount}
                                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="m-form-group">
                                <label>Categoría</label>
                                <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                                    <option value="Sueldos">Sueldos</option>
                                    <option value="Insumos">Insumos</option>
                                    <option value="Flores">Mercadería (Flores)</option>
                                    <option value="Logística">Logística/Moto</option>
                                    <option value="Servicios">Servicios</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>
                            <div className="m-form-group">
                                <label>Medio de Pago</label>
                                <select value={expenseForm.method} onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value as any })}>
                                    <option value="cash">Efectivo</option>
                                    <option value="transfer">Transferencia</option>
                                </select>
                            </div>
                            <div className="m-form-group">
                                <label>Descripción</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pago de flete"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="m-submit-btn neg">Registrar Salida</button>
                        </form>
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
