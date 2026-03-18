# 🚀 GUÍA COMPLETA DE DEPLOY - Florería Aster ERP

**Fecha:** 15 de Marzo, 2026
**Estado:** Listo para Producción

---

## 📋 ARQUITECTURA FINAL

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO FINAL                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Vercel - Gratis)                     │
│         https://floreria-aster.vercel.app                   │
│         React + Vite + TypeScript                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Railway - $5 crédito/mes)             │
│         https://aster-erp-production.railway.app            │
│         Fastify + Node.js + TypeScript                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│        DATABASE (Supabase - Gratis)                         │
│         postgresql://...supabase.co                         │
│         PostgreSQL 16 + Row Level Security                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         GOOGLE OAUTH (Google Cloud - Gratis)                │
│         Autenticación con cuenta de Google                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 PASO A PASO PARA DEPLOY

### PASO 1: Configurar Supabase (10 minutos)

1. **Ir a Supabase Dashboard:**
   - https://supabase.com/dashboard/project/lddrseslgkdaetsidyrv

2. **Ejecutar el Schema:**
   - Ir a **SQL Editor** (menú lateral)
   - Click en **"New Query"**
   - Copiar TODO el contenido de `supabase-schema.sql`
   - Click en **"Run"** o presionar Ctrl+Enter
   - ✅ Verificar que dice "Success. No rows returned"

3. **Verificar tablas creadas:**
   - Ir a **Table Editor** (menú lateral)
   - Deberías ver 20+ tablas: users, products, customers, orders, etc.

**Obtener Connection String:**
   - Ir a **Settings** (engranaje abajo a la izquierda)
   - Click en **"Database"**
   - Copiar **"Connection string"** (URI mode)
   - Se ve así: `postgresql://postgres.lddrseslgkdaetsidyrv:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.co:6543/postgres`
   - **Reemplaza `[PASSWORD]` con tu contraseña: `floreria-aster123`**

5. **Obtener API Keys:**
   - Ir a **Settings** → **"API"**
   - Copiar **"Project API keys"** → **"anon public"**
   - Copiar **"Project API keys"** → **"service_role"** (GUARDAR SEGURO!)


5. **Obtener API Keys:**
   - Ir a **Settings** → **"API"**
   - Copiar **"Project API keys"** → **"anon public"**
   - Copiar **"Project API keys"** → **"service_role"** (GUARDAR SEGURO!)

---

### PASO 2: Configurar Google Cloud OAuth (5 minutos)

1. **Ir a Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **Editar OAuth 2.0 Client:**
   - Click en el nombre de tu cliente OAuth (el que creaste)
   - O crear uno nuevo: **"Create Credentials"** → **"OAuth client ID"**

3. **Configurar Redirect URIs:**
   Agrega estos 4 URIs autorizados:
   ```
   http://localhost:3000/api/auth/google/callback          (desarrollo)
   http://localhost:5173                                    (desarrollo frontend)
   https://aster-erp-production.up.railway.app/api/auth/google/callback  (producción)
   https://floreria-aster.vercel.app                        (producción frontend)
   ```

4. **Guardar cambios:**
   - Click en **"SAVE"**
   - Copiar **Client ID** y **Client Secret**

---

### PASO 3: Deploy del Backend en Railway (15 minutos)

1. **Ir a Railway:**
   - https://railway.app
   - Click **"Start a New Project"**
   - **"Deploy from GitHub repo"**
   - Conectar tu cuenta de GitHub (usuario: Richetta)
   - Seleccionar repositorio: `floreria-aster-erp`

2. **Configurar servicio:**
   - Railway detectará automáticamente el `package.json`
   - Click en el servicio creado
   - Ir a **"Settings"** (pestaña superior)
   - En **"Root Directory"**, poner: `backend`
   - Esto le dice a Railway que el backend está en la carpeta `/backend`

3. **Agregar Variables de Entorno:**
   - Ir a **"Variables"** (pestaña superior)
   - Click **"New Variable"** y agregar:

   ```bash
   # Database - Supabase
   DATABASE_URL=postgresql://postgres.lddrseslgkdaetsidyrv:floreria-aster123@aws-0-sa-east-1.pooler.supabase.co:6543/postgres

   # JWT Secret (generar uno nuevo o usar este)
   JWT_SECRET=a8f5e2c9b1d4a7e3f6c8b2d5a9e1f4c7b3d6a8e2f5c9b1d4a7e3f6c8b2d5a9e1

   # Server
   PORT=3000
   NODE_ENV=production

   # Business
   DEFAULT_BUSINESS_ID=00000000-0000-0000-0000-000000000001

   # Frontend URL (producción)
   FRONTEND_URL=https://floreria-aster.vercel.app

   # Google OAuth
   GOOGLE_CLIENT_ID=806329509349-r910mo70k002j62jrohh3mlr5uottjlo.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   GOOGLE_REDIRECT_URI=https://aster-erp-production.up.railway.app/api/auth/google/callback
   ```

4. **Deploy:**
   - Railway automáticamente hará el deploy
   - Ir a **"Deployments"** para ver el progreso
   - Esperar a que diga **"Deployed"**
   - Copiar la URL de producción (ej: `https://aster-erp-production.up.railway.app`)

5. **Verificar health check:**
   - Abrir en navegador: `https://aster-erp-production.up.railway.app/health`
   - Debería decir: `{"status":"ok","timestamp":"..."}`

---

### PASO 4: Deploy del Frontend en Vercel (10 minutos)

1. **Ir a Vercel:**
   - https://vercel.com
   - Click **"Add New Project"**
   - **"Import Git Repository"**
   - Seleccionar repositorio: `floreria-aster-erp`

2. **Configurar proyecto:**
   - **Framework Preset:** Vite
   - **Root Directory:** dejar vacío (está en la raíz)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Agregar Variables de Entorno:**
   - Click en **"Environment Variables"**
   - Agregar:

   ```bash
   # Backend API URL (producción - Railway)
   VITE_API_URL=https://aster-erp-production.up.railway.app/api

   # Google OAuth Client ID
   VITE_GOOGLE_CLIENT_ID=806329509349-r910mo70k002j62jrohh3mlr5uottjlo.apps.googleusercontent.com
   ```

4. **Deploy:**
   - Click en **"Deploy"**
   - Esperar ~2-3 minutos
   - Vercel te dará una URL: `https://floreria-aster.vercel.app`

5. **Configurar dominio personalizado (opcional):**
   - Ir a **"Settings"** → **"Domains"**
   - Agregar tu dominio si tienes uno

---

### PASO 5: Actualizar Google OAuth Redirect URI (2 minutos)

1. **Volver a Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **Agregar nueva redirect URI:**
   - Editar OAuth Client
   - Agregar: `https://aster-erp-production.up.railway.app/api/auth/google/callback`
   - Click **"SAVE"**

---

### PASO 6: Verificar que todo funciona (5 minutos)

1. **Abrir el frontend:**
   - https://floreria-aster.vercel.app

2. **Probar login tradicional:**
   - Email: `admin@floreriaaster.com`
   - Password: `admin123`
   - ✅ Debería loguear y llevar al dashboard

3. **Probar login con Google:**
   - Click en **"Sign in with Google"**
   - Seleccionar cuenta de Google
   - ✅ Debería crear usuario automáticamente y loguear

4. **Probar CRUD:**
   - Ir a Productos → Crear producto
   - Ir a Clientes → Crear cliente
   - ✅ Verificar que se guardan en Supabase

5. **Verificar en Supabase:**
   - Ir a **Table Editor**
   - Ver usuarios creados: `SELECT * FROM users;`
   - Ver productos: `SELECT * FROM products;`

---

## 🔧 COMANDOS ÚTILES

### Desarrollo Local

```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev
# http://localhost:3000

# Terminal 2 - Frontend
npm install
npm run dev
# http://localhost:5173
```

### Build de Producción

```bash
# Backend
cd backend
npm run build
npm run start

# Frontend
npm run build
npm run preview
```

### Ver logs en Railway

```bash
# Railway CLI
railway logs
railway logs --follow
```

### Ver logs en Vercel

```bash
# Vercel CLI
vercel logs
vercel logs --follow
```

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### Error: "Failed to fetch" en frontend

**Causa:** El backend no está accesible

**Solución:**
1. Verificar que Railway deployó correctamente
2. Verificar que `VITE_API_URL` en Vercel apunta a Railway
3. Verificar CORS en backend (debe permitir origen de Vercel)

### Error: "Invalid Google token"

**Causa:** Redirect URI mal configurado

**Solución:**
1. Verificar que `GOOGLE_REDIRECT_URI` en Railway coincide con la URL de Railway
2. Verificar que Google Cloud Console tiene ambas redirect URIs

### Error: "Database connection failed"

**Causa:** DATABASE_URL incorrecto

**Solución:**
1. Verificar connection string de Supabase
2. Asegurarse de incluir la password en el connection string
3. Verificar que el schema se ejecutó correctamente

### Error: "JWT_SECRET must be at least 32 characters"

**Causa:** JWT_SECRET muy corto

**Solución:**
```bash
# Generar uno nuevo
openssl rand -base64 64
# O en Node:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📊 URLs FINALES

| Servicio | URL | Estado |
|----------|-----|--------|
| **Frontend (Vercel)** | https://floreria-aster.vercel.app | ✅ |
| **Backend (Railway)** | https://aster-erp-production.up.railway.app | ✅ |
| **Database (Supabase)** | https://lddrseslgkdaetsidyrv.supabase.co | ✅ |
| **Google OAuth** | Configurado en Google Cloud | ✅ |

---

## 🔄 CÓMO VOLVER A DESPLEGAR

### Frontend (Vercel)

```bash
# Automático con git push
git add .
git commit -m "feat: nuevo cambio"
git push origin main

# Vercel detectará el cambio y redeployará automáticamente
```

### Backend (Railway)

```bash
# Automático con git push
git add .
git commit -m "feat: cambio en backend"
git push origin main

# Railway detectará el cambio en /backend y redeployará
```

### Deploy manual desde dashboard

1. **Vercel:** Ir al proyecto → **"Deployments"** → **"Redeploy"**
2. **Railway:** Ir al proyecto → **"Deployments"** → **"Deploy latest commit"**

---

## 💰 COSTOS ESTIMADOS

| Servicio | Plan Gratis | Plan Pago |
|----------|-------------|-----------|
| **Vercel** | ✅ 100GB/mes, dominios .vercel.app | $20/mes (dominio custom) |
| **Railway** | ✅ $5 crédito/mes (~500 horas) | $5/mes (más horas) |
| **Supabase** | ✅ 500MB DB, 50K usuarios/mes | $25/mes (más recursos) |
| **Google Cloud** | ✅ OAuth gratis | Gratis |

**Total mensual estimado:** $0 - $5 USD

---

## 🔐 SEGURIDAD

### Variables sensibles (NUNCA commitear)

- `.env`
- `.env.local`
- `backend/.env`
- `backend/src/config/index.ts` (si tiene secrets hardcodeados)

### Recomendaciones

1. ✅ Usar variables de entorno en Vercel/Railway
2. ✅ JWT_SECRET de 64+ caracteres
3. ✅ HTTPS forzado (automático en Vercel/Railway)
4. ✅ CORS configurado para producción
5. ✅ Rate limiting activado
6. ✅ Row Level Security en Supabase

---

## 📞 SOPORTE

Si hay problemas:

1. **Ver logs:**
   - Railway: `railway logs`
   - Vercel: `vercel logs`

2. **Verificar health check:**
   - Backend: `https://tu-backend.railway.app/health`

3. **Probar API directamente:**
   ```bash
   curl https://tu-backend.railway.app/health
   ```

4. **Revisar variables de entorno:**
   - Vercel: Settings → Environment Variables
   - Railway: Variables tab

---

## ✅ CHECKLIST FINAL

- [ ] Schema ejecutado en Supabase
- [ ] Backend deployado en Railway
- [ ] Frontend deployado en Vercel
- [ ] Google OAuth configurado con redirect URIs de producción
- [ ] Variables de entorno configuradas en ambos servicios
- [ ] Health check responde OK
- [ ] Login tradicional funciona
- [ ] Login con Google funciona
- [ ] CRUD de productos funciona
- [ ] CRUD de clientes funciona
- [ ] Base de datos accesible desde Railway

---

**¡LISTO! Tu aplicación está en producción 🎉**
