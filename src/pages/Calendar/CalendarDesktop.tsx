import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, MapPin, Truck, AlertCircle, X, Trash2, Filter } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Calendar.css';

export const CalendarDesktop = () => {
    // Global State
    const orders = useStore(state => state.orders || []);
    const specialDates = useStore(state => state.specialDates || []);
    const fetchNationalHolidays = useStore(state => state.fetchNationalHolidays);
    const addSpecialDate = useStore(state => state.addSpecialDate);
    const deleteSpecialDate = useStore(state => state.deleteSpecialDate);
    
    // Internal State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [showEventForm, setShowEventForm] = useState(false);
    
    const [eventForm, setEventForm] = useState({
        title: '',
        category: 'personal' as const,
        color: '#4F7A5A',
        description: ''
    });

    const [filters, setFilters] = useState({
        showOrders: true,
        showHolidays: true,
        showCommercial: true,
        showPersonal: true
    });

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Fetch API Data automatically for the current viewed year
    useEffect(() => {
        fetchNationalHolidays(currentYear);
    }, [currentYear, fetchNationalHolidays]);

    // Calendar logic
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    // Adjust mapping so Monday is 0 and Sunday is 6
    const startDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

    // Helper: Normalize date string for comparison 'YYYY-MM-DD'
    const toDateStringLocal = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Day generator
    const calendarSquares = Array.from({ length: 42 }, (_, index) => {
        const dayNumber = index - startDayIndex + 1;
        const mappedDate = new Date(currentYear, currentMonth, dayNumber);
        const dateString = toDateStringLocal(mappedDate);
        
        const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
        const isToday = dateString === toDateStringLocal(new Date());

        // Find relevant data for this day
        let dayOrders = orders.filter(o => {
            if (!o.date) return false;
            // Handle ISO string or simple string date parsing safely usually it's YYYY-MM-DD...
            const oDate = new Date(o.date);
            return toDateStringLocal(oDate) === dateString;
        });
        if (!filters.showOrders) dayOrders = [];

        const daySpecialDates = specialDates.filter(sd => sd.date === dateString && (
            (sd.category === 'feriado' && filters.showHolidays) ||
            (sd.category === 'comercial' && filters.showCommercial) ||
            (sd.category === 'personal' && filters.showPersonal)
        ));

        return {
            date: mappedDate,
            dayNumber: mappedDate.getDate(),
            dateString,
            isCurrentMonth,
            isToday,
            orders: dayOrders,
            specialDates: daySpecialDates
        };
    });

    const handleDayClick = (mappedDate: Date) => {
        setSelectedDay(mappedDate);
        setShowDrawer(true);
        setShowEventForm(false);
    };

    const handleCreateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDay || !eventForm.title.trim()) return;

        addSpecialDate({
            id: `personal-${Date.now()}`,
            date: toDateStringLocal(selectedDay),
            title: eventForm.title,
            category: eventForm.category,
            color: eventForm.color,
            description: eventForm.description,
        });

        setShowEventForm(false);
        setEventForm({ title: '', category: 'personal', color: '#4F7A5A', description: '' });
    };

    // Filter properties for specific day in drawer
    const drawerDateString = selectedDay ? toDateStringLocal(selectedDay) : '';
    const selectedDayOrders = selectedDay ? orders.filter(o => o.date && toDateStringLocal(new Date(o.date)) === drawerDateString) : [];
    const selectedDaySpecials = selectedDay ? specialDates.filter(sd => sd.date === drawerDateString) : [];

    return (
        <div className="calendar-page flex-col h-full">
            <header className="page-header mb-6 flex justify-between items-center shrink-0 py-2">
                <div>
                    <h1 className="text-h1">Hub de Planificación</h1>
                    <p className="text-body mt-2 text-muted flex items-center gap-2">
                        <span>Calendario Global de Fechas, Pedidos y Entregas.</span>
                    </p>
                </div>
                <div className="calendar-controls">
                    <div className="calendar-filters flex items-center gap-3 bg-surface p-2 rounded-lg border border-border text-sm">
                        <Filter size={16} className="text-muted" />
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={filters.showOrders} onChange={(e) => setFilters({...filters, showOrders: e.target.checked})} />
                            Pedidos
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={filters.showHolidays} onChange={(e) => setFilters({...filters, showHolidays: e.target.checked})} />
                            Feriados
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={filters.showCommercial} onChange={(e) => setFilters({...filters, showCommercial: e.target.checked})} />
                            Efemérides
                        </label>
                    </div>
                    
                    <button className="btn-secondary btn-sm" onClick={goToday}>Hoy</button>
                    <div className="calendar-nav-group">
                        <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={20} /></button>
                        <h2 className="calendar-month-title">
                            {monthNames[currentMonth]} {currentYear}
                        </h2>
                        <button className="btn-icon" onClick={nextMonth}><ChevronRight size={20} /></button>
                    </div>
                </div>
            </header>

            <div className="calendar-board flex-1 min-h-0 bg-surface rounded-xl border border-border flex flex-col overflow-hidden">
                {/* Headers */}
                <div className="calendar-week-headers grid grid-cols-7 border-b border-border bg-background/50">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-small font-semibold text-muted uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="calendar-days-grid grid grid-cols-7 flex-1 overflow-y-auto">
                    {calendarSquares.map((sq, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => handleDayClick(sq.date)}
                            className={`calendar-cell border-b border-r border-border p-2 cursor-pointer transition-colors relative flex flex-col hover:bg-slate-50
                                ${!sq.isCurrentMonth ? 'bg-slate-50/50 text-muted opacity-60' : ''}
                                ${sq.isToday ? 'is-today' : ''}
                            `}
                            style={{ minHeight: '120px' }}
                        >
                            <span className={`day-number ${sq.isToday ? 'bg-primary text-white' : ''}`}>
                                {sq.dayNumber}
                            </span>

                            <div className="calendar-cell-content mt-6 flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                                {/* Special Dates Pills */}
                                {sq.specialDates.map(sd => (
                                    <div 
                                        key={sd.id} 
                                        className="event-pill special-pill"
                                        style={{ backgroundColor: `${sd.color}15`, color: sd.color, borderLeftColor: sd.color }}
                                        title={sd.title}
                                    >
                                        <div className="pill-dot" style={{ backgroundColor: sd.color }}></div>
                                        <span className="truncate">{sd.title}</span>
                                    </div>
                                ))}

                                {/* Order Pills */}
                                {sq.orders.slice(0, 3).map(order => (
                                    <div 
                                        key={order.id} 
                                        className="event-pill order-pill"
                                    >
                                        <Truck size={10} className="shrink-0" />
                                        <span className="truncate">{order.customerName || `Pedido ${order.id.slice(-4).toUpperCase()}`}</span>
                                    </div>
                                ))}
                                {sq.orders.length > 3 && (
                                    <div className="text-micro text-muted text-center mt-1">
                                        + {sq.orders.length - 3} pedidos más
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Special Dates / Day Drawer */}
            {showDrawer && selectedDay && (
                <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
                    <div className="filters-drawer day-drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header bg-slate-50">
                            <div className="drawer-title">
                                <CalendarIcon size={20} className="text-primary" />
                                <h3>
                                    {selectedDay.getDate()} de {monthNames[selectedDay.getMonth()]} {selectedDay.getFullYear()}
                                </h3>
                            </div>
                            <button className="drawer-close" onClick={() => setShowDrawer(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="drawer-body custom-scrollbar p-6">
                            
                            {/* Special Dates Section */}
                            <div className="drawer-sub-section mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-h4 flex items-center gap-2">
                                        <AlertCircle size={18} className="text-orange-500" />
                                        Efemérides y Avisos
                                    </h4>
                                    {!showEventForm && (
                                        <button className="btn-icon btn-sm text-primary" onClick={() => setShowEventForm(true)} title="Agregar Aviso">
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>

                                {showEventForm && (
                                    <form className="bg-slate-50 p-4 rounded-xl border border-border mb-4" onSubmit={handleCreateEvent}>
                                        <h5 className="text-small font-semibold mb-3">Nuevo Aviso / Efeméride</h5>
                                        <input 
                                            type="text" 
                                            className="form-input mb-3 w-full" 
                                            placeholder="Título (Ej. Aniversario Ciudad)" 
                                            value={eventForm.title}
                                            onChange={e => setEventForm({...eventForm, title: e.target.value})}
                                            required
                                        />
                                        <textarea
                                            className="form-input mb-3 w-full" 
                                            placeholder="Descripción o Notas adicionales..." 
                                            rows={2}
                                            value={eventForm.description}
                                            onChange={e => setEventForm({...eventForm, description: e.target.value})}
                                        ></textarea>
                                        <div className="flex justify-between items-center mt-4">
                                            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowEventForm(false)}>
                                                Cancelar
                                            </button>
                                            <button type="submit" className="btn-primary btn-sm">
                                                Guardar
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {selectedDaySpecials.length === 0 && !showEventForm ? (
                                    <p className="text-sm text-muted italic">No hay efemérides ni avisos para este día.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {selectedDaySpecials.map(sd => (
                                            <div key={sd.id} className="special-date-card" style={{ borderLeftColor: sd.color || '#cbd5e1' }}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="text-sm font-semibold">{sd.title}</span>
                                                        {sd.description && <p className="text-xs text-muted mt-1">{sd.description}</p>}
                                                    </div>
                                                    {sd.category === 'personal' && (
                                                        <button className="btn-icon" onClick={() => deleteSpecialDate(sd.id)}>
                                                            <Trash2 size={14} className="text-red-500" />
                                                        </button>
                                                    )}
                                                </div>
                                                <span className="text-micro mt-2 inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                    {sd.category === 'feriado' ? 'Feriado Nacional' : sd.category === 'comercial' ? 'Día Comercial' : 'Particular'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Orders Section */}
                            <div className="drawer-sub-section">
                                <h4 className="text-h4 flex items-center gap-2 mb-4">
                                    <Truck size={18} className="text-blue-500" />
                                    Pedidos Programados ({selectedDayOrders.length})
                                </h4>

                                {selectedDayOrders.length === 0 ? (
                                    <p className="text-sm text-muted italic">No hay pedidos a entregar para este día.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {selectedDayOrders.map(order => (
                                            <div key={order.id} className="order-schedule-card border border-border p-3 rounded-lg bg-white">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-semibold text-sm">{order.customerName || 'Sin Nombre'}</span>
                                                    <span className="text-xs font-mono text-muted">#{order.id.slice(0,6).toUpperCase()}</span>
                                                </div>
                                                <div className="flex gap-4 text-xs text-muted">
                                                    <div className="flex items-center gap-1">
                                                        <Truck size={12} />
                                                        {order.deliveryMethod === 'pickup' ? 'Retiro' : 'Envío'}
                                                    </div>
                                                    {order.deliveryMethod === 'delivery' && order.deliveryAddress?.street && (
                                                        <div className="flex items-center gap-1 truncate w-32">
                                                            <MapPin size={12} />
                                                            {order.deliveryAddress.street} {order.deliveryAddress.number}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 text-xs font-medium text-primary">
                                                    {order.deliveryTimeSlot === 'morning' ? 'Mañana (9-13hs)' : 
                                                     order.deliveryTimeSlot === 'afternoon' ? 'Tarde (14-18hs)' : 
                                                     order.deliveryTimeSlot === 'evening' ? 'Noche (18-21hs)' : 'Todo el día'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
