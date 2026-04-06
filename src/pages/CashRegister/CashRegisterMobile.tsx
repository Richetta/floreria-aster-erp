import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import './CashRegisterMobile.css';

export const CashRegisterMobile = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailySummary, setDailySummary] = useState<any>(null);
    const [cashInDrawer, setCashInDrawer] = useState<any>(null);
    const [cashStatus, setCashStatus] = useState<any>(null);
    
    // Modal states
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [showClosingModal, setShowClosingModal] = useState(false);
    const [openingBalance, setOpeningBalance] = useState<string>('');
    const [observedCash, setObservedCash] = useState<string>('');
    const [notes, setNotes] = useState('');

    const { alertModal, showAlert } = useModal();

    const loadData = async () => {
        try {
            const [status, summary, drawer] = await Promise.all([
                api.getCashRegisterStatus(selectedDate),
                api.getDailySummary(selectedDate),
                api.getCashInDrawer()
            ]);
            setCashStatus(status);
            setDailySummary(summary);
            setCashInDrawer(drawer);
        } catch (error) {
            console.error('CajaMobile: Error loading data', error);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedDate]);

    const handleOpenCaja = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.openCashRegister({
                date: selectedDate,
                opening_balance: parseFloat(openingBalance) || 0,
                notes: notes || undefined
            });
            showAlert({ title: 'Éxito', message: 'Caja abierta', variant: 'success' });
            setShowOpeningModal(false);
            setOpeningBalance('');
            setNotes('');
            loadData();
        } catch (error: any) {
            showAlert({ title: 'Error', message: error.message, variant: 'error' });
        }
    };

    const handleCloseCaja = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createClosing({
                date: selectedDate,
                opening_balance: cashStatus?.opening?.opening_balance || 0,
                observed_cash: parseFloat(observedCash) || undefined,
                notes: notes || undefined
            });
            showAlert({ title: 'Caja Cerrada', message: 'El cierre se registró correctamente', variant: 'success' });
            setShowClosingModal(false);
            setObservedCash('');
            setNotes('');
            loadData();
        } catch (error: any) {
            showAlert({ title: 'Error', message: error.message, variant: 'error' });
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    };

    return (
        <div className="cash-mobile-wrapper">
            <header className="mobile-cash-header">
                <div className="cash-header-top">
                    <h2>Caja del Día</h2>
                    <div className="date-picker-wrap">
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>

                {cashStatus && (
                    <div className={`status-banner ${cashStatus.is_open ? 'open' : 'closed'}`}>
                        <span className="material-symbols-rounded">
                            {cashStatus.is_open ? 'lock_open' : 'lock'}
                        </span>
                        <span>{cashStatus.is_open ? 'Caja Abierta' : 'Caja Cerrada'}</span>
                    </div>
                )}
            </header>

            <div className="cash-scroll-content">
                {/* Main Balance Card */}
                {cashInDrawer && (
                    <section className="cash-balance-hero">
                        <div className="hero-label">Efectivo en Caja</div>
                        <div className="hero-value">{formatCurrency(cashInDrawer.cash_in_drawer)}</div>
                        <div className="hero-footer">
                            <span>Inicial: {formatCurrency(cashInDrawer.opening_balance)}</span>
                            <span>{cashInDrawer.transactions_count} Movimientos</span>
                        </div>
                    </section>
                )}

                {/* Quick Actions */}
                <div className="cash-actions-row">
                    {!cashStatus?.is_open && !cashStatus?.is_closed && (
                        <button className="c-action-btn open-btn" onClick={() => setShowOpeningModal(true)}>
                            <span className="material-symbols-rounded">key</span>
                            Abrir Caja
                        </button>
                    )}
                    {cashStatus?.is_open && (
                        <button className="c-action-btn close-btn" onClick={() => setShowClosingModal(true)}>
                            <span className="material-symbols-rounded">receipt_long</span>
                            Cerrar Caja
                        </button>
                    )}
                </div>

                {/* Summary Grid */}
                {dailySummary && (
                    <section className="cash-stats-grid">
                        <div className="stat-card income">
                            <span className="material-symbols-rounded">trending_up</span>
                            <div className="stat-info">
                                <span className="stat-label">Ingresos</span>
                                <span className="stat-val">{formatCurrency(dailySummary.sales.total + dailySummary.payments_received.total)}</span>
                            </div>
                        </div>
                        <div className="stat-card expense">
                            <span className="material-symbols-rounded">trending_down</span>
                            <div className="stat-info">
                                <span className="stat-label">Egresos</span>
                                <span className="stat-val">{formatCurrency(dailySummary.expenses.total)}</span>
                            </div>
                        </div>
                        <div className="stat-card balance">
                            <span className="material-symbols-rounded">account_balance_wallet</span>
                            <div className="stat-info">
                                <span className="stat-label">Balance</span>
                                <span className="stat-val">{formatCurrency(dailySummary.balance)}</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* Transactions List */}
                {dailySummary?.transactions && (
                    <section className="cash-transactions-sec">
                        <h3>Movimientos Recientes</h3>
                        <div className="m-trans-list">
                            {dailySummary.transactions.slice(0, 10).map((t: any) => (
                                <div key={t.id} className="m-trans-item">
                                    <div className={`m-trans-icon ${t.type}`}>
                                        <span className="material-symbols-rounded">
                                            {t.type === 'sale' ? 'shopping_cart' : t.type === 'expense' ? 'money_off' : 'payments'}
                                        </span>
                                    </div>
                                    <div className="m-trans-info">
                                        <span className="m-trans-desc">{t.description}</span>
                                        <span className="m-trans-time">{new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} • {t.payment_method}</span>
                                    </div>
                                    <div className={`m-trans-amount ${t.type.includes('sale') || t.type.includes('received') ? 'pos' : 'neg'}`}>
                                        {t.type.includes('sale') || t.type.includes('received') ? '+' : '-'}${t.amount.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Modals Mobile Style */}
            {showOpeningModal && (
                <div className="bottom-sheet-overlay" onClick={() => setShowOpeningModal(false)}>
                    <div className="bottom-sheet-content" onClick={e => e.stopPropagation()}>
                        <div className="sheet-handle"></div>
                        <h3>Abrir Caja</h3>
                        <form onSubmit={handleOpenCaja}>
                            <div className="m-form-group">
                                <label>Fondo Inicial</label>
                                <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={openingBalance} 
                                    onChange={e => setOpeningBalance(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                            <div className="m-form-group">
                                <label>Notas</label>
                                <textarea 
                                    placeholder="Opcional..." 
                                    value={notes} 
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="m-submit-btn">Comenzar Día</button>
                        </form>
                    </div>
                </div>
            )}

            {showClosingModal && (
                <div className="bottom-sheet-overlay" onClick={() => setShowClosingModal(false)}>
                    <div className="bottom-sheet-content" onClick={e => e.stopPropagation()}>
                        <div className="sheet-handle"></div>
                        <h3>Cierre de Caja</h3>
                        <p className="sheet-subtitle">Verificá el efectivo físico antes de cerrar.</p>
                        <form onSubmit={handleCloseCaja}>
                            <div className="m-form-group">
                                <label>Efectivo Observado (Caja física)</label>
                                <input 
                                    type="number" 
                                    placeholder="Monto total contado" 
                                    value={observedCash} 
                                    onChange={e => setObservedCash(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                            <div className="m-form-group">
                                <label>Notas de Cierre</label>
                                <textarea 
                                    placeholder="Cualquier novedad..." 
                                    value={notes} 
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="m-submit-btn close">Finalizar Cierre</button>
                        </form>
                    </div>
                </div>
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
