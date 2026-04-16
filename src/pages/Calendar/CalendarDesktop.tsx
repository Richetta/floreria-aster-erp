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
    const [listTimeframe, setListTimeframe] = useState<'week' | 'month' | 'trimonth' | 'year'>('year');

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

    const upcomingListDays = React.useMemo(() => {
        const list = [];
        const todayAtZero = new Date();
        todayAtZero.setHours(0, 0, 0, 0);

        let iterDays = 30;
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
        setShowDayModal(false);
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
        <div className="calendar-page fade-in">
            <header className="calendar-main-header">
                <div className="header-top">
                    <div>
                        <h1 className="text-h1 flex items-center gap-2">
                            <CalendarIcon className="text-primary" size={32} />
                            Hub de Planificación
                        </h1>
                        <p className="header-caption">
                            Gestiona fechas clave y visualiza compromisos de entrega.
                        </p>
                    </div>

                    <div className="header-actions">
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

                <div className="header-bottom premium-panel">
                    <div className="filters-group">
                        <span className="filter-label">
                            <Filter size={16} /> Ver:
                        </span>
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
                    
                    {viewMode === 'grid' ? (
                        <div className="header-actions">
                            <button className="btn btn-secondary" style={{padding: '0.4rem 1rem'}} onClick={goToday}>Hoy</button>
                            <div className="calendar-stepper">
                                <button onClick={prevMonth}><ChevronLeft size={20} /></button>
                                <div className="st-title">
                                    {monthNames[currentMonth]} {currentYear}
                                </div>
                                <button onClick={nextMonth}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="list-time-selector">
                            <span>Alcance:</span>
                            <select 
                                className="premium-select"
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

            <div className="calendar-board-container">
                {viewMode === 'grid' ? (
                    <div className="premium-calendar-grid">
                        <div className="cal-grid-headers">
                            {weekDays.map(d => (
                                <div key={d} className="grid-header-col">{d}</div>
                            ))}
                        </div>
                        <div className="cal-grid-body custom-scrollbar">
                            {calendarSquares.map((sq, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => sq.isCurrentMonth && handleDayClick(sq.date)}
                                    className={`cal-cell ${!sq.isCurrentMonth ? 'inactive-cell' : 'active-cell'}`}
                                >
                                    <div className="cell-header">
                                        <div className={`cell-number ${sq.isToday && sq.isCurrentMonth ? 'is-today' : ''}`}>
                                            {sq.dayNumber}
                                        </div>
                                    </div>

                                    <div className="cell-events custom-scrollbar">
                                        {sq.specialDates.map(sd => (
                                            <div 
                                                key={sd.id} 
                                                className={`premium-grid-pill ${sd.category === 'feriado' ? 'pill-holiday' : ''}`}
                                                style={sd.category !== 'feriado' ? { backgroundColor: sd.color, color: getTextColorForBg(sd.color || '') } : {}}
                                                title={sd.title}
                                            >
                                                {sd.category === 'feriado' && <AlertCircle size={10} />}
                                                <span className="truncate-text">{sd.title}</span>
                                            </div>
                                        ))}
                                        
                                        {sq.orders.slice(0, 3).map(o => (
                                            <div key={o.id} className="premium-grid-pill pill-order" title={o.customerName}>
                                                <Truck size={10} />
                                                <span className="truncate-text">{o.customerName || `Pedido ${o.id.slice(0,4)}`}</span>
                                            </div>
                                        ))}

                                        {sq.orders.length > 3 && (
                                            <div style={{fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '4px'}}>+ {sq.orders.length - 3} entregas</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="premium-list-view custom-scrollbar">
                        <div className="list-wrapper">
                            {upcomingListDays.length === 0 ? (
                                <div className="empty-state-list">
                                    <CalendarIcon size={64} style={{color: 'var(--color-border)', margin: '0 auto'}} />
                                    <h3>Libre de Tareas</h3>
                                    <p>No hay pedidos ni efemérides agendadas en tu alcance actual.</p>
                                </div>
                            ) : (
                                <div className="list-timeline">
                                    <div className="timeline-spine"></div>

                                    {upcomingListDays.map((ld, idx) => (
                                        <div key={idx} className="timeline-row">
                                            
                                            <div className="date-avatar-container">
                                                <div className={`date-avatar ${ld.isToday ? 'is-today' : ''}`}>
                                                    <span className="avatar-day-str">{weekDays[ld.date.getDay() === 0 ? 6 : ld.date.getDay() - 1].slice(0,3)}</span>
                                                    <span className="avatar-date">{ld.date.getDate()}</span>
                                                    <span className="avatar-month">{monthNames[ld.date.getMonth()].slice(0,3)}</span>
                                                </div>
                                                <div className={`timeline-dot ${ld.isToday ? 'is-today' : 'is-future'}`}></div>
                                            </div>

                                            <div className="cards-container">
                                                {ld.specialDates.map(sd => (
                                                    <div key={sd.id} className="glass-card" style={{ backgroundColor: sd.color || '#fef3c7' }}>
                                                        <div className="card-content-left">
                                                            <div className="card-header-flex">
                                                                {sd.category === 'feriado' ? <AlertCircle size={16} color="#ea580c"/> : <CheckCircle2 size={16} opacity={0.4}/>}
                                                                <h4 className="card-title" style={{color: sd.category === 'feriado' ? '#9a3412' : getTextColorForBg(sd.color || '')}}>{sd.title}</h4>
                                                                <span className="card-tag">{sd.category}</span>
                                                            </div>
                                                            {sd.description && <p className="card-desc" style={{color: getTextColorForBg(sd.color || '')}}>{sd.description}</p>}
                                                        </div>
                                                        {sd.category === 'personal' && (
                                                             <button className="event-btn" onClick={() => handleEditEvent({ ...sd })}>
                                                                 <Edit2 size={14} color="var(--color-text-main)"/>
                                                             </button>
                                                        )}
                                                    </div>
                                                ))}

                                                {ld.orders.length > 0 && (
                                                    <div className="order-group-card" onClick={() => handleDayClick(ld.date)}>
                                                        <div className="og-header">
                                                            <Truck size={14} /> Entregas Programadas
                                                        </div>
                                                        <div className="og-grid">
                                                            {ld.orders.map(order => (
                                                                <div key={order.id} className="order-slot">
                                                                    <div className="os-top">
                                                                        <span className="os-name">{order.customerName}</span>
                                                                        <span className="os-id">#{order.id.slice(0,5).toUpperCase()}</span>
                                                                    </div>
                                                                    <div className="os-bottom">
                                                                         <span className="os-time">
                                                                             {order.deliveryTimeSlot === 'morning' ? 'Mañana' : order.deliveryTimeSlot === 'afternoon' ? 'Tarde' : 'Noche'}
                                                                         </span>
                                                                         <span className="os-method">
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
                <div className="modal-overlay" style={{zIndex: 9999}} onClick={() => setShowEventModal(false)}>
                    <div className="modal-content" style={{maxWidth: '450px', margin: 'auto'}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="text-h3" style={{margin: 0}}>{eventForm.id ? 'Modificar Efeméride' : 'Agendar Nueva Fecha'}</h3>
                            <button className="modal-close-btn" onClick={() => setShowEventModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSaveGlobalEvent} style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
                                <div>
                                    <label className="form-label" style={{display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem'}}>Fecha a agendar</label>
                                    <input 
                                        type="date" 
                                        className="form-input"
                                        style={{width: '100%'}}
                                        value={eventForm.date}
                                        onChange={e => setEventForm({...eventForm, date: e.target.value})}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="form-label" style={{display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem'}}>Motivo / Título</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        style={{width: '100%'}}
                                        placeholder="Ej. Cumpleaños Proveedor" 
                                        value={eventForm.title}
                                        onChange={e => setEventForm({...eventForm, title: e.target.value})}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="form-label" style={{display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem'}}>Fondo de Tarjeta</label>
                                    <div className="color-bubbles">
                                        {PRESET_COLORS.map(c => (
                                            <div 
                                                key={c.bg}
                                                title={c.label}
                                                onClick={() => setEventForm({...eventForm, color: c.bg})}
                                                className={`color-bubble ${eventForm.color === c.bg ? 'active' : ''}`}
                                                style={{ backgroundColor: c.bg }}
                                            >
                                                {eventForm.color === c.bg && <CheckCircle2 size={16} color="var(--color-text-main)" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="form-label" style={{display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem'}}>Notas opcionales</label>
                                    <textarea
                                        className="form-input" 
                                        style={{width: '100%'}}
                                        placeholder="Recordar que este día hay que..." 
                                        rows={3}
                                        value={eventForm.description}
                                        onChange={e => setEventForm({...eventForm, description: e.target.value})}
                                    ></textarea>
                                </div>

                                <div className="modal-footer" style={{padding: '0.5rem 0 0 0', border: 'none'}}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowEventModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary">
                                        {eventForm.id ? 'Actualizar Ficha' : 'Guardar Fecha'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ---- DAY DETAILS MODAL ---- */}
            {showDayModal && selectedDay && (
                <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
                    <div className="modal-content" style={{maxWidth: '600px', margin: 'auto'}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{background: 'var(--color-surface)', alignItems: 'center'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                                <div style={{width: '45px', height: '45px', borderRadius: 'var(--radius-md)', background: 'var(--color-background)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <span style={{fontSize: '1.25rem', fontWeight: '900'}}>{selectedDay.getDate()}</span>
                                </div>
                                <h3 className="text-h3" style={{margin: 0}}>Inspección del Día</h3>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowDayModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="modal-body custom-scrollbar" style={{padding: '1.5rem', background: 'var(--color-background)'}}>
                             <div style={{marginBottom: '1.5rem'}}>
                                <h4 style={{fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem'}}>
                                    <AlertCircle size={14} color="#f97316" />
                                    Avisos y Eventos
                                </h4>
                                {selectedDaySpecials.length === 0 ? (
                                    <p style={{fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--color-text-muted)'}}>Sin eventos anotados.</p>
                                ) : (
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                                        {selectedDaySpecials.map(sd => (
                                            <div key={sd.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'white', padding: '1rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', borderLeftWidth: '6px', borderLeftColor: sd.category === 'feriado' ? '#f97316' : sd.color}}>
                                                <div>
                                                    <span style={{fontWeight: '700', fontSize: '1rem', display: 'block'}}>{sd.title}</span>
                                                    {sd.description && <span style={{fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem'}}>{sd.description}</span>}
                                                </div>
                                                {sd.category === 'personal' && (
                                                    <div style={{display: 'flex', gap: '0.5rem'}}>
                                                        <button className="event-btn" onClick={() => handleEditEvent(sd)}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button className="event-btn" style={{background: '#fef2f2', color: '#ef4444'}} onClick={() => { deleteSpecialDate(sd.id); setShowDayModal(false); }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 style={{fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem'}}>
                                    <Truck size={14} color="#3b82f6" />
                                    Despachos programados ({selectedDayOrders.length})
                                </h4>

                                {selectedDayOrders.length === 0 ? (
                                    <p style={{fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--color-text-muted)'}}>No hay despachos registrados para este día.</p>
                                ) : (
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                                        {selectedDayOrders.map(order => (
                                            <div key={order.id} style={{background: 'white', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'}}>
                                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-background)', paddingBottom: '0.75rem'}}>
                                                    <div>
                                                        <h5 style={{fontWeight: '900', fontSize: '1rem', margin: '0'}}>{order.customerName}</h5>
                                                        <span style={{color: 'var(--color-text-muted)', fontSize: '0.75rem', fontFamily: 'monospace'}}>ID: {order.id.slice(0,6).toUpperCase()}</span>
                                                    </div>
                                                </div>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)'}}>
                                                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-background)', padding: '0.5rem', borderRadius: 'var(--radius-md)'}}>
                                                        <Truck size={16} color={order.deliveryMethod === 'pickup' ? '#f59e0b' : '#3b82f6'} />
                                                        <span style={{fontWeight: '600'}}>{order.deliveryMethod === 'pickup' ? 'Retiro en Sucursal' : 'Envío a Domicilio'}</span>
                                                        <span style={{marginLeft: 'auto', fontWeight: '700', background: 'white', border: '1px solid var(--color-border)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem'}}>
                                                            {order.deliveryTimeSlot === 'morning' ? '9-13hs' : order.deliveryTimeSlot === 'afternoon' ? '14-18hs' : '18-21hs'}
                                                        </span>
                                                    </div>
                                                    {order.deliveryMethod === 'delivery' && order.deliveryAddress?.street && (
                                                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem'}}>
                                                            <MapPin size={16} style={{flexShrink: 0}} />
                                                            <span className="truncate-text">{order.deliveryAddress.street} {order.deliveryAddress.number}</span>
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
