-- ============================================================
-- DIAGNÓSTICO: Estado actual de usuarios y sus negocios
-- Ejecutar en Railway/Supabase para ver el problema
-- ============================================================

-- 1. Ver todos los usuarios y su business_id
SELECT 
  u.id,
  u.email,
  u.google_id,
  u.role,
  u.is_active,
  u.created_at,
  b.name as business_name,
  b.id as business_id
FROM users u
JOIN businesses b ON b.id = u.business_id
ORDER BY b.id, u.created_at;

-- 2. Detectar negocios con MÁS de un usuario (posibles mezclas)
SELECT 
  b.id as business_id,
  b.name as business_name,
  COUNT(u.id) as user_count,
  STRING_AGG(u.email, ', ') as emails,
  STRING_AGG(COALESCE(u.google_id, 'NO_GOOGLE'), ', ') as google_ids
FROM businesses b
JOIN users u ON u.business_id = b.id
GROUP BY b.id, b.name
HAVING COUNT(u.id) > 1
ORDER BY user_count DESC;

-- 3. Detectar usuarios SIN google_id (registrados con email/password)
SELECT id, email, role, created_at
FROM users
WHERE google_id IS NULL OR google_id = ''
ORDER BY created_at;

-- 4. Detectar duplicados de email (mismo email en distintos negocios - indica intentos de login cruzados)
SELECT email, COUNT(*) as count, ARRAY_AGG(business_id) as business_ids
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- ============================================================
-- SI SE NECESITA SEPARAR USUARIOS MAL MEZCLADOS:
-- (Ejecutar manualmente con cuidado después del diagnóstico)
-- ============================================================

-- Para cada usuario de Google que está en un negocio de otra persona:
-- 1. Crear su propio negocio
-- 2. Mover sus datos al nuevo negocio
-- (Esto debe hacerse caso por caso según el diagnóstico de arriba)
