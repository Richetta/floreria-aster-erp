import { sql } from 'kysely';
import { db } from './index.js';

/**
 * Emergency Migrations - Runs on server startup to ensure critical tables exist.
 * This is used to fix production issues where manual SQL migration might be missed.
 */
export async function runEmergencyMigrations() {
  console.log('--- STARTING EMERGENCY MIGRATIONS ---');

  try {
    // 1. Ensure supplier_products table exists
    await sql`
      CREATE TABLE IF NOT EXISTS supplier_products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id),
        supplier_product_name VARCHAR(255),
        supplier_product_code VARCHAR(100),
        cost DECIMAL(10,2) NOT NULL,
        min_order_quantity INTEGER DEFAULT 1,
        last_purchase_date TIMESTAMP WITH TIME ZONE,
        last_purchase_cost DECIMAL(10,2),
        UNIQUE(supplier_id, supplier_product_code)
      )
    `.execute(db);
    console.log('✔ Table supplier_products verified/created');

    // 2. Ensure supplier_id exists in products table
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id)`.execute(db);
      console.log('✔ Column supplier_id added to products table');
    } catch (err) {
      // Column might already exist, which is fine
      console.log('ℹ Column supplier_id in products table (already exists or error handled)');
    }

    // 3. Ensure brand_id exists in products table and brands table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS brands (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(business_id, name)
        )
      `.execute(db);
      console.log('✔ Table brands verified/created');

      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id)`.execute(db);
      console.log('✔ Column brand_id added to products table');

      // Enable RLS on brands
      await sql`ALTER TABLE brands ENABLE ROW LEVEL SECURITY`.execute(db);

      // Create RLS policy for brands (drop first if exists to avoid error)
      try {
        await sql`DROP POLICY IF EXISTS tenant_isolation_brands ON brands`.execute(db);
      } catch (e) {
        // Policy might not exist
      }

      await sql`
        CREATE POLICY tenant_isolation_brands ON brands
        FOR ALL
        USING (business_id = get_current_business_id())
        WITH CHECK (business_id = get_current_business_id())
      `.execute(db);
      console.log('✔ RLS policy for brands verified/created');

      // Create index
      await sql`CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)`.execute(db);
      console.log('✔ Index idx_products_brand verified/created');

      // Create trigger for updated_at
      try {
        await sql`
          CREATE TRIGGER update_brands_updated_at 
          BEFORE UPDATE ON brands
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
        `.execute(db);
        console.log('✔ Trigger update_brands_updated_at verified/created');
      } catch (e) {
        // Trigger might already exist
      }
    } catch (err) {
      console.log('ℹ Brands migration (already exists or error handled)');
    }

    // 3.5. Ensure live_cart table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS live_cart (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          cart_data JSONB NOT NULL DEFAULT '[]',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(business_id, user_id)
        )
      `.execute(db);
      console.log('✔ Table live_cart verified/created');
    } catch (err) {
      console.log('ℹ Table live_cart creation (error handled or already exists)');
    }

    // 3.6. Ensure custom_filters tables exist
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS custom_filters (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `.execute(db);
      
      await sql`
        CREATE TABLE IF NOT EXISTS custom_filter_options (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          custom_filter_id UUID NOT NULL REFERENCES custom_filters(id) ON DELETE CASCADE,
          value VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `.execute(db);

      await sql`
        CREATE TABLE IF NOT EXISTS product_custom_filter_values (
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          option_id UUID NOT NULL REFERENCES custom_filter_options(id) ON DELETE CASCADE,
          PRIMARY KEY (product_id, option_id)
        )
      `.execute(db);
      console.log('✔ Custom filters tables verified/created');
    } catch (err) {
      console.log('ℹ Custom filters migration error handled');
    }

    // 4. Ensure RLS (Row Level Security) is enabled and configured
    // This is CRITICAL for multi-tenant data isolation
    await sql`
      CREATE OR REPLACE FUNCTION get_current_business_id()
      RETURNS UUID AS $$
      BEGIN
          RETURN NULLIF(current_setting('app.current_business_id', true), '')::UUID;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `.execute(db);
    console.log('✔ RLS helper function get_current_business_id() verified/created');

    // 4.5 FIX: Final role and account normalization
    // 1. Ensure all users are owners (as requested: "every registered account is an admin")
    // 2. Set primary user of each business to have username 'admin' and name 'Administrador'
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50)`.execute(db);
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)`.execute(db);
      
      // Promote everyone to owner
      await sql`UPDATE users SET role = 'owner' WHERE role != 'owner' OR role IS NULL`.execute(db);
      
      // For each business, pick the oldest user and set them as the primary 'admin'
      // Also set a default password 'admin' if they don't have one (hashed with bcrypt: $2b$10$...)
      await sql`
        UPDATE users 
        SET name = 'Administrador', 
            username = 'admin',
            password_hash = COALESCE(password_hash, '$2b$10$rD/vMwS0y4DJiXKfabu1.ezLYHzWvE85.FEMlIuItE8XTh5tYBDAi')
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY business_id ORDER BY created_at ASC) as rn
            FROM users
          ) t WHERE rn = 1
        ) AND (username IS NULL OR username = '' OR username = 'admin')
      `.execute(db);

      console.log('✔ All accounts normalized: Roles set to owner, primary usernames set to admin, and default passwords ensured.');
    } catch (err) {
      console.error('❌ Role and account normalization failed:', err);
    }

    // Enable RLS on all multi-tenant tables
    const tablesToEnableRls = [
      'users', 'categories', 'brands', 'customers', 'price_history', 'stock_movements',
      'stock_reservations', 'orders', 'packages', 'suppliers', 'package_components',
      'waste_logs', 'app_settings', 'transactions', 'user_activity', 'order_items',
      'products', 'businesses', 'live_cart', 'custom_filters', 'custom_filter_options', 'product_custom_filter_values'
    ];

    for (const table of tablesToEnableRls) {
      try {
        await sql`ALTER TABLE ${sql.id(table)} ENABLE ROW LEVEL SECURITY`.execute(db);
        console.log(`✔ RLS enabled on ${table}`);
      } catch (err) {
        console.log(`ℹ RLS already enabled or table ${table} not found`);
      }
    }

    // Create/update RLS policies for critical tables
    const policyDefinitions = [
      { table: 'products', name: 'tenant_isolation_products' },
      { table: 'customers', name: 'tenant_isolation_customers' },
      { table: 'brands', name: 'tenant_isolation_brands' },
      { table: 'transactions', name: 'tenant_isolation_transactions' },
      { table: 'suppliers', name: 'tenant_isolation_suppliers' },
      { table: 'stock_movements', name: 'tenant_isolation_stock_movements' },
      { table: 'packages', name: 'tenant_isolation_packages' },
      { table: 'package_components', name: 'tenant_isolation_package_components' },
      { table: 'orders', name: 'tenant_isolation_orders' },
      { table: 'order_items', name: 'tenant_isolation_order_items' },
      { table: 'categories', name: 'tenant_isolation_categories' },
      { table: 'users', name: 'tenant_isolation_users' },
      { table: 'live_cart', name: 'tenant_isolation_live_cart' },
      { table: 'custom_filters', name: 'tenant_isolation_custom_filters' },
      { table: 'custom_filter_options', name: 'tenant_isolation_custom_filter_options' },
      { table: 'product_custom_filter_values', name: 'tenant_isolation_product_custom_filter_values' },
    ];

    for (const { table, name } of policyDefinitions) {
      try {
        await sql`
          DROP POLICY IF EXISTS ${sql.raw(name)} ON ${sql.id(table)};
          CREATE POLICY ${sql.raw(name)} ON ${sql.id(table)}
            FOR ALL
            USING (business_id = get_current_business_id())
            WITH CHECK (business_id = get_current_business_id());
        `.execute(db);
        console.log(`✔ RLS policy ${name} created on ${table}`);
      } catch (err) {
        console.log(`ℹ RLS policy ${name} on ${table} - skipped (table may not exist or policy exists)`);
      }
    }

    console.log('--- EMERGENCY MIGRATIONS COMPLETED ---');
  } catch (error) {
    console.error('❌ EMERGENCY MIGRATIONS FAILED:', error);
  }
}

/**
 * Google Calendar Integration Migrations
 * Adds required columns for storing Google OAuth tokens and Calendar event IDs.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export async function runGoogleCalendarMigrations() {
  console.log('--- GOOGLE CALENDAR MIGRATIONS ---');
  try {
    // Columns on users table
    const userColumns = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry BIGINT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gcal_sync_on_create BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gcal_sync_on_update BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gcal_sync_on_cancel BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gcal_reminder_24h_email BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS gcal_reminder_1h_popup BOOLEAN DEFAULT TRUE`,
    ];

    // Columns on orders table
    const orderColumns = [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_event_id TEXT`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_synced_at TIMESTAMP WITH TIME ZONE`,
    ];

    for (const stmt of [...userColumns, ...orderColumns]) {
      try {
        await sql`${sql.raw(stmt)}`.execute(db);
      } catch (e) {
        // Column already exists - safe to ignore
      }
    }

    console.log('✔ Google Calendar columns verified/created');
  } catch (error) {
    console.error('❌ Google Calendar migrations failed (non-fatal):', error);
  }
}



export async function runSubscriptionMigrations() {
  console.log('--- SUBSCRIPTION MIGRATIONS ---');
  try {
    await sql`CREATE TABLE IF NOT EXISTS subscription_plans (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), slug VARCHAR(50) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, name_short VARCHAR(100) NOT NULL, description TEXT, price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0, price_annually DECIMAL(10,2) NOT NULL DEFAULT 0, max_users INTEGER, max_products INTEGER, max_orders_per_month INTEGER, max_categories INTEGER, max_afip_invoices INTEGER, max_branches INTEGER DEFAULT 1, features JSONB NOT NULL DEFAULT '{}', badge_text VARCHAR(100), badge_color VARCHAR(50), sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`.execute(db);
    console.log('? subscription_plans OK');
    await sql`CREATE TABLE IF NOT EXISTS subscriptions (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, plan_id UUID NOT NULL REFERENCES subscription_plans(id), status VARCHAR(50) NOT NULL DEFAULT 'trial', billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(), current_period_end TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month', trial_ends_at TIMESTAMP WITH TIME ZONE, cancel_at_period_end BOOLEAN DEFAULT false, cancelled_at TIMESTAMP WITH TIME ZONE, cancellation_reason TEXT, locked_price_monthly DECIMAL(10,2), locked_price_annually DECIMAL(10,2), orders_this_month INTEGER DEFAULT 0, last_order_count_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(), mp_preapproval_id VARCHAR(255), mp_subscription_id VARCHAR(255), last_mp_payment_id VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(business_id))`.execute(db);
    console.log('? subscriptions OK');
    await sql`CREATE TABLE IF NOT EXISTS subscription_events (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE, event_type VARCHAR(100) NOT NULL, old_plan_id UUID REFERENCES subscription_plans(id), new_plan_id UUID REFERENCES subscription_plans(id), metadata JSONB DEFAULT '{}', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`.execute(db);
    console.log('? subscription_events OK');
    const r = await sql`SELECT COUNT(*) as count FROM subscription_plans`.execute(db);
    if (parseInt((r.rows[0] as any).count, 10) === 0) {
      await sql`INSERT INTO subscription_plans (slug,name,name_short,description,price_monthly,price_annually,max_users,max_products,max_orders_per_month,max_categories,features,badge_text,sort_order) VALUES ('semilla','Plan Gratuito','Gratis','Gestion basica',0,0,1,50,30,1,'{}',NULL,0),('florecer','Plan Profesional','Profesional','Control total',45000,450000,5,500,200,10,'{}','MAS POPULAR',1)`.execute(db);
      console.log('? Default plans seeded');
    }

    // Cleanup any extra plans added by mistake in previous versions
    await sql`DELETE FROM subscription_plans WHERE slug NOT IN ('semilla', 'florecer')`.execute(db);
    
    // Ensure the existing 'florecer' plan is updated to the new pricing and higher limits
    await sql`UPDATE subscription_plans SET price_monthly = 45000, price_annually = 450000, max_users = 10, max_products = 10000, max_orders_per_month = 999999, max_categories = 100 WHERE slug = 'florecer'`.execute(db);
    
    await runCustomSubscriptionUpdates();

    console.log('--- SUBSCRIPTION MIGRATIONS COMPLETED ---');
  } catch (error) {
    console.error('Subscription migrations failed (non-fatal):', error);
  }
}

/**
 * Custom updates requested by user:
 * 1. richettajp@gmail.com and floreriaaster@gmail.com -> Florecer (Annual)
 * 2. Other existing accounts -> 15-day Trial
 * 3. New accounts -> Start with Free mode (handled in auth logic)
 */
export async function runCustomSubscriptionUpdates() {
  console.log('--- RUNNING CUSTOM SUBSCRIPTION UPDATES ---');
  try {
    // 1. Get the 'florecer' plan ID
    const planResult = await sql`SELECT id FROM subscription_plans WHERE slug = 'florecer'`.execute(db);
    const florecerPlanId = (planResult.rows[0] as any)?.id;

    if (!florecerPlanId) {
      console.error('❌ Plan "florecer" not found, skipping custom updates');
      return;
    }

    // 2. Identify businesses for the specific emails
    const specificEmails = ['richettajp@gmail.com', 'floreriaaster@gmail.com'];
    const usersResult = await sql`SELECT business_id, email FROM users WHERE email IN (${sql.join(specificEmails)})`.execute(db);
    const specificBusinessIds = usersResult.rows.map((u: any) => u.business_id);

    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    // Update specific businesses to Florecer Annual
    for (const businessId of specificBusinessIds) {
      await sql`
        INSERT INTO subscriptions (business_id, plan_id, status, billing_cycle, current_period_start, current_period_end, updated_at)
        VALUES (${businessId}, ${florecerPlanId}, 'active', 'annually', ${now}, ${oneYearLater}, ${now})
        ON CONFLICT (business_id) DO UPDATE SET
          plan_id = EXCLUDED.plan_id,
          status = 'active',
          billing_cycle = 'annually',
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          trial_ends_at = NULL,
          updated_at = EXCLUDED.updated_at
      `.execute(db);
      console.log(`✔ Business ${businessId} upgraded to Florecer Annual`);
    }

    // 3. Set all other existing businesses to a 15-day trial
    // We target businesses that are NOT in the specific list
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 15);

    // Get the 'semilla' plan ID for the trial if they don't have one? 
    // Actually, usually trial is on the paid plan features, but the user said "leave them in trial mode".
    // I'll assume they get the 'florecer' features during the trial.
    
    const otherBusinessesResult = await sql`
      SELECT id FROM businesses 
      WHERE id NOT IN (SELECT business_id FROM users WHERE email IN (${sql.join(specificEmails)}))
    `.execute(db);
    
    for (const b of otherBusinessesResult.rows as any) {
      // Upsert trial subscription
      await sql`
        INSERT INTO subscriptions (business_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at, updated_at)
        VALUES (${b.id}, ${florecerPlanId}, 'trial', 'monthly', ${now}, ${trialEnd}, ${trialEnd}, ${now})
        ON CONFLICT (business_id) DO UPDATE SET
          status = 'trial',
          trial_ends_at = EXCLUDED.trial_ends_at,
          updated_at = EXCLUDED.updated_at
        WHERE subscriptions.status != 'active' -- Don't overwrite active paying users if any
      `.execute(db);
    }
    console.log('✔ Existing accounts set to 15-day trial mode');

    console.log('--- CUSTOM SUBSCRIPTION UPDATES COMPLETED ---');
  } catch (error) {
    console.error('❌ Custom subscription updates failed:', error);
  }
}
