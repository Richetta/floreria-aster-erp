-- Migration: Enforce RLS on all existing tables
-- ============================================

-- Policy helper function
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_business_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Categories
DROP POLICY IF EXISTS tenant_isolation_categories ON categories;
CREATE POLICY tenant_isolation_categories ON categories FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Customers
DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Price History
DROP POLICY IF EXISTS tenant_isolation_price_history ON price_history;
CREATE POLICY tenant_isolation_price_history ON price_history FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Stock Movements
DROP POLICY IF EXISTS tenant_isolation_stock_movements ON stock_movements;
CREATE POLICY tenant_isolation_stock_movements ON stock_movements FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Stock Reservations
DROP POLICY IF EXISTS tenant_isolation_stock_reservations ON stock_reservations;
CREATE POLICY tenant_isolation_stock_reservations ON stock_reservations FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Orders
DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
CREATE POLICY tenant_isolation_orders ON orders FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Packages
DROP POLICY IF EXISTS tenant_isolation_packages ON packages;
CREATE POLICY tenant_isolation_packages ON packages FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Suppliers
DROP POLICY IF EXISTS tenant_isolation_suppliers ON suppliers;
CREATE POLICY tenant_isolation_suppliers ON suppliers FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Package Components
DROP POLICY IF EXISTS tenant_isolation_package_components ON package_components;
CREATE POLICY tenant_isolation_package_components ON package_components FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Waste Logs
DROP POLICY IF EXISTS tenant_isolation_waste_logs ON waste_logs;
CREATE POLICY tenant_isolation_waste_logs ON waste_logs FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- App Settings
DROP POLICY IF EXISTS tenant_isolation_app_settings ON app_settings;
CREATE POLICY tenant_isolation_app_settings ON app_settings FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Transactions
DROP POLICY IF EXISTS tenant_isolation_transactions ON transactions;
CREATE POLICY tenant_isolation_transactions ON transactions FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- User Activity
DROP POLICY IF EXISTS tenant_isolation_user_activity ON user_activity;
CREATE POLICY tenant_isolation_user_activity ON user_activity FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Order Items
DROP POLICY IF EXISTS tenant_isolation_order_items ON order_items;
CREATE POLICY tenant_isolation_order_items ON order_items FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Products
DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products FOR ALL USING (business_id = get_current_business_id()) WITH CHECK (business_id = get_current_business_id());

-- Businesses
DROP POLICY IF EXISTS tenant_isolation_businesses ON businesses;
CREATE POLICY tenant_isolation_businesses ON businesses FOR ALL USING (id = get_current_business_id()) WITH CHECK (id = get_current_business_id());

-- Enable RLS on all these tables (idempotent)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
