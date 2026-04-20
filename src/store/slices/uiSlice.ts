import { type StateCreator } from 'zustand';
import type { TeamNote, Toast, ShopInfo, PaymentMethod } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';

export interface UiSlice {
    isLoading: boolean;
    error: string | null;
    notifications: Toast[];
    teamNotes: TeamNote[];
    shopInfo: ShopInfo;
    notificationsLastSeenCount: number;
    
    addNotification: (message: string, type: Toast['type']) => void;
    removeNotification: (id: string) => void;
    addTeamNote: (note: Omit<TeamNote, 'id' | 'date'>) => void;
    deleteTeamNote: (id: string) => void;
    loadShopInfo: () => Promise<void>;
    updateShopInfo: (info: Partial<ShopInfo>) => Promise<void>;
    updatePaymentMethods: (methods: PaymentMethod[]) => Promise<void>;
    markNotificationsAsSeen: (count: number) => void;
}

const initialShopInfo: ShopInfo = {
    name: 'mi jardín',
    logo: undefined,
    phone: '',
    address: '',
    instagram: '',
    currency: 'ARS'
};

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
    isLoading: false,
    error: null,
    notifications: [],
    teamNotes: [],
    shopInfo: initialShopInfo,
    notificationsLastSeenCount: Number(localStorage.getItem('notifications_last_seen_count')) || 0,

    addNotification: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(7);
        set(state => ({
            notifications: [...state.notifications, { id, message, type }]
        }));
        setTimeout(() => get().removeNotification(id), 5000);
    },

    removeNotification: (id) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    },

    addTeamNote: (note) => {
        const newNote: TeamNote = {
            ...note,
            id: Math.random().toString(36).substring(7),
            date: new Date().toISOString()
        };
        set(state => ({
            teamNotes: [newNote, ...state.teamNotes]
        }));
    },

    deleteTeamNote: (id) => {
        set(state => ({
            teamNotes: state.teamNotes.filter(n => n.id !== id)
        }));
    },

    loadShopInfo: async () => {
        try {
            const data = await api.getBusinessInfo();
            set({
                shopInfo: {
                    name: data.name,
                    logo: data.logo_url,
                    phone: data.phone,
                    address: data.address,
                    instagram: data.settings?.instagram || '',
                    currency: data.currency,
                    paymentMethods: data.settings?.payment_methods || []
                }
            });
        } catch (error) {
            console.error('Error loading shop info:', error);
        }
    },

    updateShopInfo: async (info) => {
        try {
            const currentSettings = (await api.getBusinessInfo()).settings || {};
            await api.updateBusinessInfo({
                name: info.name,
                address: info.address,
                phone: info.phone,
                logo_url: info.logo,
                currency: info.currency,
                settings: {
                    ...currentSettings,
                    instagram: info.instagram ?? currentSettings.instagram
                }
            });
            set(state => ({ shopInfo: { ...state.shopInfo, ...info } }));
            get().addNotification('Información del negocio actualizada', 'success');
        } catch (error) {
            get().addNotification('Error al actualizar información del negocio', 'error');
            console.error('Error updating shop info:', error);
        }
    },

    updatePaymentMethods: async (methods) => {
        try {
            const currentSettings = (await api.getBusinessInfo()).settings || {};
            await api.updateBusinessInfo({
                settings: {
                    ...currentSettings,
                    payment_methods: methods
                }
            });
            set(state => ({
                shopInfo: {
                    ...state.shopInfo,
                    paymentMethods: methods
                }
            }));
            get().addNotification('Métodos de pago actualizados', 'success');
        } catch (error) {
            get().addNotification('Error al actualizar métodos de pago', 'error');
            console.error('Error updating payment methods:', error);
        }
    },

    markNotificationsAsSeen: (count) => {
        localStorage.setItem('notifications_last_seen_count', count.toString());
        set({ notificationsLastSeenCount: count });
    }
});
