import type { Product, Category } from './types';
import type { Product as ApiProduct } from '../../services/api';

// Map API Product to Frontend Product
export const mapApiProductToFrontend = (apiProduct: ApiProduct, categoriesData: Category[]): Product => ({
    id: apiProduct.id,
    code: apiProduct.code,
    name: apiProduct.name,
    category: apiProduct.category_id 
        ? (categoriesData.find(c => c.id === apiProduct.category_id)?.name || apiProduct.category_name || 'Sin Categoría')
        : (apiProduct.category_name || 'Sin Categoría'),
    category_id: apiProduct.category_id,
    price: apiProduct.price,
    cost: apiProduct.cost,
    stock: apiProduct.stock_quantity,
    min: apiProduct.min_stock,
    tags: apiProduct.tags || [],
});

// Map Frontend Product to API Product
export const mapFrontendToApiProduct = (product: Partial<Product>, categoriesData: Category[]) => {
    let categoryId = product.category_id;
    if (!categoryId && product.category) {
        const catName = product.category.toLowerCase();
        categoryId = categoriesData.find(c => c.name.toLowerCase() === catName)?.id;
    }

    return {
        code: product.code,
        name: product.name,
        cost: product.cost || 0,
        price: product.price || 0,
        min_stock: product.min || 5,
        stock_quantity: product.stock || 0,
        tags: product.tags || [],
        is_barcode: false,
        is_active: true,
        category_id: categoryId,
    };
};
