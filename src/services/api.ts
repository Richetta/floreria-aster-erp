// ============================================
// API CLIENT - Florería Aster ERP
// ============================================

import { logger } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
  suggested_price: number;
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
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as any)['Authorization'] = `Bearer ${this.token}`;
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

      return response.json();
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
      localStorage.setItem('auth_token', response.token);
    }

    return response;
  }

  async register(name: string, email: string, password: string, role: 'admin' | 'seller' | 'viewer' = 'viewer'): Promise<User> {
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
    localStorage.removeItem('auth_token');
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

  async createUser(user: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'seller' | 'driver' | 'viewer';
    phone?: string;
  }): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, user: Partial<User> & { password?: string }): Promise<User> {
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

  async changePassword(current_password: string, new_password: string): Promise<{ success: boolean; message: string }> {
    return this.request('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
  }

  async getProfile(): Promise<User> {
    return this.request<User>('/users/profile/me');
  }

  // ============================================
  // REPORTS ENDPOINTS
  // ============================================

  async getSalesSummary(from_date?: string, to_date?: string): Promise<{
    total_sales: number;
    total_transactions: number;
    by_payment_method: { method: string; total: number; count: number }[];
  }> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    return this.request(`/reports/sales/summary${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getSalesByPeriod(from_date?: string, to_date?: string, group_by: 'day' | 'month' = 'day'): Promise<any[]> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    params.append('group_by', group_by);
    return this.request(`/reports/sales/by-period?${params.toString()}`);
  }

  async getTopProducts(from_date?: string, to_date?: string, limit: number = 10): Promise<{
    product_id: string;
    product_name: string;
    product_code: string;
    total_quantity: number;
    total_revenue: number;
    avg_price: number;
  }[]> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    params.append('limit', limit.toString());
    return this.request(`/reports/products/top?${params.toString()}`);
  }

  async getTopCustomers(from_date?: string, to_date?: string, limit: number = 10): Promise<{
    id: string;
    name: string;
    phone: string;
    email: string;
    debt_balance: number;
    total_orders: number;
    total_spent: number;
  }[]> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    params.append('limit', limit.toString());
    return this.request(`/reports/customers/top?${params.toString()}`);
  }

  async getProfits(from_date?: string, to_date?: string): Promise<{
    period: { from: string; to: string };
    summary: {
      total_revenue: number;
      total_expenses: number;
      total_profit: number;
      profit_margin: number;
    };
    by_product: {
      product_id: string;
      product_name: string;
      quantity_sold: number;
      total_revenue: number;
      total_cost: number;
      profit: number;
    }[];
  }> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    return this.request(`/reports/profits${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async exportSales(from_date?: string, to_date?: string): Promise<string> {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);

    const response = await fetch(`${API_BASE_URL}/reports/export/sales${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.text();
  }

  // ============================================
  // IMPORT/EXPORT ENDPOINTS
  // ============================================

  async parseFile(file: File): Promise<{
    method: string;
    filename: string;
    total_rows: number;
    data: any[];
    raw_rows: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/import/parse-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error parsing file');
    }

    return response.json();
  }

  async parseCSV(file: File): Promise<any> {
    return this.parseFile(file);
  }

  async importPrices(data: {
    code: string;
    name?: string;
    cost?: number;
    price?: number;
    stock?: number;
  }[], options: {
    update_costs?: boolean;
    update_prices?: boolean;
    update_stock?: boolean;
    auto_margin?: boolean;
    margin_percent?: number;
  }): Promise<{ updated: number; created: number; errors: any[] }> {
    return this.request('/import/import-prices', {
      method: 'POST',
      body: JSON.stringify({
        data,
        update_costs: options.update_costs ?? true,
        update_prices: options.update_prices ?? true,
        update_stock: options.update_stock ?? false,
        auto_margin: options.auto_margin ?? false,
        margin_percent: options.margin_percent ?? 50
      })
    });
  }

  async exportProductsTemplate(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/import/export-template`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.text();
  }

  async downloadCSV(filename: string, data: any[]): Promise<void> {
    const csv = this.convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header =>
          `"${String(row[header]).replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    return csv;
  }

  // ============================================
  // CASH REGISTER ENDPOINTS
  // ============================================

  async openCashRegister(data: {
    date: string;
    opening_balance: number;
    notes?: string;
  }): Promise<{ success: boolean; opening: any }> {
    return this.request('/cash-register/open', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getCashRegisterStatus(date?: string): Promise<{
    date: string;
    is_open: boolean;
    is_closed: boolean;
    opening: any | null;
    closing: any | null;
  }> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    return this.request(`/cash-register/status${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getDailySummary(date?: string): Promise<{
    date: string;
    sales: { total: number; cash: number; card: number; transfer: number; count: number };
    payments_received: { total: number; cash: number; card: number; transfer: number; count: number };
    expenses: { total: number; cash: number; transfer: number; count: number; by_category: { [key: string]: number } };
    supplier_payments: { total: number; transfer: number; count: number };
    balance: number;
    opening_balance: number;
    closing_balance: number;
    transactions: any[];
  }> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    return this.request(`/cash-register/daily-summary${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async createClosing(data: {
    date: string;
    opening_balance: number;
    observed_cash?: number;
    notes?: string;
  }): Promise<{ success: boolean; closing: any }> {
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
    return this.request(`/cash-register/closing-history${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getCashInDrawer(): Promise<{
    opening_balance: number;
    cash_in_drawer: number;
    transactions_count: number;
    last_updated: string;
  }> {
    return this.request('/cash-register/cash-in-drawer');
  }

  // ============================================
  // STOCK ENDPOINTS
  // ============================================

  async getStockMovements(params?: {
    product_id?: string;
    from_date?: string;
    to_date?: string;
    type?: string;
    limit?: number;
  }): Promise<{
    id: string;
    product_id: string;
    product_name: string;
    product_code: string;
    movement_type: string;
    quantity: number;
    balance_after: number;
    reference_type: string;
    notes: string | null;
    created_at: string;
  }[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/stock/movements${queryString ? `?${queryString}` : ''}`);
  }

  async getProductStockHistory(id: string, limit: number = 50): Promise<{
    product: {
      id: string;
      name: string;
      code: string;
      current_stock: number;
      min_stock: number;
    };
    summary: {
      current_stock: number;
      min_stock: number;
      total_movements: number;
      last_movement: string | null;
      by_type: { [key: string]: number };
    };
    movements: {
      movement_type: string;
      quantity: number;
      balance_after: number;
      reference_type: string;
      notes: string | null;
      created_at: string;
    }[];
  }> {
    return this.request(`/stock/product/${id}/history?limit=${limit}`);
  }

  async getLowStockProducts(): Promise<{
    id: string;
    name: string;
    code: string;
    stock_quantity: number;
    min_stock: number;
    shortage: number;
    category_id: string | null;
    price: number;
  }[]> {
    return this.request('/stock/low-stock');
  }

  async createStockAdjustment(data: {
    product_id: string;
    quantity: number;
    reason: string;
    notes?: string;
  }): Promise<{ success: boolean; movement: any; new_stock: number }> {
    return this.request('/stock/adjustment', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getStockSummary(): Promise<{
    total_products: number;
    total_stock: number;
    total_value_at_cost: number;
    total_value_at_price: number;
    low_stock_count: number;
    out_of_stock_count: number;
    movements_today: number;
  }> {
    return this.request('/stock/summary');
  }

  // ============================================
  // REMINDERS ENDPOINTS
  // ============================================

  async getBirthdayReminders(days_ahead: number = 30): Promise<{
    total: number;
    today: number;
    this_week: number;
    reminders: {
      type: string;
      customer_id: string;
      customer_name: string;
      phone: string;
      email: string;
      date: string;
      days_until: number;
      message: string;
      is_today: boolean;
      is_soon: boolean;
    }[];
  }> {
    return this.request(`/reminders/birthdays?days_ahead=${days_ahead}`);
  }

  async getDebtReminders(min_amount: number = 0): Promise<{
    total: number;
    total_amount: number;
    by_urgency: { high: number; medium: number; low: number };
    reminders: {
      type: string;
      customer_id: string;
      customer_name: string;
      phone: string;
      email: string;
      debt_amount: number;
      last_order_date: string | null;
      total_orders: number;
      message: string;
      urgency: 'high' | 'medium' | 'low';
    }[];
  }> {
    return this.request(`/reminders/debts?min_amount=${min_amount}`);
  }

  async sendWhatsAppReminder(phone: string, message: string, type: string): Promise<{
    success: boolean;
    reminder_id: string;
    whatsapp_url: string;
    message: string;
  }> {
    return this.request('/reminders/send-whatsapp', {
      method: 'POST',
      body: JSON.stringify({ phone, message, type })
    });
  }

  async sendEmailReminder(email: string, subject: string, message: string, type: string): Promise<{
    success: boolean;
    reminder_id: string;
    message: string;
  }> {
    return this.request('/reminders/send-email', {
      method: 'POST',
      body: JSON.stringify({ email, subject, message, type })
    });
  }

  async sendBulkReminders(customer_ids: string[], message_template: string, method: 'whatsapp' | 'email' | 'both'): Promise<{
    total: number;
    sent: number;
    failed: number;
    reminders: any[];
  }> {
    return this.request('/reminders/send-bulk', {
      method: 'POST',
      body: JSON.stringify({ customer_ids, message_template, method })
    });
  }

  async getReminderHistory(limit: number = 50): Promise<{
    id: string;
    action: string;
    customer_name: string;
    method: string;
    message: string;
    created_at: string;
  }[]> {
    return this.request(`/reminders/history?limit=${limit}`);
  }

  // ============================================
  // PRODUCTS ENDPOINTS
  // ============================================

  async getProducts(params?: { search?: string; category?: string; low_stock?: boolean; active?: boolean; limit?: number }): Promise<Product[]> {
    const queryString = new URLSearchParams(params as any).toString();
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

  async updateProductStock(id: string, quantity: number, type: 'adjustment' | 'purchase' | 'waste', reason?: string): Promise<any> {
    return this.request(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, type, reason }),
    });
  }

  // ============================================
  // CATEGORIES ENDPOINTS
  // ============================================

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  async createCategory(category: { name: string; parent_id?: string }): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
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

  async getCustomers(params?: { search?: string; has_debt?: boolean; limit?: number }): Promise<Customer[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request<Customer[]>(`/customers${queryString ? `?${queryString}` : ''}`);
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }

  async getCustomerHistory(id: string): Promise<Customer & { orders: Order[]; total_orders: number; total_spent: number }> {
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

  async registerPayment(id: string, amount: number, payment_method?: 'cash' | 'card' | 'transfer', notes?: string): Promise<any> {
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

  async getOrders(params?: { status?: string; customer_id?: string; from_date?: string; to_date?: string; delivery_method?: string; limit?: number }): Promise<Order[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request<Order[]>(`/orders${queryString ? `?${queryString}` : ''}`);
  }

  async getOrder(id: string): Promise<Order & { items: OrderItem[] }> {
    return this.request(`/orders/${id}`);
  }

  async createOrder(order: {
    customer_id: string; // "guest" or UUID
    guest_name?: string;
    guest_phone?: string;
    delivery_date: string;
    delivery_method: 'pickup' | 'delivery';
    delivery_time_slot?: 'morning' | 'afternoon' | 'evening' | 'allday';
    delivery_address?: any;
    contact_phone?: string;
    card_message?: string;
    notes?: string;
    items: { product_id?: string; package_id?: string; quantity: number; unit_price: number }[];
    advance_payment?: number;
  }): Promise<Order> {
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

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
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
  // TRANSACTIONS ENDPOINTS
  // ============================================

  async getTransactions(params?: { type?: string; category?: string; from_date?: string; to_date?: string; payment_method?: string; limit?: number }): Promise<Transaction[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request<Transaction[]>(`/transactions${queryString ? `?${queryString}` : ''}`);
  }

  async getTransaction(id: string): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${id}`);
  }

  async getFinancialSummary(from_date?: string, to_date?: string): Promise<{
    income: { total: number; cash: number; card: number; transfer: number };
    expense: { total: number; cash: number; transfer: number };
    balance: number;
  }> {
    const queryString = new URLSearchParams();
    if (from_date) queryString.append('from_date', from_date);
    if (to_date) queryString.append('to_date', to_date);
    return this.request(`/transactions/summary/period${queryString.toString() ? `?${queryString.toString()}` : ''}`);
  }

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
  }

  async createSale(sale: {
    total: number;
    payment_method: 'cash' | 'card' | 'transfer';
    customer_id?: string;
    items: {
      product_id?: string;
      package_id?: string;
      quantity: number;
      unit_price: number;
    }[];
    notes?: string;
  }): Promise<Transaction> {
    return this.request<Transaction>('/transactions/sale', {
      method: 'POST',
      body: JSON.stringify(sale),
    });
  }

  async createPurchase(purchase: {
    supplier_id: string;
    payment_method: 'cash' | 'transfer';
    items: {
      product_id: string;
      quantity: number;
      cost: number;
    }[];
    notes?: string;
  }): Promise<Transaction> {
    return this.request<Transaction>('/transactions/purchase', {
      method: 'POST',
      body: JSON.stringify(purchase),
    });
  }

  async createExpense(expense: {
    amount: number;
    category: string;
    payment_method: 'cash' | 'transfer';
    description: string;
    notes?: string;
  }): Promise<Transaction> {
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
  // PACKAGES ENDPOINTS
  // ============================================

  async getPackages(params?: { section?: string; is_active?: boolean; search?: string; limit?: number }): Promise<Package[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request<Package[]>(`/packages${queryString ? `?${queryString}` : ''}`);
  }

  async getPackage(id: string): Promise<Package> {
    return this.request<Package>(`/packages/${id}`);
  }

  async getPackageAvailability(id: string): Promise<{ available: boolean; missing_components: any[]; missingComponents: any[] }> {
    return this.request(`/packages/${id}/availability`);
  }

  async createPackage(pkg: {
    name: string;
    section: string;
    description?: string;
    price: number;
    is_active?: boolean;
    components: { product_id: string; quantity: number }[];
  }): Promise<Package> {
    return this.request<Package>('/packages', {
      method: 'POST',
      body: JSON.stringify({ ...pkg, components: pkg.components }),
    });
  }

  async updatePackage(id: string, pkg: Partial<Package>): Promise<Package> {
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

  // ============================================
  // SUPPLIERS ENDPOINTS
  // ============================================

  async getSuppliers(params?: { category?: string; search?: string; limit?: number }): Promise<Supplier[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request<Supplier[]>(`/suppliers${queryString ? `?${queryString}` : ''}`);
  }

  async getSupplier(id: string): Promise<Supplier & { purchases: any[] }> {
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
  // WASTE ENDPOINTS
  // ============================================

  async getWasteLogs(params?: { from_date?: string; to_date?: string; reason?: string; product_id?: string; limit?: number }): Promise<WasteLog[]> {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request<WasteLog[]>(`/waste${queryString ? `?${queryString}` : ''}`);
  }

  async getWasteSummary(from_date?: string, to_date?: string): Promise<{
    total_loss: number;
    by_reason: Record<string, number>;
    top_products: { product_id: string; product_name: string; total_amount: number; count: number }[];
    by_date: Record<string, number>;
    logs: WasteLog[];
  }> {
    const queryString = new URLSearchParams();
    if (from_date) queryString.append('from_date', from_date);
    if (to_date) queryString.append('to_date', to_date);
    return this.request(`/waste/summary${queryString.toString() ? `?${queryString.toString()}` : ''}`);
  }

  async createWaste(waste: {
    product_id: string;
    quantity: number;
    reason: 'Deterioro natural' | 'Rotura de proveedor' | 'Rotura en local' | 'Vencimiento' | 'Robo/Extravío' | 'Otro';
    notes?: string;
  }): Promise<WasteLog> {
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
