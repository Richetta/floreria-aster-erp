# ============================================
# PLAN DE IMPLEMENTACIÓN - 1 DÍA
# ============================================
# Este archivo contiene el plan completo
# para implementar el backend en un día
# ============================================

# HORARIO SUGERIDO:
# 08:00 - Setup infraestructura
# 10:00 - Backend + Auth
# 12:00 - Almuerzo
# 13:00 - Database + Migración
# 15:00 - API Productos
# 17:00 - Conectar Frontend
# 19:00 - Cena
# 20:00 - Testing + Deploy

# ============================================
# PASO 1: INSTALAR DEPENDENCIAS (15 min)
# ============================================

cd backend
npm install

# ============================================
# PASO 2: CONFIGURAR NEON DB (10 min)
# ============================================
# 1. Ir a https://neon.tech
# 2. Crear cuenta
# 3. Crear proyecto "aster-erp"
# 4. Copiar connection string
# 5. Pegar en .env

# ============================================
# PASO 3: INICIALIZAR DB (10 min)
# ============================================
# En la UI de Neon:
# 1. Ir a "SQL Editor"
# 2. Copiar contenido de schema.sql
# 3. Ejecutar

# O desde terminal:
# psql 'CONNECTION_STRING' -f schema.sql

# ============================================
# PASO 4: INICIAR BACKEND (2 min)
# ============================================

npm run dev

# ============================================
# PASO 5: TESTEAR API (5 min)
# ============================================

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@floreriaaster.com","password":"admin123"}'

# ============================================
# ESTADO ACTUAL (LO QUE YA ESTÁ HECHO)
# ============================================
# ✅ Schema de base de datos completo
# ✅ Backend con Fastify configurado
# ✅ Auth (login/register) implementado
# ✅ CRUD de productos implementado
# ✅ Sistema de stock con movimientos
# ✅ Row Level Security configurado
# ✅ Multi-tenant ready

# ============================================
# PRÓXIMOS PASOS (LO QUE FALTA)
# ============================================
# ⏳ Clientes CRUD
# ⏳ Pedidos CRUD
# ⏳ Conectar frontend al backend
# ⏳ Migrar datos de localStorage a PostgreSQL
# ⏳ Deploy a producción

# ============================================
# DEFAULT CREDENTIALS
# ============================================
# Email: admin@floreriaaster.com
# Password: admin123
# Business ID: 00000000-0000-0000-0000-000000000001
