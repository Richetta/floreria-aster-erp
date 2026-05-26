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
                    slug: data.slug || '',
                    settings: data.settings || {},
                    paymentMethods: (data.settings?.payment_methods && data.settings.payment_methods.length > 0) 
                        ? data.settings.payment_methods 
                        : [{ id: 'default-cash', name: 'Efectivo', type: 'cash', is_active: true }]
                }
            });
        } catch (error) {
            console.error('Error loading shop info:', error);
        }
    },

    updateShopInfo: async (info) => {
        try {
            const data = await api.getBusinessInfo();
            const currentSettings = data.settings || {};
            await api.updateBusinessInfo({
                name: info.name !== undefined ? info.name : data.name,
                address: info.address !== undefined ? info.address : data.address,
                phone: info.phone !== undefined ? info.phone : data.phone,
                logo_url: info.logo !== undefined ? info.logo : data.logo_url,
                currency: info.currency !== undefined ? info.currency : data.currency,
                slug: info.slug !== undefined ? info.slug : data.slug,
                settings: {
                    ...currentSettings,
                    instagram: info.instagram ?? currentSettings.instagram,
                    storefront: info.settings?.storefront ?? currentSettings.storefront
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
