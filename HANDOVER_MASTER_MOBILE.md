# 📑 MASTER HANDOVER: Proyecto Rediseño Integral Mobile
## Florería Aster ERP - Documentación Técnica y de Producto

Este documento es una guía exhaustiva para que la inteligencia artificial (Qwen) o cualquier desarrollador continúe con la transformación móvil del ERP. No es solo un resumen; es el manual de arquitectura y estilo del proyecto.

---

## 1. VISIÓN Y FILOSOFÍA DEL PROYECTO
El objetivo es que el usuario sienta que está usando una **App Nativa**, no una web adaptada.
- **Ergonomía**: Uso de pulgares (controles en la mitad inferior).
- **Simplicidad**: Menos tablas, más "Feeds" y "Cards".
- **Estética "Premium"**: Inspirado en diseños modernos de SaaS (bordes muy redondeados `20px+`, sombras suaves, micro-animaciones).

---

## 2. ARQUITECTURA TÉCNICA: EL PATRÓN PROXY
Para salvaguardar la versión de escritorio, se utiliza un patrón de renderizado condicional en la entrada de cada módulo.

### Estructura de Archivos
```bash
src/pages/Modulo/
├── index.tsx              # Componente Proxy (Decide qué renderizar)
├── ModuloDesktop.tsx      # Archivo original de PC (Renombrado de Modulo.tsx)
├── ModuloMobile.tsx       # Nueva interfaz optimizada para smartphone
└── ModuloMobile.css       # Estilos exclusivos para la versión mobile
```

### Implementación del Proxy (`index.tsx`)
```tsx
import { SalesDesktop } from './SalesDesktop';
import { SalesMobile } from './SalesMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Sales = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    if (isMobile === null) return null; // Esperar detección
    return isMobile ? <SalesMobile /> : <SalesDesktop />;
};
```

---

## 3. UI KIT Y DESIGN TOKENS (MOBILE)

### Iconografía (Crítico)
Se ha migrado de `lucide-react` a **Google Material Symbols Rounded** para lograr una apariencia más nativa y consistente.
- **Importación en HTML**: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0" />`.
- **Uso**: `<span className="material-symbols-rounded">shopping_cart</span>`.

### Componentes de Navegación
1. **MobileBottomNav**: Barra inferior con 5 accesos directos. El botón central suele ser una acción principal (ej: POS).
2. **Bottom Sheets**: Para filtros, carritos o detalles secundarios, se usan paneles que suben desde abajo en lugar de modales centrados.
3. **Wizard Stepper**: Para procesos largos (como crear un Pedido), se usa un flujo de pasos (Wizard) para no saturar la pantalla.

---

## 4. AUDITORÍA DE MÓDULOS COMPLETADOS (Fase 1-6)

### 💰 POS & Pedidos (`src/pages/POS`)
- **Lógica**: Se separó en dos flujos internos: "Venta Rápida" (Venta inmediata) y "Agendar Pedido" (Wizard con pasos para Cliente -> Delivery -> Seña).
- **Escáner**: Integrado con la cámara del celular para leer códigos de barra en el inventario.

### 📊 Dashboard (`src/pages/Dashboard`)
- **UI**: Carruseles horizontales para métricas. Lista vertical de entregas próximas.

### 📦 Gestión de Pedidos (`src/pages/Orders`)
- **UI**: Lista tipo "Feed" con tarjetas interactivas. Estados diferenciados por colores pálidos y bordes gruesos.

### 🚚 Logística (`src/pages/Logistics`)
- **Driver View**: Interfaz para el repartidor con botones gigantes para:
  - **Llamar / WhatsApp**: Un toque para contactar al cliente.
  - **Google Maps**: Botón que abre la navegación a la dirección del pedido.

### 🎂 Recordatorios CRM (`src/pages/Reminders`)
- **Automatización**: Diferenciación de Cumpleaños vs Deudas. Botón verde directo para enviar mensajes de WhatsApp pre-armados.

### 🏦 Finanzas y Caja (`src/pages/Finances` & `CashRegister`)
- **Balances**: Cards de "Saldo Actual" con diseño limpio. Bottom Sheets para Apertura/Cierre de caja.

---

## 5. HOJA DE RUTA: PENDIENTES (Roadmap para Qwen)

Faltan adaptar los siguientes módulos siguiendo el **Patrón Proxy** y la estética descrita:

1. **Reportes (`/reports`)**:
   - *Desafío*: Gráficos complejos en pantalla pequeña.
   - *Solución*: Gráficos de barras verticales y leyendas debajo del gráfico. Cards de resumen de texto arriba.
2. **Mermas (`/mermas`)**:
   - *Contexto*: Registro de flores dañadas.
   - *Solución*: Selector de producto rápido + Input numérico grande + Botón de confirmación visual.
3. **Paquetes (`/paquetes`)**:
   - *Contexto*: Ramos pre-armados.
   - *Solución*: Galería de fotos (Cards) con toggle de disponibilidad táctil.
4. **Stock (`/stock`)**:
   - *Contexto*: Historial de movimientos.
   - *Solución*: Lista cronológica tipo "Notificaciones".
5. **Reposición (`/reposicion`)**:
   - *Contexto*: Qué comprar al proveedor.
   - *Solución*: Indicadores visuales de "Stock Bajo" y botón para "Añadir a lista de compra" estilo lista de supermercado.

---

## 6. REGLAS DE ORO PARA EL DESARROLLO
1. **Touch Targets**: Absolutamente todos los botones interactuables deben tener al menos `48px` de altura.
2. **Safe Areas**: Siempre usar `padding-bottom: 120px` (o similar) al final de las listas para que no queden tapadas por el `MobileBottomNav`.
3. **Validación**: Antes de crear un nuevo `Mobile.tsx`, verificar que el `index.tsx` de ese módulo ya esté configurado como Proxy para evitar colisiones.

Este documento resumen integra la embergadura de la aplicación y garantiza la continuidad del estándar de calidad establecido.
