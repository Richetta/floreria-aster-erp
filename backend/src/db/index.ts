import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { config } from '../config/index.js';

// ============================================
// DATABASE TYPE DEFINITIONS
// ============================================

export interface Database {
  businesses: BusinessesTable;
  users: UsersTable;
  categories: CategoriesTable;
  brands: BrandsTable;
  products: ProductsTable;
  price_history: PriceHistoryTable;
  stock_movements: StockMovementsTable;
  stock_reservations: StockReservationsTable;
  customers: CustomersTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  packages: PackagesTable;
  package_components: PackageComponentsTable;
  suppliers: SuppliersTable;
  supplier_products: SupplierProductsTable;
  supplier_purchases: SupplierPurchasesTable;
  purchases: PurchasesTable;
  waste_logs: WasteLogsTable;
  transactions: TransactionsTable;
  refresh_tokens: RefreshTokensTable;
  audit_logs: AuditLogsTable;
  user_activity: UserActivityTable;
  user_invitations: UserInvitationsTable;
  internal_comments: InternalCommentsTable;
  app_settings: AppSettingsTable;
  subscription_plans: SubscriptionPlansTable;
  subscriptions: SubscriptionsTable;
  subscription_usage_logs: SubscriptionUsageLogsTable;
  subscription_events: SubscriptionEventsTable;
  live_cart: LiveCartTable;
  custom_filters: CustomFiltersTable;
  custom_filter_options: CustomFilterOptionsTable;
  product_custom_filter_values: ProductCustomFilterValuesTable;
}

// ============================================
// TABLE INTERFACES
// ============================================

interface BusinessesTable {
  id: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
  tax_rate: number;
  default_margin: number;
  opening_time: string | null;
  closing_time: string | null;
  created_at: Date;
  updated_at: Date;
}

interface UsersTable {
  id: string;
  business_id: string;
  name: string;
  username: string | null;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expiry: number | null;
  google_calendar_enabled: boolean | null;
  role: 'owner' | 'admin' | 'employee' | 'finance' | 'delivery' | 'viewer';
  phone: string | null;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface CategoriesTable {
  id: string;
  business_id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface BrandsTable {
  id: string;
  business_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

interface ProductsTable {
  id: string;
  business_id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  cost: number;
  price: number;
  margin_percent: number | null;
  stock_quantity: number;
  min_stock: number;
  max_stock: number | null;
  is_active: boolean;
  is_barcode: boolean;
  supplier_id: string | null;
  tags: string[];
  images: string[];
  // Sales tracking fields (for Recientes and Top tabs in POS)
  sales_count: number | null;
  last_sale_date: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface PriceHistoryTable {
  id: string;
  business_id: string;
  product_id: string;
  old_cost: number | null;
  old_price: number | null;
  new_cost: number;
  new_price: number;
  changed_by: string | null;
  reason: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

interface StockMovementsTable {
  id: string;
  business_id: string;
  product_id: string;
  movement_type: 'sale' | 'order' | 'purchase' | 'adjustment' | 'waste' | 'return' | 'transfer';
  quantity: number;
  balance_after: number;
  reference_type: string;
  reference_id: string;
  user_id: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  deleted_at: Date | null;
}

interface StockReservationsTable {
  id: string;
  business_id: string;
  product_id: string;
  order_id: string;
  quantity: number;
  status: string;
  expires_at: Date | null;
  created_at: Date;
}

interface CustomersTable {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string | null;
  address_street: string | null;
  address_number: string | null;
  address_floor: string | null;
  address_city: string | null;
  debt_balance: number;
  credit_limit: number;
  birthday: Date | null;
  anniversary: Date | null;
  important_date_name: string | null;
  important_date: Date | null;
  notes: string | null;
  is_active: boolean;
  total_orders: number;
  total_spent: number;
  last_order_date: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface OrdersTable {
  id: string;
  business_id: string;
  order_number: number;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  status: 'pending' | 'confirmed' | 'assembling' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  subtotal: number;
  discount: number;
  total_amount: number;
  advance_payment: number;
  payment_method: string | null;
  payment_status: string | null;
  delivery_method: 'pickup' | 'delivery';
  delivery_date: Date;
  delivery_time_slot: 'morning' | 'afternoon' | 'evening' | 'allday';
  delivery_address: Record<string, any> | null;
  delivery_address_street: string | null;
  delivery_address_number: string | null;
  delivery_address_floor: string | null;
  delivery_address_city: string | null;
  delivery_address_reference: string | null;
  contact_phone: string | null;
  card_message: string | null;
  delivery_notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  delivered_at: Date | null;
  deleted_at: Date | null;
}

interface OrderItemsTable {
  id: string;
  business_id: string;
  order_id: string;
  product_id: string | null;
  package_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  product_snapshot: Record<string, any> | null;
  created_at: Date;
  deleted_at: Date | null;
}

interface PackagesTable {
  id: string;
  business_id: string;
  name: string;
  section: string;
  description: string | null;
  suggested_price: number;
  is_active: boolean;
  images: string[];
  tags: string[];
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface PackageComponentsTable {
  id: string;
  business_id: string;
  package_id: string;
  product_id: string;
  quantity: number;
  display_order: number;
  created_at: Date;
}

interface SuppliersTable {
  id: string;
  business_id: string;
  name: string;
  contact_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  category: string | null;
  next_visit_date: Date | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface SupplierProductsTable {
  id: string;
  supplier_id: string;
  product_id: string | null;
  supplier_product_name: string;
  supplier_product_code: string;
  cost: number;
  min_order_quantity: number;
  last_purchase_date: Date | null;
  last_purchase_cost: number | null;
}

interface SupplierPurchasesTable {
  id: string;
  business_id: string;
  supplier_id: string;
  total_amount: number;
  invoice_document_url: string | null;
  created_by: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

interface PurchasesTable {
  id: string;
  business_id: string;
  purchase_number: number;
  supplier_id: string;
  items: Record<string, any>;
  subtotal: number;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  created_by: string | null;
  created_at: Date;
}

interface WasteLogsTable {
  id: string;
  business_id: string;
  product_id: string;
  quantity: number;
  reason: string;
  notes: string | null;
  reported_by: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

interface TransactionsTable {
  id: string;
  business_id: string;
  type: string;
  category: string;
  amount: number;
  payment_method: string | null;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

interface RefreshTokensTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

interface AuditLogsTable {
  id: string;
  business_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

interface AppSettingsTable {
  id: string;
  business_id: string;
  key: string;
  value: Record<string, any>;
  updated_at: Date;
}

interface UserActivityTable {
  id: string;
  user_id: string;
  business_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

interface LiveCartTable {
  id: string;
  business_id: string;
  user_id: string;
  cart_data: any;
  updated_at: Date;
}

interface UserInvitationsTable {
  id: string;
  business_id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

interface InternalCommentsTable {
  id: string;
  business_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  content: string;
  created_at: Date;
  updated_at: Date;
}

interface CustomFiltersTable {
  id: string;
  business_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

interface CustomFilterOptionsTable {
  id: string;
  business_id: string;
  custom_filter_id: string;
  value: string;
  created_at: Date;
}

interface ProductCustomFilterValuesTable {
  business_id: string;
  product_id: string;
  option_id: string;
}

// ============================================
// SUBSCRIPTION SYSTEM TABLES
// ============================================

interface SubscriptionPlansTable {
  id: string;
  slug: string;
  name: string;
  name_short: string | null;
  description: string | null;
  price_monthly: number;
  price_annually: number;
  is_active: boolean;
  sort_order: number;
  badge_text: string | null;
  badge_color: string;
  max_users: number | null;
  max_products: number | null;
  max_orders_per_month: number | null;
  max_categories: number | null;
  max_afip_invoices: number | null;
  max_branches: number;
  features: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionsTable {
  id: string;
  business_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  billing_cycle: 'monthly' | 'annually';
  current_period_start: Date | null;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  cancel_at_period_end: boolean;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  locked_price_monthly: number | null;
  locked_price_annually: number | null;
  locked_until: Date | null;
  mp_subscription_id: string | null;
  mp_customer_id: string | null;
  mp_preapproval_id: string | null;
  last_mp_payment_id: string | null;
  orders_this_month: number;
  last_order_count_reset: Date | null;
  admin_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionUsageLogsTable {
  id: string;
  business_id: string;
  month: Date;
  users_count: number;
  products_count: number;
  orders_count: number;
  categories_count: number;
  afip_invoices_count: number;
  created_at: Date;
}

interface SubscriptionEventsTable {
  id: string;
  subscription_id: string;
  event_type: string;
  old_plan_id: string | null;
  new_plan_id: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool })
});

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function setBusinessId(businessId: string): Promise<void> {
  await sql`SELECT set_config('app.current_business_id', ${businessId}, true)`.execute(db);
}

export async function getBusinessPlan(businessId: string) {
  const result = await db
    .selectFrom('subscriptions as s')
    .innerJoin('subscription_plans as p', 's.plan_id', 'p.id')
    .select(['p.slug', 's.status', 's.trial_ends_at'])
    .where('s.business_id', '=', businessId)
    .where('s.status', 'in', ['active', 'trial'])
    .executeTakeFirst();
  
  return result || { slug: 'semilla', status: 'free', trial_ends_at: null };
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`.execute(db);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
