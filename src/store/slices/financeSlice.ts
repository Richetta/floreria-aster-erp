import { type StateCreator } from 'zustand';
import type { TransactionLocal } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';

export interface FinanceSlice {
    transactions: TransactionLocal[];
    loadTransactions: () => Promise<void>;
    addTransaction: (transaction: TransactionLocal) => Promise<void>;
    processPurchase: (purchase: { supplierId: string, items: any[], method: 'cash' | 'transfer', notes?: string }) => Promise<boolean>;
}

export const createFinanceSlice: StateCreator<AppState, [], [], FinanceSlice> = (set, get) => ({
    transactions: [],

    loadTransactions: async () => {
        set({ isLoading: true, error: null } as any);
        try {
            const apiTransactions = await api.getTransactions({ limit: 1000 });
            const transactions = apiTransactions.map(t => ({
                id: t.id,
                type: t.type === 'expense' ? 'expense' : 'income',
                category: t.category as any,
                amount: t.amount,
                date: t.created_at,
                method: t.payment_method || 'cash',
                description: t.description || '',
                relatedId: t.reference_id,
                metadata: t.metadata,
                notes: t.notes
            }));
            set({ transactions, isLoading: false } as any);
        } catch (error: any) {
            set({ error: error.message, isLoading: false } as any);
        }
    },

    addTransaction: async (transaction) => {
        try {
            await api.createTransaction({
                type: transaction.type === 'income' ? 'payment_received' : 'expense',
                category: transaction.category as any,
                amount: transaction.amount,
                payment_method: transaction.method,
                description: transaction.description,
                notes: transaction.notes,
                reference_id: transaction.relatedId,
                metadata: transaction.metadata
            });
            
            set(state => ({
                transactions: [transaction, ...state.transactions]
            }));
            get().addNotification('Transacción registrada', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar transacción', 'error');
            console.error('Error adding transaction:', error);
        }
    },

    processPurchase: async (purchase) => {
        try {
            await api.createPurchase({
                supplier_id: purchase.supplierId,
                payment_method: purchase.method,
                items: purchase.items.map(i => ({
                    product_id: i.productId,
                    quantity: i.qty,
                    cost: i.price
                })),
                notes: purchase.notes
            });

            get().addNotification('Compra registrada correctamente', 'success');
            return true;
        } catch (error: any) {
            get().addNotification('Error al registrar la compra', 'error');
            console.error('Error processing purchase:', error);
            return false;
        }
    },
});
