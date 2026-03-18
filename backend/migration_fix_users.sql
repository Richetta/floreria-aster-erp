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

-- 3. (Opcional) Limpiar cualquier admin duplicado si fuera necesario
-- UPDATE users SET email = 'admin@floreriaaster.com' WHERE email = 'admin';

-- Verificar cambios
SELECT id, name, email, password_hash, google_id FROM users LIMIT 10;
