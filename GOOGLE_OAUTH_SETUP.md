# ⚠️ IMPORTANTE: CONFIGURACIÓN FINAL DE GOOGLE OAUTH

## ESTE ARCHIVO DEBE LEERSE DESPUÉS DEL DEPLOY

---

## 🎯 QUÉ HACER CON ESTE ARCHIVO

Una vez que hayas completado el deploy en **Railway** y **Vercel**, necesitas actualizar las **Redirect URIs** en Google Cloud Console.

---

## 📋 PASOS A SEGUIR

### PASO 1: Obtener URLs de Producción

Después del deploy, tendrás estas URLs:

1. **Backend en Railway:**
   - URL: `https://__________.up.railway.app`
   - Ejemplo: `https://aster-erp-production.up.railway.app`

2. **Frontend en Vercel:**
   - URL: `https://__________.vercel.app`
   - Ejemplo: `https://floreria-aster.vercel.app`

**✅ COPIA ESTAS URLs**

---

### PASO 2: Ir a Google Cloud Console

1. Abrir: https://console.cloud.google.com/apis/credentials
2. Iniciar sesión con tu cuenta de Google
3. Seleccionar el proyecto: `floreria-aster-erp`

---

### PASO 3: Editar OAuth 2.0 Client

1. En la lista de **"OAuth 2.0 Client IDs"**, hacer click en tu cliente
   - Nombre: algo como "Florería Aster ERP"
   - Client ID: `806329509349-r910mo70k002j62jrohh3mlr5uottjlo.apps.googleusercontent.com`

2. Hacer click en el lápiz ✏️ para editar

---

### PASO 4: Agregar Authorized Redirect URIs

Agregar **ESTAS 4 URIs** (las 2 primeras ya deberían estar, las 2 últimas son las NUEVAS de producción):

```
# Desarrollo (ya deberían estar)
http://localhost:3000/api/auth/google/callback
http://localhost:5173

# PRODUCCIÓN (AGREGAR ESTAS)
https://ASTER-ERP-PRODUCCION.up.railway.app/api/auth/google/callback
https://floreria-aster.vercel.app
```

**⚠️ REEMPLAZAR:**
- `ASTER-ERP-PRODUCCION` con el nombre real de tu app en Railway
- `floreria-aster` con el nombre real de tu app en Vercel

---

### PASO 5: Guardar Cambios

1. Click en **"SAVE"**
2. Esperar ~30 segundos que Google propague los cambios
3. ✅ ¡Listo!

---

## 🧪 VERIFICAR QUE FUNCIONA

### Test 1: Backend Health Check

```
https://TU-RAILWAY.up.railway.app/health
```

**Debe responder:**
```json
{"status":"ok","timestamp":"2026-03-15T..."}
```

---

### Test 2: Login con Google

1. Ir a: `https://TU-VERCEL.vercel.app/login`
2. Click en **"Sign in with Google"**
3. Seleccionar cuenta de Google
4. ✅ Debería loguear y llevar al dashboard

**Si da error:**
- Verificar que las redirect URIs están bien escritas
- Verificar que no hay espacios al final
- Verificar que usa `https://` (no `http://`)
- Esperar 1-2 minutos (Google puede tardar en propagar)

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: "redirect_uri_mismatch"

**Causa:** La redirect URI en tu app no coincide con la de Google Cloud

**Solución:**
1. Verificar `GOOGLE_REDIRECT_URI` en Railway Variables
2. Verificar que esa misma URI está en Google Cloud Console
3. Deben ser **IDÉNTICAS** (incluyendo trailing slash o no)

---

### Error: "access_denied" o "invalid_grant"

**Causa:** Token expirado o configuración incorrecta

**Solución:**
1. Borrar caché del navegador
2. Cerrar sesión en Google
3. Volver a intentar
4. Si persiste, regenerar Client Secret en Google Cloud

---

### Error: "Google Sign-In no funciona en desarrollo"

**Causa:** Google OAuth requiere HTTPS en producción

**Solución:**
- En localhost funciona con HTTP (excepción de desarrollo)
- En producción, Vercel y Railway usan HTTPS automáticamente
- Verificar que la URL de producción tenga `https://`

---

## 📞 NECESITAS AYUDA

Si tienes problemas:

1. **Verifica logs en Railway:**
   - Ir a Railway Dashboard → Tu proyecto → Logs
   - Buscar errores de Google OAuth

2. **Verifica variables de entorno:**
   - Railway: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
   - Vercel: `VITE_GOOGLE_CLIENT_ID`

3. **Verifica Google Cloud Console:**
   - El OAuth Client está habilitado
   - Las redirect URIs están bien escritas
   - El proyecto está activo

---

## ✅ CHECKLIST FINAL

- [ ] Backend deployado en Railway
- [ ] Frontend deployado en Vercel
- [ ] URLs de producción copiadas
- [ ] Google Cloud Console abierto
- [ ] OAuth Client editado
- [ ] 4 redirect URIs agregadas (2 dev + 2 prod)
- [ ] Cambios guardados
- [ ] Health check del backend responde OK
- [ ] Login con Google funciona en producción
- [ ] Login tradicional funciona en producción

---

**¡Una vez completado este checklist, tu app está 100% lista para producción! 🎉**
