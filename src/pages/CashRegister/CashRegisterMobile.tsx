import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { useModal } from '../../hooks/useModal';
import { AlertModal } from '../../components/ui/Modals';
import { analyzeFinances } from '../Finances/utils/financesAnalyzer';
import './CashRegisterMobile.css';

export const CashRegisterMobile = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const orders = useStore((state) => state.orders) || [];
    const products = useStore((state) => state.products);
    const packages = useStore((state) => state.packages);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadOrders = useStore((state) => state.loadOrders);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailySummary, setDailySummary] = useState<any>(null);
    const [cashInDrawer, setCashInDrawer] = useState<any>(null);
    const [cashStatus, setCashStatus] = useState<any>(null);
    const shopInfo = useStore((state) => state.shopInfo);

    // Modal states
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [showClosingModal, setShowClosingModal] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
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

            // Sync finance stores
            await Promise.allSettled([
                loadTransactions(),
                loadCustomers(),
                loadOrders ? loadOrders() : Promise.resolve()
            ]);
        } catch (error) {
            console.error('CajaMobile: Error loading data', error);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedDate]);

    // Live analytics computation for multi-boxes
    const [wasteLogs] = useState<any[]>([]);
    const [fixedCosts] = useState<number>(350000);
    const analytics = analyzeFinances(transactions, orders, products, customers, wasteLogs, fixedCosts);

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
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="cash-mobile-wrapper">
            <header className="mobile-cash-header">
                <div className="cash-header-top">
                    <h2>Caja Chica</h2>
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
                {/* Live treasury multi-boxes availability */}
                <section className="m-treasury-section" style={{ padding: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: '#166534', fontWeight: 'bold' }}>💵 Efectivo</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(analytics.treasury.cash)}</span>
                        </div>
                        <div style={{ background: '#f0f9ff', padding: '8px', borderRadius: '8px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: '#075985', fontWeight: 'bold' }}>📱 MPago</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0284c7' }}>{formatCurrency(analytics.treasury.mercadopago)}</span>
                        </div>
                        <div style={{ background: '#faf5ff', padding: '8px', borderRadius: '8px', border: '1px solid #e9d5ff', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: '#6b21a8', fontWeight: 'bold' }}>🏦 Banco</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#7e22ce' }}>{formatCurrency(analytics.treasury.bank)}</span>
                        </div>
                    </div>
                </section>

                {/* Main Balance Card */}
                {cashInDrawer && (
                    <section className="cash-balance-hero">
                        <div className="hero-label">Fondo Físico en Local</div>
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
                            {dailySummary.transactions.slice(0, 25).map((t: any) => {
                                const isExpanded = expandedId === t.id;
                                const items = t.metadata?.items || [];
                                const hasDetails = items.length > 0 || t.notes;

                                return (
                                    <div 
                                        key={t.id} 
                                        className={`m-trans-item-container ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : t.id)}
                                    >
                                        <div className="m-trans-item">
                                            <div className={`m-trans-icon ${t.type}`}>
                                                <span className="material-symbols-rounded">
                                                    {t.type === 'sale' ? 'shopping_cart' : t.type === 'expense' ? 'money_off' : 'payments'}
                                                </span>
                                            </div>
                                            <div className="m-trans-info">
                                                <span className="m-trans-desc truncate">{t.description}</span>
                                                <span className="m-trans-time">
                                                    {new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} • {
                                                        (shopInfo.paymentMethods?.find(m => m.name === t.payment_method || m.id === t.payment_method)?.name) || 
                                                        (t.payment_method === 'cash' ? 'Efectivo' : t.payment_method === 'card' ? 'Tarjeta' : t.payment_method || '-')
                                                    }
                                                </span>
                                            </div>
                                            <div className="m-trans-amount-wrap">
                                                <div className={`m-trans-amount ${t.type.includes('sale') || t.type.includes('received') ? 'pos' : 'neg'}`}>
                                                    {t.type.includes('sale') || t.type.includes('received') ? '+' : '-'}${t.amount.toLocaleString()}
                                                </div>
                                                {hasDetails && (
                                                    <span className={`material-symbols-rounded m-expand-icon ${isExpanded ? 'rotated' : ''}`}>
                                                        expand_more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="m-trans-details">
                                                {items.length > 0 && (
                                                    <div className="m-details-items">
                                                        {items.map((item: any, idx: number) => (
                                                            <div key={idx} className="m-detail-row">
                                                                <div className="m-detail-main">
                                                                    <span className="m-detail-qty">{item.qty || item.quantity}x</span>
                                                                    <span className="m-detail-name">
                                                                        {item.name || item.product_name || 
                                                                         (item.product_id ? products.find(p => p.id === item.product_id)?.name : null) ||
                                                                         (item.package_id ? packages.find(p => p.id === item.package_id)?.name : null) ||
                                                                         'Producto'}
                                                                    </span>
                                                                </div>
                                                                <span className="m-detail-total">${((item.price || item.unit_price) * (item.qty || item.quantity)).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {t.notes && (
                                                    <div className="m-details-notes">
                                                        <span className="notes-tag">Observaciones:</span>
                                                        <p>{t.notes}</p>
                                                    </div>
                                                )}
                                                <div className="m-details-meta">
                                                    <span>REF: {t.id.slice(-6).toUpperCase()}</span>
                                                    <span>•</span>
                                                    <span>{new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
