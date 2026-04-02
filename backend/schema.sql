-- ============================================
-- ASTER ERP - DATABASE SCHEMA (PRODUCTION)
-- ============================================
-- Diseñado para: PostgreSQL 16
-- Multi-tenant con Row Level Security
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'seller', 'driver', 'viewer');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'assembling', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE delivery_method AS ENUM ('pickup', 'delivery');
CREATE TYPE delivery_time_slot AS ENUM ('morning', 'afternoon', 'evening', 'allday');
CREATE TYPE stock_movement_type AS ENUM ('sale', 'order', 'purchase', 'adjustment', 'waste', 'return', 'transfer');
CREATE TYPE waste_reason AS ENUM ('damaged', 'wilted', 'expired', 'broken', 'lost', 'other');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_category AS ENUM ('sale', 'payment_received', 'expense', 'supplier_payment', 'waste', 'salary', 'rent', 'utilities', 'other');

-- ============================================
-- CORE TABLES
-- ============================================

-- Businesses (Multi-tenant)
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    currency VARCHAR(10) DEFAULT 'ARS',
    tax_rate DECIMAL(5,2) DEFAULT 21.00,
    default_margin DECIMAL(5,2) DEFAULT 40.00,
    opening_time TIME,
    closing_time TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- Nullable for Google-only users
    google_id VARCHAR(255) UNIQUE, -- Added for Google Sign-In
    role user_role NOT NULL DEFAULT 'viewer',
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, email)
);

-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    margin_percent DECIMAL(5,2),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    max_stock INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    is_barcode BOOLEAN DEFAULT FALSE,
    supplier_id UUID REFERENCES suppliers(id),
    tags TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_margin CHECK (margin_percent >= 0 AND margin_percent <= 100)
);

-- Price History
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_cost DECIMAL(10,2),
    old_price DECIMAL(10,2),
    new_cost DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    changed_by UUID REFERENCES users(id),
    reason VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type stock_movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Reservations
CREATE TABLE stock_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address_street VARCHAR(255),
    address_number VARCHAR(20),
    address_floor VARCHAR(20),
    address_city VARCHAR(100),
    debt_balance DECIMAL(10,2) DEFAULT 0.00,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    birthday DATE,
    anniversary DATE,
    important_date_name VARCHAR(255),
    important_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    last_order_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    status order_status NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    advance_payment DECIMAL(10,2) DEFAULT 0.00,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    delivery_method delivery_method NOT NULL,
    delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_time_slot delivery_time_slot DEFAULT 'allday',
    delivery_address JSONB,
    delivery_address_street VARCHAR(255),
    delivery_address_number VARCHAR(20),
    delivery_address_floor VARCHAR(20),
    delivery_address_city VARCHAR(100),
    delivery_address_reference TEXT,
    contact_phone VARCHAR(50),
    card_message TEXT,
    delivery_notes TEXT,
    internal_notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(business_id, order_number)
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    package_id UUID REFERENCES packages(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    product_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (product_id IS NOT NULL AND package_id IS NULL) OR
        (product_id IS NULL AND package_id IS NOT NULL)
    )
);

-- Packages (Ramos)
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    section VARCHAR(100) NOT NULL,
    description TEXT,
    suggested_price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Package Components
CREATE TABLE package_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    category VARCHAR(100),
    next_visit_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Supplier Products
CREATE TABLE supplier_products (
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
);

-- Supplier Purchases
CREATE TABLE supplier_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    total_amount DECIMAL(10,2) NOT NULL,
    invoice_document_url TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    purchase_number INTEGER NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, purchase_number)
);

-- Waste Logs
CREATE TABLE waste_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    reported_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App Settings
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, key)
);

-- ============================================
-- INDEXES (CRITICAL FOR PERFORMANCE)
-- ============================================

-- Products
CREATE INDEX idx_products_business ON products(business_id, is_active);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_products_business_stock ON products(business_id, stock_quantity);

-- Stock Movements
CREATE INDEX idx_stock_movements_business_product_date ON stock_movements(business_id, product_id, created_at DESC);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Orders
CREATE INDEX idx_orders_business_status ON orders(business_id, status);
CREATE INDEX idx_orders_business_date ON orders(business_id, delivery_date);
CREATE INDEX idx_orders_business_customer ON orders(business_id, customer_id);
CREATE INDEX idx_orders_business_payment ON orders(business_id, payment_status);
CREATE INDEX idx_orders_deleted ON orders(deleted_at) WHERE deleted_at IS NOT NULL;

-- Order Items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Customers
CREATE INDEX idx_customers_business ON customers(business_id, is_active);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_birthday ON customers(birthday);
CREATE INDEX idx_customers_anniversary ON customers(anniversary);

-- Transactions
CREATE INDEX idx_transactions_business_type ON transactions(business_id, type);
CREATE INDEX idx_transactions_business_category ON transactions(business_id, category);
CREATE INDEX idx_transactions_business_date ON transactions(business_id, created_at);

-- Price History
CREATE INDEX idx_price_history_business_product_date ON price_history(business_id, product_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (MULTI-TENANT)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy helper function
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_business_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for each table (example for products)
CREATE POLICY tenant_isolation_products ON products
    FOR ALL
    USING (business_id = get_current_business_id())
    WITH CHECK (business_id = get_current_business_id());

CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (business_id = get_current_business_id())
    WITH CHECK (business_id = get_current_business_id());

CREATE POLICY tenant_isolation_customers ON customers
    FOR ALL
    USING (business_id = get_current_business_id())
    WITH CHECK (business_id = get_current_business_id());

CREATE POLICY tenant_isolation_orders ON orders
    FOR ALL
    USING (business_id = get_current_business_id())
    WITH CHECK (business_id = get_current_business_id());

-- (Repeat for all tables...)

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Create default business
INSERT INTO businesses (id, name, tax_id, phone, email, currency) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Florería Aster', '20-12345678-9', '11-1234-5678', 'contacto@floreriaaster.com', 'ARS');

-- Create admin user (password: admin123)
INSERT INTO users (business_id, name, email, password_hash, role) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Administrador', 'admin@floreriaaster.com', '$2b$10$rH0zGzJvzJvzJvzJvzJvzOYvzJvzJvzJvzJvzJvzJvzJvzJvzJvz', 'admin');

-- Create default categories
INSERT INTO categories (business_id, name) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Ramos'),
    ('00000000-0000-0000-0000-000000000001', 'Flores'),
    ('00000000-0000-0000-0000-000000000001', 'Macetas'),
    ('00000000-0000-0000-0000-000000000001', 'Regalería'),
    ('00000000-0000-0000-0000-000000000001', 'Plantas Interior'),
    ('00000000-0000-0000-0000-000000000001', 'Plantas Exterior'),
    ('00000000-0000-0000-0000-000000000001', 'Tierra'),
    ('00000000-0000-0000-0000-000000000001', 'Insumos');

-- ============================================
-- VIEWS (USEFUL QUERIES)
-- ============================================

-- Available stock (considering reservations)
CREATE OR REPLACE VIEW v_available_stock AS
SELECT 
    p.id,
    p.name,
    p.stock_quantity,
    COALESCE(SUM(sr.quantity), 0) as reserved_quantity,
    p.stock_quantity - COALESCE(SUM(sr.quantity), 0) as available_quantity
FROM products p
LEFT JOIN stock_reservations sr ON p.id = sr.product_id AND sr.status = 'active'
GROUP BY p.id, p.name, p.stock_quantity;

-- Daily sales summary
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT 
    DATE(created_at) as sale_date,
    COUNT(*) as total_orders,
    SUM(total) as total_revenue,
    SUM(advance_payment) as total_advance
FROM orders
WHERE status != 'cancelled'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Products with low stock
CREATE OR REPLACE VIEW v_low_stock_products AS
SELECT 
    id,
    name,
    stock_quantity,
    min_stock,
    (min_stock - stock_quantity) as shortage
FROM products
WHERE stock_quantity < min_stock AND is_active = TRUE
ORDER BY shortage DESC;

-- Customer debts
CREATE OR REPLACE VIEW v_customer_debts AS
SELECT 
    id,
    name,
    phone,
    debt_balance,
    last_order_date
FROM customers
WHERE debt_balance > 0 AND is_active = TRUE
ORDER BY debt_balance DESC;
