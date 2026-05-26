export type Product = {
    id: string;
    code: string;
    barcode?: string;
    name: string;
    category: string;
    category_id?: string;
    brand_id?: string;
    brand_name?: string;
    price: number;
    cost?: number;
    stock: number;
    min: number;
    tags: string[];
    custom_filter_options?: string[];
    supplierId?: string;
    salesCount?: number;
    lastSaleDate?: string;
    weeklySales?: number;
    images?: string[];
    storefront_published?: boolean;
};

export type Category = {
    id: string;
    name: string;
    parent_id?: string | null;
    children?: Category[];
};

export type Brand = {
    id: string;
    name: string;
};

export type CustomFilterOption = {
    id: string;
    business_id: string;
    custom_filter_id: string;
    value: string;
    created_at: string;
};

export type CustomFilter = {
    id: string;
    business_id: string;
    name: string;
    created_at: string;
    updated_at: string;
    options: CustomFilterOption[];
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
    status: 'pending' | 'assembling' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'archived';
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
    payment_method?: string;
};

export type Sale = {
    id: string;
    total: number;
    date: string;
    items: any[];
    method: string;
    notes?: string;
    customerId?: string;
};

export type TransactionLocal = {
    id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    date: string;
    method: string;
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
    storefront_published?: boolean;
    images?: string | string[];
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
    paymentMethods?: PaymentMethod[];
    slug?: string;
    settings?: Record<string, any>;
};

export type PaymentMethod = {
    id: string;
    name: string;
    type: 'cash' | 'transfer' | 'debit' | 'credit' | 'other';
    last_digits?: string;
    is_active: boolean;
    surcharge?: number;
    iconId?: string;
};

// Full Store State (Intersection of all slices)
// This will be populated by the actual slice interfaces
export type AppState = any; 

