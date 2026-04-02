export type Product = {
    id: string;
    code: string;
    barcode?: string;
    name: string;
    category: string;
    category_id?: string;
    price: number;
    cost?: number;
    stock: number;
    min: number;
    tags: string[];
    supplierId?: string;
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
    orderNumber?: string;
    customerName: string;
    customerPhone?: string;
    customerId?: string;
    total: number;
    status: 'pending' | 'assembling' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
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
    cardMessage?: string;
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

export type PackageItem = { productId: string; quantity: number };

export type Package = {
    id: string;
    name: string;
    section: string;
    description: string;
    price: number;
    items: PackageItem[];
    isActive: boolean;
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

// Full Store State (Intersection of all slices)
// This will be populated by the actual slice interfaces
export type AppState = any; 

