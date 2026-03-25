import { useState, useMemo } from 'react';
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
    Download
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { TicketPrinter } from '../../components/TicketPrinter/TicketPrinter';
import type { TicketData } from '../../components/TicketPrinter/TicketPrinter';
import './Sales.css';

export const Sales = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const shopInfo = useStore((state) => state.shopInfo);

    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('today'); // today, week, month, all
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    
    // Ticket Printer State
    const [showTicketPrinter, setShowTicketPrinter] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

    // Filter sales from transactions
    const sales = useMemo(() => {
        return (transactions || []).filter(t => t.category === 'Venta POS' || (t.type === 'income' && t.description?.toLowerCase().includes('venta')));
    }, [transactions]);

    const filteredSales = useMemo(() => {
        let result = [...sales];

        // Search filter
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

        // Date filter
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="sales-page">
            <header className="page-header">
                <div className="header-content">
                    <h1 className="text-h1 flex items-center gap-3">
                        <ShoppingBag className="text-primary" size={32} />
                        Historial de Ventas
                    </h1>
                    <p className="text-muted">Visualizá y reimprimí los tickets de tus ventas realizadas</p>
                </div>
            </header>

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
                                            {sale.method === 'cash' ? 'Efectivo' : 'Tarjeta'}
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
                                                {formatDate(sale.date)} - {formatTime(sale.date)}
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
                                                    <span className="item-name">{item.name || item.product_name || 'Producto'}</span>
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

            {/* Ticket Printer */}
            {showTicketPrinter && ticketData && (
                <TicketPrinter
                    ticketData={ticketData}
                    isOpen={showTicketPrinter}
                    onClose={() => {
                        setShowTicketPrinter(false);
                        setTicketData(null);
                    }}
                    shopName={shopInfo.name}
                    shopPhone={shopInfo.phone}
                    shopAddress={shopInfo.address}
                />
            )}
        </div>
    );
};
