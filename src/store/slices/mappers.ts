import type { Product, Category } from './types';
import type { Product as ApiProduct } from '../../services/api';

// Helper to flatten nested categories tree
export const flattenCategories = (categories: Category[]): Category[] => {
    const result: Category[] = [];
    const recurse = (cats: Category[]) => {
        if (!cats) return;
        for (const cat of cats) {
            result.push(cat);
            if (cat.children && cat.children.length > 0) {
                recurse(cat.children);
            }
        }
    };
    recurse(categories);
    return result;
};

// Map API Product to Frontend Product
export const mapApiProductToFrontend = (apiProduct: ApiProduct, categoriesData: Category[]): Product => {
    const flatCategories = flattenCategories(categoriesData);
    return {
        id: apiProduct.id,
        code: apiProduct.code,
        barcode: apiProduct.barcode,
        name: apiProduct.name,
        category: apiProduct.category_id 
            ? (flatCategories.find(c => c.id === apiProduct.category_id)?.name || apiProduct.category_name || 'Sin Categoría')
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
        custom_filter_options: apiProduct.custom_filter_options || [],
        // Campos de ventas para tabs Recientes y Top
        salesCount: Number((apiProduct as any).sales_count || 0),
        lastSaleDate: (apiProduct as any).last_sale_date || undefined,
    };
};

const parseNumber = (val: any, fallback = 0): number => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? fallback : val;
    const str = String(val).replace(',', '.').trim();
    const num = Number(str);
    return isNaN(num) || !isFinite(num) ? fallback : num;
};

// Map Frontend Product to API Product
export const mapFrontendToApiProduct = (product: Partial<Product>, categoriesData: Category[]) => {
    let categoryId = product.category_id;
    const flatCategories = flattenCategories(categoriesData);
    if (!categoryId && product.category) {
        const catName = product.category.toLowerCase().trim();
        categoryId = flatCategories.find(c => c.name.toLowerCase().trim() === catName)?.id;
    }

    return {
        code: product.code,
        barcode: product.barcode,
        name: product.name,
        cost: parseNumber(product.cost, 0),
        price: parseNumber(product.price, 0),
        min_stock: parseNumber(product.min, 5),
        stock_quantity: parseNumber(product.stock, 0),
        tags: product.tags || [],
        custom_filter_options: product.custom_filter_options || [],
        is_barcode: false,
        is_active: true,
        category_id: categoryId,
        brand_id: product.brand_id,
        supplier_id: product.supplierId,
    };
};
