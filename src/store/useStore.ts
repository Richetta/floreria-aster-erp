import { create } from 'zustand';
import { api } from '../services/api';
import { logger } from '../utils/logger';
import { generateIdWithPrefix } from '../utils/idGenerator';
import type {
    Product as ApiProduct,
} from '../services/api';

// ============================================
// TYPE MAPPINGS (API -> Frontend)
// ============================================

export type Product = {
    id: string;
    code: string;
    name: string;
    category: string;
    category_id?: string;
    price: number;
    cost?: number;
    stock: number;
    min: number;
    tags: string[];
    salesCount?: number;
    lastSaleDate?: string;
    weeklySales?: number;
};

export type Category = {
    id: string;
    name: string;
    parent_id?: string;
};

export type Customer = {
    id: string;
    name: string;
    phone: string;
    email: string;
    debtBalance: number;
    importantDateName: string;
    importantDate: string;
    notes: string;
    orderCount?: number;
    lastOrderDate?: string;
    address?: string;
    address_street?: string;
    address_number?: string;
    address_floor?: string;
    address_city?: string;
    birthday?: string;
    anniversary?: string;
    total_orders?: number;
    total_spent?: number;
};

export type Order = {
    id: string;
    customerName: string;
    customerPhone?: string;
    customerId?: string;
    total: number;
    status: 'pending' | 'assembling' | 'ready' | 'shipping' | 'delivered';
    date: string;
    items: any[];
    notes?: string;
    advancePayment?: number;
    deliveryMethod?: 'pickup' | 'delivery';
    deliveryAddress?: {
        street?: string;
        number?: string;
        floor?: string;
        city?: string;
        reference?: string;
    };
    deliveryTimeSlot?: 'morning' | 'afternoon' | 'evening' | 'allday';
    contactPhone?: string;
    isGift?: boolean;
    includeCard?: boolean;
    guestName?: string;
    guestPhone?: string;
};

export type Sale = {
    id: string;
    total: number;
    date: string;
    items: any[];
    method: 'cash' | 'card' | 'transfer';
    notes?: string;
    customerId?: string;
};

export type TransactionLocal = {
    id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    date: string;
    method: 'cash' | 'card' | 'transfer';
    description: string;
    relatedId?: string;
    metadata?: Record<string, any>;
    notes?: string;
};

export type Package = {
    id: string;
    name: string;
    section: string;
    description: string;
    price: number;
    items: { productId: string; quantity: number }[];
    isActive: boolean;
};

export type PackageItem = {
    productId: string;
    quantity: number;
};

export type SupplierLocal = {
    id: string;
    name: string;
    contactName: string;
    phone: string;
    category: string;
    address?: string;
    lastVisit?: string;
    nextVisitDate?: string;
};

export type TeamNote = {
    id: string;
    text: string;
    date: string;
    author: string;
    color: 'yellow' | 'green' | 'blue' | 'purple';
};

export type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
};

export type ShopInfo = {
    name: string;
    logo?: string;
    phone: string;
    address: string;
    instagram?: string;
    currency: string;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Map API Product to Frontend Product
const mapApiProductToFrontend = (apiProduct: ApiProduct, categoriesData: Category[]): Product => ({
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
const mapFrontendToApiProduct = (product: Partial<Product>, categoriesData: Category[]) => {
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

// ============================================
// STORE STATE
// ============================================

interface AppState {
    // Data
    products: Product[];
    packages: Package[];
    orders: Order[];
    sales: Sale[];
    customers: Customer[];
    transactions: TransactionLocal[];
    suppliers: SupplierLocal[];
    teamNotes: TeamNote[];
    shopInfo: ShopInfo;
    tags: string[];
    categories: string[];
    categoriesData: Category[];
    
    // POS State (Persistent)
    cart: any[];
    posOrderForm: {
        selectedCustomer: string;
        deliveryDate: string;
        deliveryTimeSlot: 'morning' | 'afternoon' | 'evening' | 'allday';
        orderNotes: string;
        deliveryMethod: 'pickup' | 'delivery';
        advancePayment: number;
        deliveryAddress: {
            street: string;
            number: string;
            floor: string;
            city: string;
            reference: string;
        };
        contactPhone: string;
        isGuest: boolean;
        guestName: string;
        guestPhone: string;
    };

    // Loading states
    isLoading: boolean;
    error: string | null;
    notifications: Toast[];

    // Notification actions
    addNotification: (message: string, type: Toast['type']) => void;
    removeNotification: (id: string) => void;

    // Product actions
    loadProducts: () => Promise<void>;
    addProduct: (product: Product) => Promise<void>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;

    // Category actions
    loadCategories: () => Promise<void>;
    addCategory: (category: string) => Promise<void>;
    renameCategory: (oldName: string, newName: string) => Promise<void>;
    deleteCategory: (category: string) => Promise<void>;

    // Package actions
    loadPackages: () => Promise<void>;
    addPackage: (pkg: Package) => Promise<void>;
    updatePackage: (id: string, pkg: Partial<Package>) => Promise<void>;
    deletePackage: (id: string) => Promise<void>;
    checkPackageAvailability: (packageId: string) => { available: boolean; missingComponents: any[] };

    // Customer actions
    loadCustomers: () => Promise<void>;
    addCustomer: (customer: Customer) => Promise<void>;
    updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
    deleteCustomer: (id: string) => Promise<void>;
    registerPayment: (id: string, amount: number) => Promise<void>;

    // Order actions
    loadOrders: () => Promise<void>;
    addOrder: (order: Order) => Promise<void>;
    updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;

    // Financial actions
    processSale: (sale: Sale) => Promise<boolean>;
    processPurchase: (purchase: { supplierId: string, items: any[], method: 'cash' | 'transfer', notes?: string }) => Promise<boolean>;
    addTransaction: (transaction: TransactionLocal) => Promise<void>;
    loadTransactions: () => Promise<void>;

    // Supplier actions
    loadSuppliers: () => Promise<void>;
    addSupplier: (supplier: SupplierLocal) => Promise<void>;
    updateSupplier: (id: string, supplier: Partial<SupplierLocal>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;

    // Waste actions
    registerWaste: (productId: string, quantity: number, reason: string) => Promise<void>;

    // Settings
    updateShopInfo: (info: Partial<ShopInfo>) => void;

    // Team Note actions
    addTeamNote: (note: Omit<TeamNote, 'id' | 'date'>) => void;
    deleteTeamNote: (id: string) => void;

    // Utility
    getPriceHistory: (id: string) => Promise<any[]>;
    trackSale: (productId: string, quantity: number) => void;
    addTag: (tag: string) => void;
    // POS actions
    setCart: (cart: any[]) => void;
    addToCart: (product: any) => void;
    removeFromCart: (id: string) => void;
    updateCartQty: (id: string, delta: number) => void;
    clearCart: () => void;
    updatePosOrderForm: (updates: any) => void;
    clearPosOrderForm: () => void;
}

// ============================================
// INITIAL DATA (Fallback)
// ============================================

const initialProducts: Product[] = [];
const initialTags: string[] = ['Primavera', 'Regalo', 'Flores de Corte', 'San Valentín', 'Deco', 'Oferta'];
const initialPackages: Package[] = [];
const initialOrders: Order[] = [];
const initialCustomers: Customer[] = [];
const initialSuppliers: SupplierLocal[] = [];
const initialShopInfo: ShopInfo = {
    name: 'Florería Aster',
    phone: '11-1234-5678',
    address: 'Calle de las Rosas 789, Buenos Aires',
    instagram: '@floreria.aster',
    currency: 'ARS'
};

const initialPosOrderForm = {
    selectedCustomer: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    deliveryTimeSlot: 'allday' as const,
    orderNotes: '',
    deliveryMethod: 'pickup' as const,
    advancePayment: 0,
    deliveryAddress: {
        street: '',
        number: '',
        floor: '',
        city: '',
        reference: ''
    },
    contactPhone: '',
    isGuest: false,
    guestName: '',
    guestPhone: ''
};

// ============================================
// STORE CREATION
// ============================================

export const useStore = create<AppState>()(
    (set, get) => ({
    // Initial state
    products: initialProducts,
    packages: initialPackages,
    orders: initialOrders,
    sales: [],
    customers: initialCustomers,
    transactions: [],
    suppliers: initialSuppliers,
    teamNotes: JSON.parse(localStorage.getItem('team_notes') || '[]'),
    shopInfo: initialShopInfo,
    tags: initialTags,
    categories: [],
    categoriesData: [],
    isLoading: false,
    error: null,
    notifications: [],

    // POS Initial State
    cart: [],
    posOrderForm: initialPosOrderForm,

    // ============================================
    // POS ACTIONS
    // ============================================

    setCart: (cart) => set({ cart }),
    
    addToCart: (product) => {
        set(state => {
            const existing = state.cart.find(item => item.id === product.id);
            const qtyToAdd = (product as any).qty || 1;
            if (existing) {
                return {
                    cart: state.cart.map(item =>
                        item.id === product.id ? { ...item, qty: item.qty + qtyToAdd } : item
                    )
                };
            }
            return { cart: [...state.cart, { ...product, qty: qtyToAdd }] };
        });
    },

    removeFromCart: (id) => {
        set(state => ({
            cart: state.cart.filter(item => item.id !== id)
        }));
    },

    updateCartQty: (id, delta) => {
        set(state => ({
            cart: state.cart.map(item => {
                if (item.id === id) {
                    return { ...item, qty: Math.max(1, item.qty + delta) };
                }
                return item;
            })
        }));
    },

    clearCart: () => set({ cart: [] }),

    updatePosOrderForm: (updates) => {
        set(state => ({
            posOrderForm: {
                ...state.posOrderForm,
                ...updates,
                deliveryAddress: updates.deliveryAddress 
                    ? { ...state.posOrderForm.deliveryAddress, ...updates.deliveryAddress }
                    : state.posOrderForm.deliveryAddress
            }
        }));
    },

    clearPosOrderForm: () => set({ posOrderForm: initialPosOrderForm }),

    // ============================================
    // NOTIFICATION ACTIONS
    // ============================================

    addNotification: (message: string, type: Toast['type']) => {
        const id = Math.random().toString(36).substring(2, 9);
        set(state => ({
            notifications: [...state.notifications, { id, message, type }]
        }));
        // Auto-remove after 5 seconds
        setTimeout(() => get().removeNotification(id), 5000);
    },

    removeNotification: (id: string) => {
        set(state => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    },

    // ============================================
    // PRODUCT ACTIONS
    // ============================================

    loadProducts: async () => {
        set({ isLoading: true, error: null });
        try {
            // Load categories first to ensure mapping works
            if (get().categoriesData.length === 0) {
                await get().loadCategories();
            }

            const apiProducts = await api.getProducts({ limit: 1000 });
            // Map API products to frontend format
            const categoriesData = get().categoriesData;
            const products = apiProducts.map(p => mapApiProductToFrontend(p, categoriesData));
            set({ products, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addProduct: async (product: Product) => {
        try {
            const categoriesData = get().categoriesData;
            const apiProduct = await api.createProduct(
                mapFrontendToApiProduct(product, categoriesData)
            );

            set(state => ({
                products: [...state.products, { ...product, id: apiProduct.id }]
            }));
            get().addNotification('Producto creado correctamente', 'success');
            logger.success('Producto creado', { id: apiProduct.id, name: product.name }, 'Products');
        } catch (error: any) {
            get().addNotification('Error al crear el producto', 'error');
            logger.error('Error al crear producto', error, 'Products');
            throw error;
        }
    },

    updateProduct: async (id: string, updates: Partial<Product>) => {
        try {
            const categoriesData = get().categoriesData;
            const apiUpdate = mapFrontendToApiProduct(updates, categoriesData);
            
            await api.updateProduct(id, {
                name: apiUpdate.name,
                price: apiUpdate.price,
                cost: apiUpdate.cost,
                min_stock: apiUpdate.min_stock,
                stock_quantity: apiUpdate.stock_quantity,
                tags: apiUpdate.tags,
                category_id: apiUpdate.category_id,
            });
            
            set(state => ({
                products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
            }));
            get().addNotification('Producto actualizado', 'success');
            logger.success('Producto actualizado', { id, ...updates }, 'Products');
        } catch (error: any) {
            get().addNotification('Error al actualizar el producto', 'error');
            logger.error('Error al actualizar producto', error, 'Products');
            throw error;
        }
    },

    deleteProduct: async (id: string) => {
        try {
            await api.deleteProduct(id);
            set(state => ({
                products: state.products.filter(p => p.id !== id)
            }));
            get().addNotification('Producto eliminado', 'success');
            logger.success('Producto eliminado', { id }, 'Products');
        } catch (error: any) {
            get().addNotification('Error al eliminar el producto', 'error');
            logger.error('Error al eliminar producto', error, 'Products');
            throw error;
        }
    },

    // ============================================
    // CATEGORY ACTIONS
    // ============================================

    loadCategories: async () => {
        try {
            const categoriesData = await api.getCategories();
            set({ 
                categoriesData,
                categories: categoriesData.map(c => c.name)
            });
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    },

    addCategory: async (name: string) => {
        try {
            const newCat = await api.createCategory({ name });
            set(state => ({
                categoriesData: [...state.categoriesData, newCat],
                categories: [...state.categories, newCat.name]
            }));
            get().addNotification('Categoría creada', 'success');
        } catch (error) {
            get().addNotification('Error al crear categoría', 'error');
        }
    },

    renameCategory: async (oldName: string, newName: string) => {
        // For now, API might not support rename, so we just update local
        // and ideally update all products in that category.
        // If the backend had a rename endpoint, we'd call it here.
        set(state => ({
            categories: state.categories.map(c => c === oldName ? newName : c),
            categoriesData: state.categoriesData.map(c => c.name === oldName ? { ...c, name: newName } : c),
            products: state.products.map(p => p.category === oldName ? { ...p, category: newName } : p)
        }));
    },

    deleteCategory: async (name: string) => {
        try {
            const cat = get().categoriesData.find(c => c.name === name);
            if (cat) {
                await api.deleteCategory(cat.id);
            }
            set(state => ({
                categories: state.categories.filter(c => c !== name),
                categoriesData: state.categoriesData.filter(c => c.name !== name),
                products: state.products.map(p => p.category === name ? { ...p, category: 'Sin Categoría', category_id: undefined } : p)
            }));
            get().addNotification('Categoría eliminada', 'success');
        } catch (error) {
            get().addNotification('Error al eliminar categoría', 'error');
        }
    },

    // ============================================
    // PACKAGE ACTIONS
    // ============================================

    loadPackages: async () => {
        set({ isLoading: true, error: null });
        try {
            const apiPackages = await api.getPackages({ limit: 1000 });
            const packages = apiPackages.map(pkg => ({
                id: pkg.id,
                name: pkg.name,
                section: pkg.section,
                description: pkg.description || '',
                price: pkg.suggested_price,
                items: (pkg.components || pkg.items || []).map((comp: any) => ({
                    productId: comp.product_id || comp.productId,
                    quantity: comp.quantity
                })),
                isActive: pkg.is_active,
            }));
            set({ packages, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addPackage: async (pkg: Package) => {
        try {
            await api.createPackage({
                name: pkg.name,
                section: pkg.section,
                description: pkg.description,
                price: pkg.price,
                is_active: pkg.isActive,
                components: pkg.items.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity
                })),
            });
            
            set(state => ({
                packages: [...state.packages, pkg]
            }));
            get().addNotification('Paquete creado', 'success');
        } catch (error: any) {
            get().addNotification('Error al crear paquete', 'error');
            console.error('Error adding package:', error);
        }
    },

    updatePackage: async (id: string, updates: Partial<Package>) => {
        try {
            await api.updatePackage(id, {
                name: updates.name,
                section: updates.section,
                description: updates.description,
                suggested_price: updates.price,
                is_active: updates.isActive,
            });
            
            set(state => ({
                packages: state.packages.map(p => p.id === id ? { ...p, ...updates } : p)
            }));
        } catch (error: any) {
            console.error('Error updating package:', error);
        }
    },

    deletePackage: async (id: string) => {
        try {
            await api.deletePackage(id);
            set(state => ({
                packages: state.packages.filter(p => p.id !== id)
            }));
            get().addNotification('Paquete eliminado', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar paquete', 'error');
            console.error('Error deleting package:', error);
        }
    },

    checkPackageAvailability: (packageId: string) => {
        const state = get();
        const pkg = state.packages.find(p => p.id === packageId);

        if (!pkg) {
            return { available: false, missingComponents: [] };
        }

        const missingComponents: any[] = [];
        let available = true;

        pkg.items.forEach(component => {
            const product = state.products.find(p => p.id === component.productId);
            if (product) {
                if (product.stock < component.quantity) {
                    available = false;
                    missingComponents.push({
                        productId: product.id,
                        productName: product.name,
                        required: component.quantity,
                        available: product.stock,
                        shortage: component.quantity - product.stock
                    });
                }
            } else {
                available = false;
                missingComponents.push({
                    productId: component.productId,
                    productName: 'Producto eliminado',
                    required: component.quantity,
                    available: 0,
                    shortage: component.quantity
                });
            }
        });

        return { available, missingComponents };
    },

    // ============================================
    // CUSTOMER ACTIONS
    // ============================================

    loadCustomers: async () => {
        set({ isLoading: true, error: null });
        try {
            const apiCustomers = await api.getCustomers({ limit: 1000 });
            const customers = apiCustomers.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email || '',
                debtBalance: Number(c.debt_balance) || 0,
                importantDateName: c.important_date_name || '',
                importantDate: c.important_date || '',
                notes: c.notes || '',
                birthday: c.birthday,
                anniversary: c.anniversary,
                address_street: c.address_street,
                address_number: c.address_number,
                address_floor: c.address_floor,
                address_city: c.address_city,
                orderCount: Number(c.total_orders) || 0,
                total_orders: Number(c.total_orders) || 0,
                total_spent: Number(c.total_spent) || 0,
                lastOrderDate: c.last_order_date,
                address: [c.address_street, c.address_number, c.address_city].filter(Boolean).join(', '),
            }));
            set({ customers, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addCustomer: async (customer: Customer) => {
        try {
            await api.createCustomer({
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                debt_balance: customer.debtBalance,
                birthday: customer.birthday,
                anniversary: customer.anniversary,
                notes: customer.notes,
                address_street: customer.address_street,
                address_number: customer.address_number,
                address_floor: customer.address_floor,
                address_city: customer.address_city,
            });
            
            set(state => ({
                customers: [...state.customers, customer]
            }));
            get().addNotification('Cliente registrado', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar cliente', 'error');
            console.error('Error adding customer:', error);
        }
    },

    updateCustomer: async (id: string, updates: Partial<Customer>) => {
        try {
            await api.updateCustomer(id, {
                name: updates.name,
                phone: updates.phone,
                email: updates.email,
                debt_balance: updates.debtBalance,
                birthday: updates.birthday,
                anniversary: updates.anniversary,
                notes: updates.notes,
                important_date_name: updates.importantDateName,
                important_date: updates.importantDate,
            });
            
            set(state => ({
                customers: state.customers.map(c => c.id === id ? { ...c, ...updates } : c)
            }));
            get().addNotification('Datos del cliente actualizados', 'success');
        } catch (error: any) {
            get().addNotification('Error al actualizar cliente', 'error');
            console.error('Error updating customer:', error);
        }
    },

    deleteCustomer: async (id: string) => {
        try {
            await api.deleteCustomer(id);
            set(state => ({
                customers: state.customers.filter(c => c.id !== id)
            }));
            get().addNotification('Cliente eliminado', 'success');
        } catch (error: any) {
            get().addNotification('Error al eliminar cliente', 'error');
            console.error('Error deleting customer:', error);
        }
    },

    registerPayment: async (id: string, amount: number) => {
        try {
            await api.registerPayment(id, amount, 'cash', 'Pago de deuda');
            
            set(state => ({
                customers: state.customers.map(c =>
                    c.id === id
                        ? { ...c, debtBalance: Math.max(0, (Number(c.debtBalance) || 0) - (Number(amount) || 0)) }
                        : c
                )
            }));
            get().addNotification('Pago registrado correctamente', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar el pago', 'error');
            console.error('Error registering payment:', error);
        }
    },

    // ============================================
    // ORDER ACTIONS
    // ============================================

    loadOrders: async () => {
        set({ isLoading: true, error: null });
        try {
            const apiOrders = await api.getOrders({ limit: 500 });
            const orders = apiOrders.map(o => ({
                id: o.id,
                customerName: o.customer_name,
                customerPhone: o.customer_phone,
                customerId: o.customer_id,
                total: Number(o.total_amount) || 0,
                status: o.status as any,
                date: o.delivery_date,
                items: o.items || [],
                notes: o.card_message || o.notes,
                advancePayment: Number(o.advance_payment) || 0,
                deliveryMethod: o.delivery_method,
                deliveryAddress: o.delivery_address,
                deliveryTimeSlot: o.delivery_time_slot,
                contactPhone: o.contact_phone,
            }));
            set({ orders: orders.reverse(), isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addOrder: async (order: Order) => {
        try {
            await api.createOrder({
                customer_id: order.customerId || '',
                guest_name: order.guestName,
                guest_phone: order.guestPhone,
                delivery_date: order.date,
                delivery_method: order.deliveryMethod || 'pickup',
                delivery_time_slot: order.deliveryTimeSlot,
                delivery_address: order.deliveryAddress,
                contact_phone: order.contactPhone,
                card_message: order.notes,
                items: order.items.map((item: any) => ({
                    product_id: item.isPackage ? undefined : (item.product_id || item.id),
                    package_id: item.isPackage ? (item.package_id || item.id) : undefined,
                    quantity: Number(item.qty || item.quantity),
                    unit_price: Number(item.price),
                    product_name: item.name
                })),
                advance_payment: Number(order.advancePayment || 0),
            });
            
            set(state => ({
                orders: [...state.orders, order]
            }));
            get().addNotification('Pedido registrado correctamente', 'success');
        } catch (error: any) {
            get().addNotification('Error al registrar el pedido', 'error');
            console.error('Error adding order:', error);
            throw error; // Re-throw to inform POS UI
        }
    },

    updateOrderStatus: async (id: string, status: Order['status']) => {
        try {
            await api.updateOrderStatus(id, status as any);
            
            set(state => ({
                orders: state.orders.map(o => o.id === id ? { ...o, status } : o)
            }));
            get().addNotification(`Pedido ${status}`, 'info');
        } catch (error: any) {
            get().addNotification('Error al actualizar estado del pedido', 'error');
            console.error('Error updating order status:', error);
        }
    },

    // ============================================
    // FINANCIAL ACTIONS
    // ============================================

    loadTransactions: async () => {
        set({ isLoading: true, error: null });
        try {
            const apiTransactions = await api.getTransactions({ limit: 1000 });
            const transactions = apiTransactions.map(t => ({
                id: t.id,
                type: (t.type === 'sale' || t.type === 'payment_received') ? 'income' : 'expense',
                category: t.category,
                amount: Number(t.amount) || 0, // Ensure amount is numeric (API might return as string)
                date: t.created_at,
                method: t.payment_method as any || 'cash',
                description: t.description || t.notes || '',
                relatedId: t.reference_id,
                metadata: t.metadata,
                notes: t.notes || '',
            } as TransactionLocal));
            set({ transactions: transactions.reverse(), isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    processSale: async (sale: Sale) => {
        set({ isLoading: true });
        console.log('[POS] Iniciando proceso de venta:', sale);
        try {
            // Mapear items correctamente para la API
            const saleItems = sale.items.map((item: any) => {
                console.log('[POS] Item:', item);

                if (item.isPackage) {
                    // Es un paquete: el id del item es el package_id
                    return {
                        product_id: undefined,
                        package_id: item.id,
                        quantity: Number(item.qty) || Number(item.quantity) || 1,
                        unit_price: Number(item.price) || 0,
                    };
                } else {
                    // Es un producto normal
                    return {
                        product_id: item.product_id || item.id,
                        package_id: undefined,
                        quantity: Number(item.qty) || Number(item.quantity) || 1,
                        unit_price: Number(item.price) || 0,
                    };
                }
            });

            console.log('[POS] Items mapeados para API:', saleItems);

            // Create sale via API
            await api.createSale({
                total: Number(sale.total),
                payment_method: sale.method,
                items: saleItems,
                notes: sale.notes,
                customer_id: sale.customerId || undefined,
            });

            console.log('[POS] Venta creada exitosamente en el backend');
            
            // --- OPTIMISTIC UI UPDATE ---
            // Update stock and customer stats locally for instant feel
            set(state => {
                const updatedProducts = [...state.products];
                sale.items.forEach((item: any) => {
                    if (item.id) {
                        const pIdx = updatedProducts.findIndex(p => p.id === (item.product_id || item.id));
                        if (pIdx !== -1) {
                            updatedProducts[pIdx] = {
                                ...updatedProducts[pIdx],
                                stock: Math.max(0, updatedProducts[pIdx].stock - (Number(item.qty) || Number(item.quantity) || 1))
                            };
                        }
                    }
                });

                return { 
                    products: updatedProducts,
                    isLoading: false 
                };
            });

            get().addNotification('Venta procesada con éxito', 'success');

            // Background Reload: Do not block the result on these
            // We do them to ensure definitive sync with server (ids, timestamps, audited stock)
            Promise.all([
                get().loadProducts(),
                get().loadTransactions(),
                get().loadCustomers(),
                get().loadOrders()
            ]).then(() => {
                console.log('[POS] Sincronización de fondo completada');
            }).catch(err => {
                console.warn('[POS] Error en la sincronización de fondo:', err);
            });

            return true;
        } catch (error: any) {
            console.error('[POS] ERROR en processSale:', error);
            const errorMsg = error.response?.data?.details || error.message || 'Error desconocido';
            set({ error: errorMsg, isLoading: false });
            get().addNotification(`Error al procesar venta: ${errorMsg}`, 'error');
            return false;
        }
    },

    processPurchase: async (purchase) => {
        set({ isLoading: true });
        try {
            await api.createPurchase({
                supplier_id: purchase.supplierId,
                payment_method: purchase.method,
                items: purchase.items.map((item: any) => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                    cost: item.cost,
                })),
                notes: purchase.notes,
            });

            // --- OPTIMISTIC UI UPDATE ---
            // Increase stock locally for instant feel
            set(state => {
                const updatedProducts = [...state.products];
                purchase.items.forEach((item: any) => {
                    const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
                    if (pIdx !== -1) {
                        updatedProducts[pIdx] = {
                            ...updatedProducts[pIdx],
                            stock: Number(updatedProducts[pIdx].stock) + Number(item.quantity),
                            cost: Number(item.cost) // Update cost snapshot
                        };
                    }
                });

                return { 
                    products: updatedProducts,
                    isLoading: false 
                };
            });

            get().addNotification('Compra registrada con éxito', 'success');

            // Background Reload
            Promise.all([
                get().loadProducts(),
                get().loadTransactions(),
                get().loadSuppliers()
            ]).then(() => {
                console.log('[PURCHASE] Sincronización de fondo completada');
            }).catch(err => {
                console.warn('[PURCHASE] Error en sincronización de fondo:', err);
            });

            return true;
        } catch (error: any) {
            set({ isLoading: false });
            get().addNotification(`Error al registrar la compra: ${error.message}`, 'error');
            console.error('Error processing purchase:', error);
            throw error;
        }
    },

    addTransaction: async (transaction: TransactionLocal) => {
        try {
            const cleanAmount = Number(transaction.amount) || 0;
            if (transaction.type === 'expense') {
                await api.createExpense({
                    amount: cleanAmount,
                    category: transaction.category,
                    payment_method: transaction.method as any,
                    description: transaction.description,
                    notes: transaction.relatedId,
                });
            } else {
                await api.createTransaction({
                    type: transaction.type === 'income' ? 'payment_received' : 'expense',
                    amount: cleanAmount,
                    category: transaction.category,
                    payment_method: transaction.method,
                    description: transaction.description,
                });
            }
            
            set(state => ({
                transactions: [...state.transactions, { ...transaction, amount: cleanAmount }]
            }));
        } catch (error: any) {
            console.error('Error adding transaction:', error);
        }
    },

    // ============================================
    // SUPPLIER ACTIONS
    // ============================================

    loadSuppliers: async () => {
        set({ isLoading: true, error: null });
        try {
            const apiSuppliers = await api.getSuppliers({ limit: 1000 });
            const suppliers = apiSuppliers.map(s => ({
                id: s.id,
                name: s.name,
                contactName: s.contact_name || '',
                phone: s.phone,
                category: s.category || 'General',
                address: s.address,
                lastVisit: s.created_at, // Use created_at if no other visit info
                nextVisitDate: s.next_visit_date,
            }));
            set({ suppliers, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    addSupplier: async (supplier: SupplierLocal) => {
        try {
            await api.createSupplier({
                name: supplier.name,
                contact_name: supplier.contactName,
                phone: supplier.phone,
                category: supplier.category,
                address: supplier.address,
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

    updateSupplier: async (id: string, updates: Partial<SupplierLocal>) => {
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
        } catch (error: any) {
            console.error('Error updating supplier:', error);
        }
    },

    deleteSupplier: async (id: string) => {
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

    // ============================================
    // WASTE ACTIONS
    // ============================================

    registerWaste: async (productId: string, quantity: number, reason: string) => {
        try {
            await api.createWaste({
                product_id: productId,
                quantity,
                reason: reason as any,
            });

            set(state => {
                const product = state.products.find(p => p.id === productId);
                if (!product) return state;

                const wasteAmount = product.price * 0.5 * quantity;

                const newTransaction: TransactionLocal = {
                    id: generateIdWithPrefix('t'),
                    type: 'expense',
                    category: 'Merma',
                    amount: wasteAmount,
                    date: new Date().toISOString(),
                    method: 'cash',
                    description: `Merma: ${quantity}x ${product.name} (${reason})`,
                    relatedId: productId
                };

                return {
                    products: state.products.map(p =>
                        p.id === productId ? { ...p, stock: Math.max(0, p.stock - quantity) } : p
                    ),
                    transactions: [...state.transactions, newTransaction]
                };
            });
        } catch (error: any) {
            console.error('Error registering waste:', error);
        }
    },

    // ============================================
    // SETTINGS & UTILITY
    // ============================================

    updateShopInfo: (info: Partial<ShopInfo>) => {
        set(state => ({ shopInfo: { ...state.shopInfo, ...info } }));
    },
    // Utility
    getPriceHistory: async (id: string) => {
        try {
            return await api.getProductPriceHistory(id);
        } catch (error) {
            console.error('Error fetching price history:', error);
            return [];
        }
    },

    trackSale: (productId: string, quantity: number) => {
        set(state => ({
            products: state.products.map(p =>
                p.id === productId
                    ? {
                        ...p,
                        salesCount: (p.salesCount || 0) + quantity,
                        lastSaleDate: new Date().toISOString(),
                        weeklySales: (p.weeklySales || 0) + quantity
                    }
                    : p
            )
        }));
    },

    addTag: (tag: string) => {
        set(state => ({
            tags: state.tags.includes(tag) ? state.tags : [...state.tags, tag]
        }));
    },

    removeTag: (tagToRemove: string) => {
        set(state => ({
            tags: state.tags.filter(t => t !== tagToRemove),
            products: state.products.map(p => ({
                ...p,
                tags: p.tags.filter(t => t !== tagToRemove)
            }))
        }));
    },

    // ============================================
    // TEAM NOTES ACTIONS
    // ============================================

    addTeamNote: (noteData) => {
        const newNote: TeamNote = {
            ...noteData,
            id: generateIdWithPrefix('n'),
            date: new Date().toISOString()
        };
        set(state => {
            const newNotes = [newNote, ...state.teamNotes];
            localStorage.setItem('team_notes', JSON.stringify(newNotes));
            return { teamNotes: newNotes };
        });
    },

    deleteTeamNote: (id: string) => {
        set(state => {
            const newNotes = state.teamNotes.filter(n => n.id !== id);
            localStorage.setItem('team_notes', JSON.stringify(newNotes));
            return { teamNotes: newNotes };
        });
    }
})
);
