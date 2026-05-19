import type { TransactionLocal, Order, Product, Customer } from '../../../store/slices/types';
import type { WasteLog } from '../../../services/api';

export interface SmartAlert {
    id: string;
    title: string;
    description: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    icon: string;
}

export interface SeasonalityData {
    currentSeasonName: string;
    seasonType: 'alta' | 'media' | 'baja';
    description: string;
    nextKeyDateName: string;
    daysToNextKeyDate: number;
    recommendedActions: string[];
}

export interface ForecastData {
    projectedNextWeekSales: number;
    trendDirection: 'up' | 'down' | 'flat';
    trendPercentage: number;
    humanInterpretation: string;
}

export interface BusinessIntelligenceMetrics {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    ticketPromedio: number;
    estimatedProfitMargin: number; // percentage
    deudaCriticaRatio: number; // percentage
    dineroInmovilizado: number;
    costoMermas: number;
    vipCustomers: { id: string; name: string; totalSpent: number; orderCount: number }[];
    alertas: SmartAlert[];
    seasonality: SeasonalityData;
    forecast: ForecastData;
}

// Fechas especiales clave de la florería
const FLORIST_SPECIAL_DATES = [
    { name: 'San Valentín', month: 1, day: 14, weight: 'alta' }, // Febrero
    { name: 'Día de los Enamorados', month: 5, day: 12, weight: 'alta' }, // Junio
    { name: 'Día del Amigo', month: 6, day: 20, weight: 'media' }, // Julio
    { name: 'Día de la Primavera', month: 8, day: 21, weight: 'alta' }, // Septiembre (0-indexed base for months is Jan = 0)
    { name: 'Día de la Madre', month: 9, day: 18, weight: 'alta' }, // Octubre (tercer domingo aprox, seteado 18)
    { name: 'Navidad y Fin de Año', month: 11, day: 24, weight: 'alta' } // Diciembre
];

export const analyzeFinances = (
    transactions: TransactionLocal[] = [],
    orders: Order[] = [],
    products: Product[] = [],
    customers: Customer[] = [],
    wasteLogs: WasteLog[] = []
): BusinessIntelligenceMetrics => {
    
    // 1. Ingresos y Egresos básicos
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const netBalance = totalIncome - totalExpense;

    // 2. Ticket Promedio (Basado en órdenes o transacciones si no hay órdenes)
    let ticketPromedio = 0;
    const completedOrders = orders.filter(o => o.status !== 'cancelled');
    if (completedOrders.length > 0) {
        const totalSalesSum = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        ticketPromedio = Math.round(totalSalesSum / completedOrders.length);
    } else {
        const incomeTx = transactions.filter(t => t.type === 'income');
        if (incomeTx.length > 0) {
            ticketPromedio = Math.round(totalIncome / incomeTx.length);
        }
    }

    // 3. Margen de Ganancia Estimado
    // Margen = ((Precio Venta - Costo) / Precio Venta) * 100
    let totalSalesVal = 0;
    let totalCostVal = 0;

    completedOrders.forEach(order => {
        totalSalesVal += Number(order.total) || 0;
        const items = order.items || [];
        items.forEach((item: any) => {
            const qty = Number(item.qty || item.quantity) || 1;
            const price = Number(item.price || item.unit_price) || 0;
            
            // Buscar costo del producto
            const prod = products.find(p => p.id === item.product_id || p.id === item.productId);
            let cost = prod?.cost || prod?.cost === 0 ? prod.cost : price * 0.5; // Fallback al 50% de costo
            
            totalCostVal += cost * qty;
        });
    });

    // Si no hay órdenes, estimamos según productos y transacciones
    if (totalSalesVal === 0) {
        products.forEach(p => {
            const cost = p.cost || p.price * 0.5;
            totalSalesVal += p.price;
            totalCostVal += cost;
        });
    }

    const estimatedProfitMargin = totalSalesVal > 0 
        ? Math.max(0, Math.min(100, Math.round(((totalSalesVal - totalCostVal) / totalSalesVal) * 100))) 
        : 50;

    // 4. Deuda Crítica Ratio (Deuda total sobre facturación total)
    const totalDebt = customers.reduce((sum, c) => sum + (Number(c.debtBalance) || 0), 0);
    const deudaCriticaRatio = totalIncome > 0 ? Math.round((totalDebt / totalIncome) * 100) : 0;

    // 5. Dinero Inmovilizado (Stock sin movimiento en los últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Obtener IDs de productos vendidos en los últimos 30 días
    const recentSoldProductIds = new Set<string>();
    completedOrders.forEach(o => {
        const orderDate = new Date(o.date);
        if (orderDate >= thirtyDaysAgo) {
            (o.items || []).forEach((item: any) => {
                if (item.product_id) recentSoldProductIds.add(item.product_id);
                if (item.productId) recentSoldProductIds.add(item.productId);
            });
        }
    });

    let dineroInmovilizado = 0;
    products.forEach(p => {
        if (p.stock > 0 && !recentSoldProductIds.has(p.id)) {
            const cost = p.cost || p.price * 0.45;
            dineroInmovilizado += cost * p.stock;
        }
    });

    // 6. Costo de Mermas (Valorizado)
    let costoMermas = 0;
    wasteLogs.forEach(w => {
        const prod = products.find(p => p.id === w.product_id);
        const cost = prod?.cost !== undefined ? prod.cost : (prod?.price !== undefined ? prod.price * 0.5 : 0);
        costoMermas += cost * w.quantity;
    });

    // Si no hay logs de mermas directos, estimamos de transacciones con categoría mermas
    if (costoMermas === 0) {
        costoMermas = transactions
            .filter(t => t.type === 'expense' && (t.category.toLowerCase().includes('merma') || t.category.toLowerCase().includes('desperdicio')))
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }

    // 7. VIP Customers (Clientes más valiosos)
    const vipCustomers = customers
        .map(c => {
            // Calcular aportes de orders si no tiene totalSpent precalculado
            const customerSpent = completedOrders
                .filter(o => o.customerId === c.id || o.customerName === c.name)
                .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            
            return {
                id: c.id,
                name: c.name,
                totalSpent: c.total_spent || customerSpent,
                orderCount: c.total_orders || completedOrders.filter(o => o.customerId === c.id).length
            };
        })
        .filter(c => c.totalSpent > 0)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

    // 8. Temporadas y Estacionalidad
    const now = new Date();
    const currentMonth = now.getMonth(); // 0 = Ene, 11 = Dic
    
    // Determinar estación en el hemisferio sur
    let currentSeasonName = 'Invierno';
    let seasonType: 'alta' | 'media' | 'baja' = 'media';
    let seasonDescription = 'Temporada estable de compras cotidianas e institucionales.';
    
    if (currentMonth >= 8 && currentMonth <= 10) { // Septiembre, Octubre, Noviembre
        currentSeasonName = 'Primavera 🌸';
        seasonType = 'alta';
        seasonDescription = '¡Temporada dorada de la florería! Alta demanda por primavera y eventos.';
    } else if (currentMonth >= 11 || currentMonth <= 1) { // Diciembre, Enero, Febrero
        currentSeasonName = 'Verano ☀️';
        seasonType = 'baja';
        seasonDescription = 'Calor intenso y vacaciones. Momento ideal para flores secas y plantas de interior.';
    } else if (currentMonth >= 2 && currentMonth <= 4) { // Marzo, Abril, Mayo
        currentSeasonName = 'Otoño 🍂';
        seasonType = 'media';
        seasonDescription = 'Clima templado. Buena demanda corporativa y arreglos cálidos.';
    } else { // Junio, Julio, Agosto
        currentSeasonName = 'Invierno ❄️';
        seasonType = 'media';
        seasonDescription = 'Clima frío. Destacan orquídeas y ramos de invierno.';
    }

    // Calcular días a la próxima fecha patria floral
    let nextKeyDateName = FLORIST_SPECIAL_DATES[0].name;
    let daysToNextKeyDate = 999;
    
    FLORIST_SPECIAL_DATES.forEach(special => {
        const eventYear = (currentMonth > special.month || (currentMonth === special.month && now.getDate() > special.day)) 
            ? now.getFullYear() + 1 
            : now.getFullYear();
            
        const eventDate = new Date(eventYear, special.month, special.day);
        const timeDiff = eventDate.getTime() - now.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        if (diffDays >= 0 && diffDays < daysToNextKeyDate) {
            daysToNextKeyDate = diffDays;
            nextKeyDateName = special.name;
        }
    });

    const recommendedActions: string[] = [];
    if (seasonType === 'alta') {
        recommendedActions.push('Asegurar stock extra de flores de temporada.');
        recommendedActions.push('Lanzar ofertas de preventa para fechas fuertes.');
    } else if (seasonType === 'baja') {
        recommendedActions.push('Fomentar ventas de plantas duraderas y secas.');
        recommendedActions.push('Reducir inventario perecedero para evitar mermas.');
    } else {
        recommendedActions.push('Optimizar logística de envíos para días laborales.');
        recommendedActions.push('Lanzar suscripciones florales para clientes recurrentes.');
    }

    if (daysToNextKeyDate <= 15) {
        recommendedActions.push(`¡Faltan solo ${daysToNextKeyDate} días para ${nextKeyDateName}! Planifica stock floral masivo.`);
    }

    const seasonality: SeasonalityData = {
        currentSeasonName,
        seasonType,
        description: seasonDescription,
        nextKeyDateName,
        daysToNextKeyDate,
        recommendedActions
    };

    // 9. Forecasting / Predicción Lineal de Ventas (Últimas 4 semanas)
    // Agrupamos ventas por semana (semana 1, semana 2, semana 3, semana 4)
    const weeklyRevenues = [0, 0, 0, 0];
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    
    completedOrders.forEach(o => {
        const orderDate = new Date(o.date);
        const diffMs = now.getTime() - orderDate.getTime();
        const weekIndex = Math.floor(diffMs / msInWeek);
        if (weekIndex >= 0 && weekIndex < 4) {
            weeklyRevenues[3 - weekIndex] += Number(o.total) || 0; // Guardamos en orden w1, w2, w3, w4
        }
    });

    // Si no hay datos de órdenes semanales, dividimos ingresos en 4 bloques
    if (weeklyRevenues.reduce((a, b) => a + b, 0) === 0 && totalIncome > 0) {
        weeklyRevenues[0] = totalIncome * 0.22;
        weeklyRevenues[1] = totalIncome * 0.24;
        weeklyRevenues[2] = totalIncome * 0.26;
        weeklyRevenues[3] = totalIncome * 0.28;
    }

    // Regresión lineal simple: y = mx + b
    // x = [0, 1, 2, 3] semanas
    // y = weeklyRevenues
    const x = [0, 1, 2, 3];
    const y = weeklyRevenues;
    const n = 4;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, idx) => sum + val * y[idx], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const denominator = (n * sumXX - sumX * sumX);
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    
    // Proyectar semana 5 (x = 4)
    const projectedNextWeekSales = Math.max(0, Math.round(y[3] + slope));
    
    let trendDirection: 'up' | 'down' | 'flat' = 'flat';
    let trendPercentage = 0;
    
    if (y[3] > 0 && slope !== 0) {
        trendPercentage = Math.round((slope / y[3]) * 100);
        if (slope > 50) trendDirection = 'up';
        else if (slope < -50) trendDirection = 'down';
    }

    let humanInterpretation = 'Las ventas se mantendrán estables en los próximos días.';
    if (trendDirection === 'up') {
        humanInterpretation = `¡Tendencia de crecimiento del ${Math.abs(trendPercentage)}%! Se proyectan excelentes ingresos para la próxima semana.`;
    } else if (trendDirection === 'down') {
        humanInterpretation = `Alerta de caída del ${Math.abs(trendPercentage)}% en facturación. Te sugerimos revisar promociones de catálogo.`;
    }

    const forecast: ForecastData = {
        projectedNextWeekSales,
        trendDirection,
        trendPercentage: Math.abs(trendPercentage),
        humanInterpretation
    };

    // 10. Alertas Inteligentes Activas
    const alertas: SmartAlert[] = [];

    // Alerta 1: Caída de ventas
    if (trendDirection === 'down' && trendPercentage > 15) {
        alertas.push({
            id: 'sales_drop',
            title: 'Caída de Facturación Semanal',
            description: `Se detectó una contracción del ${trendPercentage}% en ventas recientes. Te aconsejamos activar productos estancados.`,
            type: 'danger',
            icon: 'trending_down'
        });
    }

    // Alerta 2: Cuentas fiadas críticas
    if (deudaCriticaRatio > 35) {
        alertas.push({
            id: 'high_debt',
            title: 'Morosidad Crítica en Local',
            description: `Las cuentas fiadas representan el ${deudaCriticaRatio}% de tus ingresos totales. Te aconsejamos pausar créditos a deudores activos.`,
            type: 'danger',
            icon: 'person_alert'
        });
    } else if (deudaCriticaRatio > 15) {
        alertas.push({
            id: 'mid_debt',
            title: 'Cuentas Pendientes Elevadas',
            description: `Tienes $${totalDebt.toLocaleString('es-AR')} pendientes de cobro. Recuerda mandar un recordatorio amistoso de pago por WhatsApp.`,
            type: 'warning',
            icon: 'account_balance_wallet'
        });
    }

    // Alerta 3: Próxima fecha estacional clave
    if (daysToNextKeyDate <= 15) {
        alertas.push({
            id: 'seasonal_date',
            title: `¡Se acerca ${nextKeyDateName}!`,
            description: `Faltan solo ${daysToNextKeyDate} días. Es una temporada de demanda ${FLORIST_SPECIAL_DATES.find(d => d.name === nextKeyDateName)?.weight || 'alta'}. Prepara tus insumos y envoltorios.`,
            type: 'success',
            icon: 'temp_preferences_eco'
        });
    }

    // Alerta 4: Dinero inmovilizado
    if (dineroInmovilizado > 250000) {
        alertas.push({
            id: 'dead_stock',
            title: 'Capital Inmovilizado en Flores/Plantas',
            description: `Tienes aprox. $${dineroInmovilizado.toLocaleString('es-AR')} detenidos en productos sin ventas en 30 días. ¡Lanza un descuento o combo especial!`,
            type: 'warning',
            icon: 'hourglass_empty'
        });
    }

    // Alerta 5: Mermas críticas
    const mermaRatio = totalIncome > 0 ? (costoMermas / totalIncome) * 100 : 0;
    if (mermaRatio > 12) {
        alertas.push({
            id: 'critical_waste',
            title: 'Pérdidas Críticas por Mermas',
            description: `El desperdicio representa el ${Math.round(mermaRatio)}% de tus ingresos. Revisa la refrigeración de tus flores y el orden de salida.`,
            type: 'danger',
            icon: 'delete_forever'
        });
    }

    // Alerta por defecto si todo marcha impecable
    if (alertas.length === 0) {
        alertas.push({
            id: 'all_good',
            title: '¡Operación en Óptimas Condiciones! ✨',
            description: 'Tus finanzas no registran alertas de morosidad, stock inmovilizado ni pérdidas críticas. ¡Excelente gestión comercial!',
            type: 'success',
            icon: 'verified'
        });
    }

    return {
        totalIncome,
        totalExpense,
        netBalance,
        ticketPromedio,
        estimatedProfitMargin,
        deudaCriticaRatio,
        dineroInmovilizado,
        costoMermas,
        vipCustomers,
        alertas,
        seasonality,
        forecast
    };
};
