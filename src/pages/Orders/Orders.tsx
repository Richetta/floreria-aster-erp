import { useState, useMemo, useEffect } from 'react';
import {
    Plus,
    Search,
    Clock,
    Truck,
    X,
    FileText,
    Banknote,
    UserCircle,
    MapPin,
    CalendarDays,
    LayoutGrid,
    Copy,
    Package,
    Clock9,
    Check
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Order } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import './Orders.css';

export const Orders = () => {
    const navigate = useNavigate();
    const orders = useStore((state) => state.orders);
    const updateOrderStatus = useStore((state) => state.updateOrderStatus);
    const loadOrders = useStore((state) => state.loadOrders);
    const loadCustomers = useStore((state) => state.loadCustomers);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load orders from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadOrders(), loadCustomers()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState<'hoy' | 'esta-semana' | 'este-mes' | 'todos' | 'mes-especifico'>('esta-semana');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');

    // Flow columns for Kanban view
    const columns: { id: Order['status'], label: string, icon: any, color: string }[] = useMemo(() => [
        { id: 'pending', label: 'Pendiente', icon: Clock, color: '#ef4444' },
        { id: 'assembling', label: 'En Armado', icon: Search, color: '#a855f7' },
        { id: 'ready', label: 'Listo', icon: Check, color: '#3b82f6' },
        { id: 'out_for_delivery', label: 'En Camino', icon: Truck, color: '#eab308' },
        { id: 'delivered', label: 'Entregado', icon: Check, color: '#22c55e' }
    ], []);

    const filteredOrders = useMemo(() => {
        let base = orders.filter(o =>
            o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (timeFilter !== 'todos') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            base = base.filter(o => {
                const oDate = new Date(o.date);
                const oDateClear = new Date(o.date);
                oDateClear.setHours(0, 0, 0, 0);
                
                if (timeFilter === 'hoy') {
                    return oDateClear.getTime() === today.getTime();
                }
                
                if (timeFilter === 'esta-semana') {
                    const first = today.getDate() - today.getDay();
                    const last = first + 6;
                    const firstDay = new Date(today.setDate(first));
                    const lastDay = new Date(today.setDate(last));
                    firstDay.setHours(0,0,0,0);
                    lastDay.setHours(23,59,59,999);
                    return oDate >= firstDay && oDate <= lastDay;
                }

                if (timeFilter === 'este-mes') {
                    return oDate.getMonth() === new Date().getMonth() && oDate.getFullYear() === new Date().getFullYear();
                }

                if (timeFilter === 'mes-especifico') {
                    return oDate.getMonth() === selectedMonth && oDate.getFullYear() === new Date().getFullYear();
                }

                return true;
            });
        }

        return base;
    }, [orders, searchTerm, timeFilter, selectedMonth]);

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, orderId: string) => {
        setDraggedOrderId(orderId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            const el = document.getElementById(`order-card-${orderId}`);
            if (el) el.classList.add('opacity-50');
        }, 0);
    };

    const handleDragEnd = (orderId: string) => {
        setDraggedOrderId(null);
        const el = document.getElementById(`order-card-${orderId}`);
        if (el) el.classList.remove('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-surface-hover');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('bg-surface-hover');
    };

    const handleDrop = (e: React.DragEvent, newStatus: Order['status']) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-surface-hover');
        
        if (draggedOrderId) {
            updateOrderStatus(draggedOrderId, newStatus);
            if (selectedOrder && selectedOrder.id === draggedOrderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
        }
        setDraggedOrderId(null);
    };

    return (
        <div className="orders-page flex-col h-full">
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
                        <p style={{ color: '#64748b', fontWeight: 500 }}>Cargando pedidos...</p>
                    </div>
                </div>
            )}

            <header className="page-header mb-6 flex justify-between items-center shrink-0 py-2">
                <div>
                    <h1 className="text-h1">Progreso de Pedidos</h1>
                    <p className="text-body mt-2 flex items-center gap-2">
                        Control visual desde que se encarga hasta que se entrega.
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate('/pos', { state: { initialTab: 'agendar' } })}
                >
                    <Plus size={20} />
                    <span className="hidden-mobile">Nuevo Pedido</span>
                </button>
            </header>

            <div className="filters-wrapper mb-6 shrink-0">
                <div className="filters-container bg-surface p-5 rounded-2xl border border-border flex flex-col gap-5">
                    {/* Primera fila: Búsqueda + Vistas */}
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                        <div className="search-wrapper flex-1 relative">
                            <div className="search-bar bg-gradient-to-r from-background to-background border border-border rounded-xl px-4 py-3">
                                <Search className="text-muted flex-shrink-0" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente o ID..."
                                    className="search-input flex-1 bg-transparent border-none outline-none px-3 text-small w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* View Toggle - Segmented Control */}
                        <div className="view-toggle-segmented flex-shrink-0">
                            <button
                                className={`segmented-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                                onClick={() => setViewMode('kanban')}
                            >
                                <LayoutGrid size={18}/>
                                <span>Kanban</span>
                            </button>
                            <button
                                className={`segmented-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                                onClick={() => setViewMode('calendar')}
                            >
                                <CalendarDays size={18}/>
                                <span>Calendario</span>
                            </button>
                        </div>
                    </div>

                    {/* Segunda fila: Filtros de tiempo */}
                    <div className="time-filters flex flex-wrap items-center gap-3 pt-2">
                        <span className="filter-label text-micro font-semibold text-muted uppercase tracking-wider">Filtrar por:</span>
                        
                        <div className="time-filter-buttons flex flex-wrap gap-2">
                            {[
                                { id: 'hoy', label: 'Hoy' },
                                { id: 'esta-semana', label: 'Esta Semana' },
                                { id: 'este-mes', label: 'Este Mes' },
                                { id: 'todos', label: 'Todos' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    className={`time-filter-btn ${timeFilter === f.id ? 'active' : ''}`}
                                    onClick={() => setTimeFilter(f.id as any)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="filter-divider w-px h-6 bg-border mx-1"></div>

                        {/* Month Selector */}
                        <label className="month-filter flex items-center gap-2.5 cursor-pointer">
                            <Search className="text-muted flex-shrink-0" size={16} />
                            <select
                                className="month-select text-small font-medium cursor-pointer"
                                value={timeFilter === 'mes-especifico' ? selectedMonth : ''}
                                onChange={(e) => {
                                    if (e.target.value !== '') {
                                        setTimeFilter('mes-especifico');
                                        setSelectedMonth(parseInt(e.target.value));
                                    }
                                }}
                            >
                                <option value="" disabled>Mes específico</option>
                                {[
                                    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                                ].map((name, idx) => (
                                    <option key={idx} value={idx}>{name}</option>
                                ))}
                            </select>
                            {timeFilter === 'mes-especifico' && (
                                <span className="selected-month-badge text-micro font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                                    {[
                                        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
                                    ][selectedMonth]}
                                </span>
                            )}
                        </label>
                    </div>
                </div>
            </div>

            {/* Kanban Board Layout */}
            {viewMode === 'kanban' ? (
                <div className="kanban-board-wrapper flex-1 min-h-0 overflow-hidden">
                    <div className="kanban-board">
                        {columns.map(column => {
                            const columnOrders = filteredOrders.filter(o => o.status === column.id);
                            const Icon = column.icon;

                            return (
                                <div
                                    key={column.id}
                                    className="kanban-column bg-surface rounded-xl border border-border flex flex-col h-full overflow-hidden transition-colors"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, column.id)}
                                >
                                    <div className="kanban-header px-3 py-2.5 border-b border-border flex justify-between items-center bg-background shrink-0">
                                        <h3 className="font-semibold text-small flex items-center gap-1.5" style={{ color: column.color }}>
                                            <Icon size={16} />
                                            {column.label}
                                        </h3>
                                        <span className="text-micro bg-surface text-muted px-2 py-0.5 rounded-full border border-border">
                                            {columnOrders.length}
                                        </span>
                                    </div>

                                    <div className="kanban-cards-container p-2 overflow-y-auto flex-1">
                                        {columnOrders.map(order => (
                                            <div
                                                key={order.id}
                                                id={`order-card-${order.id}`}
                                                className={`order-card mb-2 p-3 status-${order.status} ${draggedOrderId === order.id ? 'opacity-50' : ''}`}
                                                onClick={() => setSelectedOrder(order)}
                                                draggable="true"
                                                onDragStart={(e) => handleDragStart(e, order.id)}
                                                onDragEnd={() => handleDragEnd(order.id)}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-micro font-black bg-white/20 px-1.5 py-0.5 rounded text-white tracking-widest uppercase">ID: #{order.id.split('-')[0]}</span>
                                                    <div className="p-1 bg-white/20 rounded shadow-sm">
                                                        {order.deliveryMethod === 'delivery' ? <Truck size={12} className="text-white" /> : <MapPin size={12} className="text-white" />}
                                                    </div>
                                                </div>

                                                <h4 className="font-extrabold text-small leading-tight mb-2 tracking-tight text-white">{order.customerName}</h4>

                                                <div className="space-y-1.5 mb-2 bg-white/10 p-2 rounded-lg border border-white/20">
                                                    <div className="flex items-center gap-1.5 text-white font-bold text-micro">
                                                        <CalendarDays size={11} className="text-white" />
                                                        <span>{timeFilter === 'hoy' ? 'Hoy' : new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(order.date))}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-white text-micro font-bold">
                                                        <Clock size={11} className="text-white" />
                                                        <span>{new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(order.date))} hs</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2 pt-2 border-t border-white/30 flex justify-between items-center">
                                                    <span className="text-micro text-white uppercase font-black tracking-tighter">TOTAL</span>
                                                    <p className="font-black text-base text-white">${order.total.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {columnOrders.length === 0 && (
                                            <div className="text-center py-8 px-4 bg-background/50 rounded-xl border border-dashed border-border mt-2">
                                                <p className="text-micro text-muted mb-3">Sin pedidos en esta etapa</p>
                                                <button 
                                                    className="btn btn-sm btn-secondary w-full flex items-center justify-center gap-1.5 opacity-70 hover:opacity-100"
                                                    onClick={() => navigate('/pos', { state: { initialTab: 'agendar' } })}
                                                >
                                                    <Plus size={14} />
                                                    <span>Registrar</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 bg-surface rounded-xl border border-border flex items-center justify-center p-8">
                    <div className="text-center text-muted">
                        <CalendarDays size={48} className="mx-auto mb-4 opacity-50" />
                        <h3 className="text-h3 mb-2">Vista Calendario (Próximamente)</h3>
                        <p className="max-w-md">La vista de calendario mensual está en desarrollo para futuras actualizaciones.</p>
                        <button className="btn btn-secondary mt-4" onClick={() => setViewMode('kanban')}>Volver a Kanban</button>
                    </div>
                </div>
            )}

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content redesigned-modal" onClick={e => e.stopPropagation()}>
                        
                        {/* Header Section */}
                        <header className="modal-header-elegant">
                            <div className="header-left">
                                <div className={`status-indicator status-${selectedOrder.status}`}></div>
                                <div className="order-identity">
                                    <div className="id-container">
                                        <span className="id-label">PEDIDO</span>
                                        <h2 className="id-value">#{selectedOrder.id.slice(0, 8)}</h2>
                                        <button 
                                            className="copy-btn" 
                                            title="Copiar ID completo"
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedOrder.id);
                                                // Ideally add a small toast here
                                            }}
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                    <div className="status-tag-wrapper">
                                        <span className={`status-tag status-${selectedOrder.status}`}>
                                            {columns.find(c => c.id === selectedOrder.status)?.label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button className="modal-close-elegant" onClick={() => setSelectedOrder(null)}>
                                <X size={20} />
                            </button>
                        </header>

                        <div className="modal-scroll-area">
                            <div className="modal-grid-v2">
                                
                                {/* Section: Logistics & Customer */}
                                <div className="grid-column">
                                    <section className="detail-card">
                                        <div className="detail-card-header">
                                            <UserCircle size={18} />
                                            <h3>Información del Cliente</h3>
                                        </div>
                                        <div className="detail-card-body customer-compact">
                                            <div className="avatar-circle">
                                                {selectedOrder.customerName.charAt(0)}
                                            </div>
                                            <div className="customer-details">
                                                <p className="main-name">{selectedOrder.customerName}</p>
                                                {selectedOrder.customerPhone && (
                                                    <p className="sub-phone">{selectedOrder.customerPhone}</p>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="detail-card mt-4">
                                        <div className="detail-card-header">
                                            <Truck size={18} />
                                            <h3>Detalles de Entrega</h3>
                                        </div>
                                        <div className="detail-card-body">
                                            <div className="logistics-info">
                                                <div className="info-pair">
                                                    <CalendarDays size={16} className="text-primary" />
                                                    <div className="info-text">
                                                        <span className="label">Fecha Entrega</span>
                                                        <p className="value">{new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date(selectedOrder.date))}</p>
                                                    </div>
                                                </div>
                                                <div className="info-pair">
                                                    <Clock9 size={16} className="text-primary" />
                                                    <div className="info-text">
                                                        <span className="label">Horario</span>
                                                        <p className="value">
                                                            {new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(selectedOrder.date))} hs
                                                            <span className="time-slot-tag">
                                                                {selectedOrder.deliveryTimeSlot === 'morning' ? 'Mañana' : 
                                                                 selectedOrder.deliveryTimeSlot === 'afternoon' ? 'Tarde' :
                                                                 selectedOrder.deliveryTimeSlot === 'evening' ? 'Noche' : 'Todo el día'}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`method-badge ${selectedOrder.deliveryMethod}`}>
                                                {selectedOrder.deliveryMethod === 'delivery' ? 'Envío a domicilio' : 'Retiro por local'}
                                            </div>
                                            {selectedOrder.deliveryMethod === 'delivery' && selectedOrder.deliveryAddress && (
                                                <div className="address-box mt-3">
                                                    <MapPin size={16} />
                                                    <div className="address-content">
                                                        <p className="street">
                                                            {selectedOrder.deliveryAddress.street} {selectedOrder.deliveryAddress.number}
                                                            {selectedOrder.deliveryAddress.floor && ` (Piso: ${selectedOrder.deliveryAddress.floor})`}
                                                        </p>
                                                        <p className="city">{selectedOrder.deliveryAddress.city || 'Buenos Aires'}</p>
                                                        {selectedOrder.deliveryAddress.reference && (
                                                            <p className="reference">Ref: {selectedOrder.deliveryAddress.reference}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>

                                {/* Section: Order Content (Items) */}
                                <div className="grid-column">
                                    <section className="detail-card h-full">
                                        <div className="detail-card-header">
                                            <Package size={18} />
                                            <h3>Contenido del Pedido</h3>
                                        </div>
                                        <div className="detail-card-body p-0">
                                            <div className="items-list-modern">
                                                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                                    selectedOrder.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="order-item-row">
                                                            <div className="item-qty">{item.qty || item.quantity}x</div>
                                                            <div className="item-main">
                                                                <span className="item-name">{item.name || item.product_name}</span>
                                                                {item.isPackage && <span className="package-label">Pack</span>}
                                                            </div>
                                                            <div className="item-price">${Number(item.price || item.unit_price).toLocaleString()}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-items">No hay productos registrados</div>
                                                )}
                                            </div>
                                            <div className="order-summary-row mt-auto pt-4 border-t border-dashed">
                                                <span className="summary-label">SUBTOTAL</span>
                                                <span className="summary-value">${selectedOrder.total.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Section: Finances & Notes */}
                                <div className="grid-column">
                                    <section className="detail-card">
                                        <div className="detail-card-header">
                                            <Banknote size={18} />
                                            <h3>Estado Financiero</h3>
                                        </div>
                                        <div className="detail-card-body">
                                            <div className="finance-stats-v2">
                                                <div className="stat-box">
                                                    <span className="label">Total Pedido</span>
                                                    <p className="value total">${selectedOrder.total.toLocaleString()}</p>
                                                </div>
                                                <div className="stat-box">
                                                    <span className="label">Seña / Pago</span>
                                                    <p className="value paid">${(selectedOrder.advancePayment || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="balance-result-box mt-4">
                                                {selectedOrder.total - (selectedOrder.advancePayment || 0) > 0 ? (
                                                    <div className="balance-card pending">
                                                        <div className="balance-icon">!</div>
                                                        <div className="balance-info">
                                                            <span className="label">PENDIENTE</span>
                                                            <p className="amount">${(selectedOrder.total - (selectedOrder.advancePayment || 0)).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="balance-card success">
                                                        <div className="balance-icon"><Check size={16} /></div>
                                                        <div className="balance-info">
                                                            <span className="label">ESTADO</span>
                                                            <p className="amount">TOTALMENTE PAGADO</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="detail-card mt-4">
                                        <div className="detail-card-header">
                                            <FileText size={18} />
                                            <h3>Notas y Observaciones</h3>
                                        </div>
                                        <div className="detail-card-body">
                                            {selectedOrder.notes ? (
                                                <div className="notes-display">
                                                    {selectedOrder.notes}
                                                </div>
                                            ) : (
                                                <p className="text-muted text-xs italic">Sin observaciones para este pedido.</p>
                                            )}
                                        </div>
                                    </section>
                                </div>

                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <footer className="modal-footer-elegant">
                            <p className="footer-creation-date">
                                Pedido creado el: {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date())}
                                {/* Ideally use created_at here if available */}
                            </p>
                            <div className="footer-actions">
                                <button className="btn-secondary-elegant" onClick={() => setSelectedOrder(null)}>Cerrar</button>
                                <button className="btn-primary-elegant" onClick={() => window.print()}>Imprimir Ticket</button>
                            </div>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};
