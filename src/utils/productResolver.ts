import type { AppState } from '../store/useStore';

/**
 * Resolves a product or package name from the store based on its ID.
 * Useful as a fallback when metadata is missing the name.
 */
export const resolveProductName = (
    id: string | undefined, 
    type: 'product' | 'package',
    state: AppState
): string => {
    if (!id) return 'Producto';

    if (type === 'product') {
        const product = state.products.find(p => p.id === id);
        return product ? product.name : 'Producto';
    }

    if (type === 'package') {
        const pkg = state.packages.find(p => p.id === id);
        return pkg ? pkg.name : 'Combo/Ramo';
    }

    return 'Producto';
};
