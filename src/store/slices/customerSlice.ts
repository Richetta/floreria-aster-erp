import { type StateCreator } from 'zustand';
import type { Customer } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';

export interface CustomerSlice {
    customers: Customer[];
    loadCustomers: () => Promise<void>;
    addCustomer: (customer: Customer) => Promise<void>;
    updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
    registerPayment: (id: string, amount: number) => Promise<void>;
}

export const createCustomerSlice: StateCreator<AppState, [], [], CustomerSlice> = (set, get) => ({
    customers: [],

    loadCustomers: async () => {
        set({ isLoading: true, error: null } as any);
        try {
            const apiCustomers = await api.getCustomers();
            const customers = apiCustomers.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email || '',
                address: `${c.address_street || ''} ${c.address_number || ''}`.trim(),
                debt: c.debt_balance,
                totalOrders: c.total_orders || 0,
                totalSpent: c.total_spent || 0,
                lastOrder: c.last_order_date,
                birthday: c.birthday,
                anniversary: c.anniversary,
                notes: c.notes || ''
            }));
            set({ customers, isLoading: false } as any);
        } catch (error: any) {
            set({ error: error.message, isLoading: false } as any);
        }
    },

    addCustomer: async (customer) => {
        try {
            await api.createCustomer({
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                notes: customer.notes
            });
            set(state => ({
                customers: [...state.customers, customer]
            }));
            get().addNotification('Cliente añadido', 'success');
        } catch (error: any) {
            get().addNotification('Error al añadir cliente', 'error');
            console.error('Error adding customer:', error);
        }
    },

    updateCustomer: async (id, updates) => {
        try {
            await api.updateCustomer(id, {
                name: updates.name,
                phone: updates.phone,
                email: updates.email,
                notes: updates.notes
            });
            set(state => ({
                customers: state.customers.map(c => c.id === id ? { ...c, ...updates } : c)
            }));
            get().addNotification('Cliente actualizado', 'success');
        } catch (error: any) {
            get().addNotification('Error al actualizar cliente', 'error');
            console.error('Error updating customer:', error);
        }
    },

    registerPayment: async (id, amount) => {
        try {
            // Update local state directly — payment endpoint handled by financeSlice
            set(state => ({
                customers: state.customers.map(c =>
                    c.id === id ? { ...c, debtBalance: c.debtBalance - amount } : c
                )
            }));
            get().addNotification('Pago registrado', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar pago', 'error');
            console.error('Error registering payment:', error);
        }
    },
});
