import { type StateCreator } from 'zustand';
import type { Package } from './types';
import type { AppState } from '../useStore';
import { api, type Package as ApiPackage } from '../../services/api';

export interface PackageSlice {
    packages: Package[];
    loadPackages: () => Promise<void>;
    addPackage: (pkg: Omit<Package, 'id'>) => Promise<void>;
    updatePackage: (id: string, pkg: Partial<Package>) => Promise<void>;
    deletePackage: (id: string) => Promise<void>;
    checkPackageAvailability: (id: string) => { available: boolean; missingComponents: any[] };
}

const mapApiToStore = (p: ApiPackage): Package => ({
    id: p.id,
    name: p.name,
    section: p.section,
    description: p.description || '',
    price: p.suggested_price || p.price || 0,
    isActive: p.is_active,
    items: (p.components || p.items || []).map(c => ({
        productId: c.product_id || (c as any).productId,
        quantity: c.quantity
    }))
});

export const createPackageSlice: StateCreator<AppState, [], [], PackageSlice> = (set, get) => ({
    packages: [],

    loadPackages: async () => {
        try {
            const apiPackages = await api.getPackages();
            const packages = apiPackages.map(mapApiToStore);
            set({ packages });
        } catch (error: any) {
            console.error('Error loading packages:', error);
            set({ packages: [] });
        }
    },

    addPackage: async (pkgData) => {
        try {
            const apiData = {
                name: pkgData.name,
                section: pkgData.section,
                description: pkgData.description,
                price: pkgData.price,
                is_active: pkgData.isActive,
                components: pkgData.items.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity
                }))
            };

            const newPkg = await api.createPackage(apiData);
            set(state => ({
                packages: [...state.packages, mapApiToStore(newPkg)]
            }));
            get().addNotification('Arreglo creado correctamente', 'success');
        } catch (error: any) {
            get().addNotification('Error al crear el arreglo', 'error');
            console.error('Error creating package:', error);
        }
    },

    updatePackage: async (id, updates) => {
        try {
            const apiUpdates: any = { ...updates };
            if (updates.isActive !== undefined) apiUpdates.is_active = updates.isActive;
            if (updates.items) {
                apiUpdates.components = updates.items.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity
                }));
            }

            const updatedPkg = await api.updatePackage(id, apiUpdates);
            set(state => ({
                packages: state.packages.map(p => p.id === id ? mapApiToStore(updatedPkg) : p)
            }));
            get().addNotification('Arreglo actualizado', 'success');
        } catch (error: any) {
            get().addNotification('Error al actualizar el arreglo', 'error');
            console.error('Error updating package:', error);
        }
    },

    deletePackage: async (id) => {
        try {
            await api.deletePackage(id);
            set(state => ({
                packages: state.packages.filter(p => p.id !== id)
            }));
            get().addNotification('Arreglo eliminado', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar el arreglo', 'error');
            console.error('Error deleting package:', error);
        }
    },

    checkPackageAvailability: (id: string) => {
        const pkg = get().packages.find(p => p.id === id);
        if (!pkg) return { available: false, missingComponents: [] };

        const products = get().products;
        const missingComponents: any[] = [];
        let available = true;

        pkg.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            const stock = product ? product.stock : 0;
            if (stock < item.quantity) {
                available = false;
                missingComponents.push({
                    productId: item.productId,
                    productName: product ? product.name : 'Producto desconocido',
                    required: item.quantity,
                    available: stock,
                    shortage: item.quantity - stock
                });
            }
        });

        return { available, missingComponents };
    }
});
