-- ============================================
-- CREAR USUARIO ADMIN - Florería Aster ERP
-- ============================================
-- Ejecutar en Supabase → SQL Editor
-- Usuario: admin
-- Contraseña: admin
-- ============================================

-- Insertar o actualizar usuario admin
INSERT INTO users (
  id,
  business_id,
  name,
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at,
  last_login
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'admin',
  '$2b$10$ztaLdDrS/Be8gKUkg1q9uOkKS2Jidd6nhqbMxa4nJtUkiuzrw9KWG',
  'admin',
  true,
  NOW(),
  NOW(),
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Administrador',
  email = 'admin',
  password_hash = '$2b$10$ztaLdDrS/Be8gKUkg1q9uOkKS2Jidd6nhqbMxa4nJtUkiuzrw9KWG',
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- Verificar que se creó correctamente
SELECT id, name, email, role, is_active, created_at 
FROM users 
WHERE email = 'admin' OR id = '00000000-0000-0000-0000-000000000001';
