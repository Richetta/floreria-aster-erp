import type { StateCreator } from 'zustand';

export interface SpecialDate {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    title: string;
    category: 'feriado' | 'comercial' | 'personal';
    color?: string;
    description?: string;
}

export interface CalendarSlice {
    specialDates: SpecialDate[];
    holidaysLoadedYear: number | null;

    addSpecialDate: (date: SpecialDate) => void;
    updateSpecialDate: (id: string, data: Partial<SpecialDate>) => void;
    deleteSpecialDate: (id: string) => void;
    fetchNationalHolidays: (year: number) => Promise<void>;
}

// Fechas comerciales de florería que queremos siempre tener
const FLORIST_DATES: SpecialDate[] = [
    { id: 'flor-1', date: 'XXXX-02-14', title: 'Día de los Enamorados', category: 'comercial', color: '#ff4d4d', description: 'Alta demanda de Rosas y Arreglos Románticos' },
    { id: 'flor-2', date: 'XXXX-03-08', title: 'Día de la Mujer', category: 'comercial', color: '#d946ef', description: 'Fuerte venta corporativa y regalos individuales' },
    { id: 'flor-3', date: 'XXXX-09-21', title: 'Día de la Primavera', category: 'comercial', color: '#22c55e', description: 'Flores coloridas, regalos a estudiantes' },
    // El Día de la Madre y Amigo cambian o pueden ser variables, pero agregamos fechas estándar
    { id: 'flor-4', date: 'XXXX-07-20', title: 'Día del Amigo', category: 'comercial', color: '#eab308' },
];

export const createCalendarSlice: StateCreator<CalendarSlice> = (set, get) => ({
    specialDates: [],
    holidaysLoadedYear: null,

    addSpecialDate: (date) => set((state) => ({
        specialDates: [...state.specialDates, date]
    })),

    updateSpecialDate: (id, data) => set((state) => ({
        specialDates: state.specialDates.map((d) =>
            d.id === id ? { ...d, ...data } : d
        )
    })),

    deleteSpecialDate: (id) => set((state) => ({
        specialDates: state.specialDates.filter((d) => d.id !== id)
    })),

    fetchNationalHolidays: async (year: number) => {
        // Evitá re-fetchear si ya cargamos este año
        if (get().holidaysLoadedYear === year) return;

        try {
            const response = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${year}`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            // Transform data to our SpecialDate format
            const holidays: SpecialDate[] = data.map((h: any) => ({
                id: `feriado-${year}-${h.mes}-${h.dia}`,
                date: `${year}-${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`,
                title: h.motivo,
                category: 'feriado',
                color: '#64748b',
                description: `${h.tipo === 'inamovible' ? 'Inamovible' : h.tipo === 'trasladable' ? 'Trasladable' : 'Puente/Otro'}`
            }));

            // Inyectamos también las efemérides comerciales adaptadas al año actual
            const floristDatesThisYear = FLORIST_DATES.map(fd => ({
                ...fd,
                id: `${fd.id}-${year}`,
                date: fd.date.replace('XXXX', String(year))
            }));

            set((state) => {
                // Remove older fetched holidays/florist dates to purely manage the specific year without duplication?
                // For simplicity, we just keep personal ones intact, and overwrite system ones for this year.
                const userPersonal = state.specialDates.filter(d => d.category === 'personal');
                
                // You could accumulate them, but to keep memory clean we just hold the generated ones combined with all personals.
                // Wait! It's better to accumulate system holidays if the user navigates between years.
                const existingHolidays = state.specialDates.filter(d => 
                    d.category !== 'personal' && !d.date.startsWith(String(year))
                );

                return {
                    specialDates: [...userPersonal, ...existingHolidays, ...holidays, ...floristDatesThisYear],
                    holidaysLoadedYear: year
                };
            });
        } catch (error) {
            console.error('Failed to load national holidays:', error);
            // Fallback: at least load florist dates if API fails
            const floristDatesThisYear = FLORIST_DATES.map(fd => ({
                ...fd,
                id: `${fd.id}-${year}`,
                date: fd.date.replace('XXXX', String(year))
            }));
            
            set((state) => {
                 const currentOthers = state.specialDates.filter(d => !d.date.startsWith(String(year)));
                 return { specialDates: [...currentOthers, ...floristDatesThisYear], holidaysLoadedYear: year };
            });
        }
    }
});
