// ============================================
// API CLIENT - Florería Aster ERP
// ============================================

import { logger } from '../utils/logger';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Use relative path in production for Vercel Proxy, absolute in dev or if explicitly set as absolute
const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`);

// ============================================
// TYPES
// ============================================

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'seller' | 'driver' | 'viewer';
  business_id: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  cost: number;
  price: number;
  margin_percent?: number;
  stock_quantity: number;
  min_stock: number;
  is_active: boolean;
  is_barcode: boolean;
  supplier_id?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address_street?: string;
  address_number?: string;
  address_floor?: string;
  address_city?: string;
  debt_balance: number;
  birthday?: string;
  anniversary?: string;
  important_date_name?: string;
  important_date?: string;
  notes?: string;
  total_orders?: number;
  total_spent?: number;
  last_order_date?: string;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  order_number?: number;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  status: 'pending' | 'assembling' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  total_amount: number;
  advance_payment: number;
  delivery_method: 'pickup' | 'delivery';
  delivery_date: string;
  delivery_time_slot: 'morning' | 'afternoon' | 'evening' | 'allday';
  delivery_address?: {
    street?: string;
    number?: string;
    floor?: string;
    city?: string;
    reference?: string;
  };
  contact_phone?: string;
  card_message?: string;
  notes?: string;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  product_id?: string;
  package_id?: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type Transaction = {
  id: string;
  type: 'sale' | 'payment_received' | 'expense' | 'supplier_payment' | 'adjustment';
  category: string;
  amount: number;
  payment_method?: 'cash' | 'card' | 'transfer';
  description?: string;
  notes?: string;
  reference_id?: string;
  reference_type?: string;
  metadata?: Record<string, any>;
  created_at: string;
};

export type Package = {
  id: string;
  name: string;
  section: string;
  description?: string;
  price: number;
  suggested_price?: number;
  is_active: boolean;
  components: PackageComponent[];
  items?: PackageComponent[]; // Alias for frontend compatibility
  created_at: string;
};

export type PackageComponent = {
  id: string;
  product_id: string;
  quantity: number;
  display_order?: number;
};

export type Supplier = {
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
  created_at: string;
};

export type WasteLog = {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  notes?: string;
  created_at: string;
};

export type Category = {
  id: string;
  business_id: string;
  name: string;
  parent_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================
// HTTP CLIENT
// ============================================

class ApiClient {
  private token: string | null = localStorage.getItem('auth_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    logger.debug(`API Request: ${options.method || 'GET'} ${endpoint}`, null, 'ApiClient');

    const headers: HeadersInit = {
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      (headers as any)['Content-Type'] = 'application/json';
    }

    if (this.token) {
      (headers as any)['Authorization'] = `Bearer ${this.token}`;
    }

    if (options.body && typeof options.body === 'string') {
      console.log(`[ApiClient] Request Body for ${endpoint}:`, JSON.parse(options.body));
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        logger.error(`API Error: ${response.status} ${error.error || error.message}`, error, 'ApiClient');

        if (response.status === 401 && !window.location.pathname.includes('/login')) {
          this.token = null;
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }

        throw new Error(error.error || error.message || 'Request failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      return response.text() as any;
    } catch (error: any) {
      logger.error(`Request failed: ${error.message}`, error, 'ApiClient');
      throw error;
    }
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async register(name: string, email: string, password: string, role: string = 'viewer'): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // ============================================
  // USERS ENDPOINTS
  // ============================================

  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async getUser(id: string): Promise<User> {
    return this.request<User>(`/users/${id}`);
  }

  async createUser(user: any): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, user: any): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async changePassword(current_password: string, new_password: string): Promise<any> {
    return this.request('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/users/profile/me');
  }

  // ============================================
  // PRODUCTS & STOCK ENDPOINTS
  // ============================================

  async getProducts(params?: any): Promise<Product[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<Product[]>(`/products${queryString ? `?${queryString}` : ''}`);
  }

  async getProduct(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  async createProduct(product: Partial<Product>): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    return this.request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getProductPriceHistory(id: string): Promise<any[]> {
    return this.request<any[]>(`/products/${id}/price-history`);
  }

  /**
   * Sube un archivo (xlsx, csv, pdf, docx) al backend y retorna los datos parseados.
   * Usa FormData con multipart/form-data (no puede pasar por this.request que setea Content-Type: json).
   */
  async parseFile(file: File): Promise<{ method: string; filename: string; total_rows: number; data: any[] }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/import-data/parse-file`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `Error ${response.status}`);
    }
    return response.json();
  }

  /**
   * Importa una lista de precios al backend.
   */
  async importPrices(
    data: any[],
    options: {
      update_costs: boolean;
      update_prices: boolean;
      update_stock: boolean;
      stock_action: 'set' | 'add';
      auto_margin: boolean;
      margin_percent: number;
    }
  ): Promise<{ updated: number; created: number; errors: any[] }> {
    return this.request('/import-data/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ data, ...options }),
    });
  }

  /**
   * Descarga el catálogo actual como CSV desde el backend.
   * Retorna el texto CSV listo para descargar.
   */
  async exportProductsTemplate(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/import-data/export-template`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Error al exportar: ${response.statusText}`);
    }
    return response.text();
  }

  async updateProductStock(id: string, quantity: number, type: string, reason?: string): Promise<any> {
    return this.request(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, type, reason }),
    });
  }

  async getStockMovements(params?: any): Promise<any[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/stock/movements${queryString ? `?${queryString}` : ''}`);
  }

  async getProductStockHistory(id: string, limit: number = 50): Promise<any> {
    return this.request(`/stock/product/${id}/history?limit=${limit}`);
  }

  async getNotifications(): Promise<any[]> {
    return this.request('/notifications');
  }

  // ============================================
  // REMINDERS ENDPOINTS
  // ============================================

  async getReminderHistory(limit: number = 100): Promise<any[]> {
    return this.request(`/reminders/history?limit=${limit}`);
  }

  async sendBulkReminders(customerIds: string[], template: string, channel: 'whatsapp' | 'email' | 'sms' = 'whatsapp'): Promise<any> {
    return this.request('/reminders/send-bulk', {
      method: 'POST',
      body: JSON.stringify({ customerIds, template, channel })
    });
  }

  async downloadCSV(filename: string, data: any[]): Promise<void> {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async getLowStockProducts(): Promise<any[]> {
    return this.request('/stock/low-stock');
  }

  async getRestockItems(): Promise<any[]> {
    return this.request('/inventory/restock');
  }

  async createStockAdjustment(data: any): Promise<any> {
    return this.request('/stock/adjustment', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getStockSummary(): Promise<any> {
    return this.request('/stock/summary');
  }

  // ============================================
  // CATEGORIES ENDPOINTS
  // ============================================

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  async createCategory(category: any): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  }

  async updateCategory(id: string, category: any): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(category),
    });
  }

  async deleteCategory(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // CUSTOMERS ENDPOINTS
  // ============================================

  async getCustomers(params?: any): Promise<Customer[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<Customer[]>(`/customers${queryString ? `?${queryString}` : ''}`);
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }

  async getCustomerHistory(id: string): Promise<any> {
    return this.request(`/customers/${id}/history`);
  }

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    return this.request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    });
  }

  async deleteCustomer(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/customers/${id}`, {
      method: 'DELETE',
    });
  }

  async registerPayment(id: string, amount: number, payment_method?: string, notes?: string): Promise<any> {
    return this.request(`/customers/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ amount, payment_method, notes }),
    });
  }

  async addDebt(id: string, amount: number, notes?: string, order_id?: string): Promise<any> {
    return this.request(`/customers/${id}/debt`, {
      method: 'POST',
      body: JSON.stringify({ amount, notes, order_id }),
    });
  }

  // ============================================
  // ORDERS ENDPOINTS
  // ============================================

  async getOrders(params?: any): Promise<Order[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<Order[]>(`/orders${queryString ? `?${queryString}` : ''}`);
  }

  async getOrder(id: string): Promise<any> {
    return this.request(`/orders/${id}`);
  }

  async createOrder(order: any): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async updateOrder(id: string, order: Partial<Order>): Promise<Order> {
    return this.request<Order>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteOrder(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  async getDeliveryScheduled(date?: string): Promise<Order[]> {
    const queryString = date ? `?date=${date}` : '';
    return this.request<Order[]>(`/orders/delivery/scheduled${queryString}`);
  }

  // ============================================
  // TRANSACTIONS & SALES ENDPOINTS
  // ============================================

  async getTransactions(params?: any): Promise<Transaction[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<Transaction[]>(`/transactions${queryString ? `?${queryString}` : ''}`);
  }

  async getTransaction(id: string): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${id}`);
  }

  async getFinancialSummary(from_date?: string, to_date?: string): Promise<any> {
    const queryString = new URLSearchParams();
    if (from_date) queryString.append('from_date', from_date);
    if (to_date) queryString.append('to_date', to_date);
    return this.request(`/transactions/summary/period?${queryString.toString()}`);
  }

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
  }

  async createSale(sale: any): Promise<Transaction> {
    return this.request<Transaction>('/transactions/sale', {
      method: 'POST',
      body: JSON.stringify(sale),
    });
  }

  async createPurchase(purchase: any): Promise<Transaction> {
    return this.request<Transaction>('/transactions/purchase', {
      method: 'POST',
      body: JSON.stringify(purchase),
    });
  }

  async createExpense(expense: any): Promise<Transaction> {
    return this.request<Transaction>('/transactions/expense', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async deleteTransaction(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // PACKAGES (ARREGLOS) ENDPOINTS
  // ============================================

  async getPackages(params?: any): Promise<Package[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<Package[]>(`/packages${queryString ? `?${queryString}` : ''}`);
  }

  async getPackage(id: string): Promise<Package> {
    return this.request<Package>(`/packages/${id}`);
  }

  async createPackage(pkg: any): Promise<Package> {
    return this.request<Package>('/packages', {
      method: 'POST',
      body: JSON.stringify(pkg),
    });
  }

  async updatePackage(id: string, pkg: any): Promise<Package> {
    return this.request<Package>(`/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pkg),
    });
  }

  async deletePackage(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/packages/${id}`, {
      method: 'DELETE',
    });
  }

  async getPackageAvailability(id: string): Promise<any> {
    return this.request(`/packages/${id}/availability`);
  }

  // ============================================
  // SUPPLIERS ENDPOINTS
  // ============================================

  async getSuppliers(params?: any): Promise<Supplier[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<Supplier[]>(`/suppliers${queryString ? `?${queryString}` : ''}`);
  }

  async getSupplier(id: string): Promise<any> {
    return this.request(`/suppliers/${id}`);
  }

  async createSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    return this.request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplier),
    });
  }

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier> {
    return this.request<Supplier>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplier),
    });
  }

  async deleteSupplier(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  async getSupplierCategories(): Promise<string[]> {
    return this.request<string[]>('/suppliers/categories/list');
  }

  // ============================================
  // REPORTS ENDPOINTS
  // ============================================

  async getSalesSummary(from_date?: string, to_date?: string): Promise<any> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    return this.request(`/reports/sales/summary?${params.toString()}`);
  }

  async getSalesByPeriod(from_date?: string, to_date?: string, interval: string = 'day'): Promise<any[]> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    params.append('interval', interval);
    return this.request(`/reports/sales/by-period?${params.toString()}`);
  }

  async getProfits(from_date?: string, to_date?: string): Promise<any> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    return this.request(`/reports/profits?${params.toString()}`);
  }

  async getTopProducts(from_date?: string, to_date?: string, limit: number = 10): Promise<any[]> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    params.append('limit', limit.toString());
    return this.request(`/reports/products/top?${params.toString()}`);
  }

  async getTopCustomers(_from_date?: string, _to_date?: string, _limit: number = 10): Promise<any[]> {
    return []; // NotImplemented in backend yet
  }

  async exportSales(from_date?: string, to_date?: string): Promise<string> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    return this.request<string>(`/reports/export/sales?${params.toString()}`);
  }


  // ============================================
  // CASH REGISTER ENDPOINTS
  // ============================================

  async getCashRegisterStatus(date?: string): Promise<any> {
    const queryString = date ? `?date=${date}` : '';
    return this.request(`/cash-register/status${queryString}`);
  }

  async openCashRegister(data: any): Promise<any> {
    return this.request('/cash-register/open', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getDailySummary(date?: string): Promise<any> {
    const queryString = date ? `?date=${date}` : '';
    return this.request(`/cash-register/daily-summary${queryString}`);
  }

  async createClosing(data: any): Promise<any> {
    return this.request('/cash-register/closing', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getClosingHistory(from_date?: string, to_date?: string, limit: number = 30): Promise<any[]> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    params.append('limit', limit.toString());
    return this.request(`/cash-register/closing-history?${params.toString()}`);
  }

  async getCashInDrawer(): Promise<any> {
    return this.request('/cash-register/cash-in-drawer');
  }

  // ============================================
  // REMINDERS ENDPOINTS
  // ============================================

  async getBirthdayReminders(days_ahead: number = 30): Promise<any> {
    return this.request(`/reminders/birthdays?days_ahead=${days_ahead}`);
  }

  async getDebtReminders(min_amount: number = 0): Promise<any> {
    return this.request(`/reminders/debts?min_amount=${min_amount}`);
  }

  async sendWhatsAppReminder(phone: string, message: string, type: string): Promise<any> {
    return this.request('/reminders/send-whatsapp', {
      method: 'POST',
      body: JSON.stringify({ phone, message, type })
    });
  }

  // ============================================
  // WASTE ENDPOINTS
  // ============================================

  async getWasteLogs(params?: any): Promise<WasteLog[]> {
    const queryString = new URLSearchParams(params).toString();
    return this.request<WasteLog[]>(`/waste${queryString ? `?${queryString}` : ''}`);
  }

  async getWasteSummary(from_date?: string, to_date?: string): Promise<any> {
    const queryString = new URLSearchParams();
    if (from_date) queryString.append('from_date', from_date);
    if (to_date) queryString.append('to_date', to_date);
    return this.request(`/waste/summary?${queryString.toString()}`);
  }

  async createWaste(waste: any): Promise<WasteLog> {
    return this.request<WasteLog>('/waste', {
      method: 'POST',
      body: JSON.stringify(waste),
    });
  }

  async deleteWaste(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/waste/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // BUSINESS ENDPOINTS
  // ============================================

  async getBusinessInfo(): Promise<any> {
    return this.request('/business');
  }

  async updateBusinessInfo(data: any): Promise<any> {
    return this.request('/business', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const api = new ApiClient();

// Initialize token from localStorage
const storedToken = localStorage.getItem('auth_token');
if (storedToken) {
  api.setToken(storedToken);
}
