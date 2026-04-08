-- MIGRACIÓN: Sistema de Marcas y Jerarquía
-- ============================================

-- 1. Crear tabla de marcas
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, name)
);

-- 2. Habilitar RLS en brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_brands ON brands
    FOR ALL
    USING (business_id = get_current_business_id())
    WITH CHECK (business_id = get_current_business_id());

-- 3. Agregar brand_id a products
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- 4. Índice para rendimiento
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

-- 5. Trigger para updated_at en brands
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
