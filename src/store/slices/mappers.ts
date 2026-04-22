import type { Product, Category } from './types';
import type { Product as ApiProduct } from '../../services/api';

// Map API Product to Frontend Product
export const mapApiProductToFrontend = (apiProduct: ApiProduct, categoriesData: Category[]): Product => ({
    id: apiProduct.id,
    code: apiProduct.code,
    barcode: apiProduct.barcode,
    name: apiProduct.name,
    category: apiProduct.category_id 
        ? (categoriesData.find(c => c.id === apiProduct.category_id)?.name || apiProduct.category_name || 'Sin Categoría')
        : (apiProduct.category_name || 'Sin Categoría'),
    category_id: apiProduct.category_id,
    brand_id: apiProduct.brand_id,
    brand_name: apiProduct.brand_name,
    price: Number(apiProduct.price || 0),
    cost: Number(apiProduct.cost || 0),
    stock: Number(apiProduct.stock_quantity || 0),
    min: Number(apiProduct.min_stock || 0),
    tags: apiProduct.tags || [],
    supplierId: apiProduct.supplier_id,
    // Campos de ventas para tabs Recientes y Top
    salesCount: Number((apiProduct as any).sales_count || 0),
    lastSaleDate: (apiProduct as any).last_sale_date || undefined,
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
        barcode: product.barcode,
        name: product.name,
        cost: Number(product.cost || 0),
        price: Number(product.price || 0),
        min_stock: Number(product.min || 5),
        stock_quantity: Number(product.stock || 0),
        tags: product.tags || [],
        is_barcode: false,
        is_active: true,
        category_id: categoryId,
        brand_id: product.brand_id,
        supplier_id: product.supplierId,
    };
};
