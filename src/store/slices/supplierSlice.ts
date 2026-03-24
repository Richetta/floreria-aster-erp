import { type StateCreator } from 'zustand';
import type { SupplierLocal } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';

export interface SupplierSlice {
    suppliers: SupplierLocal[];
    loadSuppliers: () => Promise<void>;
    addSupplier: (supplier: SupplierLocal) => Promise<void>;
    updateSupplier: (id: string, supplier: Partial<SupplierLocal>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
}

export const createSupplierSlice: StateCreator<AppState, [], [], SupplierSlice> = (set, get) => ({
    suppliers: [],

    loadSuppliers: async () => {
        set({ isLoading: true, error: null } as any);
        try {
            const apiSuppliers = await api.getSuppliers({ limit: 1000 });
            const suppliers = apiSuppliers.map(s => ({
                id: s.id,
                name: s.name,
                contactName: s.contact_name || '',
                phone: s.phone,
                category: s.category || '',
                address: s.address || '',
                lastVisit: s.created_at, // Placeholder
                nextVisitDate: s.next_visit_date,
            }));
            set({ suppliers, isLoading: false } as any);
        } catch (error: any) {
            set({ error: error.message, isLoading: false } as any);
        }
    },

    addSupplier: async (supplier) => {
        try {
            await api.createSupplier({
                name: supplier.name,
                contact_name: supplier.contactName,
                phone: supplier.phone,
                category: supplier.category,
                address: supplier.address,
                next_visit_date: supplier.nextVisitDate,
            });
            
            set(state => ({
                suppliers: [...state.suppliers, supplier]
            }));
            get().addNotification('Proveedor registrado', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar proveedor', 'error');
            console.error('Error adding supplier:', error);
        }
    },

    updateSupplier: async (id, updates) => {
        try {
            await api.updateSupplier(id, {
                name: updates.name,
                contact_name: updates.contactName,
                phone: updates.phone,
                category: updates.category,
                address: updates.address,
                next_visit_date: updates.nextVisitDate,
            });
            
            set(state => ({
                suppliers: state.suppliers.map(s => s.id === id ? { ...s, ...updates } : s)
            }));
            get().addNotification('Proveedor actualizado', 'success');
        } catch (error: any) {
            get().addNotification('Error al actualizar proveedor', 'error');
            console.error('Error updating supplier:', error);
        }
    },

    deleteSupplier: async (id) => {
        try {
            await api.deleteSupplier(id);
            set(state => ({
                suppliers: state.suppliers.filter(s => s.id !== id)
            }));
            get().addNotification('Proveedor eliminado', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar proveedor', 'error');
            console.error('Error deleting supplier:', error);
        }
    },
});
