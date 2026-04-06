import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { TicketPrinter } from '../../components/TicketPrinter/TicketPrinter';
import type { TicketData } from '../../components/TicketPrinter/TicketPrinter';
import './SalesMobile.css';

export const SalesMobile = () => {
    const transactions = useStore((state) => state.transactions);
    const customers = useStore((state) => state.customers);
    const shopInfo = useStore((state) => state.shopInfo);

    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
    const [selectedSale, setSelectedSale] = useState<any | null>(null);

    // Ticket Printer State
    const [showTicketPrinter, setShowTicketPrinter] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

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

    return (
        <div className="sales-mobile-wrapper">
            <header className="mobile-sales-header">
                <h2>Historial de Ventas</h2>
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
            </header>

            <div className="sales-list-content">
                {filteredSales.length === 0 ? (
                    <div className="empty-history">
                        <span className="material-symbols-rounded">receipt_long</span>
                        <p>No se encontraron ventas</p>
                    </div>
                ) : (
                    filteredSales.map(sale => (
                        <div key={sale.id} className="m-sale-card" onClick={() => setSelectedSale(selectedSale?.id === sale.id ? null : sale)}>
                            <div className="m-sale-header">
                                <div className="m-sale-main">
                                    <span className="m-sale-id">#{sale.id.slice(-6).toUpperCase()}</span>
                                    <span className="m-sale-time">{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className={`m-sale-method ${sale.method}`}>
                                    <span className="material-symbols-rounded">
                                        {sale.method === 'cash' ? 'payments' : 'credit_card'}
                                    </span>
                                    {sale.method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                                </div>
                            </div>
                            <div className="m-sale-body">
                                <div className="m-sale-info">
                                    <span className="m-sale-customer">
                                        {sale.metadata?.customer_id ? customers.find(c => c.id === sale.metadata!.customer_id)?.name : 'Venta Mostrador'}
                                    </span>
                                    <span className="m-sale-items">{(sale.metadata?.items || []).length} productos</span>
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
                )}
            </div>

            {showTicketPrinter && ticketData && (
                <TicketPrinter
                    ticketData={ticketData}
                    isOpen={showTicketPrinter}
                    onClose={() => { setShowTicketPrinter(false); setTicketData(null); }}
                    shopName={shopInfo.name}
                    shopPhone={shopInfo.phone}
                    shopAddress={shopInfo.address}
                />
            )}
        </div>
    );
};
