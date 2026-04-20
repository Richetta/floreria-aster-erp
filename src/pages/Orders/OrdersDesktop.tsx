import { useState, useMemo, useEffect } from 'react';
import {
    Plus, Search, Clock, Truck, X, FileText, Banknote, UserCircle,
    MapPin, CalendarDays, LayoutGrid, Copy, Package, Clock9, Check,
    MessageSquare, CreditCard, DollarSign, ChevronLeft, ArrowRight,
    ChevronRight, Filter, Archive, AlertCircle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Order } from '../../store/useStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { TicketPrinter } from '../../components/TicketPrinter/TicketPrinter';
import type { TicketData } from '../../components/TicketPrinter/TicketPrinter';
import './Orders.css';

export const OrdersDesktop = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const orders = useStore((state) => state.orders);
    const products = useStore((state) => state.products);
    const updateOrderStatus = useStore((state) => state.updateOrderStatus);
    const loadOrders = useStore((state) => state.loadOrders);
    const loadCustomers = useStore((state) => state.loadCustomers);
    const loadProducts = useStore((state) => state.loadProducts);
    const deleteOrder = useStore((state) => state.deleteOrder);
    const updateOrder = useStore((state) => state.updateOrder);
    const shopInfo = useStore((state) => state.shopInfo);
    const addNotification = useStore((state) => state.addNotification);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load orders from backend on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadOrders(), loadCustomers(), loadProducts()]);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState<'hoy' | 'esta-semana' | 'este-mes' | 'todos' | 'mes-especifico'>('esta-semana');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Payment panel state
    const [showPaymentPanel, setShowPaymentPanel] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [paymentLoading, setPaymentLoading] = useState(false);
    
    // Set default payment method when shopInfo loads
    useEffect(() => {
        if (shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0 && !paymentMethod) {
            setPaymentMethod(shopInfo.paymentMethods[0].name);
        }
    }, [shopInfo.paymentMethods]);
    const [paymentError, setPaymentError] = useState('');

    // Action states
    const [showArchived, setShowArchived] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Order>>({});
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Ticket Printer State
    const [showTicketPrinter, setShowTicketPrinter] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

    // Effect to open specific order if orderId is in location state
    // Waits until orders are loaded
    useEffect(() => {
        if (isLoading) return;
        const state = location.state as { orderId?: string } | null;
        if (state?.orderId && orders.length > 0) {
            const order = orders.find(o => o.id === state.orderId);
            if (order) {
                setSelectedOrder(order);
                window.history.replaceState({}, document.title);
            }
        }
    }, [isLoading, orders, location.state]);

    const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'pickup' | 'delivery'>('all');

    // Flow columns for Kanban view
    const columns: { id: Order['status'], label: string, icon: any, color: string, bg: string }[] = useMemo(() => [
        { id: 'pending', label: 'Pendiente', icon: Clock, color: '#EF4444', bg: '#FEF2F2' },
        { id: 'assembling', label: 'En Armado', icon: FileText, color: '#A855F7', bg: '#FAF5FF' },
        { id: 'ready', label: 'Listo', icon: Check, color: '#3B82F6', bg: '#EFF6FF' },
        { id: 'out_for_delivery', label: 'En Camino', icon: Truck, color: '#F59E0B', bg: '#FFFBEB' },
        { id: 'delivered', label: 'Entregado', icon: Check, color: '#10B981', bg: '#ECFDF5' },
        { id: 'cancelled', label: 'Cancelado', icon: X, color: '#6B7280', bg: '#F9FAFB' },
        { id: 'archived', label: 'Archivado', icon: Archive, color: '#6B7280', bg: '#F9FAFB' }
    ], []);

    const toggleStatusFilter = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const filteredOrders = useMemo(() => {
        let base = (orders || []).filter(o =>
            o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Status filters
        if (statusFilters.length > 0) {
            base = base.filter(o => statusFilters.includes(o.status));
        }

        // Delivery method filter
        if (deliveryFilter !== 'all') {
            base = base.filter(o => o.deliveryMethod === deliveryFilter);
        }

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
                    firstDay.setHours(0, 0, 0, 0);
                    lastDay.setHours(23, 59, 59, 999);
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

        // Hide cancelled and archived if showArchived is false
        if (!showArchived) {
            base = base.filter(o => o.status !== 'cancelled' && o.status !== 'archived');
        }

        return base;
    }, [orders, searchTerm, timeFilter, selectedMonth, showArchived, statusFilters, deliveryFilter]);

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

    // Delivery time slot to human-readable
    const timeSlotLabel = (slot?: string) => {
        if (slot === 'morning') return 'Mañana (9-13hs)';
        if (slot === 'afternoon') return 'Tarde (14-18hs)';
        if (slot === 'evening') return 'Noche (18-21hs)';
        return 'Todo el día';
    };

    // Format delivery date correctly (avoid timezone issues)
    const formatDeliveryDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
        } catch {
            return dateStr;
        }
    };

    // Payment handler
    const handleRegisterPayment = async () => {
        if (!selectedOrder) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            setPaymentError('Ingresá un monto válido');
            return;
        }
        const pendingBalance = selectedOrder.total - (selectedOrder.advancePayment || 0);
        if (amount > pendingBalance) {
            setPaymentError(`El monto no puede superar el saldo pendiente ($${pendingBalance.toLocaleString()})`);
            return;
        }
        setPaymentLoading(true);
        setPaymentError('');
        try {
            // Use the dedicated order payment endpoint
            const result = await api.registerOrderPayment(
                selectedOrder.id,
                amount,
                paymentMethod,
                `Pago sobre pedido #${selectedOrder.id.slice(0, 8)}`
            );

            // Update local state with new advance_payment from response
            const newAdvance = Number(result.advance_payment ?? ((selectedOrder.advancePayment || 0) + amount));
            const updatedOrder = { ...selectedOrder, advancePayment: newAdvance };
            setSelectedOrder(updatedOrder);
            // Refresh orders list
            await loadOrders();

            setPaymentAmount('');
            setShowPaymentPanel(false);
        } catch (err: any) {
            setPaymentError(err.message || 'Error al registrar el pago');
        } finally {
            setPaymentLoading(false);
        }
    };

    // Action Handlers
    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (!window.confirm('¿Estás seguro de eliminar este pedido permanentemente?')) return;

        setIsActionLoading(true);
        await deleteOrder(selectedOrder.id);
        setSelectedOrder(null);
        setIsActionLoading(false);
    };

    const handleCancelOrder = async () => {
        if (!selectedOrder) return;
        if (!window.confirm('¿Confirmas cancelar este pedido?')) return;

        setIsActionLoading(true);
        await updateOrderStatus(selectedOrder.id, 'cancelled');
        setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
        setIsActionLoading(false);
    };

    const handleArchiveOrder = async () => {
        if (!selectedOrder) return;
        setIsActionLoading(true);
        await updateOrderStatus(selectedOrder.id, 'archived');
        setSelectedOrder({ ...selectedOrder, status: 'archived' });
        setIsActionLoading(false);
    };

    const handleStartEdit = () => {
        setEditForm({ ...selectedOrder });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedOrder) return;
        setIsActionLoading(true);
        try {
            await updateOrder(selectedOrder.id, editForm);
            setSelectedOrder({ ...selectedOrder, ...editForm } as Order);
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving order edits:', error);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleWhatsAppShare = () => {
        if (!selectedOrder) return;
        
        const customerName = selectedOrder.customerName || 'Cliente';
        const orderIdShort = selectedOrder.id.slice(0, 8).toUpperCase();
        
        const itemsList = selectedOrder.items?.map((i: any) => {
            const qty = i.qty || i.quantity || 1;
            const name = i.name || i.product_name || i.productName || 'Producto';
            const price = i.price || i.unit_price || 0;
            return `🌸 *${qty}x* ${name} ($${(price * qty).toLocaleString()})`;
        }).join('\n') || '';

        const pendingBalance = selectedOrder.total - (selectedOrder.advancePayment || 0);
        const paymentInfo = pendingBalance <= 0 
            ? '✅ *Estado:* Totalmente pagado' 
            : `⚠️ *Saldo pendiente:* $${pendingBalance.toLocaleString()}`;

        const deliveryDateStr = formatDeliveryDate(selectedOrder.date);
        const timeSlotStr = timeSlotLabel(selectedOrder.deliveryTimeSlot);
        
        const deliveryDetails = selectedOrder.deliveryMethod === 'delivery' 
            ? `📍 *Envío a domicilio:* ${selectedOrder.deliveryAddress?.street} ${selectedOrder.deliveryAddress?.number}${selectedOrder.deliveryAddress?.floor ? ` (Piso: ${selectedOrder.deliveryAddress?.floor})` : ''}, ${selectedOrder.deliveryAddress?.city || ''}`
            : `🏬 *Retiro por local:* Mi Jardín`;

        const fullMessage = `🌿 *¡Hola ${customerName}!* 🌿\n\n` +
            `Te comparto el resumen de tu pedido *#${orderIdShort}* en *Mi Jardín* 🌸\n\n` +
            `📅 *Entrega:* ${deliveryDateStr}\n` +
            `⏰ *Horario:* ${timeSlotStr}\n` +
            `${deliveryDetails}\n\n` +
            `📦 *Detalle del Pedido:*\n${itemsList}\n\n` +
            `💰 *Resumen de Cuenta:*\n` +
            `- Total: $${selectedOrder.total.toLocaleString()}\n` +
            `- Seña/Pagado: $${(selectedOrder.advancePayment || 0).toLocaleString()}\n` +
            `${paymentInfo}\n\n` +
            (selectedOrder.notes ? `📝 *Notas:* ${selectedOrder.notes}\n\n` : '') +
            `¡Cualquier consulta estamos a tu disposición! Muchas gracias por elegirnos. ✨`;

        const phone = selectedOrder.customerPhone || '';
        const cleanPhone = phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('54') ? cleanPhone : '54' + cleanPhone;
        
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(fullMessage)}`, '_blank');
    };

    const handlePrintTicket = () => {
        if (!selectedOrder) return;
        
        const orderTicket: TicketData = {
            type: 'order',
            id: selectedOrder.id.toUpperCase(),
            date: selectedOrder.date,
            customerName: selectedOrder.customerName,
            customerPhone: selectedOrder.customerPhone,
            items: selectedOrder.items.map((item: any) => ({
                name: item.name || item.product_name || item.productName || 'Producto',
                quantity: item.qty || item.quantity || 1,
                unitPrice: item.price || item.unit_price || 0,
                total: (item.price || item.unit_price || 0) * (item.qty || item.quantity || 1)
            })),
            subtotal: selectedOrder.total,
            total: selectedOrder.total,
            advancePayment: selectedOrder.advancePayment || 0,
            paymentMethod: selectedOrder.payment_method || 'Efectivo',
            notes: selectedOrder.notes
        };
        
        setTicketData(orderTicket);
        setShowTicketPrinter(true);
    };

    const renderCalendar = () => {
        const year = new Date().getFullYear();
        const month = timeFilter === 'mes-especifico' ? selectedMonth : new Date().getMonth();

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday

        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        // Group orders by date for the selected month
        const ordersByDate: Record<number, Order[]> = {};
        filteredOrders.forEach(order => {
            const d = new Date(order.date);
            if (d.getMonth() === month && d.getFullYear() === year) {
                const dateKey = d.getDate();
                if (!ordersByDate[dateKey]) ordersByDate[dateKey] = [];
                ordersByDate[dateKey].push(order);
            }
        });

        return (
            <div className="calendar-wrapper h-full">
                <div className="calendar-top-bar shrink-0">
                    <h2 className="calendar-month-title">
                        <CalendarDays size={24} />
                        {monthNames[month]} {year}
                    </h2>
                    <div className="calendar-nav-controls">
                        <button
                            className="calendar-nav-btn"
                            onClick={() => {
                                let newMonth = month - 1;
                                if (newMonth < 0) newMonth = 0;
                                setTimeFilter('mes-especifico');
                                setSelectedMonth(newMonth);
                            }}
                            title="Mes anterior"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="calendar-nav-divider"></div>
                        <button
                            className="calendar-nav-btn"
                            onClick={() => {
                                let newMonth = month + 1;
                                if (newMonth > 11) newMonth = 11;
                                setTimeFilter('mes-especifico');
                                setSelectedMonth(newMonth);
                            }}
                            title="Mes siguiente"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="calendar-grid custom-scrollbar">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="calendar-header-day">{day}</div>
                    ))}

                    {days.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} className="calendar-day-cell is-empty" />;
                        const dayOrders = ordersByDate[day] || [];
                        const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

                        return (
                            <div key={`day-${day}`} className={`calendar-day-cell ${isToday ? 'is-today' : ''}`}>
                                <span className="calendar-day-number">{day}</span>

                                <div className="calendar-orders-container custom-scrollbar">
                                    {dayOrders.map(order => (
                                        <div
                                            key={order.id}
                                            className={`calendar-order-pill status-${order.status}`}
                                            onClick={() => setSelectedOrder(order)}
                                        >
                                            <div className="customer-name">{order.customerName}</div>
                                            <div className="order-meta">
                                                <span>{timeSlotLabel(order.deliveryTimeSlot).split(' ')[0]}</span>
                                                <span className="meta-badge">{order.deliveryMethod === 'delivery' ? 'Env' : 'Ret'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
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
                            borderTopColor: '#4F7A5A',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p style={{ color: '#6B6B6B', fontWeight: 500 }}>Cargando pedidos...</p>
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

            <div className="orders-toolbar shrink-0 mb-6">
                <div className="toolbar-main-row">
                    {/* Search - Primary focus */}
                    <div className="toolbar-search">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar cliente, ID o contenido..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={() => setSearchTerm('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="toolbar-actions">
                        {/* Time Filter - Compact Dropdown */}
                        <div className="toolbar-select-wrapper">
                            <Clock size={16} />
                            <select
                                value={timeFilter}
                                onChange={(e) => setTimeFilter(e.target.value as any)}
                            >
                                <option value="hoy">Hoy</option>
                                <option value="esta-semana">Esta Semana</option>
                                <option value="este-mes">Este Mes</option>
                                <option value="mes-especifico">Mes Específico</option>
                                <option value="todos">Todos</option>
                            </select>
                        </div>

                        {timeFilter === 'mes-especifico' && (
                            <select
                                className="toolbar-month-select"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            >
                                {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((name, idx) => (
                                    <option key={idx} value={idx}>{name}</option>
                                ))}
                            </select>
                        )}

                        <div className="toolbar-divider"></div>

                        {/* View Switcher - Mini */}
                        <div className="toolbar-view-toggle">
                            <button
                                className={viewMode === 'kanban' ? 'active' : ''}
                                onClick={() => setViewMode('kanban')}
                                title="Vista Kanban"
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                className={viewMode === 'calendar' ? 'active' : ''}
                                onClick={() => { setViewMode('calendar'); setTimeFilter('mes-especifico'); }}
                                title="Vista Calendario"
                            >
                                <CalendarDays size={18} />
                            </button>
                        </div>

                        <div className="toolbar-divider"></div>

                        {/* Advanced Filters Trigger */}
                        <button
                            className={`btn-toolbar-filters ${showFilters || statusFilters.length > 0 || deliveryFilter !== 'all' ? 'active' : ''}`}
                            onClick={() => setShowFilters(true)}
                        >
                            <Filter size={18} />
                            <span>Filtros</span>
                            {(statusFilters.length > 0 || deliveryFilter !== 'all') && (
                                <span className="filter-count">
                                    {statusFilters.length + (deliveryFilter !== 'all' ? 1 : 0)}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Quick Status Pills - Only visible in Kanban or if filters active */}
                <div className="toolbar-status-row">
                    <button 
                        className={`status-pill ${statusFilters.length === 0 ? 'active' : ''}`}
                        onClick={() => setStatusFilters([])}
                    >
                        Todos
                    </button>
                    {columns.filter(c => c.id !== 'cancelled' && c.id !== 'archived').map(col => (
                        <button
                            key={col.id}
                            className={`status-pill ${statusFilters.includes(col.id) ? 'active' : ''}`}
                            onClick={() => toggleStatusFilter(col.id)}
                            style={{ '--pill-color': col.color } as any}
                        >
                            <span className="pill-dot" style={{ backgroundColor: col.color }}></span>
                            {col.label}
                        </button>
                    ))}
                    <div className="toolbar-spacer"></div>
                    <div className="archived-mini-toggle" onClick={() => setShowArchived(!showArchived)}>
                        <div className={`mini-switch ${showArchived ? 'active' : ''}`}></div>
                        <span>Ver Archivados</span>
                    </div>
                </div>
            </div>

            {/* Advanced Filters Drawer (Side Panel) */}
            {showFilters && (
                <div className="filters-drawer-overlay" onClick={() => setShowFilters(false)}>
                    <div className="filters-drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div className="drawer-title">
                                <Filter size={20} />
                                <h3>Filtros Avanzados</h3>
                            </div>
                            <button className="drawer-close" onClick={() => setShowFilters(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="drawer-body custom-scrollbar">
                            {/* Status Section */}
                            <div className="drawer-section">
                                <label className="drawer-section-label">Estados de Pedido</label>
                                <div className="drawer-status-grid">
                                    {columns.map(col => (
                                        <label key={col.id} className={`drawer-checkbox status-item ${statusFilters.includes(col.id) ? 'selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={statusFilters.includes(col.id)}
                                                onChange={() => toggleStatusFilter(col.id)}
                                            />
                                            <div className="status-item-content">
                                                <div className="status-dot" style={{ backgroundColor: col.color }}></div>
                                                <span className="status-name">{col.label}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="drawer-divider"></div>

                            {/* Delivery Method */}
                            <div className="drawer-section">
                                <label className="drawer-section-label">Método de Entrega</label>
                                <div className="drawer-radio-group">
                                    <label className={`drawer-radio ${deliveryFilter === 'all' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="delivery"
                                            checked={deliveryFilter === 'all'}
                                            onChange={() => setDeliveryFilter('all')}
                                        />
                                        <span>Todos</span>
                                    </label>
                                    <label className={`drawer-radio ${deliveryFilter === 'delivery' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="delivery"
                                            checked={deliveryFilter === 'delivery'}
                                            onChange={() => setDeliveryFilter('delivery')}
                                        />
                                        <span>Envío a domicilio</span>
                                    </label>
                                    <label className={`drawer-radio ${deliveryFilter === 'pickup' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="delivery"
                                            checked={deliveryFilter === 'pickup'}
                                            onChange={() => setDeliveryFilter('pickup')}
                                        />
                                        <span>Retiro en local</span>
                                    </label>
                                </div>
                            </div>

                            <div className="drawer-divider"></div>

                            {/* Additional Options */}
                            <div className="drawer-section">
                                <label className="drawer-section-label">Otras Opciones</label>
                                <label className="drawer-checkbox legacy">
                                    <input
                                        type="checkbox"
                                        checked={showArchived}
                                        onChange={() => setShowArchived(!showArchived)}
                                    />
                                    <span>Incluir Cancelados y Archivados</span>
                                </label>
                            </div>
                        </div>

                        <div className="drawer-footer">
                            <button
                                className="btn-drawer-clear"
                                onClick={() => {
                                    setStatusFilters([]);
                                    setDeliveryFilter('all');
                                    setShowArchived(false);
                                }}
                            >
                                Limpiar todo
                            </button>
                            <button className="btn-drawer-apply" onClick={() => setShowFilters(false)}>
                                Aplicar filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kanban / Calendar Board Layout */}
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

                                    <div className="kanban-cards-container p-2 overflow-y-auto flex-1 custom-scrollbar">
                                        {columnOrders.map(order => {
                                            const pendingBalance = order.total - (order.advancePayment || 0);
                                            return (
                                                <div
                                                    key={order.id}
                                                    id={`order-card-${order.id}`}
                                                    className={`order-card mb-2 p-3 status-${order.status} ${draggedOrderId === order.id ? 'opacity-50' : ''}`}
                                                    onClick={() => setSelectedOrder(order)}
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(e, order.id)}
                                                    onDragEnd={() => handleDragEnd(order.id)}
                                                >
                                                    <div className="order-card-header">
                                                        <span className="order-id">#{order.id.split('-')[0]}</span>
                                                    </div>

                                                    <h4 className="order-customer">{order.customerName}</h4>

                                                    <div className="order-details">
                                                        <div className="order-detail-row">
                                                            <CalendarDays size={12} />
                                                            <span>{new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(order.date))}</span>
                                                        </div>
                                                        <div className="order-detail-row">
                                                            <Clock9 size={12} />
                                                            <span>{timeSlotLabel(order.deliveryTimeSlot)}</span>
                                                        </div>
                                                        {order.deliveryMethod && (
                                                            <div className="order-detail-row">
                                                                <MapPin size={12} />
                                                                <span>{order.deliveryMethod === 'delivery' ? 'Envío' : 'Retiro'}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="order-footer">
                                                        <div className="order-total">${order.total.toLocaleString()}</div>
                                                        {pendingBalance > 1 ? (
                                                            <div className="order-payment-status pending">
                                                                <AlertCircle size={10} />
                                                                Debe ${pendingBalance.toLocaleString()}
                                                            </div>
                                                        ) : order.total > 0 ? (
                                                            <div className="order-payment-status paid">
                                                                <Check size={10} />
                                                                Saldado
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                renderCalendar()
            )}

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={() => { setSelectedOrder(null); setShowPaymentPanel(false); setPaymentAmount(''); setPaymentError(''); setIsEditing(false); }}>
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
                                                addNotification('ID Copiado', 'info');
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

                            <div className="modal-header-actions">
                                <button className="action-icon-btn whatsapp" title="Compartir por WhatsApp" onClick={handleWhatsAppShare}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>chat</span>
                                </button>
                                {!isEditing && (
                                    <>
                                        <button className="action-icon-btn edit" title="Editar Pedido" onClick={handleStartEdit}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>edit</span>
                                        </button>
                                        {selectedOrder.status !== 'cancelled' && (
                                            <button className="action-icon-btn cancel" title="Cancelar Pedido" onClick={handleCancelOrder}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>cancel</span>
                                            </button>
                                        )}
                                        {selectedOrder.status !== 'archived' && (
                                            <button className="action-icon-btn archive" title="Archivar Pedido" onClick={handleArchiveOrder}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>archive</span>
                                            </button>
                                        )}
                                        <button className="action-icon-btn delete" title="Eliminar Permanente" onClick={handleDeleteOrder}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>delete</span>
                                        </button>
                                        <button className="action-icon-btn print" title="Imprimir Ticket" onClick={handlePrintTicket}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>print</span>
                                        </button>
                                    </>
                                )}
                                <button className="modal-close-elegant" onClick={() => { setSelectedOrder(null); setShowPaymentPanel(false); setPaymentAmount(''); setPaymentError(''); setIsEditing(false); }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>close</span>
                                </button>
                            </div>
                        </header>

                        <div className="modal-scroll-area">
                            <div className="modal-grid-v2">

                                {/* Section: Client & Delivery */}
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
                                                {isEditing ? (
                                                    <div className="edit-field-group">
                                                        <input
                                                            type="text"
                                                            className="edit-input-main"
                                                            value={editForm.customerName || ''}
                                                            onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
                                                            placeholder="Nombre del cliente"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="edit-input-sub"
                                                            value={editForm.customerPhone || ''}
                                                            onChange={e => setEditForm({ ...editForm, customerPhone: e.target.value })}
                                                            placeholder="Teléfono"
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="main-name">{selectedOrder.customerName}</p>
                                                        {selectedOrder.customerPhone && (
                                                            <p className="sub-phone">{selectedOrder.customerPhone}</p>
                                                        )}
                                                    </>
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
                                                        {isEditing ? (
                                                            <input
                                                                type="date"
                                                                className="edit-input-inline"
                                                                value={editForm.date ? new Date(editForm.date).toISOString().split('T')[0] : ''}
                                                                onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                                            />
                                                        ) : (
                                                            <p className="value">{formatDeliveryDate(selectedOrder.date)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="info-pair">
                                                    <Clock9 size={16} className="text-primary" />
                                                    <div className="info-text">
                                                        <span className="label">Horario</span>
                                                        {isEditing ? (
                                                            <select
                                                                className="edit-input-inline"
                                                                value={editForm.deliveryTimeSlot || 'allday'}
                                                                onChange={e => setEditForm({ ...editForm, deliveryTimeSlot: e.target.value as any })}
                                                            >
                                                                <option value="morning">Mañana (9-13hs)</option>
                                                                <option value="afternoon">Tarde (14-18hs)</option>
                                                                <option value="evening">Noche (18-21hs)</option>
                                                                <option value="allday">Todo el día</option>
                                                            </select>
                                                        ) : (
                                                            <p className="value">
                                                                <span className="time-slot-tag">
                                                                    {timeSlotLabel(selectedOrder.deliveryTimeSlot)}
                                                                </span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`method-badge ${selectedOrder.deliveryMethod || 'pickup'}`}>
                                                {selectedOrder.deliveryMethod === 'delivery' ? 'Envío a domicilio' : 'Retiro por local'}
                                            </div>
                                            {selectedOrder.deliveryMethod === 'delivery' && (isEditing || selectedOrder.deliveryAddress) && (
                                                <div className="address-box mt-3">
                                                    <MapPin size={16} />
                                                    <div className="address-content">
                                                        {isEditing ? (
                                                            <div className="edit-address-group">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Calle"
                                                                    value={editForm.deliveryAddress?.street || ''}
                                                                    onChange={e => setEditForm({ ...editForm, deliveryAddress: { ...editForm.deliveryAddress, street: e.target.value } })}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Altura"
                                                                    value={editForm.deliveryAddress?.number || ''}
                                                                    onChange={e => setEditForm({ ...editForm, deliveryAddress: { ...editForm.deliveryAddress, number: e.target.value } })}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Piso/Depto"
                                                                    value={editForm.deliveryAddress?.floor || ''}
                                                                    onChange={e => setEditForm({ ...editForm, deliveryAddress: { ...editForm.deliveryAddress, floor: e.target.value } })}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="street">
                                                                    {selectedOrder.deliveryAddress?.street} {selectedOrder.deliveryAddress?.number}
                                                                    {selectedOrder.deliveryAddress?.floor && ` (Piso: ${selectedOrder.deliveryAddress?.floor})`}
                                                                </p>
                                                                <p className="city">{selectedOrder.deliveryAddress?.city || 'Buenos Aires'}</p>
                                                                {selectedOrder.deliveryAddress?.reference && (
                                                                    <p className="reference">Ref: {selectedOrder.deliveryAddress?.reference}</p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* Card message section - Always show header in edit mode, show content when display */}
                                    {(isEditing || selectedOrder.cardMessage) && (
                                        <section className="detail-card mt-4">
                                            <div className="detail-card-header" style={{ borderBottomColor: '#FDF2F2' }}>
                                                <MessageSquare size={18} style={{ color: '#8B4513' }} />
                                                <h3 style={{ color: '#8B4513' }}>Mensaje de la Tarjeta</h3>
                                            </div>
                                            <div className="detail-card-body">
                                                {isEditing ? (
                                                    <textarea
                                                        className="edit-textarea card-message-input-compact"
                                                        value={editForm.cardMessage || ''}
                                                        onChange={e => setEditForm({ ...editForm, cardMessage: e.target.value })}
                                                        placeholder="Escribe el mensaje para la tarjeta..."
                                                        rows={3}
                                                    />
                                                ) : (
                                                    <div className="card-message-display">
                                                        {selectedOrder.cardMessage || 'Sin mensaje cargado.'}
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    )}
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
                                                    selectedOrder.items.map((item: any, idx: number) => {
                                                        // Fallback logic: Try to find product name in the local products store if missing
                                                        const matchedProduct = item.product_id ? products.find(p => p.id === item.product_id) : null;
                                                        
                                                        const productName = item.name ||
                                                            item.product_name ||
                                                            item.productName ||
                                                            matchedProduct?.name ||
                                                            item.description ||
                                                            item.product?.name ||
                                                            (typeof item === 'string' ? item : null) ||
                                                            'Producto';

                                                        return (
                                                            <div key={idx} className="order-item-row">
                                                                <div className="item-qty">{item.qty || item.quantity || 1}x</div>
                                                                <div className="item-main">
                                                                    <span className="item-name" title={productName}>
                                                                        {productName}
                                                                    </span>
                                                                    {(item.isPackage || item.package_id) && <span className="package-label">Pack</span>}
                                                                    {item.variant && <span className="variant-badge">{item.variant}</span>}
                                                                </div>
                                                                <div className="item-price">${Number(item.price || item.unit_price || 0).toLocaleString()}</div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="empty-items">No hay productos registrados</div>
                                                )}
                                            </div>
                                            <div className="order-summary-row mt-auto pt-4 border-t border-dashed">
                                                <span className="summary-label">TOTAL</span>
                                                <span className="summary-value">${selectedOrder.total.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Section: Finances + Payment + Notes */}
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
                                                    <span className="label">Cobrado</span>
                                                    <p className="value paid">${(selectedOrder.advancePayment || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="balance-result-box mt-4">
                                                {selectedOrder.total - (selectedOrder.advancePayment || 0) > 0 ? (
                                                    <div className="balance-card pending">
                                                        <div className="balance-icon">!</div>
                                                        <div className="balance-info">
                                                            <span className="label">SALDO PENDIENTE</span>
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

                                            {/* Register Payment Panel */}
                                            {selectedOrder.total - (selectedOrder.advancePayment || 0) > 0 && (
                                                <div className="payment-panel mt-4">
                                                    {!showPaymentPanel ? (
                                                        <button
                                                            className="payment-register-btn"
                                                            onClick={() => { setShowPaymentPanel(true); setPaymentAmount(String(selectedOrder.total - (selectedOrder.advancePayment || 0))); }}
                                                        >
                                                            <DollarSign size={16} />
                                                            <span>Registrar Pago</span>
                                                            <ArrowRight size={14} />
                                                        </button>
                                                    ) : (
                                                        <div className="payment-form">
                                                            <p className="payment-form-title">Registrar pago</p>
                                                            <input
                                                                type="number"
                                                                className="payment-amount-input"
                                                                placeholder="Monto"
                                                                value={paymentAmount}
                                                                onChange={e => { setPaymentAmount(e.target.value); setPaymentError(''); }}
                                                                min="1"
                                                                max={selectedOrder.total - (selectedOrder.advancePayment || 0)}
                                                            />
                                                            <div className="payment-method-tabs flex-wrap" style={{ gap: '0.25rem' }}>
                                                                {(shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0) ? (
                                                                    shopInfo.paymentMethods.filter(m => m.is_active).map(m => (
                                                                        <button
                                                                            key={m.id}
                                                                            className={`payment-method-tab ${paymentMethod === m.name ? 'active' : ''}`}
                                                                            onClick={() => setPaymentMethod(m.name)}
                                                                        >
                                                                            {m.type === 'cash' ? <Banknote size={13} /> : <CreditCard size={13} />}
                                                                            {m.name}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    (['cash', 'card', 'transfer'] as const).map(m => (
                                                                        <button
                                                                            key={m}
                                                                            className={`payment-method-tab ${paymentMethod === m ? 'active' : ''}`}
                                                                            onClick={() => setPaymentMethod(m)}
                                                                        >
                                                                            {m === 'cash' ? (
                                                                                <><Banknote size={13} /> Efectivo</>
                                                                            ) : m === 'card' ? (
                                                                                <><CreditCard size={13} /> Tarjeta</>
                                                                            ) : (
                                                                                <><DollarSign size={13} /> Transferencia</>
                                                                            )}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                            {paymentError && <p className="payment-error">{paymentError}</p>}
                                                            <div className="payment-form-actions">
                                                                <button
                                                                    className="btn-secondary-elegant"
                                                                    onClick={() => { setShowPaymentPanel(false); setPaymentAmount(''); setPaymentError(''); }}
                                                                    disabled={paymentLoading}
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    className="btn-primary-elegant"
                                                                    onClick={handleRegisterPayment}
                                                                    disabled={paymentLoading || !paymentAmount}
                                                                >
                                                                    {paymentLoading ? 'Guardando...' : 'Confirmar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="detail-card mt-4">
                                        <div className="detail-card-header">
                                            <FileText size={18} />
                                            <h3>Notas Internas</h3>
                                        </div>
                                        <div className="detail-card-body">
                                            {isEditing ? (
                                                <textarea
                                                    className="edit-textarea"
                                                    value={editForm.notes || ''}
                                                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                                    placeholder="Notas internas del pedido..."
                                                />
                                            ) : (
                                                selectedOrder.notes ? (
                                                    <div className="notes-display">
                                                        {selectedOrder.notes}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted text-xs italic">Sin observaciones para este pedido.</p>
                                                )
                                            )}
                                        </div>
                                    </section>
                                </div>

                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <footer className="modal-footer-elegant">
                            <p className="footer-creation-date">
                                {!isEditing && `Entrega: ${formatDeliveryDate(selectedOrder.date)} · ${timeSlotLabel(selectedOrder.deliveryTimeSlot)}`}
                            </p>
                            <div className="footer-actions">
                                {isEditing ? (
                                    <>
                                        <button className="btn-secondary-elegant" onClick={() => setIsEditing(false)} disabled={isActionLoading}>Cancelar</button>
                                        <button className="btn-primary-elegant" onClick={handleSaveEdit} disabled={isActionLoading}>
                                            {isActionLoading ? 'Guardando...' : 'Guardar Cambios'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn-secondary-elegant" onClick={() => { setSelectedOrder(null); setShowPaymentPanel(false); }}>Cerrar</button>
                                        <button className="btn-primary-elegant" onClick={handlePrintTicket}>
                                            <LayoutGrid size={16} />
                                            Imprimir Ticket
                                        </button>
                                    </>
                                )}
                            </div>
                        </footer>
                    </div>
                </div>
            )}
            {/* Ticket Printer Modal */}
            {showTicketPrinter && ticketData && (
                <TicketPrinter
                    ticketData={ticketData}
                    isOpen={showTicketPrinter}
                    onClose={() => setShowTicketPrinter(false)}
                />
            )}
        </div>
    );
};
