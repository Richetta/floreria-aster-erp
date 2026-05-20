import { type StateCreator } from 'zustand';
import type { Product, Category, Brand, CustomFilter } from './types';
import type { AppState } from '../useStore';
import { api } from '../../services/api';
import { mapApiProductToFrontend, mapFrontendToApiProduct } from './mappers';

export interface ProductSlice {
    products: Product[];
    categories: string[];
    categoriesData: Category[];
    brands: Brand[];
    tags: string[];
    loadProducts: () => Promise<void>;
    loadCategories: (includeHierarchy?: boolean) => Promise<void>;
    loadBrands: () => Promise<void>;
    addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    bulkDeleteProducts: (ids: string[]) => Promise<void>;
    addCategory: (category: string, parentId?: string) => Promise<void>;
    renameCategory: (oldName: string, newName: string) => Promise<void>;
    deleteCategory: (id: string, deleteProducts?: boolean) => Promise<void>;
    addBrand: (name: string) => Promise<Brand | null>;
    deleteBrand: (id: string) => Promise<void>;
    
    customFilters: CustomFilter[];
    loadCustomFilters: () => Promise<void>;
    addCustomFilter: (name: string) => Promise<void>;
    addCustomFilterOption: (filterId: string, value: string) => Promise<void>;

    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;

    trackSale: (id: string, q: number) => void;
    registerWaste: (productId: string, quantity: number, reason: string) => Promise<void>;
    getPriceHistory: (id: string) => Promise<any[]>;
}

export const createProductSlice: StateCreator<AppState, [], [], ProductSlice> = (set, get) => ({
    products: [],
    categories: [],
    categoriesData: [],
    brands: [],
    tags: [],
    customFilters: [],

    getPriceHistory: async (id: string) => {
        try {
            return await api.getProductPriceHistory(id);
        } catch (error) {
            console.error('Error fetching price history:', error);
            return [];
        }
    },

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

    loadCategories: async (includeHierarchy = false) => {
        try {
            const categoriesData = await api.getCategories(includeHierarchy);
            set({
                categoriesData,
                categories: categoriesData.map(c => c.name)
            } as any);
        } catch (error: any) {
            console.error('Error loading categories:', error);
        }
    },

    loadBrands: async () => {
        try {
            const brands = await api.getBrands();
            set({ brands } as any);
        } catch (error: any) {
            console.error('Error loading brands:', error);
        }
    },

    loadCustomFilters: async () => {
        try {
            const customFilters = await api.getCustomFilters();
            set({ customFilters } as any);
        } catch (error: any) {
            console.error('Error loading custom filters:', error);
        }
    },

    addCustomFilter: async (name) => {
        try {
            const newFilter = await api.createCustomFilter({ name });
            set(state => ({
                customFilters: [...state.customFilters, { ...newFilter, options: [] }]
            }));
            get().addNotification('Filtro creado', 'success');
        } catch (error: any) {
            get().addNotification(error.message || 'Error al crear filtro', 'error');
        }
    },

    addCustomFilterOption: async (filterId, value) => {
        try {
            const newOption = await api.addFilterOption(filterId, { value });
            set(state => ({
                customFilters: state.customFilters.map(f =>
                    f.id === filterId ? { ...f, options: [...f.options, newOption] } : f
                )
            }));
            get().addNotification('Opción añadida', 'success');
        } catch (error: any) {
            get().addNotification('Error al añadir opción', 'error');
        }
    },

    addProduct: async (productData) => {
        try {
            let categoryId = productData.category_id || undefined;
            const categoryName = productData.category;
            
            if (!categoryId && categoryName) {
                const catNameLower = categoryName.toLowerCase().trim();
                const foundCat = get().categoriesData.find(c => c.name.toLowerCase().trim() === catNameLower);
                
                if (!foundCat && catNameLower !== 'sin categoría' && catNameLower !== 'sin categoria') {
                    const newCat = await api.createCategory({ name: categoryName });
                    set(state => ({
                        categories: [...state.categories, categoryName!],
                        categoriesData: [...state.categoriesData, newCat]
                    }));
                    categoryId = newCat.id;
                } else if (foundCat) {
                    categoryId = foundCat.id;
                }
            }

            const updatedData = { ...productData, category_id: categoryId };
            const apiProduct = await api.createProduct(mapFrontendToApiProduct(updatedData as Product, get().categoriesData));
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

            let categoryId = updates.category_id || undefined;
            const categoryName = updates.category;

            if (!categoryId && categoryName) {
                const catNameLower = categoryName.toLowerCase().trim();
                const foundCat = get().categoriesData.find(c => c.name.toLowerCase().trim() === catNameLower);

                if (!foundCat && catNameLower !== 'sin categoría' && catNameLower !== 'sin categoria') {
                    const newCat = await api.createCategory({ name: categoryName });
                    set(state => ({
                        categories: [...state.categories, categoryName!],
                        categoriesData: [...state.categoriesData, newCat]
                    }));
                    categoryId = newCat.id;
                } else if (foundCat) {
                    categoryId = foundCat.id;
                }
            }

            const updatedProduct = { ...current, ...updates, category_id: categoryId };
            const apiUpdates = mapFrontendToApiProduct(updatedProduct, get().categoriesData);
            const apiProduct = await api.updateProduct(id, apiUpdates);
            const returnedProduct = mapApiProductToFrontend(apiProduct, get().categoriesData);

            set(state => ({
                products: state.products.map(p => p.id === id ? returnedProduct : p)
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

    bulkDeleteProducts: async (ids: string[]) => {
        try {
            const result = await api.bulkDeleteProducts(ids);
            set(state => ({
                products: state.products.filter(p => !ids.includes(p.id))
            }));
            get().addNotification(`${result.deleted} productos eliminados`, 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar productos', 'error');
            console.error('Error bulk deleting products:', error);
        }
    },

    addCategory: async (name, parentId) => {
        try {
            const newCategory = await api.createCategory({ name, parent_id: parentId });
            set(state => ({
                categories: [...state.categories, name],
                categoriesData: [...state.categoriesData, newCategory]
            }));
            get().addNotification('Categoría añadida', 'success');
        } catch (error: any) {
            get().addNotification('Error al añadir categoría', 'error');
        }
    },

    addBrand: async (name) => {
        try {
            const newBrand = await api.createBrand(name);
            set(state => ({
                brands: [...state.brands, newBrand]
            }));
            get().addNotification('Marca añadida', 'success');
            return newBrand;
        } catch (error: any) {
            get().addNotification('Error al añadir marca', 'error');
            return null;
        }
    },

    deleteBrand: async (id) => {
        try {
            await api.deleteBrand(id);
            set(state => ({
                brands: state.brands.filter(b => b.id !== id)
            }));
            get().addNotification('Marca eliminada', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar marca', 'error');
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

    deleteCategory: async (id: string, deleteProducts: boolean = false) => {
        try {
            await api.deleteCategory(id, deleteProducts);
            set(state => ({
                categoriesData: state.categoriesData.filter(c => c.id !== id),
                categories: state.categoriesData.filter(c => c.id !== id).map(c => c.name),
                products: deleteProducts 
                    ? state.products.filter(p => !get().categoriesData.find(c => c.id === id)?.name || p.category !== get().categoriesData.find(c => c.id === id)?.name)
                    : state.products.map(p => {
                        const catFull = get().categoriesData.find(c => c.id === id);
                        return (catFull && p.category === catFull.name) ? { ...p, category: 'Sin Categoría' } : p;
                    })
            }));
            get().addNotification('Categoría eliminada', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar categoría', 'error');
        }
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
        const now = new Date().toISOString();
        set(state => ({
            products: state.products.map(p =>
                p.id === id
                    ? { ...p, stock: p.stock - q, salesCount: (p.salesCount || 0) + q, lastSaleDate: now }
                    : p
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
