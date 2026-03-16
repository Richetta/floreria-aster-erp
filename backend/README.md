# Aster ERP - Backend

Backend para Florería Aster ERP con Fastify + PostgreSQL

## Setup Rápido (15 minutos)

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar base de datos

1. Ir a https://neon.tech
2. Crear cuenta gratis
3. Crear proyecto "aster-erp"
4. Copiar connection string

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL=postgresql://xxx:yyy@ep-xxx.us-east-2.aws.neon.tech/aster_erp?sslmode=require
JWT_SECRET=tu_secreto_muy_largo_y_seguro_1234567890
PORT=3000
NODE_ENV=development
```

### 4. Inicializar base de datos

```bash
# Conectar a Neon y ejecutar schema.sql
# O usar psql:
psql $DATABASE_URL -f schema.sql
```

### 5. Iniciar servidor

```bash
npm run dev
```

El servidor corre en http://localhost:3000

## Endpoints

### Auth

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@floreriaaster.com","password":"admin123"}'

# Response: { "token": "xxx", "user": {...} }
```

### Productos

```bash
# Listar productos
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer TOKEN"

# Crear producto
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PROD-001",
    "name": "Ramo Primaveral",
    "cost": 10000,
    "price": 15000,
    "min_stock": 5
  }'

# Actualizar stock
curl -X POST http://localhost:3000/api/products/ID/stock \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 10,
    "type": "purchase",
    "reason": "Compra a proveedor"
  }'
```

## Estructura del Proyecto

```
backend/
├── src/
│   ├── server.ts          # Entry point
│   ├── config/
│   │   └── index.ts       # Configuración
│   ├── db/
│   │   └── index.ts       # Database connection
│   ├── routes/
│   │   ├── auth.ts        # Auth endpoints
│   │   └── products.ts    # Products endpoints
│   └── middleware/        # Auth middleware
├── schema.sql             # Database schema
├── package.json
└── .env
```

## Próximos Pasos

1. ✅ Auth funcional
2. ✅ Productos CRUD
3. ⏳ Clientes
4. ⏳ Pedidos
5. ⏳ Conectar frontend

## Default Credentials

```
Email: admin@floreriaaster.com
Password: admin123
Business ID: 00000000-0000-0000-0000-000000000001
```
