# API REST - Florería Aster ERP

## Base URL
```
http://localhost:3000/api
```

## Autenticación
Todas las rutas (excepto `/auth/login` y `/auth/register`) requieren un token JWT en el header:
```
Authorization: Bearer <token>
```

---

## AUTH `/auth`

### POST `/auth/login`
Iniciar sesión
```json
{
  "email": "admin@floreriaaster.com",
  "password": "admin123"
}
```
Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Administrador",
    "email": "admin@floreriaaster.com",
    "role": "admin",
    "business_id": "uuid"
  }
}
```

### POST `/auth/register`
Registrar nuevo usuario (solo admin)

### GET `/auth/me`
Obtener usuario actual

---

## PRODUCTOS `/products`

### GET `/products`
Listar productos
Query params: `search`, `category`, `low_stock`, `active`, `limit`

### GET `/products/:id`
Obtener producto por ID

### POST `/products`
Crear producto
```json
{
  "code": "P-001",
  "name": "Ramo Rosas",
  "description": "Ramo de 12 rosas rojas",
  "category_id": "uuid",
  "cost": 5000,
  "price": 10000,
  "min_stock": 10,
  "is_barcode": false,
  "tags": ["San Valentín", "Ramos"]
}
```

### PUT `/products/:id`
Actualizar producto

### DELETE `/products/:id`
Eliminar producto (soft delete)

### POST `/products/:id/stock`
Actualizar stock
```json
{
  "quantity": 10,
  "reason": "Compra a proveedor",
  "type": "purchase"
}
```

---

## CLIENTES `/customers`

### GET `/customers`
Listar clientes
Query params: `search`, `has_debt`, `limit`

### GET `/customers/:id`
Obtener cliente por ID

### GET `/customers/:id/history`
Obtener cliente con historial de pedidos

### POST `/customers`
Crear cliente
```json
{
  "name": "María Gómez",
  "phone": "11-2345-6789",
  "email": "maria@email.com",
  "address_street": "Av. Siempre Viva",
  "address_number": "1234",
  "address_city": "Buenos Aires",
  "debt_balance": 0,
  "birthday": "1990-05-15",
  "notes": "Cliente frecuente"
}
```

### PUT `/customers/:id`
Actualizar cliente

### DELETE `/customers/:id`
Eliminar cliente (soft delete)

### POST `/customers/:id/payment`
Registrar pago de deuda
```json
{
  "amount": 5000,
  "payment_method": "cash",
  "notes": "Pago en efectivo"
}
```

### POST `/customers/:id/debt`
Agregar deuda a cliente
```json
{
  "amount": 3000,
  "notes": "Pedido pendiente de pago",
  "order_id": "uuid"
}
```

---

## PEDIDOS `/orders`

### GET `/orders`
Listar pedidos
Query params: `status`, `customer_id`, `from_date`, `to_date`, `delivery_method`, `limit`

### GET `/orders/:id`
Obtener pedido con items

### POST `/orders`
Crear pedido
```json
{
  "customer_id": "uuid",
  "delivery_date": "2026-03-15T10:00:00Z",
  "delivery_method": "delivery",
  "delivery_time_slot": "morning",
  "delivery_address": {
    "street": "Av. Siempre Viva",
    "number": "1234",
    "city": "Buenos Aires"
  },
  "contact_phone": "11-2345-6789",
  "card_message": "Feliz cumpleaños!",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1,
      "unit_price": 15000
    }
  ],
  "advance_payment": 5000
}
```

### PUT `/orders/:id`
Actualizar pedido

### PATCH `/orders/:id/status`
Cambiar estado del pedido
```json
{
  "status": "ready"
}
```

### DELETE `/orders/:id`
Eliminar pedido (soft delete)

### GET `/orders/delivery/scheduled`
Obtener pedidos para entrega
Query params: `date`

---

## TRANSACCIONES `/transactions`

### GET `/transactions`
Listar transacciones
Query params: `type`, `category`, `from_date`, `to_date`, `payment_method`, `limit`

### GET `/transactions/:id`
Obtener transacción por ID

### GET `/transactions/summary/period`
Obtener resumen financiero
Query params: `from_date`, `to_date`

Response:
```json
{
  "income": {
    "total": 100000,
    "cash": 60000,
    "card": 30000,
    "transfer": 10000
  },
  "expense": {
    "total": 40000,
    "cash": 20000,
    "transfer": 20000
  },
  "balance": 60000
}
```

### POST `/transactions`
Crear transacción
```json
{
  "type": "expense",
  "amount": 5000,
  "payment_method": "cash",
  "category": "Insumos",
  "description": "Compra de insumos",
  "notes": "Factura A-0001"
}
```

### POST `/transactions/sale`
Registrar venta POS
```json
{
  "total": 15000,
  "payment_method": "card",
  "customer_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1,
      "unit_price": 15000
    }
  ],
  "notes": "Venta de mostrador"
}
```

### POST `/transactions/expense`
Registrar gasto
```json
{
  "amount": 3000,
  "category": "Sueldos",
  "payment_method": "transfer",
  "description": "Pago jornal empleado",
  "notes": "Semana 11"
}
```

### DELETE `/transactions/:id`
Eliminar transacción (soft delete)

---

## PAQUETES `/packages`

### GET `/packages`
Listar paquetes
Query params: `section`, `is_active`, `search`, `limit`

### GET `/packages/:id`
Obtener paquete con componentes

### GET `/packages/:id/availability`
Verificar disponibilidad de stock
Response:
```json
{
  "available": true,
  "missing_components": []
}
```

### POST `/packages`
Crear paquete
```json
{
  "name": "Ramo San Valentín",
  "section": "Ramos Especiales",
  "description": "Ramo premium con rosas",
  "price": 35000,
  "is_active": true,
  "components": [
    {
      "product_id": "uuid",
      "quantity": 12
    }
  ]
}
```

### PUT `/packages/:id`
Actualizar paquete

### DELETE `/packages/:id`
Eliminar paquete (soft delete)

---

## PROVEEDORES `/suppliers`

### GET `/suppliers`
Listar proveedores
Query params: `category`, `search`, `limit`

### GET `/suppliers/:id`
Obtener proveedor con historial de compras

### POST `/suppliers`
Crear proveedor
```json
{
  "name": "Vivero El Rosal",
  "contact_name": "Ricardo",
  "phone": "11-4433-2211",
  "email": "info@viveroelrosal.com",
  "address": "Sarmiento 123, CABA",
  "category": "Flores de Corte",
  "notes": "Proveedor principal"
}
```

### PUT `/suppliers/:id`
Actualizar proveedor

### DELETE `/suppliers/:id`
Eliminar proveedor (soft delete)

### POST `/suppliers/:id/purchase`
Registrar compra a proveedor
```json
{
  "items": [
    {
      "product_id": "uuid",
      "quantity": 50,
      "unit_cost": 100,
      "update_price": false
    }
  ],
  "notes": "Compra semanal",
  "invoice_document_url": "https://..."
}
```

### GET `/suppliers/categories/list`
Obtener categorías de proveedores

---

## MERMAS `/waste`

### GET `/waste`
Listar reportes de mermas
Query params: `from_date`, `to_date`, `reason`, `product_id`, `limit`

### GET `/waste/summary`
Obtener resumen de mermas
Response:
```json
{
  "total_loss": 15000,
  "by_reason": {
    "Deterioro natural": 10000,
    "Rotura": 5000
  },
  "top_products": [
    {
      "product_id": "uuid",
      "product_name": "Rosas Rojas",
      "total_amount": 8000,
      "count": 3
    }
  ],
  "by_date": {
    "2026-03-10": 5000,
    "2026-03-11": 10000
  },
  "logs": [...]
}
```

### POST `/waste`
Reportar merma
```json
{
  "product_id": "uuid",
  "quantity": 5,
  "reason": "Deterioro natural",
  "notes": "Flores marchitas"
}
```

### DELETE `/waste/:id`
Eliminar reporte de merma (soft delete, restaura stock)

---

## ESTADOS HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validación fallida) |
| 401 | Unauthorized (token inválido/faltante) |
| 404 | Not Found |
| 409 | Conflict (email ya existe) |
| 500 | Internal Server Error |

---

## ERRORES

Formato de error:
```json
{
  "error": "Validation error",
  "details": [
    {
      "path": ["name"],
      "message": "El nombre debe tener al menos 2 caracteres"
    }
  ]
}
```

---

## NOTAS IMPORTANTES

1. **Multi-tenant**: Todas las rutas están aisladas por `business_id` usando Row Level Security
2. **Soft Delete**: Los recursos eliminados tienen `deleted_at` en lugar de borrarse físicamente
3. **Transacciones**: Las operaciones críticas usan transacciones de base de datos
4. **Stock**: El stock se actualiza automáticamente en ventas, compras y mermas
5. **Deudas**: Las deudas de clientes se gestionan automáticamente con pedidos y pagos
