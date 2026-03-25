import { type StateCreator } from 'zustand';
import type { Sale } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';
import { logger } from '../../utils/logger';

export interface PosSlice {
    cart: any[];
    posOrderForm: {
        selectedCustomer: string;
        deliveryDate: string;
        deliveryTimeSlot: 'morning' | 'afternoon' | 'evening' | 'allday';
        orderNotes: string;
        deliveryMethod: 'pickup' | 'delivery';
        advancePayment: number;
        deliveryAddress: {
            street: string;
            number: string;
            floor: string;
            city: string;
            reference: string;
        };
        contactPhone: string;
        isGuest: boolean;
        guestName: string;
        guestPhone: string;
    };
    
    setCart: (cart: any[]) => void;
    addToCart: (product: any) => void;
    removeFromCart: (id: string) => void;
    updateCartQty: (id: string, delta: number) => void;
    clearCart: () => void;
    updatePosOrderForm: (updates: any) => void;
    clearPosOrderForm: () => void;
    processSale: (sale: Sale) => Promise<boolean>;
}

const initialPosOrderForm = {
    selectedCustomer: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    deliveryTimeSlot: 'allday' as const,
    orderNotes: '',
    deliveryMethod: 'pickup' as const,
    advancePayment: 0,
    deliveryAddress: {
        street: '',
        number: '',
        floor: '',
        city: '',
        reference: ''
    },
    contactPhone: '',
    isGuest: false,
    guestName: '',
    guestPhone: ''
};

export const createPosSlice: StateCreator<AppState, [], [], PosSlice> = (set, get) => ({
    cart: [],
    posOrderForm: initialPosOrderForm,

    setCart: (cart) => set({ cart }),
    
    addToCart: (product) => {
        set(state => {
            const existing = state.cart.find(item => item.id === product.id);
            const qtyToAdd = (product as any).qty || 1;
            if (existing) {
                return {
                    cart: state.cart.map(item =>
                        item.id === product.id ? { ...item, qty: item.qty + qtyToAdd } : item
                    )
                };
            }
            return { cart: [...state.cart, { ...product, qty: qtyToAdd }] };
        });
    },

    removeFromCart: (id) => {
        set(state => ({
            cart: state.cart.filter(item => item.id !== id)
        }));
    },

    updateCartQty: (id, delta) => {
        set(state => ({
            cart: state.cart.map(item => {
                if (item.id === id) {
                    return { ...item, qty: Math.max(1, item.qty + delta) };
                }
                return item;
            })
        }));
    },

    clearCart: () => set({ cart: [] }),

    updatePosOrderForm: (updates) => {
        set(state => ({
            posOrderForm: {
                ...state.posOrderForm,
                ...updates,
                deliveryAddress: updates.deliveryAddress 
                    ? { ...state.posOrderForm.deliveryAddress, ...updates.deliveryAddress }
                    : state.posOrderForm.deliveryAddress
            }
        }));
    },

    clearPosOrderForm: () => set({ posOrderForm: initialPosOrderForm }),

    processSale: async (sale) => {
        try {
            await api.createSale({
                total: sale.total,
                payment_method: sale.method,
                customer_id: sale.customerId,
                items: sale.items.map(i => ({
                    product_id: i.isPackage ? undefined : i.id,
                    package_id: i.isPackage ? i.id : undefined,
                    quantity: i.qty,
                    unit_price: i.price
                })),
                notes: sale.notes
            });

            // Update individual product stock/sales locally
            sale.items.forEach(item => {
                if (item.productId) {
                    get().trackSale(item.productId, item.qty);
                }
            });

            get().addNotification('Venta procesada correctamente', 'success');
            logger.success('Venta procesada', { total: sale.total }, 'POS');
            return true;
        } catch (error: any) {
            get().addNotification('Error al registrar la venta', 'error');
            logger.error('Error processing sale', error, 'POS');
            return false;
        }
    },
});
