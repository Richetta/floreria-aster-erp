# 🚀 GUÍA DE IMPLEMENTACIÓN - Florería Aster ERP

## ✅ Lo que se ha implementado

### 1. Sistema de Autenticación Corregido

**Archivos creados/modificados:**
- `create_admin_user.sql` - Script para crear usuario admin
- `backend/src/routes/auth.ts` - Ya existía, verifica que esté correcto
- `src/pages/Login/Login.tsx` - Actualizado con logging de actividad
- `src/store/useAuth.ts` - Actualizado con logging de actividad

### 2. Sistema de Actividad en Tiempo Real

**Archivos creados:**
- `create_user_activity_table.sql` - Tabla para registrar actividad
- `backend/src/routes/activity.ts` - Endpoints para logging de actividad
- `backend/src/server.ts` - Registrado el nuevo endpoint
- `src/hooks/useActivityLog.ts` - Hook para logging en frontend

---

## 📋 PASOS DE IMPLEMENTACIÓN

### PASO 1: Base de Datos (Supabase)

#### 1.1 Crear usuario admin

1. Ve a **Supabase** → Tu proyecto → **SQL Editor**
2. Ejecuta el archivo `create_admin_user.sql`

```sql
-- Usuario: admin
-- Contraseña: admin
```

#### 1.2 Crear tabla de actividad

1. En el mismo **SQL Editor**
2. Ejecuta el archivo `create_user_activity_table.sql`

---

### PASO 2: Configurar Railway

#### 2.1 Variables de Entorno

Entra a **Railway** → Tu proyecto → **Variables**

Agrega estas variables (las que no existen):

```bash
# JWT Secret (GENERAR UNO NUEVO - usa este comando)
# openssl rand -base64 64
JWT_SECRET=tu-jwt-secret-seguro-de-64-caracteres-minimo

# Google OAuth
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GOOGLE_REDIRECT_URI=https://[TU-APP].up.railway.app/api/auth/google/callback

# Frontend URL
FRONTEND_URL=https://floreria-aster-erp.vercel.app
```

**Variables que YA deberías tener:**
```bash
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=806329509349-r910mo70k002j62jrohh3mlr5uottjlo.apps.googleusercontent.com
PORT=3000
NODE_ENV=production
DEFAULT_BUSINESS_ID=00000000-0000-0000-0000-000000000001
```

#### 2.2 Obtener GOOGLE_CLIENT_SECRET

1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Selecciona tu proyecto
3. Click en el OAuth 2.0 Client ID
4. Copia el **Client Secret**
5. Pégalo en Railway como `GOOGLE_CLIENT_SECRET`

#### 2.3 Actualizar Redirect URI en Google

En el mismo OAuth 2.0 Client ID en Google Cloud:

1. En **Authorized redirect URIs**
2. Agrega: `https://[TU-APP].up.railway.app/api/auth/google/callback`
3. Click en **Save**

**Reemplaza [TU-APP]** con el nombre de tu app en Railway.
Ejemplo: `https://floreria-aster-backend.up.railway.app`

#### 2.4 Redeploy

1. Ve a **Deployments** en Railway
2. Click en **Redeploy** para aplicar las nuevas variables

---

### PASO 3: Deploy del Frontend (Vercel)

El frontend ya está publicado, pero si hiciste cambios:

```bash
git add .
git commit -m "feat: agregar sistema de actividad en tiempo real"
git push
```

Vercel detectará los cambios automáticamente.

---

### PASO 4: Verificación

#### 4.1 Probar Login Tradicional

1. Ve a https://floreria-aster-erp.vercel.app/login
2. Usuario: `admin`
3. Contraseña: `admin`
4. Deberías entrar al dashboard

#### 4.2 Probar Google Login

1. Click en "Sign in with Google"
2. Selecciona tu cuenta
3. Deberías entrar al dashboard

#### 4.3 Verificar Actividad

Después de iniciar sesión, verifica en Supabase:

```sql
SELECT 
  ua.created_at,
  ua.action,
  ua.resource_type,
  ua.details,
  u.name as user_name,
  u.email as user_email
FROM user_activity ua
JOIN users u ON u.id = ua.user_id
ORDER BY ua.created_at DESC
LIMIT 10;
```

Deberías ver los logs de login.

---

## 🔧 CÓMO USAR EL SISTEMA DE ACTIVIDAD

### En Componentes

```tsx
import { useActivityLog } from '../hooks/useActivityLog';

const MiComponente = () => {
  const { logCreate, logUpdate, logDelete, logView } = useActivityLog();

  const handleCreate = async () => {
    // Tu lógica de creación
    await createProduct(data);
    
    // Log activity
    await logCreate('product', newProduct.id, { name: newProduct.name });
  };

  const handleView = async (id: string) => {
    const product = await getProduct(id);
    await logView('product', id, { name: product.name });
  };

  return (
    // Tu componente
  );
};
```

### Acciones Disponibles

- `login` - Inicio de sesión
- `logout` - Cierre de sesión
- `page_view` - Navegación a páginas
- `create` - Crear recurso
- `update` - Actualizar recurso
- `delete` - Eliminar recurso
- `view` - Ver recurso
- `export` - Exportar datos
- `print` - Imprimir

### Recursos Comunes

- `product`
- `customer`
- `order`
- `transaction`
- `user`
- `package`
- `supplier`

---

## 🛠️ SOLUCIÓN DE PROBLEMAS

### Error 500 en Login

**Causa:** Variables de entorno faltantes en Railway

**Solución:**
1. Verifica que `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET` estén configuradas
2. Revisa las logs en Railway

### Google OAuth no funciona

**Causa:** Redirect URI incorrecto

**Solución:**
1. Verifica que el redirect URI en Google Cloud Console sea EXACTAMENTE:
   `https://[TU-APP].up.railway.app/api/auth/google/callback`
2. Verifica que `GOOGLE_REDIRECT_URI` en Railway coincida

### Usuario admin no existe

**Causa:** Script SQL no ejecutado

**Solución:**
1. Ejecuta `create_admin_user.sql` en Supabase SQL Editor
2. Verifica con:
```sql
SELECT * FROM users WHERE email = 'admin';
```

### Actividad no se registra

**Causa:** Tabla no creada o endpoint no registrado

**Solución:**
1. Ejecuta `create_user_activity_table.sql`
2. Verifica que `backend/src/server.ts` tenga la línea:
```typescript
await fastify.register(import('./routes/activity.js'), { prefix: '/api/activity' });
```

---

## 📊 MONITOREO

### Ver actividad reciente en Supabase

```sql
-- Actividad de hoy
SELECT 
  ua.created_at,
  ua.action,
  ua.resource_type,
  ua.resource_id,
  ua.details,
  u.name as user_name
FROM user_activity ua
JOIN users u ON u.id = ua.user_id
WHERE ua.created_at >= CURRENT_DATE
ORDER BY ua.created_at DESC;
```

### Usuarios activos hoy

```sql
SELECT 
  u.name,
  u.email,
  COUNT(ua.id) as actions_count,
  MAX(ua.created_at) as last_action
FROM users u
JOIN user_activity ua ON u.id = ua.user_id
WHERE ua.created_at >= CURRENT_DATE
GROUP BY u.id, u.name, u.email
ORDER BY actions_count DESC;
```

---

## 🔐 SEGURIDAD

### JWT Secret

Genera un JWT Secret seguro:

```bash
# Linux/Mac
openssl rand -base64 64

# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Google OAuth

- Mantén `GOOGLE_CLIENT_SECRET` en secreto
- Nunca lo commites al repositorio
- Rótalo periódicamente

---

## 📝 NOTAS

1. **Actividad en Tiempo Real:** Las actividades se guardan inmediatamente en la base de datos
2. **Fallos Silenciosos:** Si el logging falla, no interrumpe la experiencia del usuario
3. **Privacidad:** Solo admins pueden ver la actividad de otros usuarios (endpoint `/activity/business`)

---

## 🆘 SOPORTE

Si tienes problemas:

1. Revisa las logs en Railway
2. Verifica variables de entorno
3. Ejecuta los scripts SQL en Supabase
4. Prueba en modo desarrollo localmente

**Logs en Railway:**
- Dashboard → Tu proyecto → Logs
- Filtra por error para ver problemas

**Logs en Navegador:**
- F12 → Console
- Filtra por "error"

---

## ✅ CHECKLIST FINAL

- [ ] Ejecutar `create_admin_user.sql` en Supabase
- [ ] Ejecutar `create_user_activity_table.sql` en Supabase
- [ ] Configurar `JWT_SECRET` en Railway
- [ ] Configurar `GOOGLE_CLIENT_SECRET` en Railway
- [ ] Configurar `GOOGLE_REDIRECT_URI` en Railway
- [ ] Agregar redirect URI en Google Cloud Console
- [ ] Hacer redeploy en Railway
- [ ] Probar login con `admin/admin`
- [ ] Probar login con Google
- [ ] Verificar logs de actividad en Supabase

---

**¡Listo! Tu sistema debería estar funcionando con autenticación completa y logging de actividad.** 🎉
