-- ============================================
-- SUBSCRIPTION SYSTEM - Mi Jardín ERP
-- ============================================
-- Compatible con Supabase
-- Verifica tablas existentes antes de crear FK
-- ============================================

-- Enable UUID extension (Supabase ya lo tiene, pero por si acaso)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- Solo crear enums si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle') THEN
        CREATE TYPE billing_cycle AS ENUM ('monthly', 'annually');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_level') THEN
        CREATE TYPE support_level AS ENUM ('email', 'whatsapp', '247');
    END IF;
END $$;

-- ============================================
-- SUBSCRIPTION PLANS
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_short VARCHAR(50),
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_annually DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    badge_text VARCHAR(50),
    badge_color VARCHAR(20) DEFAULT '#4F7A5A',
    max_users INT,
    max_products INT,
    max_orders_per_month INT,
    max_categories INT,
    max_afip_invoices INT,
    max_branches INT DEFAULT 1,
    features JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
-- Nota: business_id UUID sin FK si businesses no existe
-- ============================================

DO $$ 
DECLARE
    has_businesses BOOLEAN;
BEGIN
    has_businesses := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses');
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        IF has_businesses THEN
            -- Con foreign key
            EXECUTE '
            CREATE TABLE subscriptions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
                plan_id UUID NOT NULL REFERENCES subscription_plans(id),
                status subscription_status DEFAULT ''trial'',
                billing_cycle billing_cycle DEFAULT ''monthly'',
                current_period_start DATE,
                current_period_end DATE,
                trial_ends_at DATE,
                cancel_at_period_end BOOLEAN DEFAULT FALSE,
                cancelled_at TIMESTAMP WITH TIME ZONE,
                cancellation_reason TEXT,
                locked_price_monthly DECIMAL(10,2),
                locked_price_annually DECIMAL(10,2),
                locked_until DATE,
                mp_subscription_id VARCHAR(255),
                mp_customer_id VARCHAR(255),
                mp_preapproval_id VARCHAR(255),
                last_mp_payment_id VARCHAR(255),
                orders_this_month INT DEFAULT 0,
                last_order_count_reset DATE,
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(business_id),
                CHECK (current_period_start <= current_period_end)
            )';
        ELSE
            -- Sin foreign key (Supabase sin schema principal)
            EXECUTE '
            CREATE TABLE subscriptions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                business_id UUID NOT NULL,
                plan_id UUID NOT NULL REFERENCES subscription_plans(id),
                status subscription_status DEFAULT ''trial'',
                billing_cycle billing_cycle DEFAULT ''monthly'',
                current_period_start DATE,
                current_period_end DATE,
                trial_ends_at DATE,
                cancel_at_period_end BOOLEAN DEFAULT FALSE,
                cancelled_at TIMESTAMP WITH TIME ZONE,
                cancellation_reason TEXT,
                locked_price_monthly DECIMAL(10,2),
                locked_price_annually DECIMAL(10,2),
                locked_until DATE,
                mp_subscription_id VARCHAR(255),
                mp_customer_id VARCHAR(255),
                mp_preapproval_id VARCHAR(255),
                last_mp_payment_id VARCHAR(255),
                orders_this_month INT DEFAULT 0,
                last_order_count_reset DATE,
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(business_id),
                CHECK (current_period_start <= current_period_end)
            )';
        END IF;
        
        RAISE NOTICE 'Tabla subscriptions creada correctamente';
    ELSE
        RAISE NOTICE 'Tabla subscriptions ya existe - saltando';
    END IF;
END $$;

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================
-- USAGE LOGS
-- ============================================

DO $$ 
DECLARE
    has_businesses BOOLEAN;
BEGIN
    has_businesses := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses');
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_usage_logs') THEN
        IF has_businesses THEN
            EXECUTE '
            CREATE TABLE subscription_usage_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
                month DATE NOT NULL,
                users_count INT DEFAULT 0,
                products_count INT DEFAULT 0,
                orders_count INT DEFAULT 0,
                categories_count INT DEFAULT 0,
                afip_invoices_count INT DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(business_id, month)
            )';
        ELSE
            EXECUTE '
            CREATE TABLE subscription_usage_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                business_id UUID NOT NULL,
                month DATE NOT NULL,
                users_count INT DEFAULT 0,
                products_count INT DEFAULT 0,
                orders_count INT DEFAULT 0,
                categories_count INT DEFAULT 0,
                afip_invoices_count INT DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(business_id, month)
            )';
        END IF;
        
        RAISE NOTICE 'Tabla subscription_usage_logs creada correctamente';
    ELSE
        RAISE NOTICE 'Tabla subscription_usage_logs ya existe - saltando';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usage_logs_business_month ON subscription_usage_logs(business_id, month DESC);

-- ============================================
-- SUBSCRIPTION EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    old_plan_id UUID REFERENCES subscription_plans(id),
    new_plan_id UUID REFERENCES subscription_plans(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);

-- ============================================
-- AGREGAR COLUMNAS A BUSINESS (si existe)
-- ============================================

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'current_plan_slug') THEN
            ALTER TABLE businesses ADD COLUMN current_plan_slug VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'subscription_status') THEN
            ALTER TABLE businesses ADD COLUMN subscription_status subscription_status DEFAULT 'trial';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'subscription_features') THEN
            ALTER TABLE businesses ADD COLUMN subscription_features JSONB DEFAULT '{}';
        END IF;
        
        RAISE NOTICE 'Columnas de suscripción agregadas a businesses';
    ELSE
        RAISE NOTICE 'Tabla businesses no encontrada - saltando alteración de columnas (esto es normal si usás Supabase sin schema local)';
    END IF;
END $$;

-- ============================================
-- INSERTAR PLANES INICIALES (idempotente)
-- ============================================

INSERT INTO subscription_plans (
    slug, name, name_short, description, 
    price_monthly, price_annually, 
    max_users, max_products, max_orders_per_month, max_categories, max_afip_invoices, max_branches,
    badge_text, sort_order,
    features
) VALUES 
(
    'semilla',
    'Semilla - Plan Gratuito',
    'Semilla',
    'Para empezar a organizar tu florería. Perfecto para probar el sistema.',
    0, 0,
    1, 50, 30, 1, 0, 1,
    NULL,
    1,
    '{"pos":true,"dashboard":"basic","kanban":true,"calendar_view":false,"reports":false,"cash_register":false,"waste_management":false,"barcode":false,"logistics":false,"reminders":false,"ocr_pricing":false,"packages":false,"supplier_purchases":false,"auto_restock":false,"crm_full":false,"stock_movements":false,"export_csv":false,"import_csv":false,"afip_integration":false,"mercadopago_integration":false,"multi_branch":false,"api_access":false,"white_label":false,"support_level":"email","watermark_tickets":true}'::jsonb
),
(
    'florecer',
    'Florecer - Plan Profesional',
    'Profesional',
    'El más elegido. Todo lo que necesitás para manejar tu florería como corresponde.',
    18000, 180000,
    5, 500, 200, 10, 0, 1,
    '⭐ MÁS POPULAR',
    2,
    '{"pos":true,"dashboard":"full","kanban":true,"calendar_view":true,"reports":true,"cash_register":true,"waste_management":true,"barcode":true,"logistics":"basic","reminders":true,"ocr_pricing":false,"packages":false,"supplier_purchases":false,"auto_restock":false,"crm_full":false,"stock_movements":false,"export_csv":true,"import_csv":true,"afip_integration":false,"mercadopago_integration":false,"multi_branch":false,"api_access":false,"white_label":false,"support_level":"email","watermark_tickets":false}'::jsonb
),
(
    'crecimiento',
    'Crecimiento - Plan Business',
    'Business',
    'Para florerías que quieren crecer. OCR, paquetes, CRM completo y más.',
    35000, 350000,
    15, 2000, NULL, NULL, 500, 1,
    NULL,
    3,
    '{"pos":true,"dashboard":"full","kanban":true,"calendar_view":true,"reports":true,"cash_register":true,"waste_management":true,"barcode":true,"logistics":"full","reminders":true,"ocr_pricing":true,"packages":true,"supplier_purchases":true,"auto_restock":true,"crm_full":true,"stock_movements":true,"export_csv":true,"import_csv":true,"afip_integration":true,"mercadopago_integration":true,"multi_branch":false,"api_access":false,"white_label":false,"support_level":"whatsapp","watermark_tickets":false}'::jsonb
),
(
    'jardin',
    'Jardín - Plan Enterprise',
    'Enterprise',
    'Todo ilimitado. Multi-sucursal, API access, white-label y soporte 24/7.',
    65000, 650000,
    NULL, NULL, NULL, NULL, NULL, NULL,
    NULL,
    4,
    '{"pos":true,"dashboard":"full","kanban":true,"calendar_view":true,"reports":true,"cash_register":true,"waste_management":true,"barcode":true,"logistics":"full","reminders":true,"ocr_pricing":true,"packages":true,"supplier_purchases":true,"auto_restock":true,"crm_full":true,"stock_movements":true,"export_csv":true,"import_csv":true,"afip_integration":true,"mercadopago_integration":true,"multi_branch":true,"api_access":true,"white_label":true,"support_level":"247","watermark_tickets":false}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    name_short = EXCLUDED.name_short,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_annually = EXCLUDED.price_annually,
    max_users = EXCLUDED.max_users,
    max_products = EXCLUDED.max_products,
    max_orders_per_month = EXCLUDED.max_orders_per_month,
    max_categories = EXCLUDED.max_categories,
    features = EXCLUDED.features,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (solo si las tablas existen)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
        DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
        CREATE TRIGGER update_subscription_plans_updated_at
            BEFORE UPDATE ON subscription_plans
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
        CREATE TRIGGER update_subscriptions_updated_at
            BEFORE UPDATE ON subscriptions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Función para resetear contador de pedidos mensual
CREATE OR REPLACE FUNCTION reset_monthly_order_counts()
RETURNS void AS $$
DECLARE
    current_month_start DATE;
BEGIN
    current_month_start := DATE_TRUNC('month', CURRENT_DATE);
    
    UPDATE subscriptions
    SET 
        orders_this_month = 0,
        last_order_count_reset = current_month_start
    WHERE 
        status IN ('active', 'trial')
        AND (last_order_count_reset IS NULL OR last_order_count_reset < current_month_start);
END;
$$ LANGUAGE plpgsql;

-- Función para incrementar contador de pedidos
CREATE OR REPLACE FUNCTION increment_order_count(p_business_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE subscriptions
    SET orders_this_month = orders_this_month + 1
    WHERE business_id = p_business_id
    AND status IN ('active', 'trial');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VISTAS
-- ============================================

-- Vista: suscripciones activas con info del plan
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT 
    s.id,
    s.business_id,
    b.name AS business_name,
    s.plan_id,
    p.slug AS plan_slug,
    p.name_short AS plan_name,
    s.status,
    s.billing_cycle,
    s.current_period_start,
    s.current_period_end,
    s.trial_ends_at,
    s.cancel_at_period_end,
    s.locked_price_monthly,
    s.locked_price_annually,
    s.orders_this_month,
    p.max_orders_per_month,
    p.features,
    CASE 
        WHEN s.trial_ends_at IS NOT NULL AND s.trial_ends_at < CURRENT_DATE THEN 'expired_trial'
        WHEN s.current_period_end < CURRENT_DATE THEN 'expired'
        ELSE 'valid'
    END AS validity_status
FROM subscriptions s
LEFT JOIN businesses b ON s.business_id = b.id
JOIN subscription_plans p ON s.plan_id = p.id
WHERE s.status IN ('active', 'trial');

-- Vista: métricas de uso por plan
CREATE OR REPLACE VIEW v_subscription_metrics AS
SELECT 
    p.slug AS plan_slug,
    p.name_short AS plan_name,
    COUNT(s.id) AS total_subscribers,
    COUNT(CASE WHEN s.status = 'active' THEN 1 END) AS active_subscribers,
    COUNT(CASE WHEN s.status = 'trial' THEN 1 END) AS trial_subscribers,
    COUNT(CASE WHEN s.cancel_at_period_end THEN 1 END) AS pending_cancellations,
    AVG(CASE 
        WHEN s.locked_price_monthly IS NOT NULL THEN s.locked_price_monthly
        WHEN s.billing_cycle = 'monthly' THEN p.price_monthly
        ELSE p.price_annually / 12
    END) AS avg_revenue_per_user
FROM subscription_plans p
LEFT JOIN subscriptions s ON p.id = s.plan_id
WHERE p.is_active = TRUE
GROUP BY p.slug, p.name_short;

-- ============================================
-- LISTO!
-- ============================================
-- Verificar: SELECT * FROM subscription_plans ORDER BY sort_order;
