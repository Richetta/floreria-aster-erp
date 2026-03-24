import { create } from 'zustand';
import { type StateCreator } from 'zustand';
import { createProductSlice, type ProductSlice } from './slices/productSlice';
import { createCustomerSlice, type CustomerSlice } from './slices/customerSlice';
import { createOrderSlice, type OrderSlice } from './slices/orderSlice';
import { createPosSlice, type PosSlice } from './slices/posSlice';
import { createFinanceSlice, type FinanceSlice } from './slices/financeSlice';
import { createSupplierSlice, type SupplierSlice } from './slices/supplierSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';

// Combined state type
export type AppState = ProductSlice & 
    CustomerSlice & 
    OrderSlice & 
    PosSlice & 
    FinanceSlice & 
    SupplierSlice & 
    UiSlice;

// Create the store
export const useStore = create<AppState>()((...a) => ({
    ...createProductSlice(...a),
    ...createCustomerSlice(...a),
    ...createOrderSlice(...a),
    ...createPosSlice(...a),
    ...createFinanceSlice(...a),
    ...createSupplierSlice(...a),
    ...createUiSlice(...a),
}));

// Re-export types for convenience
export * from './slices/types';
