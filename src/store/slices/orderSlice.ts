import { type StateCreator } from 'zustand';
import type { Order } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';

export interface OrderSlice {
    orders: Order[];
    loadOrders: () => Promise<void>;
    updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
}

export const createOrderSlice: StateCreator<AppState, [], [], OrderSlice> = (set, get) => ({
    orders: [],

    loadOrders: async () => {
        set({ isLoading: true, error: null } as any);
        try {
            const apiOrders = await api.getOrders();
            const orders = apiOrders.map(o => ({
                id: o.id,
                orderNumber: o.order_number?.toString() || '',
                customerName: o.customer_name,
                customerPhone: o.customer_phone || '',
                status: o.status,
                total: o.total_amount,
                advance: o.advance_payment,
                deliveryDate: o.delivery_date,
                timeSlot: o.delivery_time_slot,
                deliveryMethod: o.delivery_method,
                address: o.delivery_address ? `${o.delivery_address.street} ${o.delivery_address.number}` : '',
                items: o.items?.map(i => ({
                    id: i.id,
                    productName: '', // Would need to join with products
                    qty: i.quantity,
                    price: i.unit_price
                })) || [],
                notes: o.notes || '',
                cardMessage: o.card_message || ''
            }));
            set({ orders, isLoading: false } as any);
        } catch (error: any) {
            set({ error: error.message, isLoading: false } as any);
        }
    },

    updateOrderStatus: async (id, status) => {
        try {
            await api.updateOrderStatus(id, status);
            set(state => ({
                orders: state.orders.map(o => o.id === id ? { ...o, status } : o)
            }));
            get().addNotification('Estado de pedido actualizado', 'success');
        } catch (error: any) {
            get().addNotification('Error al actualizar pedido', 'error');
            console.error('Error updating order:', error);
        }
    },
});
