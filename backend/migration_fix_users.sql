-- ============================================
-- MIGRACIÓN: Soporte para Google Login
-- ============================================
-- Aplicar en la base de datos de producción (Supabase/Railway)
-- ============================================

-- 1. Hacer que password_hash sea opcional
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Agregar columna google_id si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='google_id') THEN
        ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
    END IF;
END $$;

-- 3. Crear tabla de actividad si no existe
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

-- Índices para actividad
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_business_id ON user_activity(business_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- Verificar cambios
SELECT id, name, email, password_hash, google_id FROM users LIMIT 10;
SELECT count(*) as activity_count FROM user_activity;
