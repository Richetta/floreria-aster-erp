# Configuración de MercadoPago para Mi Jardín ERP

## 📋 Paso a Paso

### 1. Crear Cuenta de Developer

1. Ir a https://www.mercadopago.com.ar/developers
2. Iniciar sesión con cuenta de MercadoPago (o crear una)
3. Ir a **Panel de Desarrollador** → **Tus Integraciones**
4. Click en **Crear Aplicación**
5. Nombre: `Mi Jardín ERP - Suscripciones`
6. Tipo: `Aplicación de plataforma`

### 2. Obtener Credenciales

Una vez creada la aplicación:

1. Ir a **Credenciales de Producción**
2. Copiar:
   - **Access Token** (esto va en `MP_ACCESS_TOKEN`)
   - **Public Key** (esto va en `VITE_MP_PUBLIC_KEY`)

### 3. Configurar Variables de Entorno

Agregar en el archivo `.env` del **backend**:

```env
# MercadoPago
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Agregar en el archivo `.env` del **frontend**:

```env
# MercadoPago
VITE_MP_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Instalar SDK de MercadoPago

```bash
cd backend
npm install mercadopago
```

### 5. Implementar con SDK (Recomendado)

El código actual usa fetch directo. Para producción, es mejor usar el SDK oficial:

```typescript
// backend/src/services/mercadopago.ts
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN! 
});

export const mpPreApproval = new PreApproval(client);

// Crear suscripción
export async function createSubscription(data: {
  reason: string;
  payerEmail: string;
  amount: number;
  backUrl: string;
}) {
  const result = await mpPreApproval.create({
    body: {
      reason: data.reason,
      payer_email: data.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: data.amount,
        currency_id: 'ARS',
      },
      back_url: data.backUrl,
      status: 'pending',
    }
  });

  return result;
}
```

### 6. Configurar Webhook URL

1. Ir a **MercadoPago Panel** → **Tu Aplicación** → **Webhooks**
2. Agregar URL: `https://tu-api.com/api/subscription/webhook/mercadopago`
3. Eventos a suscribir:
   - ✅ `payment` (pagos recurrentes)
   - ✅ `subscription_preapproval` (creación/actualización de suscripción)

### 7. Testing (Sandbox)

MercadoPago viene con modo sandbox activado por defecto con credenciales de prueba.

**Credenciales de prueba:**
- Access Token: `TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Tarjetas de prueba: https://www.mercadopago.com.ar/developers/developers/docs/test/checkout-pro#bookmark cartões_de_teste

**Flujo de testing:**
1. Crear suscripción con plan de prueba
2. Redirigir a MercadoPago sandbox
3. Usar tarjeta de prueba
4. Webhook notifica al backend
5. Backend actualiza estado de suscripción

### 8. Ir a Producción

Cuando estés listo:

1. Cambiar credenciales de `TEST-` a `APP_USR-`
2. Probar con tarjeta real
3. Verificar webhooks funcionen en producción
4. Configurar SSL en la API (Vercel ya lo tiene)

---

## 🧪 Variables de Entorno Necesarias

### Backend (.env)
```env
MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend (.env)
```env
VITE_MP_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📝 Notas Importantes

### Sobre Suscripciones en MercadoPago Argentina

⚠️ **IMPORTANTE:** Las suscripciones automáticas (preapproval) en Argentina pueden tener limitaciones. MercadoPago Argentina usa el sistema de **suscripciones** que requiere:

1. **Tener cuenta verificada** de empresa o monotributista
2. **Habilitar cobros recurrentes** en tu cuenta
3. **Aceptar términos** de facturación automática

### Alternativa si no tenés suscripciones automáticas

Si MercadoPago no te permite usar suscripciones automáticas:

**Opción A: Pago Manual Mensual**
- Generás un link de pago cada mes
- Enviás por email/WhatsApp al cliente
- Cliente paga y webhook actualiza

**Opción B: Transferencia Bancaria**
- Mostrás CBU/CVU en la app
- Cliente transfiere y sube comprobante
- Verificás manualmente o con OCR

**Opción C: MercadoPago Checkout**
- Usás checkout normal (no suscripción)
- Cliente paga cada mes manualmente
- Menos automático pero funcional

---

## 🚀 Implementación Mínima Funcional

Para empezar sin complicarte:

### 1. Solo cobro manual (sin webhooks)

```typescript
// backend/src/routes/subscription.ts
// Reemplazar create-mercadopago con link de pago simple

server.post('/create-payment-link', {
  preHandler: [authenticate]
}, async (request: any, reply: FastifyReply) => {
  const { amount, plan_name } = request.body as any;
  
  // Crear preference de pago
  const preference = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: [{
        title: `Mi Jardín ERP - ${plan_name}`,
        unit_price: amount,
        quantity: 1,
        currency_id: 'ARS'
      }],
      back_urls: {
        success: `${process.env.FRONTEND_URL}/subscription/success`,
        failure: `${process.env.FRONTEND_URL}/subscription/failure`,
        pending: `${process.env.FRONTEND_URL}/subscription/pending`
      },
      notification_url: `${process.env.BACKEND_URL}/api/subscription/webhook/mercadopago`,
      auto_return: 'approved'
    })
  });
  
  const data = await preference.json();
  
  reply.send({
    success: true,
    data: {
      init_point: data.init_point, // URL de pago
      preference_id: data.id
    }
  });
});
```

### 2. Webhook para confirmar pago

```typescript
// Ya implementado en subscription.ts
// Solo necesita MP_ACCESS_TOKEN configurado
```

---

## 📞 Soporte MercadoPago

- Documentación: https://www.mercadopago.com.ar/developers
- SDK Node: https://github.com/mercadopago/sdk-nodejs
- Community: https://mercadopago.com.ar/community

---

## ✅ Checklist Final

- [ ] Crear cuenta developer MercadoPago
- [ ] Crear aplicación
- [ ] Obtener credenciales (TEST primero)
- [ ] Configurar variables de entorno
- [ ] Instalar SDK `npm install mercadopago`
- [ ] Configurar webhook URL
- [ ] Probar con tarjetas de prueba
- [ ] Verificar webhook funcione
- [ ] Cambiar a credenciales de producción
- [ ] Configurar SSL (ya hecho por Vercel)
- [ ] Documentar proceso para usuarios

---

¿Listo para cobrar suscripciones! 🎉
