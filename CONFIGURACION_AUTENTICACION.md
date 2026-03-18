# 🔧 CONFIGURACIÓN DE AUTENTICACIÓN - Florería Aster ERP

## Problemas Detectados

1. **Error 500 con login tradicional (admin/admin)**: El usuario admin no existe en la base de datos con la contraseña hasheada correctamente.
2. **Error 500 con Google OAuth**: Faltan variables de entorno en Railway, específicamente `GOOGLE_CLIENT_SECRET`.

---

## ✅ SOLUCIÓN PASO A PASO

### PASO 1: Crear usuario admin en la base de datos

1. Ve a **Supabase** → Tu proyecto → **SQL Editor**
2. Copia y pega el contenido del archivo `create_admin_user.sql`
3. Ejecuta el script
4. Deberías ver un resultado con el usuario admin creado

**Credenciales:**
- Usuario: `admin`
- Contraseña: `admin`

---

### PASO 2: Configurar variables de entorno en Railway

1. Ve a tu proyecto en **Railway**
2. Click en **Variables**
3. Agrega/edita las siguientes variables:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres.lddrseslgkdaetsidyrv:[TU_PASSWORD]@aws-0-sa-east-1.pooler.supabase.co:6543/postgres

# JWT Secret (USA ESTE O GENERA UNO NUEVO)
JWT_SECRET=cambia-esto-por-un-string-seguro-de-64-caracteres-minimo-1234567890

# Server
PORT=3000
NODE_ENV=production

# Business
DEFAULT_BUSINESS_ID=00000000-0000-0000-0000-000000000001

# Frontend URL
FRONTEND_URL=https://floreria-aster-erp.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=806329509349-r910mo70k002j62jrohh3mlr5uottjlo.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[TU_GOOGLE_CLIENT_SECRET_DE_GOOGLE_CLOUD]
GOOGLE_REDIRECT_URI=https://[TU-APP].up.railway.app/api/auth/google/callback
```

**⚠️ IMPORTANTE:** 
- Reemplaza `[TU_PASSWORD]` con tu contraseña de Supabase
- Reemplaza `[TU-APP]` con el nombre de tu app en Railway
- Reemplaza `[TU_GOOGLE_CLIENT_SECRET_DE_GOOGLE_CLOUD]` con tu client secret de Google

---

### PASO 3: Configurar Google OAuth en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Selecciona tu proyecto
3. Click en el OAuth 2.0 Client ID existente
4. En **Authorized redirect URIs**, agrega:

```
https://[TU-APP].up.railway.app/api/auth/google/callback
```

5. Click en **Save**

**Ejemplo:** Si tu backend en Railway está en `https://floreria-aster-backend.up.railway.app`, el redirect URI sería:
```
https://floreria-aster-backend.up.railway.app/api/auth/google/callback
```

---

### PASO 4: Reiniciar el backend en Railway

1. Ve a **Railway** → Tu proyecto
2. Click en **Deployments**
3. Click en **Redeploy** (o espera a que detecte los cambios)

---

### PASO 5: Probar la autenticación

1. Ve a https://floreria-aster-erp.vercel.app/login
2. Prueba con:
   - **Usuario:** `admin`
   - **Contraseña:** `admin`

3. O prueba con **Google Sign-In**

---

## 🔍 VERIFICACIÓN DE ERRORES

### Si el login tradicional falla:

1. Verifica que el usuario admin se creó correctamente:
```sql
SELECT id, name, email, role, is_active, password_hash IS NOT NULL as has_password
FROM users 
WHERE email = 'admin';
```

2. Verifica las logs en Railway para ver el error exacto

### Si Google OAuth falla:

1. Verifica que `GOOGLE_CLIENT_SECRET` esté configurado en Railway
2. Verifica que el redirect URI en Google Cloud Console coincida EXACTAMENTE con:
   ```
   https://[TU-APP].up.railway.app/api/auth/google/callback
   ```
3. Verifica las logs en Railway

---

## 📊 IMPLEMENTAR AUTO-GUARDADO EN TIEMPO REAL

Para que cada usuario guarde su actividad en tiempo real, se implementará:

1. **Activity Log Table** en la base de datos
2. **Hook de auditoría** en el frontend
3. **Endpoint de logging** en el backend

Ver archivo `IMPLEMENTAR_ACTIVIDAD_TIEMPO_REAL.md` para más detalles.

---

## 🆘 SOPORTE

Si los problemas persisten:

1. Revisa las logs en Railway
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que la base de datos sea accesible desde Railway
