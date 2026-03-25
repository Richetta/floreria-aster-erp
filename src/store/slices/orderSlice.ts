import { type StateCreator } from 'zustand';
import type { Order } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';
import { logger } from '../../utils/logger';

export interface OrderSlice {
    orders: Order[];
    loadOrders: () => Promise<void>;
    addOrder: (orderData: any) => Promise<string>;
    updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
}

const mapApiToStore = (o: any): Order => ({
    id: o.id,
    orderNumber: o.order_number?.toString() || '',
    customerName: o.customer_name || 'Invitado',
    customerPhone: o.customer_phone || '',
    customerId: o.customer_id,
    status: o.status,
    total: o.total_amount,
    advancePayment: o.advance_payment,
    date: o.delivery_date,
    items: o.items || [],
    deliveryMethod: o.delivery_method,
    deliveryAddress: o.delivery_address,
    deliveryTimeSlot: o.delivery_time_slot,
    contactPhone: o.contact_phone,
    notes: o.notes || '',
    cardMessage: o.card_message || ''
});

export const createOrderSlice: StateCreator<AppState, [], [], OrderSlice> = (set, get) => ({
    orders: [],

    loadOrders: async () => {
        try {
            const apiOrders = await api.getOrders();
            const orders = apiOrders.map(mapApiToStore);
            set({ orders });
        } catch (error: any) {
            console.error('Error loading orders:', error);
            set({ orders: [] });
        }
    },

    addOrder: async (orderData) => {
        try {
            logger.info('Creating new order', orderData, 'OrderSlice');
            
            // Map frontend to backend format if needed
            const apiData = {
                customer_id: orderData.customerId,
                guest_name: orderData.guestName,
                guest_phone: orderData.guestPhone,
                delivery_date: orderData.date,
                delivery_method: orderData.deliveryMethod,
                delivery_time_slot: orderData.deliveryTimeSlot,
                delivery_address: orderData.deliveryAddress,
                contact_phone: orderData.contactPhone,
                card_message: orderData.cardMessage,
                notes: orderData.notes,
                items: orderData.items.map((item: any) => ({
                    product_id: item.isPackage ? undefined : item.id,
                    package_id: item.isPackage ? item.id : undefined,
                    quantity: item.qty,
                    unit_price: item.price
                })),
                advance_payment: orderData.advancePayment
            };

            const newOrder = await api.createOrder(apiData);
            const mappedOrder = mapApiToStore(newOrder);
            
            set(state => ({
                orders: [mappedOrder, ...state.orders]
            }));
            
            get().addNotification('Pedido creado correctamente', 'success');
            return newOrder.id;
        } catch (error: any) {
            get().addNotification('Error al crear el pedido', 'error');
            logger.error('Error creating order', error, 'OrderSlice');
            throw error;
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

    deleteOrder: async (id) => {
        try {
            await api.deleteOrder(id);
            set(state => ({
                orders: state.orders.filter(o => o.id !== id)
            }));
            get().addNotification('Pedido eliminado', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar pedido', 'error');
            console.error('Error deleting order:', error);
        }
    }
});
