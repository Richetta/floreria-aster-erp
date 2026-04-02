/**
 * Shared Types
 * Tipos compartidos para toda la aplicación
 */

// ============================================
// PRODUCT TYPES
// ============================================

export interface Product {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id?: string | null;
  category_name?: string; // For frontend display
  cost: number;
  price: number;
  margin_percent?: number;
  stock_quantity: number;
  min_stock: number;
  max_stock?: number;
  is_active: boolean;
  is_barcode: boolean;
  tags: string[];
  images?: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Category {
  id: string;
  name: string;
  business_id: string;
  parent_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  code?: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  cost: number;
  price: number;
  stock?: number;
  min?: number;
  tags?: string[];
}

// ============================================
// CUSTOMER TYPES
// ============================================

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address_street?: string;
  address_number?: string;
  address_floor?: string;
  address_city?: string;
  debt_balance: number;
  credit_limit?: number;
  birthday?: string;
  anniversary?: string;
  important_date_name?: string;
  important_date?: string;
  notes?: string;
  is_active: boolean;
  total_orders?: number;
  total_spent?: number;
  last_order_date?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  email?: string;
  address_street?: string;
  address_number?: string;
  address_floor?: string;
  address_city?: string;
  debt_balance?: number;
  birthday?: string;
  anniversary?: string;
  important_date_name?: string;
  important_date?: string;
  notes?: string;
}

// ============================================
// ORDER TYPES
// ============================================

export type OrderStatus = 'pending' | 'assembling' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type DeliveryMethod = 'pickup' | 'delivery';
export type DeliveryTimeSlot = 'morning' | 'afternoon' | 'evening' | 'allday';

export interface Order {
  id: string;
  order_number?: number;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  status: OrderStatus;
  total_amount: number;
  advance_payment: number;
  delivery_method: DeliveryMethod;
  delivery_date: string;
  delivery_time_slot: DeliveryTimeSlot;
  delivery_address?: DeliveryAddress;
  contact_phone?: string;
  card_message?: string;
  notes?: string;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
  delivered_at?: string | null;
  deleted_at?: string | null;
}

export interface DeliveryAddress {
  street?: string;
  number?: string;
  floor?: string;
  city?: string;
  reference?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  package_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  discount?: number;
}

export interface OrderFormData {
  customer_id: string;
  delivery_date: string;
  delivery_method: DeliveryMethod;
  delivery_time_slot?: DeliveryTimeSlot;
  delivery_address?: DeliveryAddress;
  contact_phone?: string;
  card_message?: string;
  notes?: string;
  items: OrderItemInput[];
  advance_payment?: number;
}

export interface OrderItemInput {
  product_id?: string;
  package_id?: string;
  quantity: number;
  unit_price: number;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type TransactionType = 'sale' | 'payment_received' | 'expense' | 'supplier_payment' | 'adjustment';
export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  payment_method?: PaymentMethod;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface TransactionFormData {
  type: TransactionType;
  category: string;
  amount: number;
  payment_method?: PaymentMethod;
  description?: string;
  notes?: string;
}

// ============================================
// PACKAGE TYPES
// ============================================

export interface Package {
  id: string;
  name: string;
  section: string;
  description?: string;
  suggested_price: number;
  is_active: boolean;
  images?: string[];
  tags?: string[];
  components: PackageComponent[];
  items?: PackageComponent[]; // Alias for frontend
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface PackageComponent {
  id: string;
  package_id: string;
  product_id: string;
  quantity: number;
  display_order?: number;
  product_name?: string; // Joined from product
}

export interface PackageFormData {
  name: string;
  section: string;
  description?: string;
  price: number;
  is_active?: boolean;
  components: PackageComponentInput[];
}

export interface PackageComponentInput {
  product_id: string;
  quantity: number;
}

// ============================================
// SUPPLIER TYPES
// ============================================

export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone: string;
  email?: string;
  address?: string;
  category?: string;
  next_visit_date?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface SupplierFormData {
  name: string;
  contact_name?: string;
  phone: string;
  email?: string;
  address?: string;
  category?: string;
  next_visit_date?: string;
  notes?: string;
}

// ============================================
// USER TYPES
// ============================================

export type UserRole = 'admin' | 'seller' | 'driver' | 'viewer';

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ============================================
// WASTE TYPES
// ============================================

export type WasteReason = 'Deterioro natural' | 'Rotura de proveedor' | 'Rotura en local' | 'Vencimiento' | 'Robo/Extravío' | 'Otro';

export interface WasteLog {
  id: string;
  product_id: string;
  quantity: number;
  reason: WasteReason;
  notes?: string;
  reported_by?: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface WasteFormData {
  product_id: string;
  quantity: number;
  reason: WasteReason;
  notes?: string;
}

// ============================================
// STOCK MOVEMENT TYPES
// ============================================

export type StockMovementType = 'sale' | 'order' | 'purchase' | 'adjustment' | 'waste' | 'return' | 'transfer';

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  balance_after: number;
  reference_type: string;
  reference_id: string;
  user_id?: string;
  notes?: string;
  created_at: string;
}

// ============================================
// SHOP INFO TYPES
// ============================================

export interface ShopInfo {
  name: string;
  logo?: string;
  phone: string;
  address: string;
  instagram?: string;
  currency: string;
  tax_id?: string;
  email?: string;
}

// ============================================
// UI TYPES
// ============================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any[];
  statusCode?: number;
}
