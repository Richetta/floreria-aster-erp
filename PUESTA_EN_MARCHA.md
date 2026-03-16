# 🚀 GUÍA DE PUESTA EN MARCHA - Florería Aster ERP

## ✅ COMPLETADO HASTA AHORA

### FASE 1: Backend ✅
- [x] 8 rutas de API completas (Auth, Productos, Clientes, Pedidos, Transacciones, Paquetes, Proveedores, Mermas)
- [x] Schema de base de datos PostgreSQL
- [x] Autenticación JWT
- [x] Multi-tenant con Row Level Security
- [x] Documentación de API

### FASE 2: Autenticación Frontend ✅
- [x] Login page
- [x] Protected routes
- [x] Auth store con Zustand
- [x] API client completo
- [x] Logout en sidebar

### FASE 3: Conexión Frontend-Backend ✅ (PARCIAL)
- [x] Módulo de Productos conectado
- [x] Módulo de Clientes conectado
- [x] Dashboard conectado
- [ ] Módulo de Pedidos (pendiente)
- [ ] Módulo de Finanzas (pendiente)
- [ ] Módulo de POS (pendiente)
- [ ] Módulo de Paquetes (pendiente)
- [ ] Módulo de Proveedores (pendiente)
- [ ] Módulo de Mermas (pendiente)

---

## 📋 PASOS PARA INICIAR EL SISTEMA

### 1. Configurar Base de Datos

#### Opción A: Neon.tech (Recomendado)
1. Ir a https://neon.tech
2. Crear cuenta gratuita
3. Crear nuevo proyecto "aster-erp"
4. Copiar el **Connection String** (se ve como `postgres://user:password@host/dbname`)
5. Ir a "SQL Editor" en Neon
6. Copiar y pegar TODO el contenido de `backend/schema.sql`
7. Ejecutar (botón "Run")

#### Opción B: PostgreSQL Local
1. Instalar PostgreSQL 16+
2. Crear base de datos:
```bash
createdb aster_erp
```
3. Ejecutar schema:
```bash
psql -d aster_erp -f backend/schema.sql
```

### 2. Configurar Variables de Entorno

#### Backend (.env)
Crear archivo `backend/.env`:
```env
DATABASE_URL=tu_connection_string_de_neon
JWT_SECRET=tu_secreto_super_seguro_cambialo
PORT=3000
NODE_ENV=development
```

**Importante:** 
- `DATABASE_URL`: El connection string de Neon
- `JWT_SECRET`: Cualquier string largo (ej: `aster-erp-secret-key-2026-change-me`)

#### Frontend (.env)
Crear archivo `.env` en la raíz:
```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Instalar Dependencias

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
# Desde la raíz del proyecto
npm install
```

### 4. Iniciar el Sistema

#### Terminal 1: Backend
```bash
cd backend
npm run dev
```
✅ Deberías ver: `🚀 Server running at http://localhost:3000`

#### Terminal 2: Frontend
```bash
# Desde la raíz
npm run dev
```
✅ Deberías ver: `Local: http://localhost:5173/`

---

## 🔐 CREDENCIALES DE DEMOSTRACIÓN

Al ejecutar el schema por primera vez, se crea un usuario admin:

```
Email: admin@floreriaaster.com
Contraseña: admin123
```

---

## 🧪 PROBAR LA CONEXIÓN

### 1. Testear Backend Directamente

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@floreriaaster.com","password":"admin123"}'
```

Deberías recibir un token JWT y datos de usuario.

### 2. Testear Frontend

1. Abrir http://localhost:5173
2. Debería redirigir automáticamente a `/login`
3. Ingresar credenciales de admin
4. Debería ir al Dashboard

### 3. Verificar Carga de Datos

En el Dashboard:
- Debería mostrar "Cargando..." inicialmente
- Luego mostrar los KPIs (pueden estar vacíos si no hay datos)

En Productos:
- Ir a `/productos`
- Debería mostrar la lista vacía o con datos si cargaste
- Crear un producto de prueba
- Debería aparecer en la lista

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: "Failed to fetch" en el frontend

**Causa:** El backend no está corriendo o la URL está mal

**Solución:**
1. Verificar que el backend esté corriendo en `http://localhost:3000`
2. Verificar que `.env` del frontend tenga `VITE_API_URL=http://localhost:3000/api`
3. Reiniciar el frontend después de cambiar el .env

### Error: "Database connection failed"

**Causa:** El connection string está mal o la DB no existe

**Solución:**
1. Verificar que `backend/.env` tenga el `DATABASE_URL` correcto
2. En Neon, verificar que el proyecto esté activo
3. Reiniciar el backend después de cambiar el .env

### Error: "Token expired" o "Unauthorized"

**Causa:** El JWT expiró (dura 15 minutos)

**Solución:**
1. Cerrar sesión
2. Volver a loguearse
3. O cambiar `expiresIn` en `backend/src/server.ts` a más tiempo

### Error: "Table does not exist"

**Causa:** El schema no se ejecutó correctamente

**Solución:**
1. En Neon, ir a "Tables" y verificar que existan las tablas
2. Si no existen, volver a ejecutar `backend/schema.sql`

### El login no funciona

**Causa:** Las credenciales están mal o el usuario no existe

**Solución:**
1. Verificar que el schema se haya ejecutado correctamente
2. En Neon, consultar: `SELECT * FROM users;`
3. Debería haber un usuario con email `admin@floreriaaster.com`
4. Si no existe, crearlo manualmente con password hash:
```sql
-- Password: admin123
INSERT INTO users (business_id, name, email, password_hash, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'Administrador', 
        'admin@floreriaaster.com', 
        '$2b$10$rH0zGzJvzJvzJvzJvzJvzOYvzJvzJvzJvzJvzJvzJvzJvzJvzJvz', 
        'admin');
```

---

## 📊 CARGAR DATOS DE PRUEBA

### Opción 1: Manualmente desde la UI
1. Loguearse como admin
2. Ir a Productos → Crear algunos productos
3. Ir a Clientes → Crear algunos clientes
4. Ir a POS → Hacer una venta
5. Volver al Dashboard → Ver los datos actualizados

### Opción 2: Script SQL

Ejecutar en Neon:
```sql
-- Productos de ejemplo
INSERT INTO products (business_id, code, name, cost, price, stock_quantity, min_stock, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'P-001', 'Ramo Rosas Rojas', 5000, 10000, 20, 5, true),
    ('00000000-0000-0000-0000-000000000001', 'P-002', 'Maceta Cerámica', 2000, 4500, 15, 5, true),
    ('00000000-0000-0000-0000-000000000001', 'P-003', 'Oso Peluche', 4000, 8500, 10, 3, true);

-- Clientes de ejemplo
INSERT INTO customers (business_id, name, phone, debt_balance, is_active)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'María Gómez', '11-2345-6789', 0, true),
    ('00000000-0000-0000-0000-000000000001', 'Juan Pérez', '11-8765-4321', 5000, true);
```

---

## 🎯 PRÓXIMOS PASOS

### Completar Conexión de Módulos
1. ✅ Productos (completo)
2. ✅ Clientes (completo)
3. ✅ Dashboard (completo)
4. ⏳ Pedidos (pendiente)
5. ⏳ Finanzas (pendiente)
6. ⏳ POS/Ventas (pendiente)
7. ⏳ Paquetes (pendiente)
8. ⏳ Proveedores (pendiente)
9. ⏳ Mermas (pendiente)

### Migración de Datos
- Crear script para migrar datos de localStorage a PostgreSQL
- Los datos actuales del frontend están en `localStorage` bajo la key `aster-erp-storage`

### Testing
- Probar flujo completo: Producto → Venta → Stock → Finanzas
- Probar CRUD de cada módulo
- Probar autenticación y roles

---

## 📞 SOPORTE

Si tenés algún problema:
1. Revisar esta guía
2. Verificar logs del backend (`npm run dev` en backend)
3. Verificar consola del navegador (F12)
4. Revisar que todas las dependencias estén instaladas

---

**Fecha:** 14 de Marzo, 2026
**Estado:** FASE 3 en progreso (Productos y Clientes conectados)
**Próximo:** Conectar Pedidos y Finanzas
