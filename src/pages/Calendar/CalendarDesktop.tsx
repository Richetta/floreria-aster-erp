import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, MapPin, Truck, AlertCircle, X, Trash2, Filter, LayoutGrid, List, Edit2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Calendar.css';

export const CalendarDesktop = () => {
    // Global State
    const orders = useStore(state => state.orders || []);
    const specialDates = useStore(state => state.specialDates || []);
    const fetchNationalHolidays = useStore(state => state.fetchNationalHolidays);
    const addSpecialDate = useStore(state => state.addSpecialDate);
    const updateSpecialDate = useStore(state => state.updateSpecialDate);
    const deleteSpecialDate = useStore(state => state.deleteSpecialDate);
    
    // Internal State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showEventForm, setShowEventForm] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    
    const defaultForm = { id: '', title: '', category: 'personal' as const, color: '#4F7A5A', description: '' };
    const [eventForm, setEventForm] = useState({...defaultForm});

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

    // Day filter helper logic
    const getOrdersForDay = (dateString: string) => {
        if (!filters.showOrders) return [];
        return orders.filter(o => {
            if (!o.date) return false;
            // Handle cross timezone parsing safely
            const oDate = new Date(o.date);
            const isoCheck = !isNaN(oDate.getTime()) ? toDateStringLocal(oDate) : o.date.split('T')[0];
            return isoCheck === dateString;
        });
    };

    const getSpecialsForDay = (dateString: string) => {
        return specialDates.filter(sd => sd.date === dateString && (
            (sd.category === 'feriado' && filters.showHolidays) ||
            (sd.category === 'comercial' && filters.showCommercial) ||
            (sd.category === 'personal' && filters.showPersonal)
        ));
    };

    // Grid Day generator
    const calendarSquares = Array.from({ length: 42 }, (_, index) => {
        const dayNumber = index - startDayIndex + 1;
        const mappedDate = new Date(currentYear, currentMonth, dayNumber);
        const dateString = toDateStringLocal(mappedDate);
        
        const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
        const isToday = dateString === toDateStringLocal(new Date());

        return {
            date: mappedDate,
            dayNumber: mappedDate.getDate(),
            dateString,
            isCurrentMonth,
            isToday,
            orders: isCurrentMonth ? getOrdersForDay(dateString) : [],
            specialDates: isCurrentMonth ? getSpecialsForDay(dateString) : []
        };
    });

    // List logic (Upcoming 45 days iterator)
    const upcomingListDays = React.useMemo(() => {
        const list = [];
        const todayAtZero = new Date();
        todayAtZero.setHours(0, 0, 0, 0);

        for (let i = 0; i < 45; i++) {
            const scanDate = new Date(todayAtZero);
            scanDate.setDate(todayAtZero.getDate() + i);
            const scanString = toDateStringLocal(scanDate);
            
            const dayOrders = getOrdersForDay(scanString);
            const daySpecials = getSpecialsForDay(scanString);

            if (dayOrders.length > 0 || daySpecials.length > 0) {
                list.push({
                    date: scanDate,
                    dateString: scanString,
                    isToday: i === 0,
                    orders: dayOrders,
                    specialDates: daySpecials
                });
            }
        }
        return list;
    }, [orders, specialDates, filters]);

    const handleDayClick = (mappedDate: Date) => {
        setSelectedDay(mappedDate);
        setShowModal(true);
        setShowEventForm(false);
    };

    const handleEditEvent = (evt: any) => {
        setEventForm({
            id: evt.id,
            title: evt.title,
            category: evt.category,
            color: evt.color || '#4F7A5A',
            description: evt.description || ''
        });
        setShowEventForm(true);
    };

    const handleCreateOrUpdateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDay || !eventForm.title.trim()) return;

        if (eventForm.id) {
            updateSpecialDate(eventForm.id, {
                title: eventForm.title,
                color: eventForm.color,
                description: eventForm.description,
            });
        } else {
            addSpecialDate({
                id: `personal-${Date.now()}`,
                date: toDateStringLocal(selectedDay),
                title: eventForm.title,
                category: "personal", // forcing category over state if user is adding
                color: eventForm.color,
                description: eventForm.description,
            });
        }

        setShowEventForm(false);
        setEventForm({...defaultForm});
    };

    const selectedDayString = selectedDay ? toDateStringLocal(selectedDay) : '';
    const selectedDayOrders = selectedDay ? getOrdersForDay(selectedDayString) : [];
    const selectedDaySpecials = selectedDay ? getSpecialsForDay(selectedDayString) : [];

    return (
        <div className="calendar-page flex-col h-full">
            <header className="calendar-main-header">
                <div className="header-top flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-h1">Hub de Planificación</h1>
                        <p className="text-muted mt-1">
                            Calendario Global interactivo de Fechas, Pedidos y Entregas.
                        </p>
                    </div>

                    {/* View Switcher Mobile/Desktop Friendly */}
                    <div className="view-switcher bg-surface border border-border rounded-lg p-1 flex">
                        <button 
                            className={`view-btn ${viewMode === 'grid' ? 'active shadow-sm' : 'text-muted'}`}
                            onClick={() => setViewMode('grid')}
                            title="Vista de Grilla"
                        >
                            <LayoutGrid size={18} /> <span className="hidden-mobile">Grilla Mensual</span>
                        </button>
                        <button 
                            className={`view-btn ${viewMode === 'list' ? 'active shadow-sm' : 'text-muted'}`}
                            onClick={() => setViewMode('list')}
                            title="Vista de Lista"
                        >
                            <List size={18} /> <span className="hidden-mobile">Próximos Acontecimientos</span>
                        </button>
                    </div>
                </div>

                <div className="header-bottom flex justify-between items-center bg-surface p-3 rounded-lg border border-border shadow-sm flex-wrap gap-4">
                    {/* Filter Pills */}
                    <div className="calendar-filters flex items-center gap-2">
                        <span className="text-small font-medium text-muted flex items-center gap-1 bg-background px-2 py-1 rounded-md">
                            <Filter size={16} /> Mostrar:
                        </span>
                        
                        <button 
                            className={`filter-pill ${filters.showOrders ? 'order-active' : ''}`}
                            onClick={() => setFilters({...filters, showOrders: !filters.showOrders})}
                        >
                            <Truck size={14} /> Pedidos 
                        </button>

                        <button 
                            className={`filter-pill ${filters.showHolidays ? 'holiday-active' : ''}`}
                            onClick={() => setFilters({...filters, showHolidays: !filters.showHolidays})}
                        >
                            <AlertCircle size={14} /> Feriados
                        </button>

                        <button 
                            className={`filter-pill ${filters.showCommercial ? 'commercial-active' : ''}`}
                            onClick={() => setFilters({...filters, showCommercial: !filters.showCommercial})}
                        >
                            <CalendarIcon size={14} /> Efemérides
                        </button>
                    </div>
                    
                    {/* Navigation Controls (Only mostly relevant on Grid but useful on list if they span months) */}
                    {viewMode === 'grid' && (
                        <div className="calendar-nav-controls flex items-center gap-3">
                            <button className="btn-secondary btn-sm" onClick={goToday}>Ir a Hoy</button>
                            <div className="calendar-nav-group">
                                <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={20} /></button>
                                <h2 className="calendar-month-title">
                                    {monthNames[currentMonth]} {currentYear}
                                </h2>
                                <button className="btn-icon" onClick={nextMonth}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* VIEWS RENDERING */}
            <div className="calendar-board-container flex-1 min-h-0">
                {viewMode === 'grid' ? (
                    // ====== GRID VIEW ======
                    <div className="calendar-board grid-view flex-1 h-full bg-surface rounded-xl border border-border flex flex-col overflow-hidden shadow-sm">
                        
                        <div className="calendar-week-headers grid grid-cols-7 border-b border-border bg-slate-50">
                            {weekDays.map(day => (
                                <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="calendar-days-grid grid grid-cols-7 flex-1 overflow-y-auto">
                            {calendarSquares.map((sq, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => sq.isCurrentMonth && handleDayClick(sq.date)}
                                    className={`calendar-cell border-b border-r border-border p-2 transition-colors relative flex flex-col 
                                        ${!sq.isCurrentMonth ? 'bg-slate-50/50 text-muted opacity-60 cursor-default' : 'hover:bg-slate-50 cursor-pointer'}
                                        ${sq.isToday && sq.isCurrentMonth ? 'is-today ring-2 ring-primary ring-inset' : ''}
                                    `}
                                    style={{ minHeight: '120px' }}
                                >
                                    <span className={`day-number ${sq.isToday ? 'bg-primary text-white shadow-md' : 'text-slate-700'}`}>
                                        {sq.dayNumber}
                                    </span>

                                    <div className="calendar-cell-content mt-8 flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                                        {sq.specialDates.map(sd => (
                                            <div 
                                                key={sd.id} 
                                                className={`event-pill ${sd.category === 'feriado' ? 'pill-holiday' : 'pill-personal'}`}
                                                style={sd.category !== 'feriado' ? { backgroundColor: `${sd.color}15`, color: sd.color, borderLeftColor: sd.color } : {}}
                                                title={sd.title}
                                            >
                                                {sd.category === 'feriado' ? <AlertCircle size={10} /> : <div className="pill-dot" style={{ backgroundColor: sd.color }}></div>}
                                                <span className="truncate">{sd.title}</span>
                                            </div>
                                        ))}

                                        {sq.orders.slice(0, 3).map(order => (
                                            <div key={order.id} className="event-pill pill-order">
                                                <Truck size={10} className="shrink-0" />
                                                <span className="truncate">{order.customerName || `Pedido ${order.id.slice(0,4)}`}</span>
                                            </div>
                                        ))}
                                        {sq.orders.length > 3 && (
                                            <div className="text-micro text-primary font-medium text-center mt-1">
                                                + {sq.orders.length - 3} pedidos más
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // ====== LIST VIEW ======
                    <div className="list-view bg-surface rounded-xl border border-border shadow-sm p-4 overflow-y-auto h-full max-w-4xl mx-auto custom-scrollbar relative">
                        {upcomingListDays.length === 0 ? (
                            <div className="empty-state">
                                <CalendarIcon size={48} className="text-slate-300 mb-4" />
                                <h3 className="text-h3 text-slate-500">Sin acontecimientos cercanos</h3>
                                <p className="text-muted">No hay pedidos ni fechas especiales marcadas para los próximos días según tus filtros.</p>
                            </div>
                        ) : (
                            <div className="list-timeline relative">
                                {/* Vertical line indicator */}
                                <div className="absolute left-[39px] top-4 bottom-0 w-[2px] bg-slate-100 z-0 hidden-mobile"></div>
                                
                                {upcomingListDays.map((ld, idx) => (
                                    <div key={idx} className="list-day-row flex gap-6 mb-8 relative z-10 transition-transform hover:translate-x-1">
                                        {/* Date Callout */}
                                        <div className={`date-badge flex flex-col justify-center items-center shrink-0 w-20 h-20 rounded-2xl shadow-sm border ${ld.isToday ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                                            <span className="text-xs uppercase font-bold opacity-80 mb-[-4px]">{weekDays[ld.date.getDay() === 0 ? 6 : ld.date.getDay() - 1].slice(0,3)}</span>
                                            <span className="text-3xl font-black leading-none">{ld.date.getDate()}</span>
                                            <span className="text-xs font-semibold">{monthNames[ld.date.getMonth()].slice(0,3)}</span>
                                        </div>

                                        {/* Content Block */}
                                        <div className="flex-1 bg-white border border-slate-100 shadow-sm rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors"
                                             onClick={() => handleDayClick(ld.date)}
                                        >
                                            
                                            {ld.specialDates.length > 0 && (
                                                <div className="mb-4">
                                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><AlertCircle size={14}/> Eventos de este día</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ld.specialDates.map(sd => (
                                                           <span key={sd.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${sd.color || '#64748b'}15`, color: sd.color || '#64748b' }}>
                                                               {sd.category === 'feriado' ? <AlertCircle size={12} /> : null} {sd.title}
                                                           </span> 
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {ld.orders.length > 0 && (
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Truck size={14}/> Pedidos Agendados</h5>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {ld.orders.map(order => (
                                                            <div key={order.id} className="flex hidden-overflow justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <span className="text-sm font-medium truncate flex-1">{order.customerName || 'Cliente Invalido'}</span>
                                                                <span className="text-xs text-muted ml-2 shrink-0">{order.deliveryTimeSlot === 'morning' ? 'Mañana' : order.deliveryTimeSlot === 'afternoon' ? 'Tarde' : 'Noche'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Standard Global Modal for Day Details */}
            {showModal && selectedDay && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        
                        <div className="modal-header">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <CalendarIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-h3 m-0">Detalles del Día</h3>
                                    <p className="text-sm text-muted m-0">{selectedDay.getDate()} de {monthNames[selectedDay.getMonth()]} de {selectedDay.getFullYear()}</p>
                                </div>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body custom-scrollbar" style={{ padding: '1.5rem' }}>
                            {/* Special Dates Section */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                                    <h4 className="font-semibold text-lg flex items-center gap-2 text-slate-800">
                                        <AlertCircle size={20} className="text-orange-500" />
                                        Avisos y Efemérides
                                    </h4>
                                    {!showEventForm && (
                                        <button className="btn-secondary btn-sm" onClick={() => { setEventForm({...defaultForm}); setShowEventForm(true); }}>
                                            <Plus size={16} /> Crear Aviso
                                        </button>
                                    )}
                                </div>

                                {showEventForm && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 relative">
                                        <h5 className="text-base font-semibold mb-4">{eventForm.id ? 'Modificar Aviso' : 'Nuevo Aviso del Día'}</h5>
                                        <form onSubmit={handleCreateOrUpdateEvent}>
                                            <input 
                                                type="text" 
                                                className="form-input mb-3 w-full" 
                                                placeholder="Título descriptivo (Ej. Cumpleaños Proveedor)" 
                                                value={eventForm.title}
                                                onChange={e => setEventForm({...eventForm, title: e.target.value})}
                                                required
                                            />
                                            <div className="flex gap-3 mb-3">
                                                <div className="w-1/3">
                                                    <label className="text-xs font-semibold text-muted mb-1 block">Color Distintivo</label>
                                                    <input 
                                                        type="color" 
                                                        className="w-full h-10 p-1 border border-border rounded cursor-pointer" 
                                                        value={eventForm.color}
                                                        onChange={e => setEventForm({...eventForm, color: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            <textarea
                                                className="form-input mb-4 w-full" 
                                                placeholder="Notas internas..." 
                                                rows={2}
                                                value={eventForm.description}
                                                onChange={e => setEventForm({...eventForm, description: e.target.value})}
                                            ></textarea>
                                            <div className="flex justify-end items-center gap-2">
                                                <button type="button" className="btn-ghost btn-sm text-slate-500 hover:text-slate-800 cursor-pointer px-4 py-2" onClick={() => setShowEventForm(false)}>
                                                    Descartar
                                                </button>
                                                <button type="submit" className="btn-primary btn-sm flex items-center gap-2">
                                                    {eventForm.id ? <Edit2 size={16}/> : <Plus size={16}/>}
                                                    {eventForm.id ? 'Guardar Cambios' : 'Agendar'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {selectedDaySpecials.length === 0 && !showEventForm ? (
                                    <p className="text-sm text-slate-400 bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200 text-center">Sin avisos agendados en el casillero.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {selectedDaySpecials.map(sd => (
                                            <div key={sd.id} className="flex justify-between items-start bg-white border border-slate-200 p-3 rounded-xl shadow-sm border-l-4" style={{ borderLeftColor: sd.color || '#94a3b8' }}>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-bold text-slate-800">{sd.title}</span>
                                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                                                            {sd.category}
                                                        </span>
                                                    </div>
                                                    {sd.description && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{sd.description}</p>}
                                                </div>
                                                {sd.category === 'personal' && (
                                                    <div className="flex gap-1">
                                                        <button className="btn-icon bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200" onClick={() => handleEditEvent(sd)} title="Editar aviso">
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button className="btn-icon bg-red-50 hover:bg-red-100 text-red-600 border border-red-100" onClick={() => deleteSpecialDate(sd.id)} title="Eliminar aviso">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Orders Section */}
                            <div>
                                <h4 className="font-semibold text-lg flex items-center gap-2 text-slate-800 mb-4 border-b border-border pb-2">
                                    <Truck size={20} className="text-blue-500" />
                                    Entregas Planificadas ({selectedDayOrders.length})
                                </h4>

                                {selectedDayOrders.length === 0 ? (
                                    <p className="text-sm text-slate-400 bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200 text-center">Día libre de pedidos y logística.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {selectedDayOrders.map(order => (
                                            <div key={order.id} className="border border-slate-200 p-3 rounded-xl bg-slate-50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-sm text-slate-800">{order.customerName || 'Invitado sin nombre'}</span>
                                                    <span className="text-xs bg-white px-2 py-1 rounded font-mono border border-slate-200 text-slate-500">#{order.id.slice(0,6).toUpperCase()}</span>
                                                </div>
                                                <div className="flex flex-col gap-1.5 text-xs text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <Truck size={14} className={order.deliveryMethod === 'pickup' ? 'text-amber-500' : 'text-blue-500'} />
                                                        <span className="font-medium bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                                                            {order.deliveryMethod === 'pickup' ? 'Retiro en Sucursal' : 'Envío a Domicilio'}
                                                        </span>
                                                        <span className="font-medium ml-1">
                                                            🕒 {order.deliveryTimeSlot === 'morning' ? '9-13hs' : order.deliveryTimeSlot === 'afternoon' ? '14-18hs' : '18-21hs'}
                                                        </span>
                                                    </div>
                                                    {order.deliveryMethod === 'delivery' && order.deliveryAddress?.street && (
                                                        <div className="flex items-center gap-2 text-slate-500 bg-slate-100/50 p-1.5 rounded truncate">
                                                            <MapPin size={14} className="shrink-0" />
                                                            {order.deliveryAddress.street} {order.deliveryAddress.number}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                        <div className="modal-footer bg-slate-50 border-t border-border rounded-b-xl">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cerrar Inspección</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
