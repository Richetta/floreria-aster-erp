-- Schema para Florería Aster ERP (PostgreSQL)

-- 1. Usuarios y Permisos
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'seller', 'driver')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Clientes (CRM)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    debt_balance DECIMAL(10,2) DEFAULT 0.00,
    birthday DATE,
    anniversary DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Categorías de Productos
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 4. Materias Primas / Flores (Stock base)
CREATE TABLE raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 10,
    unit_cost DECIMAL(10,2) DEFAULT 0.00,
    category_id UUID REFERENCES categories(id)
);

-- 5. Productos Finales y Regalería (Stock directo)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0.00,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    category_id UUID REFERENCES categories(id),
    tags TEXT[] DEFAULT '{}', -- NUEVO: Arreglo de tags visuales (Filtros: San Valentín, Oferta, etc.)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Paquetes y Combos (Antes: Ramos y Arreglos)
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    section_name VARCHAR(100) NOT NULL, -- Ej: 'Desayunos', 'Ramos', 'Combos' (Para organizar la UI)
    description TEXT,
    suggested_price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Relación de Paquetes con Materias Primas / Productos (Receta / Fórmula)
CREATE TABLE package_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    raw_material_id UUID REFERENCES raw_materials(id),
    product_id UUID REFERENCES products(id), -- Un paquete puede contener otros productos (ej: un peluche)
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    CHECK (
        (raw_material_id IS NOT NULL AND product_id IS NULL) OR 
        (raw_material_id IS NULL AND product_id IS NOT NULL)
    )
);

-- 7. Pedidos y Entregas
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assembling', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
    delivery_date TIMESTAMP WITH TIME ZONE,
    delivery_address TEXT,
    card_message TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    advance_payment DECIMAL(10,2) DEFAULT 0.00,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items del pedido (pueden ser Productos directos o Paquetes)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    package_id UUID REFERENCES packages(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    CHECK (
        (product_id IS NOT NULL AND package_id IS NULL) OR 
        (product_id IS NULL AND package_id IS NOT NULL)
    )
);

-- 8. Finanzas y Caja (Transacciones)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('sale', 'payment_received', 'expense', 'supplier_payment')),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'card', 'transfer')),
    reference_id UUID, -- Puede ser order_id, purchase_id, etc.
    user_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Proveedores
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    next_visit_date DATE,
    notes TEXT
);

-- Ingreso de mercadería
CREATE TABLE supplier_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id),
    total_amount DECIMAL(10,2) NOT NULL,
    invoice_document_url TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Gestión de Mermas y Desperdicios (Waste Management)
CREATE TABLE waste_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_material_id UUID REFERENCES raw_materials(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason VARCHAR(255) NOT NULL, -- Ej: "Marchita", "Rota", "Vencida"
    reported_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (product_id IS NOT NULL AND raw_material_id IS NULL) OR 
        (product_id IS NULL AND raw_material_id IS NOT NULL)
    )
);

-- 11. Logística y Rutas de Entrega
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id),
    delivery_status VARCHAR(50) DEFAULT 'assigned' CHECK (delivery_status IN ('assigned', 'in_transit', 'delivered', 'failed')),
    proof_photo_url TEXT,
    notes TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- 12. Historial del Sistema (Audit Logs)
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100), -- Ej: "orders", "stock", "prices"
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Configuración del Negocio
CREATE TABLE app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert defaults for settings
INSERT INTO app_settings (key, value) VALUES
('general_margins', '{"default": 40, "bouquets": 50}'::jsonb),
('store_hours', '{"open": "09:00", "close": "19:00"}'::jsonb);
