import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './OrdersMobile.css';
import './OrdersMobilePayments.css';

export const OrdersMobile = () => {
    const navigate = useNavigate();
    const orders = useStore((state) => state.orders);
    const updateOrderStatus = useStore((state) => state.updateOrderStatus);
    const loadOrders = useStore((state) => state.loadOrders);
    const shopInfo = useStore((state) => state.shopInfo);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [timeFilter, setTimeFilter] = useState<string>('todos'); // todos, hoy, manana, semana
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [showPaymentPanel, setShowPaymentPanel] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentError, setPaymentError] = useState('');

    const [viewMode, setViewMode] = useState<'feed' | 'calendar'>('feed');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Set default payment method when shopInfo loads
    useEffect(() => {
        if (shopInfo.paymentMethods && shopInfo.paymentMethods.length > 0 && !paymentMethod) {
            setPaymentMethod(shopInfo.paymentMethods[0].name);
        }
    }, [shopInfo.paymentMethods]);

    useEffect(() => {
        loadOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        let base = (orders || []).filter(o =>
            o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (viewMode === 'calendar') {
            const dateStr = selectedDate.toISOString().split('T')[0];
            return base.filter(o => new Date(o.date).toISOString().split('T')[0] === dateStr);
        }

        // Filtro de Tiempo
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        if (timeFilter === 'hoy') {
            base = base.filter(o => new Date(o.date).toISOString().split('T')[0] === today.toISOString().split('T')[0]);
        } else if (timeFilter === 'manana') {
            base = base.filter(o => new Date(o.date).toISOString().split('T')[0] === tomorrow.toISOString().split('T')[0]);
        } else if (timeFilter === 'semana') {
            base = base.filter(o => new Date(o.date) <= nextWeek && new Date(o.date) >= today);
        }

        // Filtro de Estado
        if (statusFilter === 'active') {
            base = base.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'archived');
        } else if (statusFilter !== 'all') {
            base = base.filter(o => o.status === statusFilter);
        }

        return base.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [orders, searchTerm, statusFilter, timeFilter, viewMode, selectedDate]);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'pending': return { label: 'Pte', color: '#ffffff', bg: '#DFA6A0', icon: 'schedule' };
            case 'assembling': return { label: 'Armando', color: '#ffffff', bg: '#D8C3A5', icon: 'auto_fix_high' };
            case 'ready': return { label: 'Listo', color: '#ffffff', bg: '#5E9B7E', icon: 'check_circle' };
            case 'out_for_delivery': return { label: 'Camino', color: '#ffffff', bg: '#6FAE8D', icon: 'local_shipping' };
            case 'delivered': return { label: 'Entregado', color: '#ffffff', bg: '#425149', icon: 'task_alt' };
            default: return { label: status, color: '#ffffff', bg: '#ECE6DA', icon: 'help' };
        }
    };

    const handleOrderTap = (order: any) => {
        setSelectedOrder(order);
        setIsSheetOpen(true);
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        await updateOrderStatus(orderId, newStatus as any);
        setSelectedOrder((prev: any) => prev ? { ...prev, status: newStatus } : null);
        await loadOrders();
    };

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
            const result = await api.registerOrderPayment(
                selectedOrder.id,
                amount,
                paymentMethod,
                `Pago móvil #${selectedOrder.id.slice(0, 8)}`
            );

            const newAdvance = Number(result.advance_payment ?? ((selectedOrder.advancePayment || 0) + amount));
            const updatedOrder = { ...selectedOrder, advancePayment: newAdvance };
            setSelectedOrder(updatedOrder);
            await loadOrders();

            setPaymentAmount('');
            setShowPaymentPanel(false);
        } catch (err: any) {
            setPaymentError(err.message || 'Error al registrar el pago');
        } finally {
            setPaymentLoading(false);
        }
    };

    const statusFlow = ['pending', 'assembling', 'ready', 'out_for_delivery', 'delivered'];

    // Simple Calendar Mini Component
    const renderCalendar = () => {
        const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        const currentMonth = selectedDate.getMonth();
        const currentYear = selectedDate.getFullYear();
        
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
        
        const calendarDays = [];
        // Prev month days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            calendarDays.push({ day: prevMonthLastDay - i, month: 'prev' });
        }
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            calendarDays.push({ day: i, month: 'current' });
        }
        
        return (
            <div className="mini-calendar animate-fade-in">
                <div className="calendar-header">
                    <button onClick={() => setSelectedDate(new Date(currentYear, currentMonth - 1, 1))}>
                        <span className="material-symbols-rounded">chevron_left</span>
                    </button>
                    <h3>{new Date(currentYear, currentMonth).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => setSelectedDate(new Date(currentYear, currentMonth + 1, 1))}>
                        <span className="material-symbols-rounded">chevron_right</span>
                    </button>
                </div>
                <div className="calendar-grid">
                    {days.map(d => <div key={d} className="calendar-day-label">{d}</div>)}
                    {calendarDays.map((d, idx) => {
                        const isSelected = d.month === 'current' && selectedDate.getDate() === d.day;
                        const dateToCheck = new Date(currentYear, d.month === 'current' ? currentMonth : currentMonth - 1, d.day);
                        const dateStr = dateToCheck.toISOString().split('T')[0];
                        const hasOrders = (orders || []).some(o => new Date(o.date).toISOString().split('T')[0] === dateStr);
                        
                        return (
                            <div 
                                key={idx} 
                                className={`calendar-day ${d.month} ${isSelected ? 'selected' : ''} ${hasOrders ? 'has-orders' : ''}`}
                                onClick={() => d.month === 'current' && setSelectedDate(new Date(currentYear, currentMonth, d.day))}
                            >
                                {d.day}
                                {hasOrders && <div className="order-dot" />}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="orders-mobile-wrapper">
            <header className="mobile-orders-header">
                <div className="orders-header-top">
                    <h2>Pedidos</h2>
                    <div className="orders-search-inline">
                        <span className="material-symbols-rounded">search</span>
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={() => setSearchTerm('')}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        )}
                    </div>
                    <button className={`refresh-btn ${viewMode === 'calendar' ? 'active-mode' : ''}`} onClick={() => setViewMode(viewMode === 'feed' ? 'calendar' : 'feed')}>
                        <span className="material-symbols-rounded">{viewMode === 'feed' ? 'calendar_month' : 'view_list'}</span>
                    </button>
                </div>

                {viewMode === 'feed' && (
                    <div className="orders-filter-rows animate-fade-in">
                        <div className="filter-row">
                            {[
                                { id: 'todos', label: 'Todo' },
                                { id: 'hoy', label: 'Hoy' },
                                { id: 'manana', label: 'Mañana' },
                                { id: 'semana', label: 'Semana' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    className={`filter-pill ${timeFilter === f.id ? 'active' : ''}`}
                                    onClick={() => setTimeFilter(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="filter-row">
                            {[
                                { id: 'active', label: 'Activos', color: '#5E9B7E' },
                                { id: 'pending', label: 'Ptes', color: '#DFA6A0' },
                                { id: 'ready', label: 'Listos', color: '#6FAE8D' },
                                { id: 'delivered', label: 'Entregados', color: '#425149' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    className={`filter-pill ${statusFilter === f.id ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {viewMode === 'calendar' && renderCalendar()}

            <div className="orders-feed">
                <div className="feed-header-info">
                    {viewMode === 'calendar' && (
                        <h4 className="selected-date-title">
                            {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h4>
                    )}
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="empty-orders">
                        <span className="material-symbols-rounded">receipt_long</span>
                        <p>No hay pedidos para este periodo</p>
                    </div>
                ) : (
                    filteredOrders.map(order => {
                        const s = getStatusInfo(order.status);
                        const dateObj = new Date(order.date);
                        const hasItems = order.items && order.items.length > 0;

                        return (
                            <div
                                key={order.id}
                                className="order-list-item animate-fade-in"
                                onClick={() => handleOrderTap(order)}
                            >
                                <div className="order-item-leading">
                                    <div className="order-icon-circle" style={{ background: `${s.bg}20`, color: s.bg }}>
                                        <span className="material-symbols-rounded">{s.icon}</span>
                                    </div>
                                </div>
                                <div className="order-item-content">
                                    <div className="order-item-name">{order.customerName}</div>
                                    <div className="order-item-meta">
                                        #{order.id.slice(0, 5).toUpperCase()} • {dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                    </div>
                                    {hasItems && (
                                        <div className="order-item-desc">
                                            {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
                                        </div>
                                    )}
                                </div>
                                <div className="order-item-trailing">
                                    <div className="order-item-price">${order.total.toLocaleString()}</div>
                                    <div className="order-clean-badge" style={{ color: s.bg, background: `${s.bg}15` }}>
                                        {s.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Sheet - Order Detail */}
            <div className={`order-detail-sheet ${isSheetOpen ? 'open' : ''}`}>
                <div className="sheet-overlay" onClick={() => setIsSheetOpen(false)} />
                <div className="sheet-container">
                    <div className="sheet-handle" />

                    {selectedOrder && (() => {
                        const s = getStatusInfo(selectedOrder.status);
                        const dateObj = new Date(selectedOrder.date);
                        const remaining = selectedOrder.total - (selectedOrder.advancePayment || 0);

                        return (
                            <>
                                <div className="sheet-order-header">
                                    <div className="sheet-order-info">
                                        <div className="sheet-avatar" style={{ background: `${s.bg}20`, color: s.bg }}>
                                            {selectedOrder.customerName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3>{selectedOrder.customerName}</h3>
                                            <span className="sheet-order-id">#{selectedOrder.id.toUpperCase()}</span>
                                        </div>
                                    </div>
                                    <div className="sheet-actions">
                                        <button className="sheet-action-btn" onClick={() => {
                                            window.location.href = `/pos?edit=${selectedOrder.id}`;
                                        }}>
                                            <span className="material-symbols-rounded">edit</span>
                                        </button>
                                        <button className="sheet-close" onClick={() => setIsSheetOpen(false)}>
                                            <span className="material-symbols-rounded">close</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="sheet-order-details">
                                    <div className="detail-row">
                                        <span className="material-symbols-rounded">calendar_today</span>
                                        <div>
                                            <span className="detail-label">Fecha</span>
                                            <span className="detail-value">
                                                {dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="detail-row">
                                        <span className="material-symbols-rounded">schedule</span>
                                        <div>
                                            <span className="detail-label">Horario</span>
                                            <span className="detail-value">{selectedOrder.deliveryTimeSlot?.split(' (')[0] || 'Todo el día'}</span>
                                        </div>
                                    </div>
                                    <div className="detail-row">
                                        <span className="material-symbols-rounded">
                                            {selectedOrder.deliveryMethod === 'delivery' ? 'local_shipping' : 'storefront'}
                                        </span>
                                        <div>
                                            <span className="detail-label">Entrega</span>
                                            <span className="detail-value">
                                                {selectedOrder.deliveryMethod === 'delivery' ? 'Envío' : 'Retiro'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="detail-row">
                                        <span className="material-symbols-rounded">payments</span>
                                        <div>
                                            <span className="detail-label">Método</span>
                                            <span className="detail-value">{selectedOrder.paymentMethod || 'Efectivo'}</span>
                                        </div>
                                    </div>
                                    {selectedOrder.deliveryAddress?.street && (
                                        <div className="detail-row notes-row">
                                            <span className="material-symbols-rounded">location_on</span>
                                            <div>
                                                <span className="detail-label">Dirección</span>
                                                <span className="detail-value">{selectedOrder.deliveryAddress.street}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedOrder.notes && (
                                        <div className="detail-row notes-row">
                                            <span className="material-symbols-rounded">note</span>
                                            <div>
                                                <span className="detail-label">Notas</span>
                                                <span className="detail-value">{selectedOrder.notes}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="sheet-order-items">
                                    <h4>Productos</h4>
                                    <div className="sheet-items-list">
                                        {(selectedOrder.items || []).map((item: any, idx: number) => {
                                            const itemName = item.name || item.product_name || 'Producto';
                                            const itemQty = item.qty || item.quantity || 1;
                                            const itemPrice = item.price || item.unit_price || 0;
                                            return (
                                                <div key={idx} className="sheet-item">
                                                    <span className="sheet-item-name">{itemQty}x {itemName}</span>
                                                    <span className="sheet-item-price">${(itemPrice * itemQty).toLocaleString()}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="sheet-order-summary">
                                    <div className="summary-row">
                                        <span>Total</span>
                                        <span>${selectedOrder.total.toLocaleString()}</span>
                                    </div>
                                    {selectedOrder.advancePayment > 0 && (
                                        <div className="summary-row">
                                            <span>Entregado</span>
                                            <span className="summary-advance">-${selectedOrder.advancePayment.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="summary-row total-row">
                                        <span>{remaining > 0 ? 'Saldo Pendiente' : 'Pagado'}</span>
                                        <span style={{ color: remaining > 0 ? '#DFA6A0' : '#5E9B7E' }}>
                                            ${remaining > 0 ? remaining.toLocaleString() : selectedOrder.total.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Register Payment Panel Mobile */}
                                    {remaining > 0 && (
                                        <div className="mobile-payment-section">
                                            {!showPaymentPanel ? (
                                                <button
                                                    className="mobile-payment-trigger"
                                                    onClick={() => { setShowPaymentPanel(true); setPaymentAmount(String(Math.round(remaining))); }}
                                                >
                                                    <span className="material-symbols-rounded">payments</span>
                                                    Cobrar Saldo
                                                </button>
                                            ) : (
                                                <div className="mobile-payment-form">
                                                    <div className="payment-input-group">
                                                        <input
                                                            type="number"
                                                            placeholder="Monto"
                                                            value={paymentAmount}
                                                            onChange={e => { setPaymentAmount(e.target.value); setPaymentError(''); }}
                                                        />
                                                    </div>
                                                    <div className="payment-methods-grid scroll-horizontal">
                                                        {(shopInfo.paymentMethods || []).map((m: any) => (
                                                            <button
                                                                key={m.id}
                                                                className={`pay-method-btn ${paymentMethod === m.name ? 'active' : ''}`}
                                                                onClick={() => setPaymentMethod(m.name)}
                                                            >
                                                                {m.name}
                                                            </button>
                                                        ))}
                                                        {(!shopInfo.paymentMethods || shopInfo.paymentMethods.length === 0) && (
                                                            (['cash', 'card', 'transfer'] as const).map(m => (
                                                                <button
                                                                    key={m}
                                                                    className={`pay-method-btn ${paymentMethod === m ? 'active' : ''}`}
                                                                    onClick={() => setPaymentMethod(m)}
                                                                >
                                                                    {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Transf.'}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                    {paymentError && <p className="pay-error-msj">{paymentError}</p>}
                                                    <div className="pay-form-actions">
                                                        <button 
                                                            className="pay-cancel" 
                                                            onClick={() => { setShowPaymentPanel(false); setPaymentError(''); }}
                                                        >
                                                            Cerrar
                                                        </button>
                                                        <button 
                                                            className="pay-confirm"
                                                            onClick={handleRegisterPayment}
                                                            disabled={paymentLoading || !paymentAmount}
                                                        >
                                                            {paymentLoading ? '...' : 'Registrar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Status Change Buttons */}
                                <div className="sheet-status-actions">
                                    <h4>Cambiar Estado</h4>
                                    <div className="status-buttons-grid">
                                        {statusFlow.map(status => {
                                            const info = getStatusInfo(status);
                                            const isCurrent = selectedOrder.status === status;
                                            const isPast = statusFlow.indexOf(status) < statusFlow.indexOf(selectedOrder.status);
                                            return (
                                                <button
                                                    key={status}
                                                    className={`status-change-btn ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                                                    style={{ 
                                                        color: isCurrent ? 'white' : info.bg,
                                                        background: isCurrent ? info.bg : 'white',
                                                        borderColor: isCurrent ? info.bg : 'rgba(216, 195, 165, 0.2)'
                                                    }}
                                                    onClick={() => !isCurrent && handleStatusChange(selectedOrder.id, status)}
                                                    disabled={isCurrent}
                                                >
                                                    <span className="material-symbols-rounded">{info.icon}</span>
                                                    <span>{info.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            <button className="mobile-fab-add" onClick={() => navigate('/pos')}>
                <span className="material-symbols-rounded">add</span>
            </button>
        </div>
    );
};
