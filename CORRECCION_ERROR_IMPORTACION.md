# Corrección de Error 404 en Importación de Productos

## Problema Reportado

Cuando se usa la opción de importar productos en el catálogo:
1. Luego de pegar y organizar la lista, al procesar pide "¿Qué datos querés actualizar?" (esto es correcto)
2. Al intentar importar, muestra: **"Error al importar: Not Found"**
3. La consola muestra error 404 en `/api/import/import-prices`

## Causa Raíz

El problema estaba en la cadena de autenticación del backend:

1. **Hook global `onRequest`** estaba usando `await` con una función que ya enviaba respuesta
2. Cuando `authenticate()` fallaba y enviaba 401, el `await` hacía que Fastify continuara ejecutando el handler
3. Esto causaba un comportamiento inconsistente que resultaba en 404 en lugar de 401

## Solución Implementada

### Archivos Modificados

#### 1. `backend/src/middleware/auth.ts`
**Cambio:** La función `authenticate()` ahora:
- Retorna `Promise<void>`
- Lanza un error después de enviar la respuesta 401
- Esto previene que el hook continúe ejecutando el handler

```typescript
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err: any) {
    reply.code(401).send({ error: 'Unauthorized', message: err.message });
    throw new Error('Unauthorized'); // ⚠️ Importante: detiene la ejecución
  }
}
```

#### 2. `backend/src/server.ts`
**Cambio:** El hook `onRequest` ahora usa callback-style con `done()`:

```typescript
fastify.addHook('onRequest', (request, reply, done) => {
  // ... lógica de skip ...
  
  authenticate(request, reply)
    .then(() => done())
    .catch((err) => {
      console.error('[GLOBAL AUTH] Error:', err);
      done(err);
    });
});
```

#### 3. `backend/src/routes/import.ts`
**Cambios:**
- Simplificado el endpoint `/import-prices` para usar solo el hook global (sin `preHandler` duplicado)
- Agregado logging detallado para debugging en producción
- Agregado endpoint `/api/import/debug` para verificar que las rutas están registradas

```typescript
// Ahora el endpoint es más simple y usa auth global
fastify.post('/import-prices', async (request, reply) => {
  const user = request.user as any;
  
  // Solo verifica rol admin (auth ya viene del hook global)
  if (user.role !== 'admin') {
    return reply.code(403).send({ error: 'Only admins can import prices' });
  }
  
  // ... lógica de import ...
});
```

## Pasos para Desplegar en Producción (Railway)

### Opción A: Si Railway está conectado a GitHub (Recomendado)

```bash
# 1. Hacer commit de los cambios
git add .
git commit -m "fix: Corregir autenticación en endpoints de importación"

# 2. Push a main (o la rama que use Railway)
git push origin main

# 3. Railway detectará automáticamente y desplegará
# 4. Ver logs en https://railway.app
```

### Opción B: Deploy manual con Railway CLI

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Deploy desde la carpeta del backend
cd backend
railway deploy
```

## Verificación Post-Deploy

### 1. Verificar que el backend está online
```bash
curl https://aster-backend-production.up.railway.app/health
```
Debe retornar algo como:
```json
{
  "status": "ok",
  "database": "connected",
  "dbHost": "54.232.77.43",
  "timestamp": "2026-03-26T...",
  "env": "production"
}
```

### 2. Verificar rutas de importación (con sesión iniciada)
Abrir en el navegador:
```
https://aster-backend-production.up.railway.app/api/import/debug
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

### 3. Probar importación desde el frontend
1. Ir a `https://floreria-aster-erp.vercel.app/productos`
2. Click en "Importar"
3. Pegar texto o subir archivo
4. Revisar datos en preview
5. Seleccionar qué actualizar (costos, precios, stock)
6. Click en "Importar Datos"
7. Debería funcionar sin error 404

## Logging en Producción

Los siguientes logs aparecerán en Railway cuando se use la importación:

```
[IMPORT-PRICES] Request received: POST /api/import/import-prices
[IMPORT-PRICES] Headers: {...}
[IMPORT-PRICES] User authenticated: usuario@email.com Role: admin
[IMPORT-PRICES] Starting import for user: usuario@email.com
[IMPORT-PRICES] Request body keys: ["data","update_costs","update_prices",...]
[IMPORT-PRICES] Validation passed, importing 10 products
```

Si hay error, aparecerá:
```
[IMPORT-PRICES] Error: <mensaje del error>
[IMPORT-PRICES] Stack: <stack trace>
```

## ¿Por qué aparece "¿Qué datos querés actualizar?"?

Este paso **es correcto y necesario** porque:

1. **No todos los imports son iguales**: A veces solo querés actualizar precios, otras veces también costos y stock
2. **El endpoint es dual**: Sirve tanto para crear productos nuevos como actualizar existentes
3. **Flexibilidad**: Permite elegir si aplicar margen automático o no

El flujo completo es:
1. **Upload** → Subir archivo o pegar texto
2. **Preview** → Revisar y editar datos detectados
3. **Options** → Seleccionar qué actualizar (✅ correcto)
4. **Result** → Ver resultado de la importación

## Posibles Problemas Persistentes

### Si sigue apareciendo 404 después del deploy:

1. **Verificar logs de build en Railway**: Puede haber error de compilación TypeScript
2. **Verificar variables de entorno**: 
   - `JWT_SECRET` debe estar configurada
   - `DATABASE_URL` debe ser válida
3. **Verificar CORS**: El frontend en Vercel debe estar en la lista blanca

### Si el error es 401 Unauthorized:

1. El token JWT expiró → Cerrar sesión y volver a loguearse
2. El usuario no tiene rol `admin` → Verificar en base de datos

### Si el error es 403 Forbidden:

El usuario no tiene rol `admin`. Solo admins pueden importar productos.

## Resumen de Endpoints de Importación

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/import/parse-file` | POST | ✅ | Parsea archivo subido |
| `/api/import/parse-text` | POST | ✅ | Parsea texto pegado |
| `/api/import/import-prices` | POST | ✅ + Admin | Importa datos a BD |
| `/api/import/export-template` | GET | ✅ | Descarga plantilla CSV |
| `/api/import/debug` | GET | ✅ | Verifica rutas registradas |

## Archivos de Documentación Relacionados

- `BACKEND_UPDATE_GUIDE.md` - Guía detallada de actualización
- `documentacion.md` - Documentación completa del sistema
- `DEPLOY_GUIDE.md` - Guía de despliegue general
