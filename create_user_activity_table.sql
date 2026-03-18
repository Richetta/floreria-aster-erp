-- ============================================
-- TABLA DE ACTIVIDAD DE USUARIOS - Florería Aster ERP
-- ============================================
-- Ejecutar en Supabase → SQL Editor
-- ============================================

-- Crear tabla de actividad de usuarios
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_business_id ON user_activity(business_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_resource ON user_activity(resource_type, resource_id);

-- Comentario
COMMENT ON TABLE user_activity IS 'Registro de actividad de usuarios en tiempo real';
COMMENT ON COLUMN user_activity.action IS 'Tipo de acción: login, logout, create, update, delete, view, export, etc.';
COMMENT ON COLUMN user_activity.resource_type IS 'Tipo de recurso: user, product, customer, order, transaction, etc.';
COMMENT ON COLUMN user_activity.details IS 'Detalles adicionales de la acción en formato JSON';

-- Verificar tablas creadas
SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'user_activity')
ORDER BY table_name;
