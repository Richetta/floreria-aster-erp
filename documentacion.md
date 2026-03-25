# 🌸 Florería Aster ERP — Documentación Completa

> Sistema integral de gestión empresarial (ERP) diseñado específicamente para florerías.  
> **URL de Producción:** [https://floreria-aster-erp.vercel.app](https://floreria-aster-erp.vercel.app)

---

## 📖 Índice

1. [¿Qué es esta aplicación?](#qué-es-esta-aplicación)
2. [Arquitectura General](#arquitectura-general)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura de Carpetas](#estructura-de-carpetas)
5. [Frontend (Detallado)](#frontend-detallado)
6. [Backend (Detallado)](#backend-detallado)
7. [Base de Datos](#base-de-datos)
8. [Autenticación y Seguridad](#autenticación-y-seguridad)
9. [Estado Global (Zustand)](#estado-global-zustand)
10. [Módulos Funcionales](#módulos-funcionales)
11. [Infraestructura y Despliegue](#infraestructura-y-despliegue)
12. [Variables de Entorno](#variables-de-entorno)
13. [Cómo Levantar el Proyecto Localmente](#cómo-levantar-el-proyecto-localmente)
14. [Convenciones y Patrones](#convenciones-y-patrones)
15. [Problemas Conocidos y Soluciones](#problemas-conocidos-y-soluciones)

---

## ¿Qué es esta aplicación?

**Florería Aster ERP** es un sistema de gestión empresarial completo para una florería. Permite administrar:

- **Inventario** de productos (flores, macetas, insumos, etc.)
- **Punto de Venta (POS)** con soporte para escáner de código de barras
- **Pedidos programados** con entrega a domicilio o retiro en tienda
- **Clientes** con historial de compras, fechas importantes y deudas
- **Proveedores** con historial de visitas y compras
- **Arreglos/Paquetes** (ramos, combos) armados con productos del inventario
- **Finanzas** (ingresos, egresos, caja registradora)
- **Reportes** de ventas, productos más vendidos, mermas, etc.
- **Mermas** (productos dañados, marchitos, vencidos)
- **Logística** de entregas
- **Recordatorios** (cumpleaños de clientes, etc.)
- **Importación masiva** de datos (Excel, CSV, PDF, Word)

La aplicación está diseñada para ser **multi-tenant** (soporta múltiples negocios desde una misma base de datos), aunque actualmente se usa para un solo negocio: **Florería Aster**.

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    USUARIO (Navegador)                   │
│                 floreria-aster-erp.vercel.app             │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
                            ▼
┌──────────────────────────────────────────────────────────┐
│                     VERCEL (Frontend)                     │
│              React + Vite (SPA estática)                  │
│                                                           │
│  /api/* ──► Proxy inverso ──► Railway Backend             │
│  /*     ──► index.html (SPA fallback)                     │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS (Rewrite)
                            ▼
┌──────────────────────────────────────────────────────────┐
│                   RAILWAY (Backend)                        │
│              Fastify + TypeScript (API REST)               │
│           aster-backend-production.up.railway.app          │
└───────────────────────────┬──────────────────────────────┘
                            │ PostgreSQL Connection
                            ▼
┌──────────────────────────────────────────────────────────┐
│                SUPABASE / PostgreSQL 16                    │
│              Base de datos con Row Level Security          │
│              + UUID, Triggers, Views                      │
└──────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| **React** | 19.2 | UI Library |
| **TypeScript** | 5.9 | Tipado estático |
| **Vite** | 7.3 | Bundler y dev server |
| **Zustand** | 5.0 | Estado global |
| **React Router DOM** | 7.13 | Enrutamiento SPA |
| **Recharts** | 3.8 | Gráficos y reportes |
| **Lucide React** | 0.577 | Iconografía |
| **@react-oauth/google** | 0.13 | Login con Google |
| **react-to-print** | 3.3 | Impresión de tickets |
| **Tesseract.js** | 7.0 | OCR (deshabilitado) |

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| **Fastify** | 5.2 | Framework HTTP (rápido) |
| **TypeScript** | 5.3 | Tipado estático |
| **Kysely** | 0.27 | Query builder SQL (type-safe) |
| **pg** | 8.11 | Driver PostgreSQL |
| **@fastify/jwt** | 9.0 | Autenticación JWT |
| **@fastify/cors** | 10.0 | CORS |
| **@fastify/multipart** | 9.4 | Subida de archivos |
| **@fastify/rate-limit** | 10.3 | Protección anti-DDoS |
| **bcrypt** | 5.1 | Hashing de contraseñas |
| **Zod** | 3.22 | Validación de datos |
| **ExcelJS** | 4.4 | Lectura de archivos Excel |
| **csv-parse** | 6.1 | Lectura de archivos CSV |
| **mammoth** | 1.12 | Lectura de archivos Word |
| **pdf-parse** | 2.4 | Lectura de archivos PDF |
| **google-auth-library** | 9.0 | Verificación de tokens Google |

### Base de Datos
| Tecnología | Versión | Uso |
|---|---|---|
| **PostgreSQL** | 16 | Base de datos relacional |
| **Supabase** | — | Hosting de la BD (Producción) |

---

## Estructura de Carpetas

```
floreria-aster-erp/
├── .env                          # Variables de entorno del frontend
├── .env.example                  # Ejemplo de configuración
├── index.html                    # Entry point HTML
├── package.json                  # Dependencias del frontend
├── vite.config.ts                # Configuración de Vite
├── vercel.json                   # Configuración de deploy en Vercel
├── tsconfig.json                 # Config TypeScript raíz
├── database_schema.sql           # Schema SQL de referencia
│
├── src/                          # ===== FRONTEND =====
│   ├── main.tsx                  # Entry point React
│   ├── App.tsx                   # Router principal + rutas protegidas
│   ├── index.css                 # Estilos globales y variables CSS
│   │
│   ├── pages/                    # 📄 Páginas principales (19 módulos)
│   │   ├── Dashboard/            # Panel principal con métricas
│   │   ├── POS/                  # Punto de Venta
│   │   ├── Products/             # Gestión de inventario
│   │   ├── Packages/             # Arreglos y ramos
│   │   ├── Orders/               # Pedidos programados
│   │   ├── Sales/                # Historial de ventas
│   │   ├── Customers/            # Gestión de clientes
│   │   ├── Suppliers/            # Proveedores
│   │   ├── Finances/             # Finanzas (ingresos/egresos)
│   │   ├── CashRegister/         # Caja registradora
│   │   ├── Reports/              # Reportes y análisis
│   │   ├── Waste/                # Registro de mermas
│   │   ├── StockMovements/       # Movimientos de stock
│   │   ├── Logistics/            # Entregas del día
│   │   ├── Purchases/            # Compras a proveedores
│   │   ├── Reminders/            # Recordatorios
│   │   ├── Settings/             # Configuración del negocio
│   │   ├── Login/                # Pantalla de login
│   │   └── Menu/                 # Menú móvil
│   │
│   ├── components/               # 🧩 Componentes reutilizables (20)
│   │   ├── Layout/               # Layout principal (Sidebar + Header + Content)
│   │   ├── Sidebar/              # Barra lateral de navegación
│   │   ├── Header/               # Barra superior
│   │   ├── ErrorBoundary/        # Captura de errores React
│   │   ├── Toaster/              # Sistema de notificaciones toast
│   │   ├── Notifications/        # Centro de notificaciones
│   │   ├── ProductModal/         # Modal de crear/editar producto
│   │   ├── CustomerModal/        # Modal de crear/editar cliente
│   │   ├── PackageBuilder/       # Constructor de arreglos/ramos
│   │   ├── PackageAvailability/  # Verificación de stock para ramos
│   │   ├── PriceHistory/         # Historial de cambios de precio
│   │   ├── BulkPriceUpdate/      # Actualización masiva de precios
│   │   ├── CsvImportModal/       # Importación de archivos
│   │   ├── OCRImportModal/       # (Deshabilitado) Importación por OCR
│   │   ├── TicketPrinter/        # Generación e impresión de tickets
│   │   ├── BarcodeGenerator/     # Generación de códigos de barras
│   │   ├── BarcodeLabelPrinter/  # Impresión de etiquetas
│   │   ├── OrderTemplates/       # Plantillas de pedidos
│   │   ├── WasteBuilder/         # Registro de mermas
│   │   └── ui/                   # Modales genéricos (Confirm, Alert)
│   │
│   ├── store/                    # 📦 Estado global (Zustand)
│   │   ├── useStore.ts           # Store central (combina todas las slices)
│   │   ├── useAuth.ts            # Store de autenticación
│   │   └── slices/               # Slices individuales por dominio
│   │       ├── types.ts          # Tipos TypeScript compartidos
│   │       ├── mappers.ts        # Mapeo de datos API ↔ Frontend
│   │       ├── productSlice.ts   # Productos, categorías, tags
│   │       ├── customerSlice.ts  # Clientes
│   │       ├── orderSlice.ts     # Pedidos
│   │       ├── packageSlice.ts   # Arreglos/paquetes
│   │       ├── posSlice.ts       # Carrito y formulario de POS
│   │       ├── financeSlice.ts   # Transacciones financieras
│   │       ├── supplierSlice.ts  # Proveedores
│   │       └── uiSlice.ts       # Estado de UI (notificaciones, etc.)
│   │
│   ├── services/                 # 🌐 Comunicación con el backend
│   │   ├── api.ts                # Cliente HTTP centralizado (ApiClient)
│   │   └── OCRService.ts         # Servicio OCR (deshabilitado)
│   │
│   ├── hooks/                    # 🪝 Custom Hooks
│   │   ├── useModal.ts           # Hook para modales (confirm/alert)
│   │   ├── useDebounce.ts        # Hook para debounce de búsquedas
│   │   └── useActivityLog.ts     # Hook para logging de actividad
│   │
│   ├── utils/                    # 🔧 Utilidades
│   │   ├── format.ts             # Formateo de moneda, fechas, etc.
│   │   ├── idGenerator.ts        # Generación de IDs con prefijos
│   │   └── logger.ts             # Logger estructurado para debugging
│   │
│   ├── styles/                   # 🎨 Estilos adicionales
│   ├── types/                    # Tipos globales
│   └── assets/                   # Imágenes y recursos estáticos
│
├── backend/                      # ===== BACKEND =====
│   ├── package.json              # Dependencias del backend
│   ├── tsconfig.json             # Config TypeScript del backend
│   ├── schema.sql                # Schema completo de la BD (570 líneas)
│   ├── railway.json              # Config de deploy en Railway
│   │
│   └── src/
│       ├── server.ts             # Entry point del servidor Fastify
│       ├── config/               # Configuración (env vars, constantes)
│       ├── db/                   # Conexión y pool de PostgreSQL
│       ├── middleware/           # Middlewares (autenticación JWT)
│       └── routes/               # 🛣️ Rutas de la API (18 archivos)
│           ├── auth.ts           # Login, registro, Google OAuth
│           ├── users.ts          # Gestión de usuarios
│           ├── products.ts       # CRUD de productos
│           ├── categories.ts     # CRUD de categorías
│           ├── customers.ts      # CRUD de clientes
│           ├── orders.ts         # CRUD de pedidos
│           ├── transactions.ts   # Transacciones financieras
│           ├── packages.ts       # CRUD de arreglos/paquetes
│           ├── suppliers.ts      # CRUD de proveedores
│           ├── waste.ts          # Registro de mermas
│           ├── reports.ts        # Reportes y estadísticas
│           ├── import.ts         # Importación de archivos
│           ├── cash-register.ts  # Apertura/cierre de caja
│           ├── stock.ts          # Movimientos de stock
│           ├── reminders.ts      # Recordatorios
│           ├── activity.ts       # Log de actividad del usuario
│           ├── business.ts       # Configuración del negocio
│           └── diagnostic.ts     # Diagnóstico de la BD
│
└── dist/                         # Build de producción (generado)
```

---

## Frontend (Detallado)

### Enrutamiento (`App.tsx`)

Todas las rutas están protegidas por `<ProtectedRoute>`, que redirige a `/login` si no hay sesión:

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `Dashboard` | Panel principal con métricas del día |
| `/pos` | `POS` | Punto de venta con carrito |
| `/ventas` | `Sales` | Historial de ventas realizadas |
| `/pedidos` | `Orders` | Pedidos programados |
| `/productos` | `Products` | Inventario de productos |
| `/paquetes` | `Packages` | Arreglos y combos |
| `/clientes` | `Customers` | Base de clientes |
| `/proveedores` | `Suppliers` | Proveedores |
| `/mermas` | `Waste` | Registro de pérdidas |
| `/logistica` | `Logistics` | Entregas del día |
| `/compras` | `Purchases` | Compras a proveedores |
| `/menu` | `Menu` | Menú móvil |
| `/finanzas` | `Finances` | Ingresos y egresos |
| `/reportes` | `Reports` | Reportes y gráficos |
| `/caja` | `CashRegister` | Apertura/cierre de caja |
| `/stock` | `StockMovements` | Movimientos de inventario |
| `/recordatorios` | `Reminders` | Recordatorios y alertas |
| `/configuracion` | `Settings` | Configuración del negocio |
| `/login` | `Login` | Inicio de sesión (ruta pública) |

### Cliente API (`services/api.ts`)

Clase `ApiClient` que centraliza **toda** la comunicación HTTP con el backend. Características:
- **Token Bearer** automático en cada request
- **Base URL** configurable vía `VITE_API_URL`
- **Métodos organizados** por dominio: Productos, Clientes, Pedidos, Paquetes, Transacciones, Proveedores, Reportes, etc.
- **Tipos de datos** definidos para cada entidad de la API

### Estilos

- **CSS puro** (vanilla) con variables CSS globales definidas en `index.css`
- Cada página/componente tiene su propio archivo `.css`
- **Sistema de diseño** con tokens de colores, tipografía y espaciado
- **Dark mode** no implementado actualmente (solo tema claro)

---

## Backend (Detallado)

### Servidor (`server.ts`)

Framework: **Fastify** — escucha en el puerto configurado (default: `3000`).

Plugins registrados:
1. **CORS** — Permite requests desde el frontend (Vercel)
2. **JWT** — Tokens con expiración de 7 días
3. **Rate Limiting** — 100 requests por minuto por IP

### Autenticación Global

Todas las rutas bajo `/api/*` requieren autenticación JWT, excepto:
- `POST /api/auth/login`
- `POST /api/auth/google`
- `GET /health`

### API Endpoints

| Prefijo | Archivo | Descripción |
|---|---|---|
| `/api/auth` | `auth.ts` | Login tradicional + Google OAuth |
| `/api/users` | `users.ts` | Gestión de usuarios del sistema |
| `/api/products` | `products.ts` | CRUD de productos con historial de precios |
| `/api/categories` | `categories.ts` | CRUD de categorías |
| `/api/customers` | `customers.ts` | CRUD de clientes con deudas y órdenes |
| `/api/orders` | `orders.ts` | CRUD de pedidos con items y estados |
| `/api/transactions` | `transactions.ts` | Ingresos, egresos, ventas |
| `/api/packages` | `packages.ts` | CRUD de arreglos con componentes |
| `/api/suppliers` | `suppliers.ts` | CRUD de proveedores |
| `/api/waste` | `waste.ts` | Registro de mermas |
| `/api/reports` | `reports.ts` | Estadísticas y reportes |
| `/api/import` | `import.ts` | Importación de Excel/CSV/PDF/Word |
| `/api/cash-register` | `cash-register.ts` | Apertura y cierre de caja |
| `/api/stock` | `stock.ts` | Movimientos de stock |
| `/api/reminders` | `reminders.ts` | Recordatorios programados |
| `/api/activity` | `activity.ts` | Log de actividad del usuario |
| `/api/business` | `business.ts` | Configuración del negocio |
| `/api/admin` | `diagnostic.ts` | Diagnóstico de la BD (solo admin) |
| `/health` | (inline) | Health check del servidor |

---

## Base de Datos

### Motor y Hosting
- **PostgreSQL 16** alojado en **Supabase**
- **Row Level Security (RLS)** habilitado para aislamiento multi-tenant
- Extensión `uuid-ossp` para generación de UUIDs

### Tablas Principales

| Tabla | Descripción |
|---|---|
| `businesses` | Datos del negocio (multi-tenant) |
| `users` | Usuarios del sistema con roles |
| `categories` | Categorías de productos (jerárquicas) |
| `products` | Productos con stock, costos, precios, tags |
| `price_history` | Historial de cambios de precio |
| `stock_movements` | Movimientos de inventario (ventas, ajustes, etc.) |
| `stock_reservations` | Reservas de stock para pedidos |
| `customers` | Clientes con datos de contacto y deuda |
| `orders` | Pedidos programados |
| `order_items` | Items individuales de cada pedido |
| `packages` | Arreglos/ramos/combos |
| `package_components` | Productos que componen cada arreglo |
| `suppliers` | Proveedores |
| `supplier_products` | Productos por proveedor |
| `supplier_purchases` | Compras realizadas |
| `purchases` | Órdenes de compra |
| `waste_logs` | Registro de mermas |
| `transactions` | Transacciones financieras |
| `refresh_tokens` | Tokens de refresco para sesiones |
| `audit_logs` | Logs de auditoría |
| `app_settings` | Configuración de la app por negocio |

### Enums
- `user_role`: `admin`, `seller`, `driver`, `viewer`
- `order_status`: `pending`, `confirmed`, `assembling`, `ready`, `out_for_delivery`, `delivered`, `cancelled`
- `delivery_method`: `pickup`, `delivery`
- `delivery_time_slot`: `morning`, `afternoon`, `evening`, `allday`
- `stock_movement_type`: `sale`, `order`, `purchase`, `adjustment`, `waste`, `return`, `transfer`
- `waste_reason`: `damaged`, `wilted`, `expired`, `broken`, `lost`, `other`
- `transaction_type`: `income`, `expense`

### Vistas SQL Útiles
- `v_available_stock` — Stock disponible considerando reservas
- `v_daily_sales` — Resumen de ventas por día
- `v_low_stock_products` — Productos con stock bajo
- `v_customer_debts` — Clientes con deuda pendiente

---

## Autenticación y Seguridad

### Flujo de Login
1. El usuario ingresa email/contraseña o usa **Google Sign-In**
2. El backend valida las credenciales y devuelve un **JWT** (válido por 7 días)
3. El frontend almacena el token en `localStorage`
4. Cada request posterior incluye el header `Authorization: Bearer <token>`
5. El middleware `authenticate` del backend decodifica el token y establece `app.current_business_id` para el RLS

### Google OAuth
- El frontend usa `@react-oauth/google` para mostrar el botón de Google
- El token de Google se envía al backend (`POST /api/auth/google`)
- El backend verifica el token con `google-auth-library`
- Si el usuario no existe, se crea automáticamente con rol `viewer`

### Roles de Usuario
| Rol | Permisos |
|---|---|
| `admin` | Acceso total al sistema |
| `seller` | Ventas, pedidos, clientes |
| `driver` | Logística y entregas |
| `viewer` | Solo lectura |

### Protecciones
- **Rate Limiting**: 100 requests/minuto por IP
- **JWT con expiración**: 7 días
- **RLS en PostgreSQL**: Cada query está filtrada por `business_id`
- **Bcrypt**: Contraseñas hasheadas con salt

---

## Estado Global (Zustand)

El estado de la aplicación se gestiona con **Zustand**, organizado en **slices** que se combinan en un solo store.

### Store Principal (`useStore.ts`)

Combina 8 slices:

| Slice | Archivo | Estado que gestiona |
|---|---|---|
| `ProductSlice` | `productSlice.ts` | `products[]`, `categories[]`, `tags[]`, CRUD de productos |
| `CustomerSlice` | `customerSlice.ts` | `customers[]`, CRUD de clientes |
| `OrderSlice` | `orderSlice.ts` | `orders[]`, crear/actualizar pedidos |
| `PackageSlice` | `packageSlice.ts` | `packages[]`, validación de stock, CRUD de arreglos |
| `PosSlice` | `posSlice.ts` | `cart[]`, formulario de POS (cliente, método de entrega, etc.) |
| `FinanceSlice` | `financeSlice.ts` | `transactions[]`, CRUD de transacciones |
| `SupplierSlice` | `supplierSlice.ts` | `suppliers[]`, CRUD de proveedores |
| `UiSlice` | `uiSlice.ts` | `notifications[]`, estado de carga, errores |

### Store de Autenticación (`useAuth.ts`)
Separado del store principal. Gestiona:
- `user`, `isAuthenticated`, `isLoading`, `error`
- Métodos: `login()`, `logout()`, `register()`, `checkAuth()`

### Tipos Compartidos (`types.ts`)
Define los tipos TypeScript para todas las entidades:
`Product`, `Customer`, `Order`, `Package`, `PackageItem`, `Sale`, `TransactionLocal`, `SupplierLocal`, `Toast`, `ShopInfo`, etc.

---

## Módulos Funcionales

### 🛒 Punto de Venta (POS)
- Búsqueda de productos por nombre o código de barras
- Vistas: Recientes, Más Vendidos, Todos, Ramos
- Carrito persistente (se mantiene al navegar)
- Modo "Venta Rápida" (efectivo/tarjeta) o "Pedido Programado"
- Soporte para clientes invitados ("Consumidor Final")
- Impresión de tickets
- Sonido de confirmación al escanear

### 📦 Productos
- CRUD completo con categorías y etiquetas
- Seguimiento de stock con alertas de mínimo
- Historial de cambios de precio (gráfico)
- Importación masiva desde Excel/CSV/PDF/Word
- Generación de códigos de barras
- Actualización masiva de precios
- Registro de mermas

### 🌸 Arreglos / Paquetes
- Constructor visual de arreglos ("Mesa de Armado")
- Selección de componentes del inventario
- Cálculo automático de costo de materiales
- Validación de stock en tiempo real
- Clasificación por secciones (Ramos, Combos, Eventos)

### 📋 Pedidos
- Flujo de estados: Pendiente → Armando → Listo → En Camino → Entregado
- Datos de entrega (dirección, franja horaria, teléfono de contacto)
- Seña/adelanto de pago
- Mensaje para tarjeta de regalo
- Integración con deuda del cliente

### 👥 Clientes
- Datos de contacto, dirección, fechas importantes
- Balance de deuda
- Historial de pedidos y gasto total
- Recordatorios de cumpleaños/aniversarios

### 💰 Finanzas
- Registro de ingresos y egresos
- Categorización de transacciones
- Apertura y cierre de caja con arqueo
- Métodos de pago: Efectivo, Tarjeta, Transferencia

### 📊 Reportes
- Ventas por período
- Productos más vendidos
- Mermas acumuladas
- Gráficos con Recharts

### 🚚 Logística
- Vista de entregas del día
- Filtrado por franja horaria
- Datos de contacto del destinatario

---

## Infraestructura y Despliegue

### Frontend → **Vercel**
- **Repositorio**: Conectado a GitHub (deploy automático on push)
- **Framework**: Vite
- **Build**: `npm run build` → `tsc -b && vite build` → output en `dist/`
- **Proxy API**: Las requests a `/api/*` se redirigen a Railway via `vercel.json`

### Backend → **Railway**
- **Startup**: `tsx src/server.ts` (sin paso de compilación)
- **Config**: `railway.json` define el build y start commands
- **URL**: `aster-backend-production.up.railway.app`

### Base de Datos → **Supabase**
- PostgreSQL 16 con conexión directa vía `DATABASE_URL`
- Pool de conexiones manejado por `pg` en el backend

### Flujo de Deploy
```
git push origin main
    ↓
Vercel detecta el push → Build frontend → Deploy estático
    ↓
Railway detecta el push → Start backend con tsx
```

---

## Variables de Entorno

### Frontend (`.env`)
```bash
# URL del backend
VITE_API_URL=http://localhost:3000/api              # Local
# VITE_API_URL=https://tu-app.railway.app/api       # Producción

# Google OAuth
VITE_GOOGLE_CLIENT_ID=806329509349-...apps.googleusercontent.com
```

### Backend (`.env`)
```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:port/db

# JWT
JWT_SECRET=tu_secreto_jwt_seguro

# Google OAuth
GOOGLE_CLIENT_ID=806329509349-...apps.googleusercontent.com

# Server
PORT=3000
NODE_ENV=development   # o "production"

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:5173   # o https://floreria-aster-erp.vercel.app
```

---

## Cómo Levantar el Proyecto Localmente

### Requisitos Previos
- **Node.js** >= 18
- **npm** >= 9
- **PostgreSQL 16** (o acceso a Supabase)

### 1. Clonar el repositorio
```bash
git clone https://github.com/Richetta/floreria-aster-erp.git
cd floreria-aster-erp
```

### 2. Instalar dependencias del Frontend
```bash
npm install
```

### 3. Instalar dependencias del Backend
```bash
cd backend
npm install
cd ..
```

### 4. Configurar variables de entorno
```bash
# Frontend
cp .env.example .env
# Editar .env con tu VITE_API_URL y VITE_GOOGLE_CLIENT_ID

# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con tu DATABASE_URL, JWT_SECRET, etc.
```

### 5. Inicializar la base de datos
```bash
# Ejecutar el schema SQL en tu PostgreSQL
psql -d tu_base_de_datos -f backend/schema.sql
```

### 6. Levantar el Backend
```bash
cd backend
npm run dev
# Servidor corriendo en http://localhost:3000
```

### 7. Levantar el Frontend
```bash
npm run dev
# App corriendo en http://localhost:5173
```

### 8. Verificar
- Abrir `http://localhost:5173/login`
- Iniciar sesión con: `admin@floreriaaster.com` / `admin123`

---

## Convenciones y Patrones

### Nomenclatura de Archivos
- **Páginas**: PascalCase (`Products.tsx`, `POS.tsx`)
- **Componentes**: PascalCase (`PackageBuilderModal.tsx`)
- **Slices/Hooks**: camelCase (`productSlice.ts`, `useModal.ts`)
- **Estilos**: Mismo nombre que su componente (`Products.css`)
- **Rutas backend**: kebab-case (`cash-register.ts`)

### Patrones de Código
- **Slices de Zustand**: Cada slice sigue el patrón `StateCreator<AppState, [], [], SliceType>`
- **Mapeo de datos**: El backend usa `snake_case`, el frontend usa `camelCase`. Los mappers están en `slices/mappers.ts` y dentro de cada slice
- **Modales**: Se usa el hook `useModal()` para modales de confirmación/alerta
- **Notificaciones**: Se usa `addNotification()` del `UiSlice` para toasts

### Flujo de Datos
```
Componente → useStore().action() → api.method() → Backend → DB
                                                      ↓
Componente ← useStore().state ← set() ← Response ←───┘
```

---

## Problemas Conocidos y Soluciones

### 1. Error 401 al hacer requests
**Causa**: Token JWT expirado o no presente.  
**Solución**: Cerrar sesión y volver a loguearse. El token dura 7 días.

### 2. La página de Arreglos se crashea
**Causa** (resuelta): La `PackageSlice` no estaba integrada, causando `packages = undefined`.  
**Solución**: Se integró `packageSlice.ts` en `useStore.ts`.

### 3. Error al importar archivos
**Causa**: La ruta `/api/import` estaba comentada en el backend.  
**Solución**: Se descomentó la ruta en `server.ts`.

### 4. Google Sign-In muestra error
**Causa**: `google.accounts.id.initialize()` se llama múltiples veces.  
**Solución**: Es una advertencia benigna del SDK de Google, no afecta la funcionalidad.

### 5. Fechas inválidas en el Dashboard
**Causa**: Órdenes con fechas `null` o mal formadas causan `RangeError`.  
**Solución**: Se implementó parseo defensivo de fechas con fallback.

---

> **Última actualización:** 24 de Marzo de 2026  
> **Mantenido por:** Equipo de desarrollo de Florería Aster
