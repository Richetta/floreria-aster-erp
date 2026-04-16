import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, MapPin, Truck, AlertCircle, X, Trash2, Filter, LayoutGrid, List, Edit2, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Calendar.css';

const PRESET_COLORS = [
    { bg: '#FCE7F3', text: '#BE185D', label: 'Rosa Floral' },
    { bg: '#FFEDD5', text: '#C2410C', label: 'Durazno Cálido' },
    { bg: '#DCFCE7', text: '#15803D', label: 'Hoja Verde' },
    { bg: '#DBEAFE', text: '#1D4ED8', label: 'Brisa Azul' },
    { bg: '#F3E8FF', text: '#7E22CE', label: 'Lavanda' },
    { bg: '#FEF9C3', text: '#A16207', label: 'Atardecer' },
];

export const CalendarDesktop = () => {
    // ---- GLOBAL STATE ----
    const orders = useStore(state => state.orders || []);
    const specialDates = useStore(state => state.specialDates || []);
    const fetchNationalHolidays = useStore(state => state.fetchNationalHolidays);
    const addSpecialDate = useStore(state => state.addSpecialDate);
    const updateSpecialDate = useStore(state => state.updateSpecialDate);
    const deleteSpecialDate = useStore(state => state.deleteSpecialDate);
    
    // ---- INTERNAL STATE ----
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [showDayModal, setShowDayModal] = useState(false);
    
    // Global Event Form Modal
    const [showEventModal, setShowEventModal] = useState(false);
    
    const toDateStringLocal = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const defaultForm = { 
        id: '', 
        date: toDateStringLocal(new Date()), 
        title: '', 
        category: 'personal' as const, 
        color: PRESET_COLORS[0].bg, 
        description: '' 
    };
    const [eventForm, setEventForm] = useState({...defaultForm});

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [listTimeframe, setListTimeframe] = useState<'week' | 'month' | 'trimonth' | 'year'>('month');

    const [filters, setFilters] = useState({
        showOrders: true,
        showHolidays: true,
        showCommercial: true,
        showPersonal: true
    });

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Auto-fetch national holidays
    useEffect(() => {
        fetchNationalHolidays(currentYear);
    }, [currentYear, fetchNationalHolidays]);

    // ---- CALENDAR HELPER LOGIC ----
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const startDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

    const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const getOrdersForDay = (dateString: string) => {
        if (!filters.showOrders) return [];
        return orders.filter(o => {
            if (!o.date) return false;
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

    // Array mapped Grid
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

    // Array mapped List
    const upcomingListDays = React.useMemo(() => {
        const list = [];
        const todayAtZero = new Date();
        todayAtZero.setHours(0, 0, 0, 0);

        let iterDays = 30; // Default month
        if (listTimeframe === 'week') iterDays = 7;
        if (listTimeframe === 'trimonth') iterDays = 90;
        if (listTimeframe === 'year') iterDays = 365;

        for (let i = 0; i < iterDays; i++) {
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
    }, [orders, specialDates, filters, listTimeframe]);

    // ---- ACTIONS ----
    const handleDayClick = (mappedDate: Date) => {
        setSelectedDay(mappedDate);
        setShowDayModal(true);
    };

    const handleCreateGlobalEvent = () => {
        setEventForm({...defaultForm, date: toDateStringLocal(new Date())});
        setShowEventModal(true);
    };

    const handleEditEvent = (evt: any) => {
        setEventForm({
            id: evt.id,
            date: evt.date,
            title: evt.title,
            category: evt.category,
            color: evt.color || PRESET_COLORS[0].bg,
            description: evt.description || ''
        });
        setShowDayModal(false); // Close day view to focus on global edit
        setShowEventModal(true);
    };

    const handleSaveGlobalEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventForm.date || !eventForm.title.trim()) return;

        if (eventForm.id) {
            updateSpecialDate(eventForm.id, {
                date: eventForm.date,
                title: eventForm.title,
                color: eventForm.color,
                description: eventForm.description,
            });
        } else {
            addSpecialDate({
                id: `personal-${Date.now()}`,
                date: eventForm.date,
                title: eventForm.title,
                category: "personal",
                color: eventForm.color,
                description: eventForm.description,
            });
        }

        setShowEventModal(false);
        setEventForm({...defaultForm});
    };

    const selectedDayString = selectedDay ? toDateStringLocal(selectedDay) : '';
    const selectedDayOrders = selectedDay ? getOrdersForDay(selectedDayString) : [];
    const selectedDaySpecials = selectedDay ? getSpecialsForDay(selectedDayString) : [];

    const getTextColorForBg = (hexBg: string) => {
        const found = PRESET_COLORS.find(p => p.bg === hexBg);
        return found ? found.text : '#334155';
    };

    // ---- RENDER ----
    return (
        <div className="calendar-page flex-col h-full fade-in">
            <header className="calendar-main-header">
                <div className="header-top pt-2 flex justify-between items-start gap-4 flex-wrap">
                    <div>
                        <h1 className="text-h1 flex items-center gap-3">
                            <CalendarIcon className="text-primary" size={32} />
                            Hub de Planificación
                        </h1>
                        <p className="text-muted mt-2">
                            Gestiona fechas clave y visualiza compromisos de entrega.
                        </p>
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* View Switcher Segmented Control */}
                        <div className="view-switcher-pill">
                            <button 
                                className={`v-pill ${viewMode === 'grid' ? 'v-active' : ''}`}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid size={16} /> Grilla Mensual
                            </button>
                            <button 
                                className={`v-pill ${viewMode === 'list' ? 'v-active' : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                <List size={16} /> Lista Frontal
                            </button>
                        </div>
                        
                        <button className="btn btn-primary" onClick={handleCreateGlobalEvent}>
                            <Plus size={20} />
                            <span>Añadir Fecha</span>
                        </button>
                    </div>
                </div>

                <div className="header-bottom flex justify-between items-center premium-panel p-3 gap-4 flex-wrap">
                    {/* Thematic Filters */}
                    <div className="flex items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2 mr-2 text-muted text-sm font-semibold">
                            <Filter size={16} /> Ver:
                        </div>
                        <button 
                            className={`premium-filter-chip order-chip ${filters.showOrders ? 'active' : ''}`}
                            onClick={() => setFilters({...filters, showOrders: !filters.showOrders})}
                        >
                            <Truck size={14} /> Pedidos
                        </button>
                        <button 
                            className={`premium-filter-chip holiday-chip ${filters.showHolidays ? 'active' : ''}`}
                            onClick={() => setFilters({...filters, showHolidays: !filters.showHolidays})}
                        >
                            <AlertCircle size={14} /> Feriados
                        </button>
                        <button 
                            className={`premium-filter-chip commercial-chip ${filters.showCommercial ? 'active' : ''}`}
                            onClick={() => setFilters({...filters, showCommercial: !filters.showCommercial})}
                        >
                            <CalendarIcon size={14} /> Efemérides
                        </button>
                    </div>
                    
                    {/* Dynamic Navigation matching View Mode */}
                    {viewMode === 'grid' ? (
                        <div className="calendar-nav-controls flex items-center gap-3">
                            <button className="btn btn-secondary btn-sm" onClick={goToday}>Hoy</button>
                            <div className="calendar-stepper">
                                <button className="st-left" onClick={prevMonth}><ChevronLeft size={20} /></button>
                                <div className="st-title">
                                    {monthNames[currentMonth]} {currentYear}
                                </div>
                                <button className="st-right" onClick={nextMonth}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="list-time-selector flex items-center gap-2">
                            <span className="text-sm font-semibold text-muted">Alcance:</span>
                            <select 
                                className="premium-select text-sm"
                                value={listTimeframe}
                                onChange={(e) => setListTimeframe(e.target.value as any)}
                            >
                                <option value="week">Esta Semana</option>
                                <option value="month">Este Mes</option>
                                <option value="trimonth">Próximos 3 Meses</option>
                                <option value="year">Todo el Año</option>
                            </select>
                        </div>
                    )}
                </div>
            </header>

            {/* VIEWS RENDERING */}
            <div className="calendar-board-container flex-1 min-h-0">
                {viewMode === 'grid' ? (
                    // ====== GRID VIEW V3 ======
                    <div className="premium-calendar-grid flex-1 overflow-hidden flex flex-col">
                        <div className="cal-grid-headers grid grid-cols-7 border-b border-border">
                            {weekDays.map(d => (
                                <div key={d} className="py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">{d}</div>
                            ))}
                        </div>
                        <div className="cal-grid-body grid grid-cols-7 flex-1 overflow-y-auto">
                            {calendarSquares.map((sq, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => sq.isCurrentMonth && handleDayClick(sq.date)}
                                    className={`cal-cell flex flex-col p-2 transition-all duration-200
                                        ${!sq.isCurrentMonth ? 'inactive-cell cursor-default' : 'hover:shadow-inner cursor-pointer hover:bg-slate-50/50'}
                                    `}
                                >
                                    <div className="cell-header flex justify-end">
                                        <div className={`cell-number ${sq.isToday && sq.isCurrentMonth ? 'is-today' : ''}`}>
                                            {sq.dayNumber}
                                        </div>
                                    </div>

                                    <div className="cell-events mt-1 flex-1 flex flex-col gap-[3px] custom-scrollbar overflow-y-auto pr-1">
                                        {/* SPECIAL DATES */}
                                        {sq.specialDates.map(sd => (
                                            <div 
                                                key={sd.id} 
                                                className={`premium-grid-pill ${sd.category === 'feriado' ? 'pill-holiday' : ''}`}
                                                style={sd.category !== 'feriado' ? { backgroundColor: sd.color, color: getTextColorForBg(sd.color || '') } : {}}
                                                title={sd.title}
                                            >
                                                {sd.category === 'feriado' && <AlertCircle size={10} />}
                                                <span className="truncate">{sd.title}</span>
                                            </div>
                                        ))}
                                        
                                        {/* ORDERS */}
                                        {sq.orders.slice(0, 3).map(o => (
                                            <div key={o.id} className="premium-grid-pill pill-order" title={o.customerName}>
                                                <div className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 bg-white/60">
                                                    <Truck size={10} />
                                                </div>
                                                <span className="truncate font-medium">{o.customerName || `Pedido ${o.id.slice(0,4)}`}</span>
                                            </div>
                                        ))}

                                        {sq.orders.length > 3 && (
                                            <div className="text-[10px] font-bold text-slate-400 text-center mt-1">+ {sq.orders.length - 3} entregas</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // ====== LIST VIEW V3 ======
                    <div className="premium-list-view flex-1 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto py-4">
                            {upcomingListDays.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm mt-8">
                                    <CalendarIcon size={64} className="text-slate-200 mx-auto mb-6" />
                                    <h3 className="text-2xl font-bold text-slate-700 mb-2">Libre de Tareas</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto">No hay pedidos ni efemérides agendadas en tu filtro de {listTimeframe === 'week' ? 'semana' : listTimeframe === 'month' ? 'mes' : 'temporalidad'} actual.</p>
                                </div>
                            ) : (
                                <div className="list-timeline pl-[50px] relative">
                                    {/* Timeline spine */}
                                    <div className="absolute left-[88px] top-4 bottom-0 w-[2px] bg-slate-100 z-0"></div>

                                    {upcomingListDays.map((ld, idx) => (
                                        <div key={idx} className="timeline-row flex gap-8 mb-10 relative z-10 group">
                                            
                                            {/* Date Avatar */}
                                            <div className="flex-shrink-0 w-20 relative">
                                                <div className={`date-avatar w-20 h-[88px] rounded-2xl flex flex-col justify-center items-center shadow-sm border transition-shadow
                                                    ${ld.isToday ? 'bg-primary border-primary text-white shadow-primary/20' : 'bg-white border-slate-200 text-slate-700 group-hover:shadow-md group-hover:border-slate-300'}`}>
                                                    <span className="text-[11px] font-bold uppercase tracking-widest opacity-80 mb-[-2px]">{weekDays[ld.date.getDay() === 0 ? 6 : ld.date.getDay() - 1].slice(0,3)}</span>
                                                    <span className="text-3xl font-black leading-tight tracking-tighter">{ld.date.getDate()}</span>
                                                    <span className="text-xs font-semibold">{monthNames[ld.date.getMonth()].slice(0,3)}</span>
                                                </div>
                                                {/* Line Connector Dot */}
                                                <div className={`absolute top-[44px] -right-[13px] w-3 h-3 rounded-full border-2 border-white ${ld.isToday ? 'bg-primary' : 'bg-slate-300'}`}></div>
                                            </div>

                                            {/* Data Cards for that date */}
                                            <div className="flex-1 space-y-4 pt-1">
                                                {ld.specialDates.map(sd => (
                                                    <div key={sd.id} className="glass-card flex items-center p-4 border" 
                                                         style={{ backgroundColor: sd.color || '#fef3c7', borderColor: 'transparent' }}>
                                                        <div className="flex-1 text-slate-800">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {sd.category === 'feriado' ? <AlertCircle size={16} className="text-orange-600"/> : <CheckCircle2 size={16} className="opacity-40"/>}
                                                                <h4 className="font-bold text-base m-0 leading-none">{sd.title}</h4>
                                                                <span className="text-[10px] bg-white/40 px-2 py-[2px] rounded uppercase font-bold text-slate-700 tracking-wider">
                                                                    {sd.category}
                                                                </span>
                                                            </div>
                                                            {sd.description && <p className="text-sm opacity-80 m-0 mt-1">{sd.description}</p>}
                                                        </div>
                                                        {sd.category === 'personal' && (
                                                             <button className="btn-icon w-8 h-8 bg-white/40 hover:bg-white/80 transition-colors" onClick={() => handleEditEvent({ ...sd })}>
                                                                 <Edit2 size={14} className="text-slate-700"/>
                                                             </button>
                                                        )}
                                                    </div>
                                                ))}

                                                {ld.orders.length > 0 && (
                                                    <div className="glass-card bg-white p-5 border border-slate-200">
                                                        <h5 className="text-xs uppercase font-bold text-blue-600 tracking-widest mb-3 flex items-center gap-2">
                                                            <Truck size={14} /> Tareas de Logística y Entrega
                                                        </h5>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {ld.orders.map(order => (
                                                                <div key={order.id} className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer" onClick={() => handleDayClick(ld.date)}>
                                                                    <div className="flex justify-between items-center mb-1.5">
                                                                        <span className="font-bold text-slate-800 text-sm truncate">{order.customerName}</span>
                                                                        <span className="font-mono text-xs text-slate-400">#{order.id.slice(0,5).toUpperCase()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs">
                                                                         <span className="px-2 py-0.5 rounded-md font-medium text-slate-600 bg-white border border-slate-200 whitespace-nowrap">
                                                                             {order.deliveryTimeSlot === 'morning' ? 'Mañana' : order.deliveryTimeSlot === 'afternoon' ? 'Tarde' : 'Noche'}
                                                                         </span>
                                                                         <span className="truncate text-slate-500 flex items-center gap-1">
                                                                             {order.deliveryMethod === 'delivery' ? <><MapPin size={12}/>{order.deliveryAddress?.street}</> : 'Retira'}
                                                                         </span>
                                                                    </div>
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
                    </div>
                )}
            </div>

            {/* ---- GLOBAL EVENT FORM MODAL ---- */}
            {showEventModal && (
                <div className="modal-overlay z-[9999]" onClick={() => setShowEventModal(false)}>
                    <div className="modal-content !max-w-md w-full my-auto" onClick={e => e.stopPropagation()}>
                        <div className="modal-header border-b-0 pb-4">
                            <h3 className="text-h3">{eventForm.id ? 'Modificar Efeméride' : 'Agendar Nueva Fecha'}</h3>
                            <button className="modal-close-btn bg-slate-100 hover:bg-slate-200" onClick={() => setShowEventModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body pt-0 pb-6 px-6">
                            <form onSubmit={handleSaveGlobalEvent} className="flex flex-col gap-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Fecha a agendar</label>
                                    <input 
                                        type="date" 
                                        className="form-input w-full bg-slate-50 border-slate-200 focus:border-primary"
                                        value={eventForm.date}
                                        onChange={e => setEventForm({...eventForm, date: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Motivo / Título</label>
                                    <input 
                                        type="text" 
                                        className="form-input w-full bg-slate-50 border-slate-200 focus:border-primary"
                                        placeholder="Ej. Día del Profesional Forestal" 
                                        value={eventForm.title}
                                        onChange={e => setEventForm({...eventForm, title: e.target.value})}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Color de Etiqueta (Pastel Estiloso)</label>
                                    <div className="flex flex-wrap gap-3">
                                        {PRESET_COLORS.map(c => (
                                            <div 
                                                key={c.bg}
                                                title={c.label}
                                                onClick={() => setEventForm({...eventForm, color: c.bg})}
                                                className={`w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center
                                                    ${eventForm.color === c.bg ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'ring-1 ring-black/5'}
                                                `}
                                                style={{ backgroundColor: c.bg }}
                                            >
                                                {eventForm.color === c.bg && <CheckCircle2 size={16} className="text-slate-800 opacity-60" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Detalles opcionales</label>
                                    <textarea
                                        className="form-input w-full bg-slate-50 border-slate-200 focus:border-primary" 
                                        placeholder="Recordar que este día hay que..." 
                                        rows={3}
                                        value={eventForm.description}
                                        onChange={e => setEventForm({...eventForm, description: e.target.value})}
                                    ></textarea>
                                </div>

                                <div className="mt-2 text-right">
                                    <button type="button" className="btn btn-secondary mr-3" onClick={() => setShowEventModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20">
                                        {eventForm.id ? 'Actualizar Ficha' : 'Guardar en Calendario'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ---- DAY DETAILS MODAL (Read Only overlay) ---- */}
            {showDayModal && selectedDay && (
                <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
                    <div className="modal-content !max-w-lg my-auto" onClick={e => e.stopPropagation()}>
                        <div className="modal-header bg-slate-50 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col justify-center items-center shadow-sm">
                                    <span className="text-lg font-black text-slate-800 leading-none">{selectedDay.getDate()}</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 m-0">Inspección del Día</h3>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowDayModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="modal-body custom-scrollbar p-6 bg-slate-50/50">
                             {/* Special Dates Section */}
                             <div className="mb-6">
                                <h4 className="font-bold text-slate-500 uppercase tracking-widest text-xs flex items-center gap-2 mb-3">
                                    <AlertCircle size={14} className="text-orange-500" />
                                    <span className="border-b border-slate-200 flex-1 pb-1">Avisos y Eventos</span>
                                </h4>
                                {selectedDaySpecials.length === 0 ? (
                                    <p className="text-sm italic text-slate-400">Sin eventos anotados.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedDaySpecials.map(sd => (
                                            <div key={sd.id} className="flex justify-between items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100" style={{ borderLeftWidth: '6px', borderLeftColor: sd.category === 'feriado' ? '#f97316' : sd.color }}>
                                                <div>
                                                    <span className="font-bold text-slate-800 block text-base leading-tight">{sd.title}</span>
                                                    {sd.description && <span className="text-sm text-slate-500 block mt-1">{sd.description}</span>}
                                                </div>
                                                {sd.category === 'personal' && (
                                                    <div className="flex gap-2">
                                                        <button className="btn-icon bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full" onClick={() => handleEditEvent(sd)}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button className="btn-icon bg-red-50 hover:bg-red-100 text-red-500 rounded-full" onClick={() => { deleteSpecialDate(sd.id); setShowDayModal(false); }}>
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
                                <h4 className="font-bold text-slate-500 uppercase tracking-widest text-xs flex items-center gap-2 mb-3">
                                    <Truck size={14} className="text-blue-500" />
                                    <span className="border-b border-slate-200 flex-1 pb-1">Despachos programados ({selectedDayOrders.length})</span>
                                </h4>

                                {selectedDayOrders.length === 0 ? (
                                    <p className="text-sm italic text-slate-400">No hay despachos registrados para este día.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedDayOrders.map(order => (
                                            <div key={order.id} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                                                <div className="flex justify-between mb-3 border-b border-slate-100 pb-3">
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-base">{order.customerName}</h5>
                                                        <span className="text-slate-400 text-xs font-mono">ID: {order.id.slice(0,6).toUpperCase()}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-base font-bold text-primary">${order.total?.toLocaleString()}</span>
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 mt-1">Cobrado {order.advancePayment ? `$${order.advancePayment}` : 'Cero'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 text-sm text-slate-600">
                                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                                        <Truck size={16} className={order.deliveryMethod === 'pickup' ? 'text-amber-500' : 'text-blue-500'} />
                                                        <span className="font-semibold">{order.deliveryMethod === 'pickup' ? 'Se envuelve para retiro' : 'Armar paquete para envío'}</span>
                                                        <span className="ml-auto font-bold bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm text-xs">
                                                            {order.deliveryTimeSlot === 'morning' ? '9-13hs' : order.deliveryTimeSlot === 'afternoon' ? '14-18hs' : '18-21hs'}
                                                        </span>
                                                    </div>
                                                    {order.deliveryMethod === 'delivery' && order.deliveryAddress?.street && (
                                                        <div className="flex items-center gap-2 px-2 py-1">
                                                            <MapPin size={16} className="text-slate-400 shrink-0" />
                                                            <span className="truncate">{order.deliveryAddress.street} {order.deliveryAddress.number}</span>
                                                        </div>
                                                    )}
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
