import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { TicketPrinter } from '../../components/TicketPrinter/TicketPrinter';
import type { TicketData } from '../../components/TicketPrinter/TicketPrinter';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { AlertModal } from '../../components/ui/Modals';
import { useModal } from '../../hooks/useModal';
import './SalesMobile.css';

export const SalesMobile = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const shopInfo = useStore((state) => state.shopInfo);
    const addTransaction = useStore((state) => state.addTransaction);
    const registerPayment = useStore((state) => state.registerPayment);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);

    const [activeSubTab, setActiveSubTab] = useState<'billing' | 'ledger'>('billing');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
    const [selectedSale, setSelectedSale] = useState<any | null>(null);

    // Ticket Printer State
    const [showTicketPrinter, setShowTicketPrinter] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

    // Manual Expense Registration State
    const [showExpenseSheet, setShowExpenseSheet] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: shopInfo.paymentMethods?.[0]?.name || 'cash'
    });

    // Debt Payment State
    const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState(shopInfo.paymentMethods?.[0]?.name || 'cash');

    const [expandedLedgerId, setExpandedLedgerId] = useState<string | null>(null);

    const { alertModal, showAlert } = useModal();

    useEffect(() => {
        loadTransactions();
        loadCustomers();
    }, []);

    // Filter sales from transactions
    const sales = useMemo(() => {
        return (transactions || []).filter(t => t.category === 'Venta POS' || (t.type === 'income' && t.description?.toLowerCase().includes('venta')));
    }, [transactions]);

    const filteredSales = useMemo(() => {
        let result = [...sales];
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(s => {
                const customerId = s.metadata?.customer_id;
                const customerName = customerId ? customers.find(c => c.id === customerId)?.name.toLowerCase() : '';
                return s.id.toLowerCase().includes(lowSearch) || (s.description?.toLowerCase().includes(lowSearch)) || (customerName?.includes(lowSearch));
            });
        }
        const now = new Date();
        const todayAtZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (dateFilter === 'today') result = result.filter(s => new Date(s.date).getTime() >= todayAtZero);
        else if (dateFilter === 'week') result = result.filter(s => new Date(s.date).getTime() >= todayAtZero - 7 * 24 * 60 * 60 * 1000);
        else if (dateFilter === 'month') result = result.filter(s => new Date(s.date).getTime() >= todayAtZero - 30 * 24 * 60 * 60 * 1000);
        return result.reverse();
    }, [sales, searchTerm, dateFilter, customers]);

    // Debtors list
    const debtors = useMemo(() => {
        return (customers || [])
            .filter(c => (Number(c.debtBalance) || 0) > 0)
            .sort((a, b) => (Number(b.debtBalance) || 0) - (Number(a.debtBalance) || 0));
    }, [customers]);

    const handleReprint = (sale: any) => {
        const metadata = sale.metadata || {};
        const items = metadata.items || [];
        const customer = metadata.customer_id ? customers.find(c => c.id === metadata.customer_id) : null;
        const ticket: TicketData = {
            type: 'sale',
            id: sale.id.toUpperCase(),
            date: sale.date,
            customerName: customer?.name,
            customerPhone: customer?.phone,
            items: items.map((item: any) => ({
                name: item.name || item.product_name || 'Producto',
                quantity: item.qty || item.quantity,
                unitPrice: item.price || item.unit_price,
                total: (item.price || item.unit_price) * (item.qty || item.quantity)
            })),
            subtotal: sale.amount,
            total: sale.amount,
            paymentMethod: sale.method,
            notes: sale.notes
        };
        setTicketData(ticket);
        setShowTicketPrinter(true);
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

        setShowExpenseSheet(false);
        setExpenseForm({ amount: '', category: 'Insumos', description: '', method: shopInfo.paymentMethods?.[0]?.name || 'cash' });
        loadTransactions();
        showAlert({ title: 'Gasto registrado', message: 'Se ha asentado el movimiento correctamente.', variant: 'success' });
    };

    const handleProcessDebtPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(paymentAmount);
        if (!amt || amt <= 0 || !selectedDebtorId) return;

        const customer = customers.find(c => c.id === selectedDebtorId);
        if (!customer) return;

        await registerPayment(customer.id, amt);
        await addTransaction({
            id: generateIdWithPrefix('t'),
            type: 'income',
            amount: amt,
            category: 'Cobro Deuda',
            description: `Pago sobre cuenta de ${customer.name}`,
            method: paymentMethod,
            date: new Date().toISOString(),
            relatedId: customer.id
        });

        setSelectedDebtorId(null);
        setPaymentAmount('');
        loadCustomers();
        loadTransactions();
        showAlert({ title: 'Cobro registrado', message: 'Se ha asentado el pago correctamente.', variant: 'success' });
    };

    const handleWhatsApp = (debtor: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const phoneClean = (debtor.phone || '').replace(/[^0-9]/g, '');
        const phoneFormatted = phoneClean.length === 10 ? `549${phoneClean}` : phoneClean;
        const msg = encodeURIComponent(`¡Hola ${debtor.name}! Te escribimos de Florería Aster para enviarte un saludo y recordarte de manera amigable tu saldo pendiente en cuenta corriente por un total de $${(debtor.debtBalance || 0).toLocaleString()}. Te adjuntamos tu resumen. ¡Muchas gracias por tu confianza de siempre! 🌸`);
        window.open(`https://api.whatsapp.com/send?phone=${phoneFormatted}&text=${msg}`, '_blank');
    };

    return (
        <div className="sales-mobile-wrapper">
            <header className="mobile-sales-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '1full', padding: '0 4px' }}>
                    <h2>Movimientos</h2>
                    <button className="add-expense-btn" onClick={() => setShowExpenseSheet(true)} style={{ background: '#e11d48', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>add</span>
                        Gasto
                    </button>
                </div>

                <div className="mobile-tabs-container" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.08)', padding: '2px', borderRadius: '8px', margin: '8px 0' }}>
                    <button 
                        className={`m-tab-btn ${activeSubTab === 'billing' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('billing')}
                        style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                        🧾 Historial POS
                    </button>
                    <button 
                        className={`m-tab-btn ${activeSubTab === 'ledger' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('ledger')}
                        style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                        📊 Diario & Deuda
                    </button>
                </div>

                {activeSubTab === 'billing' && (
                    <>
                        <div className="sales-search-bar">
                            <span className="material-symbols-rounded">search</span>
                            <input 
                                type="text" 
                                placeholder="Buscar por cliente o ID..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="sales-tabs-scroll">
                            <button className={dateFilter === 'today' ? 'active' : ''} onClick={() => setDateFilter('today')}>Hoy</button>
                            <button className={dateFilter === 'week' ? 'active' : ''} onClick={() => setDateFilter('week')}>Semana</button>
                            <button className={dateFilter === 'month' ? 'active' : ''} onClick={() => setDateFilter('month')}>Mes</button>
                            <button className={dateFilter === 'all' ? 'active' : ''} onClick={() => setDateFilter('all')}>Todo</button>
                        </div>
                    </>
                )}
            </header>

            <div className="sales-list-content" style={{ paddingBottom: '80px' }}>
                {activeSubTab === 'billing' ? (
                    filteredSales.length === 0 ? (
                        <div className="empty-history animate-fade-in">
                            <span className="material-symbols-rounded">receipt_long</span>
                            <p>No se encontraron ventas para este período</p>
                        </div>
                    ) : (
                        filteredSales.map(sale => (
                            <div key={sale.id} className="m-sale-card animate-fade-in" onClick={() => setSelectedSale(selectedSale?.id === sale.id ? null : sale)}>
                                <div className="m-sale-header">
                                    <div className="m-sale-main">
                                        <span className="m-sale-id">ID: {sale.id.slice(-6).toUpperCase()}</span>
                                        <span className="m-sale-time">
                                            <span className="material-symbols-rounded" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>schedule</span>
                                            {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className={`m-sale-method ${sale.method}`}>
                                        <span className="material-symbols-rounded">
                                            {sale.method === 'cash' ? 'payments' : sale.method === 'transfer' ? 'account_balance' : 'credit_card'}
                                        </span>
                                        {(shopInfo.paymentMethods?.find(m => m.name === sale.method || m.id === sale.method)?.name) || 
                                         (sale.method === 'cash' ? 'Efectivo' : sale.method === 'card' ? 'Tarjeta' : sale.method)}
                                    </div>
                                </div>
                                <div className="m-sale-body">
                                    <div className="m-sale-info">
                                        <span className="m-sale-customer">
                                            {sale.metadata?.customer_id ? customers.find(c => c.id === sale.metadata!.customer_id)?.name : 'Venta Mostrador'}
                                        </span>
                                        <span className="m-sale-items">
                                            <span className="material-symbols-rounded" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>shopping_basket</span>
                                            {(sale.metadata?.items || []).length} productos
                                        </span>
                                    </div>
                                    <div className="m-sale-total">
                                        ${sale.amount.toLocaleString()}
                                    </div>
                                </div>
                                
                                {selectedSale?.id === sale.id && (
                                    <div className="m-sale-expand">
                                        <div className="m-sale-details">
                                            {sale.metadata?.items?.map((item: any, idx: number) => (
                                                <div key={idx} className="m-detail-item">
                                                    <span>{item.qty}x {item.name || item.product_name}</span>
                                                    <span>${(item.price * item.qty).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="m-sale-actions">
                                            <button className="m-reprint-btn" onClick={(e) => { e.stopPropagation(); handleReprint(sale); }}>
                                                <span className="material-symbols-rounded">print</span>
                                                Reimprimir Ticket
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )
                ) : (
                    <div>
                        {/* Morosos Section first */}
                        <div className="m-morosos-wrapper" style={{ padding: '8px', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center', color: '#1e293b', marginBottom: '12px' }}>
                                <span className="material-symbols-rounded" style={{ color: '#d97706' }}>group</span>
                                Cuentas Fiadas Activas
                            </h3>

                            {debtors.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '12px' }}>Sin deudas pendientes.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {debtors.map(d => (
                                        <div key={d.id} className="m-debtor-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} onClick={() => { setSelectedDebtorId(d.id); setPaymentAmount(d.debtBalance.toString()); }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{d.name}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.phone || 'Sin cel'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#be123c' }}>${(d.debtBalance || 0).toLocaleString()}</span>
                                                <button onClick={(e) => handleWhatsApp(d, e)} style={{ background: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chat</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Libro Diario ledger section */}
                        <div style={{ padding: '8px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center', color: '#1e293b', marginBottom: '12px' }}>
                                <span className="material-symbols-rounded" style={{ color: '#4f46e5' }}>receipt_long</span>
                                Libro Diario Diario
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(transactions || []).slice().reverse().map(t => {
                                    const isIncome = t.type === 'income' || (t.type as string) === 'sale';
                                    const isExpanded = expandedLedgerId === t.id;
                                    return (
                                        <div key={t.id} style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={() => setExpandedLedgerId(isExpanded ? null : t.id)}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="material-symbols-rounded" style={{ color: isIncome ? '#10b981' : '#f43f5e', fontSize: '18px' }}>
                                                        {isIncome ? 'arrow_upward' : 'arrow_downward'}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>{t.category}</span>
                                                </div>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isIncome ? '#10b981' : '#f43f5e' }}>
                                                    {isIncome ? '+' : '-'}${t.amount.toLocaleString()}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {t.description || 'Sin concepto'}
                                            </div>

                                            {isExpanded && t.notes && (
                                                <div style={{ marginTop: '6px', padding: '6px', background: '#f8fafc', borderRadius: '4px', fontSize: '0.75rem', color: '#475569' }}>
                                                    <strong>Notas:</strong> {t.notes}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Expense Register Bottom Sheet */}
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
                                    placeholder="0"
                                    value={expenseForm.amount}
                                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="m-form-group">
                                <label>Categoría</label>
                                <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                                    <option value="Sueldos/Jornales">Sueldos/Jornales</option>
                                    <option value="Insumos">Insumos Varios</option>
                                    <option value="Mercadería (Flores)">Mercadería (Flores)</option>
                                    <option value="Logística/Moto">Logística/Moto</option>
                                    <option value="Servicios/Luz/Internet">Servicios Diarios</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>
                            <div className="m-form-group">
                                <label>Medio de Pago</label>
                                <select value={expenseForm.method} onChange={e => setExpenseForm({ ...expenseForm, method: e.target.value })}>
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
                            <div className="m-form-group">
                                <label>Descripción</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pago de flete"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="m-submit-btn neg" style={{ background: '#e11d48', border: 'none', color: '#ffffff', padding: '12px', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold', marginTop: '12px' }}>
                                Registrar Salida
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Debtor Collection Bottom Sheet */}
            {selectedDebtorId && (
                <div className="bottom-sheet-overlay" onClick={() => setSelectedDebtorId(null)}>
                    <div className="bottom-sheet-content" onClick={e => e.stopPropagation()}>
                        <div className="sheet-handle"></div>
                        <h3>Cobrar Cuenta Fiada</h3>
                        <form onSubmit={handleProcessDebtPayment}>
                            <div className="m-form-group">
                                <label>Monto a recibir</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="m-form-group">
                                <label>Cuenta de cobro</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                    {(shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0) ? (
                                        shopInfo.paymentMethods.map(m => (
                                            <option key={m.id} value={m.name}>{m.name}</option>
                                        ))
                                    ) : (
                                        <option value="cash">Efectivo</option>
                                    )}
                                </select>
                            </div>
                            <button type="submit" className="m-submit-btn" style={{ background: '#10b981', border: 'none', color: '#ffffff', padding: '12px', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold', marginTop: '12px' }}>
                                Registrar Cobro
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showTicketPrinter && ticketData && (
                <TicketPrinter
                    ticketData={ticketData}
                    isOpen={showTicketPrinter}
                    onClose={() => { setShowTicketPrinter(false); setTicketData(null); }}
                />
            )}

            {alertModal && <AlertModal {...alertModal} />}
        </div>
    );
};
