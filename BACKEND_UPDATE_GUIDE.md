# Guía de Actualización - Backend Railway

## Problema Reportado
Error 404 "Not Found" al intentar importar productos desde el frontend en Vercel.

## Cambios Realizados

### 1. `backend/src/middleware/auth.ts`
- Se actualizó la función `authenticate()` para que retorne una Promise y lance error cuando falla la autenticación
- Esto asegura que el hook global no continúe ejecutando el handler cuando hay error de auth

### 2. `backend/src/server.ts`
- Se cambió el hook `onRequest` de `async` a callback-style con `done()`
- Esto previene que Fastify continúe procesando la ruta si la autenticación falla

### 3. `backend/src/routes/import.ts`
- Se agregó endpoint `/api/import/debug` para verificar que las rutas están registradas
- Se simplificó el endpoint `/import-prices` para usar solo el hook global de autenticación
- Se agregó logging detallado para depuración en producción
- Se agregó handler 404 personalizado para rutas desconocidas

## Pasos para Actualizar en Railway

### Opción 1: Deploy Automático (Recomendado)
Si Railway está conectado a GitHub:

1. Hacer commit y push de los cambios:
```bash
git add .
git commit -m "fix: Corregir autenticación y logging en endpoints de importación"
git push origin main
```

2. Railway detectará automáticamente los cambios y desplegará

3. Verificar logs en Railway:
   - Ir a https://railway.app
   - Seleccionar el proyecto
   - Ver logs en tiempo real

### Opción 2: Deploy Manual con Railway CLI

```bash
# Instalar Railway CLI si no está instalado
npm install -g @railway/cli

# Login
railway login

# Deploy
cd backend
railway deploy
```

## Verificación Post-Deploy

### 1. Verificar Health Check
```bash
curl https://aster-backend-production.up.railway.app/health
```
Debe retornar: `{"status":"ok","database":"connected",...}`

### 2. Verificar Rutas de Importación
Desde el navegador (con sesión iniciada):
```
GET https://aster-backend-production.up.railway.app/api/import/debug
```

Debe retornar:
```json
{
  "status": "ok",
  "routes": [
    "POST /parse-file",
    "POST /parse-text",
    "POST /import-prices",
    "GET /export-template"
  ],
  "user": {
    "email": "tu@email.com",
    "role": "admin",
    "business_id": "uuid"
  }
}
```

### 3. Verificar Logs en Railway
Los logs deben mostrar:
- `[IMPORT] Registered routes`
- `[GLOBAL AUTH]` mensajes de depuración

## Posibles Causas del Error 404

1. **Backend no actualizado**: El código en Railway es antiguo
2. **Variables de entorno faltantes**: JWT_SECRET, DATABASE_URL
3. **Error de compilación TypeScript**: Verificar logs de build en Railway
4. **Rutas no registradas**: El plugin de import no se cargó correctamente

## Debugging en Producción

Si persiste el error 404, verificar:

1. **Logs de Railway**: Buscar errores de compilación o runtime
2. **Endpoint debug**: Si `/api/import/debug` también da 404, las rutas no están registradas
3. **CORS**: Verificar que el frontend en Vercel esté en la lista blanca de CORS

## Notas Importantes

- El endpoint `/import-prices` requiere rol `admin`
- El token JWT debe enviarse en header: `Authorization: Bearer <token>`
- El proxy de Vercel (`/api/*` → Railway) debe estar configurado correctamente
