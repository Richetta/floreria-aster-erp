# 🚀 Plan de Sincronización y Evolución — Mi Jardín ERP (Modelo Simplificado)

Este documento detalla el plan para alinear la realidad técnica con el nuevo modelo de dos planes: **Gratis** y **Profesional Completo**. Se eliminan las integraciones fiscales y de pagos para centrarse exclusivamente en la gestión del negocio.

---

## 📊 Matriz de Planes (Dual)

### 🌱 Plan Gratis - *Foco: Emprendimiento Inicial*
- [x] **Límites:** 1 usuario / 50 productos / 30 pedidos / 1 categoría.
- [x] **Historial:** Limitado a los últimos 30 días (Backend forzado).
- [x] **Funciones:** POS, Dashboard básico, Kanban de pedidos.
- [x] **Bloqueos:** Reportes, Caja, Mermas, OCR, CRM Full, Etiquetas.

### 👑 Plan Profesional Completo ($15.000/mes) - *Foco: Control Total*
- [x] **Límites:** Usuarios, productos, pedidos y categorías ilimitados.
- [x] **Historial:** Historial completo desde el primer día.
- [x] **Funciones de Gestión:**
    - [x] Reportes avanzados y exportaciones.
    - [x] Caja diaria con arqueos.
    - [x] Gestión de mermas y auditoría.
    - [x] Código de barras (crear e imprimir).
    - [x] Vista calendario y logística de entregas.
    - [x] OCR de listas de precios (Carga automática).
    - [x] CRM completo con historial/timeline del cliente.
    - [x] Paquetes/Combos (Ramos armados).

---

## 🛠️ Tareas Críticas Inmediatas

### 1. Hard-Limit: Historial de 30 días para Gratis
- [x] Implementado en Backend (`reports.ts`, `transactions.ts`, `orders.ts`).
- [ ] Refinar mensajes de UI para avisar que los datos viejos están ocultos por el plan.

### 2. CRM: Timeline del Cliente
- [x] Componente `CustomerHistoryModal` creado e integrado.
- [x] Protegido con guarda `crmFull`.

### 3. Simplificación de Plataforma
- [x] Eliminada referencia a AFIP y MercadoPago en planes y UI.
- [ ] Limpiar código muerto de integraciones no deseadas para aligerar la App.

---

## 📖 Manual de Protección de Funciones

Se mantienen las herramientas de control:
1. **`FeatureRouteGuard`**: Bloquea rutas de páginas completas.
2. **`requireFeature`**: Bloquea interacciones específicas (ej. botón de OCR).

*Nota: Cualquier nueva herramienta de gestión agregada debe ser habilitada en `useSubscription.tsx` bajo la bandera del plan `completo`.*

---
*Actualizado: 23 de Abril, 2026 - Modelo de 2 Planes.*
