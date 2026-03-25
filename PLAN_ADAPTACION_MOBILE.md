# 📱 Plan de Adaptación Mobile - Florería Aster ERP

## 🎯 Objetivo

Transformar la aplicación web actual en una experiencia **mobile-first** que sea:
- ✅ Fácilmente usable en celulares (320px - 768px)
- ✅ Legible sin zoom forzado
- ✅ Navegable con una mano
- ✅ Rápida y responsiva
- ✅ Consistente en todas las secciones

---

## 📊 Estado Actual

### Lo que YA funciona en mobile:
- ✅ Header mobile con hamburguesa (Layout.css)
- ✅ Sidebar deslizante con overlay (Sidebar.css)
- ✅ Algunos breakpoints básicos en 768px
- ✅ Tamaños de fuente aumentados para accesibilidad

### Problemas detectados:
- ❌ Tablas no responsivas (productos, ventas, clientes)
- ❌ Botones muy pequeños en algunas secciones
- ❌ Formularios con inputs apretados
- ❌ Cards que se salen del viewport
- ❌ Scroll horizontal no deseado
- ❌ Menús desplegables que se cortan
- ❌ Falta optimización táctil (touch targets)

---

## 🏗️ Arquitectura de la Solución

### Fase 1: Fundamentos Mobile (Prioridad ALTA)
### Fase 2: Adaptación por Secciones (Prioridad MEDIA)
### Fase 3: Optimizaciones y Pulido (Prioridad BAJA)

---

## 📋 FASE 1: Fundamentos Mobile

### 1.1 Archivo CSS Global Mobile (`src/styles/mobile-base.css`)

Crear un archivo base con utilidades mobile reutilizables:

```css
/* ============================================
   MOBILE BASE UTILITIES
   ============================================ */

/* Touch Targets - Mínimo 44x44px para dedos */
.mobile-touch-target {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* Typography Mobile */
@media (max-width: 768px) {
    :root {
        --font-size-base: 16px;
        --font-size-small: 14px;
        --font-size-large: 18px;
    }
    
    .text-h1 { font-size: 24px; }
    .text-h2 { font-size: 20px; }
    .text-h3 { font-size: 18px; }
}

/* Container Padding Mobile */
.page-container {
    padding: 1rem;
}

@media (max-width: 768px) {
    .page-container {
        padding: 0.75rem;
    }
}

/* Cards Mobile */
.card {
    border-radius: var(--radius-lg);
    padding: 1rem;
}

@media (max-width: 768px) {
    .card {
        padding: 0.875rem;
        border-radius: var(--radius-md);
    }
}

/* Buttons Mobile */
@media (max-width: 768px) {
    .btn {
        width: 100%;
        justify-content: center;
        padding: 0.875rem 1rem;
        font-size: 1rem;
        min-height: 48px;
    }
    
    .btn-icon {
        min-width: 44px;
        min-height: 44px;
    }
}

/* Tablas Responsivas */
.table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.table-responsive table {
    min-width: 600px; /* Forzar scroll horizontal en tablas */
}

/* Inputs Mobile */
@media (max-width: 768px) {
    .form-input {
        font-size: 16px; /* Prevenir zoom en iOS */
        min-height: 48px;
        padding: 0.875rem 1rem;
    }
}

/* Modal Mobile */
@media (max-width: 768px) {
    .modal-content {
        max-width: 95%;
        max-height: 95vh;
        margin: 0.5rem;
    }
    
    .modal-header {
        padding: 1rem;
    }
    
    .modal-body {
        padding: 1rem;
    }
    
    .modal-footer {
        padding: 1rem;
        flex-direction: column-reverse;
        gap: 0.5rem;
    }
    
    .modal-footer .btn {
        width: 100%;
    }
}
```

### 1.2 Importar en `index.css`

```css
@import './styles/mobile-base.css';
```

---

## 📋 FASE 2: Adaptación por Secciones

### 2.1 Dashboard (`src/pages/Dashboard/Dashboard.css`)

**Problemas:**
- KPI grid de 4 columnas se ve apretada
- Gráficos pueden salirse del container

**Solución:**

```css
@media (max-width: 768px) {
    .kpi-grid {
        grid-template-columns: 1fr; /* 1 columna en mobile */
        gap: 0.75rem;
    }
    
    .kpi-card {
        padding: 1rem;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .kpi-icon-wrapper {
        width: 48px;
        height: 48px;
    }
    
    .kpi-content h3 {
        font-size: 0.875rem;
    }
    
    .kpi-value {
        font-size: 1.5rem;
    }
    
    .kpi-secondary {
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
    }
}
```

---

### 2.2 Productos (`src/pages/Products/Products.css`)

**Problemas:**
- Tabla de productos muy ancha
- Botones de acción muy juntos
- Filtros de tags ocupan mucho espacio

**Solución:**

```css
@media (max-width: 768px) {
    /* Toolbar stacking */
    .toolbar-top-row {
        flex-direction: column;
        align-items: stretch;
    }
    
    .toolbar-actions-group {
        flex-direction: column;
        width: 100%;
    }
    
    .toolbar-actions-group .btn {
        width: 100%;
        justify-content: center;
    }
    
    /* Tag filters scroll horizontal */
    .tag-filters-container {
        overflow-x: auto;
        white-space: nowrap;
        padding-bottom: 0.5rem;
        -webkit-overflow-scrolling: touch;
    }
    
    /* Tabla responsive */
    .table-responsive {
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
    }
    
    /* Card view alternative para mobile */
    .product-card-mobile {
        display: block;
        padding: 1rem;
        background: var(--color-surface);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        margin-bottom: 0.75rem;
    }
    
    .product-card-mobile .product-name {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
    }
    
    .product-card-mobile .product-meta {
        display: flex;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--color-text-muted);
        margin-bottom: 0.5rem;
    }
    
    .product-card-mobile .product-actions {
        display: flex;
        gap: 0.5rem;
    }
    
    .product-card-mobile .product-actions .btn {
        flex: 1;
        padding: 0.5rem;
        font-size: 0.875rem;
    }
    
    /* Ocultar tabla en mobile, mostrar cards */
    .products-table {
        display: none;
    }
}
```

---

### 2.3 POS / Vender (`src/pages/POS/POS.css`)

**Problemas:**
- Layout de 2 columnas no funciona en mobile
- Carrito ocupa mucho espacio
- Botones de cantidad muy pequeños

**Solución:**

```css
@media (max-width: 768px) {
    .pos-container {
        flex-direction: column;
        height: auto;
    }
    
    .pos-catalog {
        flex: 1;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
        max-height: 60vh;
    }
    
    .pos-cart-panel {
        flex: none;
        width: 100%;
        max-height: none;
        border-radius: 0;
        box-shadow: none;
        border-left: none;
    }
    
    /* Navegación de tabs en mobile */
    .pos-nav-pills {
        overflow-x: auto;
        white-space: nowrap;
        -webkit-overflow-scrolling: touch;
    }
    
    .nav-pill {
        flex: 0 0 auto;
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
    }
    
    /* Botones de cantidad más grandes */
    .qty-btn-catalog,
    .qty-btn {
        min-width: 40px;
        min-height: 40px;
    }
    
    .qty-value-catalog,
    .qty-value {
        min-width: 30px;
        font-size: 1rem;
    }
    
    /* Carrito compacto */
    .cart-line-item {
        padding: 0.75rem;
    }
    
    .cart-line-actions {
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    /* Botones de pago en columna */
    .payment-buttons-compact {
        flex-direction: column;
    }
    
    .payment-btn-compact {
        flex-direction: row;
        justify-content: center;
    }
}
```

---

### 2.4 Ventas (`src/pages/Sales/Sales.css`)

**Problemas:**
- Tabla de ventas muy ancha
- Filtros apilados incorrectamente

**Solución:**

```css
@media (max-width: 768px) {
    .sales-filters {
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .sales-filters .form-input,
    .sales-filters .btn {
        width: 100%;
    }
    
    /* Tabla responsive o card view */
    .sale-card-mobile {
        display: block;
        padding: 1rem;
        background: var(--color-surface);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        margin-bottom: 0.75rem;
    }
    
    .sale-card-mobile .sale-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .sale-card-mobile .sale-id {
        font-size: 0.875rem;
        font-weight: 600;
    }
    
    .sale-card-mobile .sale-total {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--color-primary);
    }
    
    .sale-card-mobile .sale-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--color-text-muted);
    }
    
    .sales-table {
        display: none;
    }
}
```

---

### 2.5 Clientes (`src/pages/Customers/Customers.css`)

**Problemas:**
- Lista de clientes muy densa
- Formulario de edición ocupa toda la pantalla

**Solución:**

```css
@media (max-width: 768px) {
    .customer-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .customer-item {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .customer-item .customer-name {
        font-size: 1rem;
        font-weight: 600;
    }
    
    .customer-item .customer-phone {
        font-size: 0.875rem;
        color: var(--color-text-muted);
    }
    
    .customer-item .customer-actions {
        display: flex;
        gap: 0.5rem;
        width: 100%;
    }
    
    .customer-item .customer-actions .btn {
        flex: 1;
        padding: 0.5rem;
        font-size: 0.875rem;
    }
    
    /* Modal de cliente en mobile */
    .customer-modal .form-group {
        margin-bottom: 0.75rem;
    }
    
    .customer-modal .form-input {
        width: 100%;
    }
}
```

---

### 2.6 Pedidos (`src/pages/Orders/Orders.css`)

**Problemas:**
- Timeline de estados muy horizontal
- Detalles de entrega difíciles de leer

**Solución:**

```css
@media (max-width: 768px) {
    .order-timeline {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .order-timeline-item {
        padding: 0.75rem;
        flex-direction: row;
        gap: 0.75rem;
    }
    
    .order-delivery-info {
        padding: 1rem;
        font-size: 0.875rem;
    }
    
    .order-actions {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .order-actions .btn {
        width: 100%;
    }
}
```

---

### 2.7 Caja (`src/pages/CashRegister/CashRegister.css`)

**Problemas:**
- Gráficos de flujo muy anchos
- Lista de transacciones densa

**Solución:**

```css
@media (max-width: 768px) {
    .cash-flow-chart {
        height: 200px;
    }
    
    .transaction-item {
        padding: 0.875rem;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
    }
    
    .transaction-item .transaction-header {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .transaction-item .transaction-amount {
        font-size: 1.125rem;
    }
}
```

---

### 2.8 Reportes (`src/pages/Reports/Reports.css`)

**Problemas:**
- Filtros de fecha muy anchos
- Gráficos no responsivos

**Solución:**

```css
@media (max-width: 768px) {
    .report-filters {
        flex-direction: column;
    }
    
    .report-filters .form-group {
        width: 100%;
    }
    
    .report-filters .btn {
        width: 100%;
    }
    
    .report-chart-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    .report-card {
        padding: 1rem;
        margin-bottom: 0.75rem;
    }
}
```

---

### 2.9 Configuración (`src/pages/Settings/Settings.css`)

**Problemas:**
- Menú lateral muy ancho
- Formularios de configuración densos

**Solución:**

```css
@media (max-width: 768px) {
    .settings-container {
        flex-direction: column;
    }
    
    .settings-menu {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
        overflow-x: auto;
        white-space: nowrap;
        -webkit-overflow-scrolling: touch;
    }
    
    .settings-menu-item {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
    }
    
    .settings-content {
        padding: 1rem;
    }
    
    .settings-section {
        margin-bottom: 1.5rem;
    }
    
    .settings-section h3 {
        font-size: 1rem;
        margin-bottom: 0.75rem;
    }
}
```

---

## 📋 FASE 3: Optimizaciones y Pulido

### 3.1 Navegación Mejorada

```css
/* Scroll suave entre secciones */
html {
    scroll-behavior: smooth;
}

/* Safe areas para notches y home indicators */
@supports (padding: max(0px)) {
    .mobile-header {
        padding-left: max(1rem, env(safe-area-inset-left));
        padding-right: max(1rem, env(safe-area-inset-right));
        padding-top: max(0px, env(safe-area-inset-top));
    }
    
    .page-container {
        padding-bottom: max(1rem, env(safe-area-inset-bottom));
    }
}
```

### 3.2 Animaciones Performance

```css
/* Reducir animaciones en mobile para mejor performance */
@media (max-width: 768px) {
    * {
        animation-duration: 0.15s !important;
        transition-duration: 0.15s !important;
    }
    
    /* Mantener solo animaciones esenciales */
    .btn:active {
        transform: scale(0.98);
    }
}
```

### 3.3 Pull to Refresh (opcional, requiere JS)

```css
/* Indicator visual para pull-to-refresh */
.ptr--ptr {
    box-shadow: inset 0 -1px 0 var(--color-border);
}

.ptr--icon {
    fill: var(--color-primary);
}
```

### 3.4 Loading States Mobile

```css
@media (max-width: 768px) {
    .loading-spinner {
        width: 40px;
        height: 40px;
    }
    
    .loading-text {
        font-size: 0.875rem;
    }
}
```

---

## 🎨 Guía de Estilos Mobile

### Touch Targets
- **Mínimo:** 44x44px (recomendación Apple HIG)
- **Óptimo:** 48x48px
- **Espacio entre elementos:** 8px mínimo

### Typography
- **Tamaño base:** 16px (previene zoom en iOS)
- **Títulos H1:** 24px
- **Títulos H2:** 20px
- **Títulos H3:** 18px
- **Texto cuerpo:** 16px
- **Texto pequeño:** 14px

### Spacing
- **Padding de página:** 16px (0.75rem - 1rem)
- **Gap entre cards:** 12px (0.75rem)
- **Margen inferior de secciones:** 24px (1.5rem)

### Breakpoints
```css
/* Mobile pequeño */
@media (max-width: 375px) { }

/* Mobile estándar */
@media (max-width: 768px) { }

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) { }

/* Desktop */
@media (min-width: 1025px) { }
```

---

## ✅ Checklist de Implementación

### Fase 1: Fundamentos
- [ ] Crear `src/styles/mobile-base.css`
- [ ] Importar en `src/index.css`
- [ ] Verificar que no rompa desktop
- [ ] Test en Chrome DevTools mobile

### Fase 2: Por Sección
- [ ] Dashboard
- [ ] Productos
- [ ] POS / Vender
- [ ] Ventas
- [ ] Clientes
- [ ] Pedidos
- [ ] Caja
- [ ] Reportes
- [ ] Configuración
- [ ] Proveedores
- [ ] Compras
- [ ] Logística
- [ ] Recordatorios
- [ ] Mermas
- [ ] Movimientos de Stock

### Fase 3: Optimizaciones
- [ ] Safe areas para dispositivos con notch
- [ ] Animaciones performance
- [ ] Loading states mobile
- [ ] Test en dispositivos reales (iOS y Android)
- [ ] Test de usabilidad con usuarios reales

---

## 🧪 Testing

### Dispositivos a testear:
- iPhone SE (375px)
- iPhone 12/13 (390px)
- iPhone 14 Pro Max (430px)
- Samsung Galaxy S21 (360px)
- iPad Mini (768px)
- iPad Pro (1024px)

### Herramientas:
- Chrome DevTools Device Mode
- Safari Responsive Design Mode
- BrowserStack (si está disponible)
- Test en dispositivos físicos

### Métricas de éxito:
- ✅ Sin scroll horizontal no deseado
- ✅ Todos los botones son cliqueables (mínimo 44x44px)
- ✅ Texto legible sin zoom (mínimo 16px)
- ✅ Formularios usables sin zoom forzado en iOS
- ✅ Menús accesibles con una mano
- ✅ Modales no se salen de la pantalla
- ✅ Tiempo de carga < 3s en 4G

---

## 📦 Recursos y Referencias

### Guías de Diseño:
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)
- [Material Design Mobile](https://material.io/design/platform-guidance/android-touch.html)
- [Google Mobile UX Best Practices](https://developers.google.com/web/fundamentals/design-and-ux/responsive)

### Herramientas:
- [Responsively App](https://responsively.app/) - Testing multi-dispositivo
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly) - Google

### Librerías útiles (opcional):
- `react-use-gesture` - Gestos táctiles
- `pull-to-refresh` - Pull to refresh
- `react-swipeable` - Swipe gestures

---

## 🚀 Próximos Pasos

1. **Revisar y aprobar este plan** con el equipo
2. **Comenzar con Fase 1** (fundamentos)
3. **Priorizar secciones** más usadas en mobile (POS, Ventas, Productos)
4. **Testear en dispositivos reales** después de cada sección
5. **Iterar** basado en feedback de usuarios

---

## 📝 Notas Importantes

### Para Alejandra (vista cansada):
- Mantener tamaños de fuente grandes (mínimo 16px)
- Alto contraste en todos los elementos
- Evitar texto sobre imágenes
- Botones con iconos + texto (no solo iconos)

### Para uso en florería:
- Considerar uso con guantes (touch targets más grandes)
- Modo oscuro para mejor visibilidad en exteriores
- Notificaciones visibles y audibles

---

**Documento creado:** 2026-03-25  
**Última actualización:** 2026-03-25  
**Versión:** 1.0
