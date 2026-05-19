import { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    Calendar as CalendarIcon, 
    Printer, 
    ChevronDown, 
    ChevronUp, 
    ShoppingBag,
    Clock,
    User,
    CreditCard,
    Banknote,
    FileText,
    Download,
    Plus,
    ArrowDownLeft,
    ArrowUpRight,
    Check,
    X,
    Users,
    Receipt
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { TicketPrinter } from '../../components/TicketPrinter/TicketPrinter';
import type { TicketData } from '../../components/TicketPrinter/TicketPrinter';
import { generateIdWithPrefix } from '../../utils/idGenerator';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal } from '../../components/ui/Modals';
import './Sales.css';

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

// --- GENERAL LEDGER TRANSACTION ITEM COMPONENT ---
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

// --- MAIN SALES COMPONENT ---
export const SalesDesktop = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const shopInfo = useStore((state) => state.shopInfo);
    const products = useStore((state) => state.products);
    const packages = useStore((state) => state.packages);
    const addTransaction = useStore((state) => state.addTransaction);
    const registerPayment = useStore((state) => state.registerPayment);
    const loadTransactions = useStore((state) => state.loadTransactions);
    const loadCustomers = useStore((state) => state.loadCustomers);

    const [activeSubTab, setActiveSubTab] = useState<'billing' | 'ledger'>('billing');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('today'); // today, week, month, all
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    
    // Ticket Printer State
    const [showTicketPrinter, setShowTicketPrinter] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

    // Manual Expense Registration State
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Insumos',
        description: '',
        method: shopInfo.paymentMethods?.[0]?.name || 'cash'
    });

    // Debt Payment Modal State
    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; customerId: string; amount: string; method: string }>({
        isOpen: false, customerId: '', amount: '', method: shopInfo.paymentMethods?.[0]?.name || 'cash'
    });

    const { confirmModal, showConfirm } = useModal();

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
            result = result.filter(s => {
                const lowSearch = searchTerm.toLowerCase();
                const customerId = s.metadata?.customer_id;
                const customerName = customerId ? customers.find(c => c.id === customerId)?.name.toLowerCase() : '';
                
                return s.id.toLowerCase().includes(lowSearch) || 
                       (s.description?.toLowerCase().includes(lowSearch)) ||
                       (customerName?.includes(lowSearch));
            });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lastWeek = today - (7 * 24 * 60 * 60 * 1000);
        const lastMonth = today - (30 * 24 * 60 * 60 * 1000);

        if (dateFilter === 'today') {
            result = result.filter(s => new Date(s.date).getTime() >= today);
        } else if (dateFilter === 'week') {
            result = result.filter(s => new Date(s.date).getTime() >= lastWeek);
        } else if (dateFilter === 'month') {
            result = result.filter(s => new Date(s.date).getTime() >= lastMonth);
        }

        return result;
    }, [sales, searchTerm, dateFilter, customers]);

    // Debtors lists
    const debtors = useMemo(() => {
        return (customers || [])
            .filter(c => (Number(c.debtBalance) || 0) > 0)
            .sort((a, b) => (Number(b.debtBalance) || 0) - (Number(a.debtBalance) || 0));
    }, [customers]);

    const totalDebt = useMemo(() => {
        return debtors.reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);
    }, [debtors]);

    const toggleExpand = (id: string) => {
        setExpandedSale(expandedSale === id ? null : id);
    };

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

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const invoiceDateFormatter = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="sales-page">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                <div className="header-content">
                    <h1 className="text-h1 flex items-center gap-3">
                        <ShoppingBag className="text-primary" size={32} />
                        Movimientos y Ventas
                    </h1>
                    <p className="text-muted">Control diario del ledger de facturación, gastos y cobranza de morosos.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Navigation Tabs */}
                    <div className="finances-tabs" style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                        <button 
                            className={`tab-btn ${activeSubTab === 'billing' ? 'active' : ''}`}
                            onClick={() => setActiveSubTab('billing')}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeSubTab === 'billing' ? '#ffffff' : 'transparent', fontWeight: activeSubTab === 'billing' ? 'bold' : 'normal', cursor: 'pointer' }}
                        >
                            🧾 Historial POS
                        </button>
                        <button 
                            className={`tab-btn ${activeSubTab === 'ledger' ? 'active' : ''}`}
                            onClick={() => setActiveSubTab('ledger')}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeSubTab === 'ledger' ? '#ffffff' : 'transparent', fontWeight: activeSubTab === 'ledger' ? 'bold' : 'normal', cursor: 'pointer' }}
                        >
                            📊 Libro Diario & Deudores
                        </button>
                    </div>

                    <button className="btn-add-expense" onClick={() => setShowExpenseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#e11d48', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        <Plus size={18} />
                        Registrar Gasto
                    </button>
                </div>
            </header>

            {activeSubTab === 'billing' ? (
                <>
                    <div className="sales-controls card">
                        <div className="search-box">
                            <Search className="search-icon" size={20} />
                            <input 
                                type="text" 
                                placeholder="Buscar por ID, descripción o cliente..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="form-input"
                            />
                        </div>

                        <div className="filter-group">
                            <div className="date-filters">
                                <button 
                                    className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
                                    onClick={() => setDateFilter('today')}
                                >
                                    Hoy
                                </button>
                                <button 
                                    className={`filter-btn ${dateFilter === 'week' ? 'active' : ''}`}
                                    onClick={() => setDateFilter('week')}
                                >
                                    Esta Semana
                                </button>
                                <button 
                                    className={`filter-btn ${dateFilter === 'month' ? 'active' : ''}`}
                                    onClick={() => setDateFilter('month')}
                                >
                                    Este Mes
                                </button>
                                <button 
                                    className={`filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
                                    onClick={() => setDateFilter('all')}
                                >
                                    Todo
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="sales-list-container">
                        {filteredSales.length === 0 ? (
                            <div className="empty-state card">
                                <div className="empty-icon-container">
                                    <FileText size={48} className="text-muted" />
                                </div>
                                <h3>No hay ventas para mostrar</h3>
                                <p>Ajustá los filtros o realizá una nueva venta en el POS.</p>
                            </div>
                        ) : (
                            <div className="sales-list">
                                {filteredSales.map((sale) => (
                                    <div key={sale.id} className={`sale-card card ${expandedSale === sale.id ? 'expanded' : ''}`}>
                                        <div className="sale-card-header" onClick={() => toggleExpand(sale.id)}>
                                            <div className="sale-main-info">
                                                <div className="sale-time">
                                                    <Clock size={16} className="text-muted" />
                                                    <span>{formatTime(sale.date)}</span>
                                                </div>
                                                <div className="sale-id">
                                                    <span className="text-small text-muted">ID:</span>
                                                    <span className="font-mono">{sale.id.slice(-6).toUpperCase()}</span>
                                                </div>
                                                <div className="sale-customer">
                                                    <User size={16} className="text-muted" />
                                                    <span>
                                                        {(() => {
                                                            const customerId = sale.metadata?.customer_id;
                                                            return customerId 
                                                                ? customers.find(c => c.id === customerId)?.name 
                                                                : 'Venta Mostrador';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="sale-payment-info">
                                                <div className={`payment-tag ${sale.method}`}>
                                                    {sale.method === 'cash' ? <Banknote size={14} /> : <CreditCard size={14} />}
                                                    {(shopInfo.paymentMethods?.find(m => m.name === sale.method || m.id === sale.method)?.name) || 
                                                     (sale.method === 'cash' ? 'Efectivo' : sale.method === 'card' ? 'Tarjeta' : sale.method)}
                                                </div>
                                                <div className="sale-amount">
                                                    ${sale.amount.toLocaleString()}
                                                </div>
                                                <div className="expand-icon">
                                                    {expandedSale === sale.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>

                                        {expandedSale === sale.id && (
                                            <div className="sale-card-details">
                                                <div className="details-header">
                                                    <h4>Detalle de Productos</h4>
                                                    <div className="sale-date-full">
                                                        <CalendarIcon size={14} />
                                                        {invoiceDateFormatter(sale.date)} - {formatTime(sale.date)}
                                                    </div>
                                                </div>

                                                <div className="items-table">
                                                    <div className="table-header">
                                                        <span>Producto</span>
                                                        <span className="text-center">Cant.</span>
                                                        <span className="text-right">Precio</span>
                                                        <span className="text-right">Subtotal</span>
                                                    </div>
                                                    {(sale.metadata?.items || []).map((item: any, idx: number) => (
                                                        <div key={idx} className="table-row">
                                                            <span className="item-name">
                                                                {item.name || item.product_name || 
                                                                 (item.product_id ? products.find(p => p.id === item.product_id)?.name : null) ||
                                                                 (item.package_id ? packages.find(p => p.id === item.package_id)?.name : null) ||
                                                                 'Producto'}
                                                            </span>
                                                            <span className="text-center">{item.qty || item.quantity}</span>
                                                            <span className="text-right">${(item.price || item.unit_price).toLocaleString()}</span>
                                                            <span className="text-right">${((item.price || item.unit_price) * (item.qty || item.quantity)).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                    <div className="table-footer">
                                                        <span>TOTAL</span>
                                                        <span className="total-value">${sale.amount.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                {sale.notes && (
                                                    <div className="sale-notes">
                                                        <span className="text-small font-bold">Notas:</span>
                                                        <p>{sale.notes}</p>
                                                    </div>
                                                )}

                                                <div className="sale-actions">
                                                    <button 
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => handleReprint(sale)}
                                                    >
                                                        <Printer size={16} />
                                                        Reimprimir Ticket
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm">
                                                        <Download size={16} />
                                                        Descargar PDF
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="finances-main" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                    {/* General Ledger / Libro Diario list */}
                    <section className="finances-section transactions-section card" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div className="section-title flex items-center gap-2">
                                <FileText size={20} className="text-primary" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Historial del Libro Diario</h2>
                            </div>
                            <div className="section-badges" style={{ display: 'flex', gap: '0.5rem' }}>
                                <span className="badge-green" style={{ background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    Ingresos & Ventas
                                </span>
                                <span className="badge-red" style={{ background: '#fff1f2', color: '#be123c', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    Egresos & Compras
                                </span>
                            </div>
                        </div>

                        <div className="transactions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            {/* Income Column */}
                            <div className="transactions-column">
                                <div className="column-header header-green" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '2px solid #10b981', paddingBottom: '8px', marginBottom: '1rem', fontWeight: 'bold', color: '#10b981' }}>
                                    <div className="header-dot dot-green" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                    <span>Ingresos</span>
                                </div>
                                <div className="transactions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {(transactions || []).filter(t => t.type === 'income' || (t.type as string) === 'sale').length === 0 ? (
                                        <div className="empty-column" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            <p>Sin ingresos registrados</p>
                                        </div>
                                    ) : (
                                        [...(transactions || [])].filter(t => t.type === 'income' || (t.type as string) === 'sale').slice().reverse().map(t => (
                                            <TransactionItem key={t.id} t={t} />
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Expense Column */}
                            <div className="transactions-column">
                                <div className="column-header header-red" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '2px solid #f43f5e', paddingBottom: '8px', marginBottom: '1rem', fontWeight: 'bold', color: '#f43f5e' }}>
                                    <div className="header-dot dot-red" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }}></div>
                                    <span>Egresos</span>
                                </div>
                                <div className="transactions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {(transactions || []).filter(t => t.type === 'expense').length === 0 ? (
                                        <div className="empty-column" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            <p>Sin egresos registrados</p>
                                        </div>
                                    ) : (
                                        [...(transactions || [])].filter(t => t.type === 'expense').slice().reverse().map(t => (
                                            <TransactionItem key={t.id} t={t} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Cuentas Fiadas / Deudores sidebar column */}
                    <section className="finances-section debtors-section card" style={{ padding: '1.5rem', borderRadius: '12px', height: 'fit-content' }}>
                        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div className="section-title flex items-center gap-2">
                                <Users size={20} className="text-amber-500" />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Deudores (Cta. Cte.)</h2>
                            </div>
                            {debtors.length > 0 && (
                                <span className="badge-amber" style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {debtors.length} morosos
                                </span>
                            )}
                        </div>

                        {totalDebt > 0 && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Deuda Total en Calle</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#b45309' }}>{formatCurrency(totalDebt)}</div>
                                </div>
                                <button className="collect-all-btn-sm" onClick={handleCollectAll} style={{ background: '#b45309', border: 'none', color: '#ffffff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Cobrar Todo
                                </button>
                            </div>
                        )}

                        <div className="debtors-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto' }}>
                            {debtors.length === 0 ? (
                                <div className="empty-debtors" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    <h3>¡Todo al día!</h3>
                                    <p>No hay cuentas pendientes por cobrar.</p>
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

            {/* Ticket Printer Dialog */}
            {showTicketPrinter && ticketData && (
                <TicketPrinter
                    ticketData={ticketData}
                    isOpen={showTicketPrinter}
                    onClose={() => {
                        setShowTicketPrinter(false);
                        setTicketData(null);
                    }}
                />
            )}

            {/* Expense Registration Modal (exactly preserved design) */}
            {showExpenseModal && (
                <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-custom">
                            <div className="modal-title-wrap">
                                <div className="modal-icon-red">
                                    <ArrowDownLeft size={22} />
                                </div>
                                <div>
                                    <h2>Registrar Gasto del Local</h2>
                                    <p>Completa los datos del movimiento de caja chica</p>
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
                                    <DollarSignIcon size={18} />
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

            {/* Payment Modal */}
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
                                    <p>Registrá el pago recibido del cliente</p>
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
                                    <DollarSignIcon size={18} />
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

// Simple DollarSign wrapper icon since DollarSign can sometimes collide or be missing
const DollarSignIcon = ({ size }: { size: number }) => (
    <span style={{ fontSize: `${size}px`, fontWeight: 'bold', color: '#94a3b8', paddingLeft: '4px' }}>$</span>
);
