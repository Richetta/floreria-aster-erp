import { type StateCreator } from 'zustand';
import type { Product, Category } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';
import { logger } from '../../utils/logger';
import { mapApiProductToFrontend, mapFrontendToApiProduct } from './mappers';

export interface ProductSlice {
    products: Product[];
    categories: string[];
    categoriesData: Category[];
    tags: string[];
    loadProducts: () => Promise<void>;
    loadCategories: () => Promise<void>;
    addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    addCategory: (category: string) => Promise<void>;
    renameCategory: (oldName: string, newName: string) => Promise<void>;
    deleteCategory: (name: string) => void;
    
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;
    
    trackSale: (id: string, q: number) => void;
    registerWaste: (productId: string, quantity: number, reason: string) => Promise<void>;
}

export const createProductSlice: StateCreator<AppState, [], [], ProductSlice> = (set, get) => ({
    products: [],
    categories: [],
    categoriesData: [],
    tags: [],

    loadProducts: async () => {
        set({ isLoading: true, error: null } as any);
        try {
            const apiProducts = await api.getProducts({ limit: 1000 });
            const products = apiProducts.map(p => mapApiProductToFrontend(p, get().categoriesData));
            set({ products, isLoading: false } as any);
        } catch (error: any) {
            set({ error: error.message, isLoading: false } as any);
        }
    },

    loadCategories: async () => {
        try {
            const categoriesData = await api.getCategories();
            set({ 
                categoriesData,
                categories: categoriesData.map(c => c.name)
            });
        } catch (error: any) {
            console.error('Error loading categories:', error);
        }
    },

    addProduct: async (productData) => {
        try {
            const apiProduct = await api.createProduct(mapFrontendToApiProduct(productData as Product, get().categoriesData));
            const newProduct = mapApiProductToFrontend(apiProduct, get().categoriesData);
            set(state => ({
                products: [...state.products, newProduct]
            }));
            get().addNotification('Producto añadido', 'success');
        } catch (error: any) {
            get().addNotification('Error al añadir producto', 'error');
            console.error('Error adding product:', error);
        }
    },

    updateProduct: async (id, updates) => {
        try {
            const current = get().products.find(p => p.id === id);
            if (!current) return;
            const updatedProduct = { ...current, ...updates };
            await api.updateProduct(id, mapFrontendToApiProduct(updatedProduct, get().categoriesData));
            
            set(state => ({
                products: state.products.map(p => p.id === id ? updatedProduct : p)
            }));
            get().addNotification('Producto actualizado', 'success');
        } catch (error: any) {
            get().addNotification('Error al actualizar producto', 'error');
            console.error('Error updating product:', error);
        }
    },

    deleteProduct: async (id) => {
        try {
            await api.deleteProduct(id);
            set(state => ({
                products: state.products.filter(p => p.id !== id)
            }));
            get().addNotification('Producto eliminado', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar producto', 'error');
            console.error('Error deleting product:', error);
        }
    },

    addCategory: async (name) => {
        try {
            const newCategory = await api.createCategory({ name });
            set(state => ({
                categories: [...state.categories, name],
                categoriesData: [...state.categoriesData, newCategory]
            }));
            get().addNotification('Categoría añadida', 'success');
        } catch (error: any) {
            get().addNotification('Error al añadir categoría', 'error');
        }
    },

    renameCategory: async (oldName, newName) => {
        try {
            const category = get().categoriesData.find(c => c.name === oldName);
            if (!category) return;

            await api.updateCategory(category.id, { name: newName });

            set(state => ({
                categoriesData: state.categoriesData.map(c =>
                    c.name === oldName ? { ...c, name: newName } : c
                ),
                categories: state.categories.map(c => c === oldName ? newName : c),
                products: state.products.map(p =>
                    p.category === oldName ? { ...p, category: newName } : p
                )
            }));
            get().addNotification('Categoría renombrada', 'success');
        } catch (error: any) {
            get().addNotification('Error al renombrar categoría', 'error');
        }
    },

    deleteCategory: (name) => {
        // Implement logic to delete or handle products in category
        set(state => ({
            categories: state.categories.filter(c => c !== name),
            products: state.products.map(p =>
                p.category === name ? { ...p, category: undefined } : p
            )
        }));
    },

    addTag: (tag) => {
        set(state => ({
            tags: state.tags.includes(tag) ? state.tags : [...state.tags, tag]
        }));
    },

    removeTag: (tagToRemove) => {
        set(state => ({
            tags: state.tags.filter(t => t !== tagToRemove),
            products: state.products.map(p => ({
                ...p,
                tags: p.tags.filter(t => (t as any) !== tagToRemove)
            }))
        }));
    },

    trackSale: (id, q) => {
        set(state => ({
            products: state.products.map(p =>
                p.id === id ? { ...p, stock: p.stock - q, salesCount: (p.salesCount || 0) + q } : p
            )
        }));
    },

    registerWaste: async (productId, quantity, reason) => {
        try {
            await api.createWaste({
                product_id: productId,
                quantity,
                reason: reason as any
            });
            set(state => ({
                products: state.products.map(p =>
                    p.id === productId ? { ...p, stock: p.stock - quantity } : p
                )
            }));
            get().addNotification('Merma registrada', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar merma', 'error');
            console.error('Error registering waste:', error);
        }
    },
});
