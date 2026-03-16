# 🌼 Florería Aster ERP - Sistema de Gestión

**Versión:** 1.0.0  
**Estado:** ✅ Listo para Producción  
**Última actualización:** 15 de Marzo, 2026

---

## 📋 DESCRIPCIÓN

Sistema ERP completo para la gestión de Florería Aster. Incluye:

- ✅ **Inventario y Stock** - Productos, categorías, control de stock
- ✅ **Ventas y POS** - Punto de venta con código de barras
- ✅ **Pedidos** - Gestión de entregas y seguimiento
- ✅ **Clientes (CRM)** - Base de datos, deudas, recordatorios
- ✅ **Proveedores** - Compras y gestión de órdenes
- ✅ **Finanzas** - Libro mayor, caja, reportes
- ✅ **Paquetes/Ramos** - Armado de productos compuestos
- ✅ **Mermas** - Control de pérdidas y desperdicios
- ✅ **Reportes** - Analytics y exportación de datos
- ✅ **Multi-usuario** - Roles y permisos
- ✅ **Google OAuth** - Login con cuenta de Google

---

## 🚀 ARQUITECTURA

| Capa | Tecnología | Hosting |
|------|-----------|---------|
| **Frontend** | React 19 + Vite + TypeScript | Vercel |
| **Backend** | Fastify + Node.js + TypeScript | Railway |
| **Database** | PostgreSQL 16 | Supabase |
| **Auth** | Google OAuth 2.0 + JWT | Google Cloud |

---

## 🔗 URLs DE PRODUCCIÓN

| Servicio | URL |
|----------|-----|
| **Frontend** | https://floreria-aster.vercel.app |
| **Backend API** | https://aster-erp-production.up.railway.app |
| **Database** | https://lddrseslgkdaetsidyrv.supabase.co |

---

## 🎯 COMIENZO RÁPIDO

### Desarrollo Local

```bash
# 1. Clonar repositorio
git clone https://github.com/Richetta/floreria-aster-erp.git
cd floreria-aster-erp

# 2. Instalar dependencias del Frontend
npm install

# 3. Instalar dependencias del Backend
cd backend
npm install

# 4. Configurar variables de entorno
# Copiar backend/.env.example a backend/.env
# Copiar .env.example a .env (raíz)
# Editar con tus credenciales

# 5. Iniciar Backend (Terminal 1)
cd backend
npm run dev

# 6. Iniciar Frontend (Terminal 2)
cd ..
npm run dev
```

### Credenciales de Demo

```
Email: admin@floreriaaster.com
Password: admin123

O usa tu cuenta de Google
```

---

## 📖 DOCUMENTACIÓN

| Documento | Descripción |
|-----------|-------------|
| [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) | Guía completa de deploy paso a paso |
| [API_ROUTES.md](./backend/API_ROUTES.md) | Documentación de la API REST |
| [supabase-schema.sql](./supabase-schema.sql) | Schema de base de datos |

---

## 🔧 COMANDOS DISPONIBLES

### Frontend

```bash
npm run dev      # Desarrollo con hot-reload
npm run build    # Build de producción
npm run preview  # Preview del build
npm run lint     # Linting con ESLint
```

### Backend

```bash
npm run dev      # Desarrollo con tsx watch
npm run build    # Compilar a JavaScript
npm run start    # Iniciar servidor de producción
npm run db:init  # Inicializar base de datos
```

---

## 📦 ESTRUCTURA DEL PROYECTO

```
floreria-aster-erp/
├── src/                    # Frontend React
│   ├── components/         # Componentes reutilizables
│   ├── pages/              # Páginas de la aplicación
│   ├── services/           # API client y servicios
│   ├── store/              # Zustand stores (estado)
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utilidades y helpers
│   └── types/              # TypeScript types
├── backend/                # Backend Fastify
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── config/         # Configuración
│   │   └── db/             # Database connection
│   └── schema.sql          # Database schema
├── public/                 # Assets estáticos
├── supabase-schema.sql     # Schema para Supabase
├── vercel.json             # Configuración Vercel
└── DEPLOY_GUIDE.md         # Guía de deploy
```

---

## 🔐 VARIABLES DE ENTORNO

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

### Backend (backend/.env)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=xxxxx
PORT=3000
NODE_ENV=development
GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

---

## 🛡️ SEGURIDAD

- ✅ JWT para autenticación
- ✅ Google OAuth 2.0
- ✅ Row Level Security en PostgreSQL
- ✅ Rate limiting (100 req/min)
- ✅ CORS configurado
- ✅ Passwords con bcrypt
- ✅ HTTPS forzado en producción

---

## 📊 MÓDULOS DEL SISTEMA

1. **Dashboard** - KPIs y métricas principales
2. **POS** - Punto de venta con código de barras
3. **Pedidos** - Gestión de entregas (Kanban)
4. **Productos** - Inventario y categorías
5. **Paquetes** - Ramos y combos
6. **Clientes** - CRM y deudas
7. **Proveedores** - Compras
8. **Finanzas** - Libro mayor y caja
9. **Mermas** - Control de pérdidas
10. **Reportes** - Analytics
11. **Recordatorios** - Cumpleaños y deudas
12. **Configuración** - Usuarios y ajustes

---

## 💰 COSTOS MENSUALES

| Servicio | Costo |
|----------|-------|
| Vercel | Gratis |
| Railway | $5 crédito/mes |
| Supabase | Gratis |
| Google Cloud | Gratis |
| **Total** | **$0 - $5 USD/mes** |

---

## 🤝 CONTRIBUCIÓN

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-feature`)
3. Commit (`git commit -m 'feat: nueva feature'`)
4. Push (`git push origin feature/nueva-feature`)
5. Pull Request

---

## 📞 SOPORTE

- **GitHub Issues:** https://github.com/Richetta/floreria-aster-erp/issues
- **Email:** contacto@floreriaaster.com

---

## 📄 LICENCIA

Propietario - Todos los derechos reservados

---

## 🎉 AGRADECIMIENTOS

- **React** - UI library
- **Vite** - Build tool
- **Fastify** - Backend framework
- **Supabase** - Database
- **Vercel** - Frontend hosting
- **Railway** - Backend hosting

---

**Hecho con ❤️ para Florería Aster**
