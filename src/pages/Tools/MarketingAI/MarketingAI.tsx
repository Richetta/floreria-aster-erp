import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles,
    Calendar,
    Flame,
    Copy,
    Check,
    Camera,
    ShoppingBag,
    Award,
    Compass,
    Heart,
    Smile,
    BookOpen,
    Coins,
    Instagram,
    Palette,
    Layers,
    ArrowLeft,
    CheckCircle2,
    BookmarkCheck
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { useNavigate } from 'react-router-dom';
import type { Product, Customer } from '../../../store/slices/types';
import './MarketingAI.css';

// interfaces locales para el motor de marketing
interface MarketingSuggestion {
    id: string;
    priority: 'urgent' | 'recommended' | 'opportunity';
    title: string;
    reason: string;
    icon: string;
    details: {
        idea: string;
        objective: string;
        whyRecommended: string;
        difficulty: 'Fácil' | 'Media' | 'Avanzada';
        estimatedTime: string;
        recordingGuide: {
            steps: { shot: string; description: string; duration: string }[];
            music: string;
        };
        hooks: Record<string, string>; // Mapeo de tono -> hook
        copies: Record<string, string>; // Mapeo de tono -> copy
        ctas: Record<string, string>;   // Mapeo de tono -> cta
        hashtags: string[];
    };
    relatedProduct?: Product;
    relatedCustomer?: Customer;
    palette?: { name: string; colors: string[] };
}

export const MarketingAI: React.FC = () => {
    const navigate = useNavigate();

    // Obtener datos reales del ERP
    const products = useStore(state => state.products) as Product[];
    const customers = useStore(state => state.customers) as Customer[];
    const shopInfo = useStore(state => state.shopInfo);
    const loadProducts = useStore(state => state.loadProducts);
    const loadCustomers = useStore(state => state.loadCustomers);

    // Estados de navegación y UI
    const [activeTab, setActiveTab] = useState<'today' | 'reels' | 'promos' | 'garden'>('today');
    const [selectedSuggestion, setSelectedSuggestion] = useState<MarketingSuggestion | null>(null);
    const [selectedTone, setSelectedTone] = useState<string>('emotional'); // emotional, fun, educational, sales
    const [copiedTextType, setCopiedTextType] = useState<string | null>(null); // 'copy', 'hook', 'cta', 'whatsapp', 'combo'
    const [customPromoProduct, setCustomPromoProduct] = useState<string>('');
    const [customDiscount, setCustomDiscount] = useState<number>(15);

    // Estados de Gamificación (Business Memory en localStorage)
    const [xp, setXp] = useState<number>(0);
    const [level, setLevel] = useState<number>(1);
    const [completedSuggestions, setCompletedSuggestions] = useState<string[]>([]);
    const [history, setHistory] = useState<{ id: string; title: string; date: string; xpGained: number }[]>([]);

    // Cargar datos al montar
    useEffect(() => {
        const fetchAll = async () => {
            try {
                await Promise.allSettled([loadProducts(), loadCustomers()]);
            } catch (e) {
                console.error("Error al cargar datos en FloriAI:", e);
            }
        };
        fetchAll();

        // Cargar gamificación de localStorage
        const storedXp = localStorage.getItem('floriai_xp');
        const storedLevel = localStorage.getItem('floriai_level');
        const storedCompleted = localStorage.getItem('floriai_completed_suggestions');
        const storedHistory = localStorage.getItem('floriai_history');

        if (storedXp) setXp(Number(storedXp));
        if (storedLevel) setLevel(Number(storedLevel));
        if (storedCompleted) setCompletedSuggestions(JSON.parse(storedCompleted));
        if (storedHistory) setHistory(JSON.parse(storedHistory));
    }, [loadProducts, loadCustomers]);

    // Guardar gamificación en localStorage
    const saveProgress = (newXp: number, newLevel: number, newCompleted: string[], newHistory: any[]) => {
        setXp(newXp);
        setLevel(newLevel);
        setCompletedSuggestions(newCompleted);
        setHistory(newHistory);

        localStorage.setItem('floriai_xp', newXp.toString());
        localStorage.setItem('floriai_level', newLevel.toString());
        localStorage.setItem('floriai_completed_suggestions', JSON.stringify(newCompleted));
        localStorage.setItem('floriai_history', JSON.stringify(newHistory));
    };

    // Dinámica de completar sugerencia y ganar XP
    const handleCompleteSuggestion = (suggestionId: string, title: string) => {
        if (completedSuggestions.includes(suggestionId)) return;

        const xpReward = 15;
        let newXp = xp + xpReward;
        let newLevel = level;

        // Subir de nivel cada 100 XP
        if (newXp >= 100) {
            newXp = newXp - 100;
            newLevel = level + 1;
        }

        const newCompleted = [...completedSuggestions, suggestionId];
        const newHistory = [
            {
                id: Math.random().toString(36).substr(2, 9),
                title,
                date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                xpGained: xpReward
            },
            ...history
        ];

        saveProgress(newXp, newLevel, newCompleted, newHistory);

        // Feedback visual temporal
        setCopiedTextType('success-complete');
        setTimeout(() => setCopiedTextType(null), 3000);
    };

    // Heurísticas de recomendación y paletas estéticas
    const flowerPalettes: Record<string, { name: string; colors: string[] }> = {
        rosas: { name: 'Romántico Rubí', colors: ['#9f1239', '#e11d48', '#fda4af', '#1e293b'] },
        girasoles: { name: 'Amanecer Dorado', colors: ['#b45309', '#f59e0b', '#fde047', '#475569'] },
        asters: { name: 'Sueño Silvestre', colors: ['#6b21a8', '#a855f7', '#e9d5ff', '#334155'] },
        lirios: { name: 'Elegancia Pureza', colors: ['#15803d', '#10b981', '#f0fdf4', '#f1f5f9'] },
        claveles: { name: 'Calidez Rústica', colors: ['#b91c1c', '#ea580c', '#ffedd5', '#27272a'] },
        orquideas: { name: 'Mística Exótica', colors: ['#86198f', '#d946ef', '#f5d0fe', '#0f172a'] },
        margaritas: { name: 'Frescura Silvestre', colors: ['#0f766e', '#14b8a6', '#ccfbf1', '#fafaf9'] },
        general: { name: 'Jardín Clásico', colors: ['#14532d', '#22c55e', '#bbf7d0', '#1c1917'] }
    };

    const getPaletteByProduct = (name: string): { name: string; colors: string[] } => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('rosa')) return flowerPalettes.rosas;
        if (lowerName.includes('girasol')) return flowerPalettes.girasoles;
        if (lowerName.includes('aster')) return flowerPalettes.asters;
        if (lowerName.includes('lirio')) return flowerPalettes.lirios;
        if (lowerName.includes('clavel')) return flowerPalettes.claveles;
        if (lowerName.includes('orquid')) return flowerPalettes.orquideas;
        if (lowerName.includes('margarita')) return flowerPalettes.margaritas;
        return flowerPalettes.general;
    };

    // Productos por defecto si el ERP está vacío
    const defaultProducts: Product[] = [
        { id: 'def-1', code: 'ROS-01', name: 'Rosas Importadas Rojas', category: 'Flores de Corte', price: 2800, stock: 45, min: 10, tags: ['rosas', 'corte', 'premium'], salesCount: 15 },
        { id: 'def-2', code: 'GIR-02', name: 'Girasoles Gigantes', category: 'Flores de Corte', price: 1900, stock: 35, min: 8, tags: ['girasoles', 'campo'], salesCount: 22 },
        { id: 'def-3', code: 'AST-03', name: 'Asters Silvestres Morados', category: 'Ramos Especiales', price: 3400, stock: 4, min: 12, tags: ['asters', 'silvestres'], salesCount: 3 },
        { id: 'def-4', code: 'LIR-04', name: 'Lirios Perfumados Blancos', category: 'Flores de Corte', price: 2300, stock: 2, min: 5, tags: ['lirios', 'perfume'], salesCount: 38 }
    ];

    // Clientes por defecto si el ERP está vacío
    const defaultCustomers: Customer[] = [
        { id: 'def-c1', name: 'Clara Domínguez', phone: '1198765432', email: 'clara@gmail.com', debtBalance: 0, importantDateName: 'Cumpleaños', importantDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Le encantan los colores pasteles' },
        { id: 'def-c2', name: 'Juan Manuel Pérez', phone: '1123456789', email: 'juanperez@outlook.com', debtBalance: 0, importantDateName: 'Aniversario de Bodas', importantDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Siempre lleva ramos grandes' }
    ];

    // Procesar datos y correr el "Marketing Engine"
    const suggestions = useMemo<MarketingSuggestion[]>(() => {
        const listProducts = products.length > 0 ? products : defaultProducts;
        const listCustomers = customers.length > 0 ? customers : defaultCustomers;

        const results: MarketingSuggestion[] = [];

        // 1. EVALUAR SOBRESTOCK / BAJA ROTACIÓN -> URGENTE (🔴)
        const overstockProducts = listProducts
            .filter(p => p.stock >= (p.min * 2) || p.stock >= 30)
            .sort((a, b) => b.stock - a.stock);

        if (overstockProducts.length > 0) {
            const mainOver = overstockProducts[0];
            const name = mainOver.name;
            const cleanName = name.replace(/(importados|nacionales|gigantes|silvestres|morados|rojos)/gi, '').trim();

            results.push({
                id: `sug-over-${mainOver.id}`,
                priority: 'urgent',
                title: `Exceso de stock: ${name}`,
                reason: `Tenés ${mainOver.stock} unidades en el local. ¡Momento ideal para armar promociones creativas antes de que pierdan valor!`,
                icon: 'production_quantity_limits',
                relatedProduct: mainOver,
                palette: getPaletteByProduct(name),
                details: {
                    idea: `Reel Estético: Seducción en tonos ${getPaletteByProduct(name).name}`,
                    objective: `Vender el exceso de ${name} y potenciar la salida de combos especiales.`,
                    whyRecommended: `Este artículo supera tu stock mínimo de ${mainOver.min} en más del doble. Promocionarlo digitalmente acelerará el flujo de caja.`,
                    difficulty: 'Fácil',
                    estimatedTime: '15 min',
                    recordingGuide: {
                        music: 'Acoustic Folk Instrumental o Lofi suave',
                        steps: [
                            { shot: 'Primer plano (Macro)', description: 'Mapea de cerca los pétalos de tus hermosas/os ' + cleanName + ', mostrando el rocío de agua fresca.', duration: '3s' },
                            { shot: 'Plano subjetivo (POV)', description: 'Tus manos seleccionando los mejores tallos con sumo cuidado y limpiándolos elegantemente.', duration: '4s' },
                            { shot: 'Plano cenital rápido', description: 'El armado veloz del ramo sobre papel kraft rústico amarrándolo con hilo de yute.', duration: '5s' },
                            { shot: 'Plano general alegre', description: 'Sonreír sosteniendo el ramo terminado frente a una ventana con luz cálida.', duration: '3s' }
                        ]
                    },
                    hooks: {
                        emotional: `«¿Sabías que regalar ${cleanName.toLowerCase()} no es solo un detalle, sino un recordatorio de calma en medio de la semana? Te muestro cómo armamos esta joya floral...»`,
                        fun: `«El psicólogo me dijo que no puedo comprar felicidad, pero sí puedo comprar un ramo gigante de ${cleanName.toLowerCase()}... y la verdad es exactamente lo mismo 😂. Mirá este diseño...»`,
                        educational: `«¿Tenés ${cleanName.toLowerCase()} en casa? ⚠️ Hacé esto para que duren el doble de tiempo frescas en el florero. Tip clave: corte diagonal y una gota de limón.»`,
                        sales: `«¡Alerta de Flores Frescas! 🎉 Solo por hoy y mañana, llevate un ramo súper estético de ${name} con un 20% de descuento. ¡Perfecto para alegrar tu mesa!»`
                    },
                    copies: {
                        emotional: `Dicen que las flores hablan un idioma que las palabras no alcanzan. Hoy armamos este ramo con las mejores ${cleanName.toLowerCase()} frescas del local, pensado para transmitir serenidad. ✨\n\n¿A quién te gustaría alegrarle el día de forma inesperada hoy? Escribinos y preparamos su envío directo con dedicatoria especial escrita a mano. 💌`,
                        fun: `Terapia floral: 99% efectiva, comprobada científicamente por este/a florista obsesionado/a con los colores otoñales. 🤭💐\n\nHoy decidimos que es un excelente día para regalarte a vos mismo ese toque de naturaleza que tu escritorio está pidiendo a gritos.\n\nContanos en comentarios: ¿sos del equipo que prefiere colores vibrantes o pasteles suaves? 👇`,
                        educational: `El arte de cuidar las flores en casa 🏡🌸. A veces nos frustra que se marchiten rápido, pero con este truco simple vas a disfrutar tus ${cleanName.toLowerCase()} por muchos días más:\n\n1️⃣ Cortá los tallos a 45 grados cada 2 días.\n2️⃣ Evitá que las hojas toquen el agua del florero para no generar bacterias.\n3️⃣ Ubicalas lejos del sol directo.\n\n¿Te sirvió este tip? Guardá este post para cuando tengas tus próximas flores en casa. 💾`,
                        sales: `¡Una oportunidad única para llenar de vida tu hogar! 🥳💐\n\nAcabamos de recibir una tanda espectacular de ${name} directo de cultivo, y diseñamos una promo irresistible para mover nuestro stock: un ramo de diseño premium a un precio que no vas a creer.\n\nIdeal para regalar o regalarte. Hacé clic en el enlace de la bio o envianos un WhatsApp para encargar el tuyo antes de que se agoten. 🛒💨`
                    },
                    ctas: {
                        emotional: `Reservá un momento de belleza. Hacé clic en nuestro link para coordinar el envío hoy mismo.`,
                        fun: `No lo pienses de más, ¡las flores no tienen calorías! Envianos un mensaje y reservamos tu ramo.`,
                        educational: `¿Qué otra flor te cuesta cuidar? Dejanos tu duda en comentarios y hacemos el próximo video explicándotelo.`,
                        sales: `¡Quedan pocas unidades en stock! Escribinos al WhatsApp linkeado y coordiná tu retiro.`
                    },
                    hashtags: ['florerias', 'marketingdeflores', cleanName.replace(/\s+/g, '').toLowerCase(), 'ramosdiseño', 'decoracionconflores', 'floresfrescas']
                }
            });
        } else {
            // Producto genérico si no hay sobrestock
            results.push({
                id: 'sug-over-generic',
                priority: 'urgent',
                title: 'Oportunidad de Contenido: El Proceso Creativo',
                reason: 'No se detecta sobrestock crítico. ¡Es el momento perfecto para mostrar el detrás de escena de tu taller!',
                icon: 'video_library',
                palette: flowerPalettes.asters,
                details: {
                    idea: 'Reel: Un día en la vida de un/a Florista',
                    objective: 'Construir comunidad y mostrar la frescura diaria de la florería.',
                    whyRecommended: 'Mostrar el proceso humaniza la marca y genera confianza en los envíos de regalos.',
                    difficulty: 'Media',
                    estimatedTime: '20 min',
                    recordingGuide: {
                        music: 'Instrumental Indie Folk alegre',
                        steps: [
                            { shot: 'Plano general', description: 'Abriendo la puerta del local al amanecer, recibiendo la luz natural.', duration: '3s' },
                            { shot: 'Plano detalle (Macro)', description: 'Pulverizando agua fresca sobre un ramo ya terminado listo para entrega.', duration: '4s' },
                            { shot: 'Primer plano', description: 'Escribiendo la tarjeta dedicatoria rústica a mano con pluma elegante.', duration: '4s' },
                            { shot: 'Plano subjetivo', description: 'Cargando el ramo con cuidado en el auto de repartos o entregándoselo a un cliente.', duration: '4s' }
                        ]
                    },
                    hooks: {
                        emotional: '«¿Alguna vez te preguntaste qué pasa desde que elegís un ramo en la web hasta que golpean tu puerta? Acompañame hoy...»',
                        fun: '«Expectativa vs. Realidad de ser florista: Spoiler, no todo es estético, ¡limpiar espinas también es parte del glamour! 😅»',
                        educational: '«Hoy te muestro las 3 herramientas sin las cuales un florista profesional no podría diseñar un ramo perfecto. La número 3 te va a sorprender.»',
                        sales: '«Diseñamos cada pedido de forma personalizada. Hacé tu compra hoy y mirá cómo preparamos tu regalo con todo el amor.»'
                    },
                    copies: {
                        emotional: 'Detrás de cada pétalo, hay un equipo seleccionando, limpiando e hilvanando historias para vos. Nos apasiona saber que nuestras flores son cómplices de sorpresas, abrazos a la distancia y reconciliaciones. ❤️✨\n\n¿Querés enviar un abrazo floral hoy? Escribinos y nos encargamos de todo.',
                        fun: 'Detrás de esos reels estéticos con música calma, hay un florista barriendo ramitas del piso por quinta vez en el día y tomando café frío. ☕️😂 Pero no cambiaríamos este caos lleno de perfumes por nada en el mundo.\n\n¿Querés ver el detrás de escena? Dejanos un saludo botánico en comentarios.',
                        educational: 'Crear un arreglo floral requiere técnica, balance y sobre todo, mucha paciencia. Hoy te abrimos las puertas de nuestro taller para mostrarte cómo equilibramos colores y alturas en un jarrón clásico.\n\n¿Te gustaría aprender a armar los tuyos? Estate atento a nuestras historias que se vienen novedades del próximo taller virtual. 📝🌿',
                        sales: '¿Buscás el regalo perfecto que hable por vos? En nuestro catálogo online vas a encontrar ramos diseñados pétalo por pétalo con flores frescas del día.\n\nComprá seguro desde la web o mandanos un mensaje directo para asesoramiento personalizado. ¡Hacemos envíos rápidos en la zona! 🚚✨'
                    },
                    ctas: {
                        emotional: 'Compartí belleza hoy. Tocá el enlace de la bio para ver las flores frescas disponibles.',
                        fun: 'Dejanos un emoji de flor si vos también amás el desorden creativo de un taller.',
                        educational: 'Guardá este Reel si querés inspirarte para tu próximo arreglo de florero.',
                        sales: 'Pedilo hoy mismo a través del botón de nuestra tienda.'
                    },
                    hashtags: ['detrásdeescena', 'tallerfloral', 'floristas', 'regalaflores', 'diseñobotánico']
                }
            });
        }

        // 2. CUMPLEAÑOS / ANIVERSARIOS DE CLIENTES -> RECOMENDADO (🟡)
        const upcomingCustomers = listCustomers
            .filter(c => {
                if (!c.importantDate) return false;
                try {
                    const todayTime = new Date();
                    todayTime.setHours(0, 0, 0, 0);
                    const impDate = new Date(c.importantDate);
                    // Ajustar el año del cumpleaños al año actual para comparar
                    impDate.setFullYear(todayTime.getFullYear());

                    const diffTime = impDate.getTime() - todayTime.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 7;
                } catch {
                    return false;
                }
            });

        if (upcomingCustomers.length > 0) {
            const client = upcomingCustomers[0];
            const typeEvent = client.importantDateName || 'ocasión especial';

            results.push({
                id: `sug-client-${client.id}`,
                priority: 'recommended',
                title: `${typeEvent} próximo: ${client.name}`,
                reason: `Su ${typeEvent.toLowerCase()} se celebra pronto. Escribile un mensaje especial ofreciéndole un combo exclusivo para fidelizarlo.`,
                icon: 'cake',
                relatedCustomer: client,
                details: {
                    idea: `WhatsApp Marketing Directo & Personalizado`,
                    objective: `Fidelizar al cliente ofreciendo un beneficio exclusivo o recordándole el envío de regalo.`,
                    whyRecommended: `Mantener el contacto activo con clientes frecuentes en sus fechas especiales aumenta el valor de vida del cliente (LTV) y genera compras espontáneas.`,
                    difficulty: 'Fácil',
                    estimatedTime: '5 min',
                    recordingGuide: {
                        music: 'N/A - Mensajería Directa',
                        steps: [
                            { shot: 'WhatsApp', description: 'Revisar el historial de compras de ' + client.name + ' para sugerir algo acorde a sus gustos.', duration: '1m' },
                            { shot: 'WhatsApp', description: 'Copiar la plantilla de mensaje pre-armado de FloriAI.', duration: '1m' },
                            { shot: 'WhatsApp', description: 'Personalizar el nombre y enviar vía WhatsApp Web con un enlace de compra directo.', duration: '2m' }
                        ]
                    },
                    hooks: {
                        emotional: `Hola ${client.name}! En Mi Jardín sabemos lo especial que es esta fecha...`,
                        fun: `¡Hola ${client.name}! Rumores dicen que se acerca una fecha muy importante... 😉`,
                        educational: `¿Querés sorprender en su día? Hola ${client.name}, te damos el secreto floral...`,
                        sales: `¡Beneficio Exclusivo! Hola ${client.name}, prepará tu regalo con un 15% OFF.`
                    },
                    copies: {
                        emotional: `Hola ${client.name}! 🌸 En Mi Jardín nos acordamos que en unos días celebrás tu ${typeEvent.toLowerCase()}. Queremos mandarte un abrazo gigante y recordarte que el arte de regalar flores es regalar un momento inolvidable.\n\nSi estás pensando en celebrarlo decorando tu hogar o querés darte ese mimo estético que tanto te merecés, queremos regalarte un **15% de descuento** en cualquier diseño floral de nuestro catálogo de esta semana.\n\nQue tengas un hermoso comienzo de celebración! ✨💌`,
                        fun: `¡Hola ${client.name}! 🥳🎉\n\nPor acá nuestro radar botánico nos avisa que se acerca tu ${typeEvent.toLowerCase()}. ¡Y en este local las celebraciones se hacen con flores frescas!\n\nPara que tu mesa de cumpleaños o tu rincón favorito brille de forma espectacular, tenés reservado un cupón de **regalo especial del 15% de descuento** en tu próximo ramo.\n\n¿Con qué flor te gustaría soplar las velitas este año? Respondemos por acá y lo preparamos! 🎂💐`,
                        educational: `Hola ${client.name}! 🌿 ¿Sabías que cada flor que elegís para tu ${typeEvent.toLowerCase()} tiene un significado único? Por ejemplo, las margaritas representan nuevos comienzos y alegría, mientras que los lirios evocan prosperidad.\n\nQueremos acompañarte en esta fecha hermosa ayudándote a elegir las flores ideales que cuenten tu historia este año. Además, tenés un beneficio de cortesía con un **15% de descuento** para tu próximo encargo.\n\n¡Escribinos y diseñemos juntos algo mágico! 🎨🌸`,
                        sales: `¡Hola ${client.name}! 🌟 ¡Feliz casi ${typeEvent.toLowerCase()}!\n\nQueremos que celebres a lo grande, por eso te creamos un beneficio único para usar antes de tu día especial: **15% OFF + Tarjeta de Dedicatoria Premium de regalo** en cualquier ramo de nuestra web.\n\n👉 Usá el código: **CELEBRA-${client.name.split(' ')[0].toUpperCase()}** al hacer tu pedido o respondemos este mensaje y te lo agendamos en 5 minutos.\n\n¡Coordinemos tu entrega a domicilio! 🚚💐`
                    },
                    ctas: {
                        emotional: `Hacer tu encargo especial`,
                        fun: `Reservar mi beneficio`,
                        educational: `Pedir asesoramiento de significado`,
                        sales: `Canjear mi 15% OFF ahora`
                    },
                    hashtags: []
                }
            });
        } else {
            // Sugerencia recomendado si no hay fechas
            results.push({
                id: 'sug-client-generic',
                priority: 'recommended',
                title: 'Fidelización: Mensaje para Clientes Dormidos',
                reason: 'No hay cumpleaños ni aniversarios en los próximos 7 días. ¡Enviá un saludo de cortesía a tus clientes frecuentes que hace más de 30 días no compran!',
                icon: 'history',
                details: {
                    idea: 'Campaña de Reactivación vía WhatsApp',
                    objective: 'Recordar tu marca de forma cálida a clientes valiosos y reactivar ventas en días tranquilos.',
                    whyRecommended: 'Traer de vuelta a un cliente que ya te conoce es 5 veces más barato que conseguir uno nuevo.',
                    difficulty: 'Fácil',
                    estimatedTime: '8 min',
                    recordingGuide: {
                        music: 'N/A',
                        steps: [
                            { shot: 'ERP', description: 'Buscar clientes en el apartado de Clientes que hace más de un mes no registran compras.', duration: '3m' },
                            { shot: 'WhatsApp', description: 'Enviar un mensaje cálido compartiendo el tip de cuidado o una sugerencia estética de otoño.', duration: '5m' }
                        ]
                    },
                    hooks: {
                        emotional: '«Hola! Nos acordamos de vos y de lo mucho que te gustaban los colores del local...»',
                        fun: '«¡Hola! Hace mucho que tu florero está vacío en casa y nosotros no lo podemos permitir... 😉»',
                        educational: '«Hola! Te compartimos nuestra última guía rápida de aromaterapia floral...»',
                        sales: '«¡Te extrañamos! Volvé a disfrutar de tu rincón florecido con un regalo especial...»'
                    },
                    copies: {
                        emotional: `¡Hola! 🌸 Hace un tiempo que no sabemos de vos por el local y queríamos mandarte un saludito cálido para saber cómo estás.\n\nEsperamos que tu semana venga llena de luz. Por acá estuvimos diseñando unos ramos de estación espectaculares con flores secas de otoño que seguro te encantarían por su aroma silvestre.\n\nCuando gustes pasar, recordá que las puertas de nuestro jardín están siempre abiertas. ¡Que tengas un hermoso día! ✨`,
                        fun: `¡Hola! 😄💐\n\nPasamos por acá a hacer una inspección digital de floreros... 🕵️‍♀️🌸 Nos dio la sospecha de que tu rincón favorito de la casa hace bastante no tiene flores frescas y vinimos al rescate!\n\nEsta semana recibimos unos claveles y asters rústicos hermosos. Si te tienta devolverle la vida a tu jarrón, avisanos y te preparamos un diseño bien alegre con envío gratis en tu zona.\n\n¡Un abrazo grande!`,
                        educational: `¡Hola! 🌿 Esperamos que estés muy bien.\n\nQueríamos compartirte una guía súper rápida que armamos para el cuidado de follajes en floreros en esta época del año. ¿Sabías que colocar una ramita de eucalipto en tu ducha con vapor actúa como un descongestivo natural y te relaja al instante? 🚿💚\n\nSi querés pasar por unas ramitas frescas de eucalipto y lavanda para probarlo, escribinos y te las separamos. ¡Es un mimo espectacular para arrancar el día!`,
                        sales: `¡Hola! 🌟 ¡Te extrañamos mucho por el local!\n\nQueremos que tu casa vuelva a lucir alegre y perfumada, por eso te preparamos un beneficio exclusivo para tu próxima compra: **Envío a Domicilio totalmente Sin Cargo** en tu ramo favorito de esta semana.\n\nRespondemos este WhatsApp y coordinamos la entrega para el día y la hora que te quede más cómodo. ¡Esperamos volver a verte pronto! 🚚💐`
                    },
                    ctas: {
                        emotional: `Ver catálogo de otoño`,
                        fun: `¡Quiero rellenar mi florero!`,
                        educational: `Pedir mis ramitas de eucalipto`,
                        sales: `Reclamar mi envío sin cargo`
                    },
                    hashtags: []
                }
            });
        }

        // 3. CAMPAÑAS Y OPORTUNIDADES DE TEMPORADA -> OPORTUNIDAD (🟢)
        // Detectar estación del año: En Mayo (2026-05-21) estamos en Otoño / vísperas de Invierno
        results.push({
            id: 'sug-seasonal',
            priority: 'opportunity',
            title: 'Campaña de Temporada: Válida en Mayo (Otoño/Invierno)',
            reason: 'Llegó el frío. Es la oportunidad ideal para lanzar la colección "Cálido Hogar" con flores secas, eucalipto y follaje de larga duración.',
            icon: 'ac_unit',
            palette: flowerPalettes.claveles,
            details: {
                idea: 'Historia de Contenido Estético y Acogedor (Vibes de Pinterest)',
                objective: 'Posicionar ramos de larga duración (otoño/invierno) que resistan perfectamente las calefacciones y el frío.',
                whyRecommended: 'Los clientes en invierno buscan elementos de decoración cálidos para el interior del hogar. Las flores secas y ramas rústicas tienen un margen de ganancia excelente y cero merma.',
                difficulty: 'Media',
                estimatedTime: '10 min',
                recordingGuide: {
                    music: 'Warm Cozy Lofi Beats o Folk Acústico suave',
                    steps: [
                        { shot: 'Plano detalle', description: 'Una taza de café humeante o té al lado de un pequeño florero con flores secas y eucalipto.', duration: '4s' },
                        { shot: 'Plano medio', description: 'Mostrando cómo acomodar suavemente ramas de pino, flores secas de color terracota y algodón en un jarrón de cerámica.', duration: '5s' },
                        { shot: 'Plano detalle', description: 'Encendiendo una vela aromática cerca de las flores para dar una atmósfera súper acogedora.', duration: '3s' },
                        { shot: 'Plano subjetivo', description: 'Escribiendo el texto en la historia: "Hacé de tu hogar tu refugio cálido esta temporada. 🕯️🍂"', duration: '3s' }
                    ]
                },
                hooks: {
                    emotional: '«Tu hogar debería sentirse como un abrazo cálido al entrar... Te muestro cómo transformamos este rincón floral...»',
                    fun: '«Mi plan perfecto de sábado frío: manta, café caliente, velas y flores que huelen a bosque... ☕️🍂»',
                    educational: '«¿Por qué las flores secas son la mejor inversión decorativa para el invierno? Te cuento los 3 motivos...»',
                    sales: '«Lanzamos nuestra Colección Cálido Hogar. Llevate tu set decorativo de jarrón rústico + flores secas hoy.»'
                },
                copies: {
                    emotional: `Cuando los días se vuelven más cortos y fríos, nuestro hogar se convierte en nuestro verdadero refugio. 🕯️🍂\n\nHoy armamos esta propuesta decorativa con eucalipto fresco, flores secas en tonos ocre y terracota, y detalles de algodón. No solo se ven hermosas, sino que llenan cada habitación de un perfume a bosque y naturaleza que te abraza al entrar.\n\nEscribinos y te asesoramos para elegir el arreglo ideal según tu espacio. 🏡✨`,
                    fun: `Confirmamos oficialmente inaugurada la temporada de: manta, té calentito, maratón de series y rodearse de decoración acogedora en casa. 🧦☕️🌿\n\nNuestra colección de ramos secos y follaje rústico llegó para demostrarte que el invierno también tiene sus colores hermosos y que tu florero no tiene por qué sufrir el frío.\n\nContanos en comentarios: ¿sos del equipo que ama el frío o ya estás contando los días para la primavera? ❄️👇`,
                    educational: `Flores secas: ¿La tendencia decorativa que llegó para quedarse? 🌾🏡\n\nEn esta época del año, las flores secas y los follajes deshidratados son los reyes de la casa por 3 razones clave:\n\n1️⃣ Cero mantenimiento: No necesitan agua ni podas.\n2️⃣ Durabilidad: Duran meses e incluso años impecables.\n3️⃣ Estilo rústico: Combinan de forma espectacular con maderas y cerámicas.\n\nEnviamos un mensaje y te mostramos las variedades de flores secas que tenemos disponibles en el taller. 💾`,
                    sales: `🍁 Lanzamiento Oficial: Colección Cálido Hogar 🍁\n\nDiseñamos una línea especial pensada para darle vida y calidez a tu casa este invierno. Arreglos rústicos en jarrones de barro rústico combinados con eucalipto, lavanda y flores secas de cultivo local.\n\n🎉 Llevate el combo completo (Jarrón + Ramo de Estación + Vela Aromática de regalo) a un precio especial de lanzamiento.\n\nHacé clic en el botón abajo o escribinos para encargar el tuyo. Envios rápidos a domicilio. 🚚🍂`
                },
                ctas: {
                    emotional: `Crear tu refugio cálido`,
                    fun: `Ver colección acogedora`,
                    educational: `Ver catálogo de secas`,
                    sales: `Comprar set Cálido Hogar`
                },
                hashtags: ['decoraciondeinvierno', 'floressecas', 'estilocozystyle', 'eucaliptofresco', 'floreriasesteticas', 'detallesdelhogar']
            }
        });

        return results;
    }, [products, customers]);

    // Obtener sugerencia actual
    const currentSuggestion = selectedSuggestion || suggestions[0];

    // Manejar copiado al portapapeles con feedback visual
    const handleCopyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        setCopiedTextType(type);
        setTimeout(() => setCopiedTextType(null), 2000);
    };

    // Crear combo promocional interactivo
    const suggestedCombo = useMemo(() => {
        const listProducts = products.length > 0 ? products : defaultProducts;
        // Tomar el primer producto con mayor stock (sobrestock) y el segundo con stock aceptable
        const sorted = [...listProducts].sort((a, b) => b.stock - a.stock);
        const prodA = sorted[0];
        const prodB = sorted[1] || listProducts[2] || listProducts[0];

        if (!prodA || !prodB) return null;

        const originalTotal = prodA.price + prodB.price;
        const discountVal = customDiscount / 100;
        const promoPrice = Math.round(originalTotal * (1 - discountVal));
        const code = `COMBO-${prodA.name.split(' ')[0].toUpperCase()}-${customDiscount}`;

        return {
            productA: prodA,
            productB: prodB,
            originalPrice: originalTotal,
            promoPrice: promoPrice,
            code: code,
            whatsappText: `*¡Super Promo Exclusiva en ${shopInfo?.name || 'Mi Jardín'}!* 🌸✨\n\nArmamos un combo espectacular para llenar de perfume tu semana:\n\n💐 *${prodA.name}* + *${prodB.name}*\n❌ Precio de lista: $${originalTotal.toLocaleString()}\n✅ *Precio Promo (${customDiscount}% OFF): $${promoPrice.toLocaleString()}*\n\n👉 Reservalo hoy respondiendo este mensaje o usá el código *${code}* en nuestra web.\n\n¡Coordinamos el envío rápido a tu casa! 🚚`
        };
    }, [products, customDiscount, shopInfo]);

    return (
        <div className="marketing-ai-page">
            {/* Cabecera Premium */}
            <div className="marketing-header">
                <button className="back-btn" onClick={() => navigate('/herramientas')}>
                    <ArrowLeft size={20} />
                    <span>Volver a Herramientas</span>
                </button>
                <div className="title-section">
                    <div className="title-badge">
                        <Sparkles size={16} />
                        <span>FloriAI Copiloto</span>
                    </div>
                    <h1>Copiloto de Marketing & Asistente Creativo</h1>
                    <p>Tu community manager, asesor de ventas y motor de campañas alimentado por el stock de tu florería.</p>
                </div>
            </div>

            {/* Layout Principal de Dos Columnas */}
            <div className="marketing-content-grid">
                
                {/* COLUMNA IZQUIERDA: Herramientas y Pestañas */}
                <div className="marketing-tools-container">
                    {/* Barra de Navegación de Pestañas */}
                    <div className="marketing-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
                            onClick={() => setActiveTab('today')}
                        >
                            <Calendar size={18} />
                            <span>Qué hacer hoy</span>
                            <span className="badge-count">3</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'reels' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reels')}
                        >
                            <Camera size={18} />
                            <span>Estudio de Reels</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'promos' ? 'active' : ''}`}
                            onClick={() => setActiveTab('promos')}
                        >
                            <ShoppingBag size={18} />
                            <span>Generador de Combos</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'garden' ? 'active' : ''}`}
                            onClick={() => setActiveTab('garden')}
                        >
                            <Award size={18} />
                            <span>Mi Jardín Digital</span>
                        </button>
                    </div>

                    {/* CONTENIDO DE PESTAÑA: QUÉ HACER HOY */}
                    {activeTab === 'today' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>📋 Tu rutina de crecimiento de hoy</h2>
                                <p>Sugerencias personalizadas basadas en el inventario real y los clientes de tu tienda para generar hábito y traccionar ventas diarias.</p>
                            </div>

                            {/* Tarjetas de Prioridad / Listado */}
                            <div className="suggestions-list">
                                {suggestions.map((sug) => {
                                    const isSelected = currentSuggestion?.id === sug.id;
                                    const isCompleted = completedSuggestions.includes(sug.id);

                                    return (
                                        <div 
                                            key={sug.id}
                                            className={`suggestion-card border-priority-${sug.priority} ${isSelected ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                            onClick={() => setSelectedSuggestion(sug)}
                                        >
                                            <div className="suggestion-status-indicator">
                                                {sug.priority === 'urgent' && <span className="status-badge urgent">🔴 Urgente</span>}
                                                {sug.priority === 'recommended' && <span className="status-badge recommended">🟡 Recomendado</span>}
                                                {sug.priority === 'opportunity' && <span className="status-badge opportunity">🟢 Oportunidad</span>}
                                            </div>
                                            <div className="suggestion-card-header">
                                                <span className="material-symbols-rounded sug-icon">{sug.icon}</span>
                                                <div className="sug-meta">
                                                    <h3>{sug.title}</h3>
                                                    <p>{sug.reason}</p>
                                                </div>
                                                {isCompleted ? (
                                                    <CheckCircle2 size={24} className="text-success completed-icon" />
                                                ) : (
                                                    <span className="material-symbols-rounded sug-arrow">arrow_forward_ios</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Detalle Ampliado de la Sugerencia Seleccionada */}
                            {currentSuggestion && (
                                <div className="suggestion-details-card glass-panel mt-6">
                                    <div className="sug-details-header">
                                        <div className="sug-details-title-row">
                                            <span className="material-symbols-rounded header-icon">{currentSuggestion.icon}</span>
                                            <div>
                                                <h3>Detalles de la Sugerencia Creativa</h3>
                                                <p className="sug-accent-reason">{currentSuggestion.reason}</p>
                                            </div>
                                        </div>
                                        <button 
                                            className={`complete-task-btn ${completedSuggestions.includes(currentSuggestion.id) ? 'done' : ''}`}
                                            onClick={() => handleCompleteSuggestion(currentSuggestion.id, currentSuggestion.title)}
                                            disabled={completedSuggestions.includes(currentSuggestion.id)}
                                        >
                                            {completedSuggestions.includes(currentSuggestion.id) ? (
                                                <>
                                                    <BookmarkCheck size={18} />
                                                    <span>¡Completado! +15 XP</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Check size={18} />
                                                    <span>Marcar como Hecho (+15 XP)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Información Principal de la Idea */}
                                    <div className="suggestion-info-blocks">
                                        <div className="info-block">
                                            <strong>💡 La Idea</strong>
                                            <p>{currentSuggestion.details.idea}</p>
                                        </div>
                                        <div className="info-block">
                                            <strong>🎯 Objetivo Comercial</strong>
                                            <p>{currentSuggestion.details.objective}</p>
                                        </div>
                                        <div className="info-block">
                                            <strong>🔍 ¿Por qué se recomienda?</strong>
                                            <p>{currentSuggestion.details.whyRecommended}</p>
                                        </div>
                                    </div>

                                    <div className="suggestion-meta-row">
                                        <div className="meta-badge">
                                            <Layers size={16} />
                                            <span>Dificultad: {currentSuggestion.details.difficulty}</span>
                                        </div>
                                        <div className="meta-badge">
                                            <Flame size={16} />
                                            <span>Tiempo est.: {currentSuggestion.details.estimatedTime}</span>
                                        </div>
                                        {currentSuggestion.palette && (
                                            <div className="meta-badge color-palette-badge">
                                                <Palette size={16} />
                                                <span>Paleta sugerida: <strong>{currentSuggestion.palette.name}</strong></span>
                                                <div className="palette-preview-dots">
                                                    {currentSuggestion.palette.colors.slice(0, 3).map((col, idx) => (
                                                        <span key={idx} className="color-dot" style={{ backgroundColor: col }} title={col} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Guía de Grabación Paso a Paso */}
                                    <div className="creative-guide-section mt-6">
                                        <h4>🎥 Guía de Grabación Paso a Paso (Storyboarding)</h4>
                                        <p className="music-recommendation">🎵 Música recomendada: <strong>{currentSuggestion.details.recordingGuide.music}</strong></p>
                                        
                                        <div className="storyboard-timeline">
                                            {currentSuggestion.details.recordingGuide.steps.map((step, index) => (
                                                <div key={index} className="storyboard-step">
                                                    <div className="step-number">{index + 1}</div>
                                                    <div className="step-content">
                                                        <div className="step-shot-type">{step.shot} <span className="step-duration">({step.duration})</span></div>
                                                        <p className="step-desc">{step.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Redacción y Copies con Selector de Tono */}
                                    <div className="copywriter-section mt-6">
                                        <div className="copywriter-header">
                                            <h4>✍️ Generador de Textos & Copies Inteligentes</h4>
                                            
                                            {/* Selector de Tono de Voz */}
                                            <div className="tone-selector">
                                                <button 
                                                    className={`tone-btn ${selectedTone === 'emotional' ? 'active' : ''}`}
                                                    onClick={() => setSelectedTone('emotional')}
                                                >
                                                    <Heart size={14} />
                                                    <span>Emocional</span>
                                                </button>
                                                <button 
                                                    className={`tone-btn ${selectedTone === 'fun' ? 'active' : ''}`}
                                                    onClick={() => setSelectedTone('fun')}
                                                >
                                                    <Smile size={14} />
                                                    <span>Divertido</span>
                                                </button>
                                                <button 
                                                    className={`tone-btn ${selectedTone === 'educational' ? 'active' : ''}`}
                                                    onClick={() => setSelectedTone('educational')}
                                                >
                                                    <BookOpen size={14} />
                                                    <span>Educativo</span>
                                                </button>
                                                <button 
                                                    className={`tone-btn ${selectedTone === 'sales' ? 'active' : ''}`}
                                                    onClick={() => setSelectedTone('sales')}
                                                >
                                                    <Coins size={14} />
                                                    <span>Vendedor</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Bloques de Texto Listos para Copiar */}
                                        <div className="copy-blocks-grid">
                                            {/* Gancho / Hook */}
                                            <div className="copy-block-card">
                                                <div className="copy-card-header">
                                                    <span>🔥 Hook / Frase de Gancho</span>
                                                    <button 
                                                        className="copy-text-btn"
                                                        onClick={() => handleCopyToClipboard(currentSuggestion.details.hooks[selectedTone] || '', 'hook')}
                                                    >
                                                        {copiedTextType === 'hook' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                                        <span>{copiedTextType === 'hook' ? 'Copiado' : 'Copiar'}</span>
                                                    </button>
                                                </div>
                                                <p className="copy-text-content">"{currentSuggestion.details.hooks[selectedTone] || 'Cargando hook...'}"</p>
                                            </div>

                                            {/* Copy Principal */}
                                            <div className="copy-block-card">
                                                <div className="copy-card-header">
                                                    <span>📝 Descripción / Caption del Post</span>
                                                    <button 
                                                        className="copy-text-btn"
                                                        onClick={() => handleCopyToClipboard(currentSuggestion.details.copies[selectedTone] || '', 'copy')}
                                                    >
                                                        {copiedTextType === 'copy' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                                        <span>{copiedTextType === 'copy' ? 'Copiado' : 'Copiar'}</span>
                                                    </button>
                                                </div>
                                                <p className="copy-text-content pre-wrap">{currentSuggestion.details.copies[selectedTone] || 'Cargando copy...'}</p>
                                            </div>

                                            {/* Llamado a la Acción / CTA */}
                                            <div className="copy-block-card">
                                                <div className="copy-card-header">
                                                    <span>🎯 Llamado a la Acción (CTA)</span>
                                                    <button 
                                                        className="copy-text-btn"
                                                        onClick={() => handleCopyToClipboard(currentSuggestion.details.ctas[selectedTone] || '', 'cta')}
                                                    >
                                                        {copiedTextType === 'cta' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                                        <span>{copiedTextType === 'cta' ? 'Copiado' : 'Copiar'}</span>
                                                    </button>
                                                </div>
                                                <p className="copy-text-content">"{currentSuggestion.details.ctas[selectedTone] || 'Cargando CTA...'}"</p>
                                            </div>

                                            {/* Hashtags Botánicos */}
                                            <div className="copy-block-card">
                                                <div className="copy-card-header">
                                                    <span>#️⃣ Hashtags Recomendados</span>
                                                    <button 
                                                        className="copy-text-btn"
                                                        onClick={() => handleCopyToClipboard(currentSuggestion.details.hashtags.map(h => `#${h}`).join(' '), 'hashtags')}
                                                    >
                                                        {copiedTextType === 'hashtags' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                                        <span>{copiedTextType === 'hashtags' ? 'Copiado' : 'Copiar'}</span>
                                                    </button>
                                                </div>
                                                <p className="copy-text-content text-muted">
                                                    {currentSuggestion.details.hashtags.map(h => `#${h}`).join(' ')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CONTENIDO DE PESTAÑA: ESTUDIO DE REELS */}
                    {activeTab === 'reels' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>🎥 Estudio de Creación de Reels</h2>
                                <p>Crea guiones cinematográficos estéticos para cualquier flor de tu catálogo. Elegí un producto real y adaptá el guion al instante.</p>
                            </div>

                            <div className="reels-builder-card glass-panel p-4 mb-6">
                                <div className="form-group mb-4">
                                    <label className="form-label font-bold text-small">Seleccionar Flor o Producto del Inventario:</label>
                                    <select 
                                        className="form-input w-full"
                                        value={customPromoProduct}
                                        onChange={(e) => setCustomPromoProduct(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar de la Base de Datos --</option>
                                        {(products.length > 0 ? products : defaultProducts).map(p => (
                                            <option key={p.id} value={p.name}>{p.name} (Stock: {p.stock})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="interactive-reel-teaser bg-surface p-4 rounded-lg border border-border">
                                    <h4 className="font-bold flex items-center gap-2 mb-2 text-primary">
                                        <Sparkles size={18} />
                                        Guion Generado para: {customPromoProduct || 'Flores Frescas Variadas'}
                                    </h4>
                                    <p className="text-small text-muted mb-4">
                                        Este guion ha sido adaptado dinámicamente según la frescura y la estética de la flor seleccionada. Utilizalo para grabar con tu celular directamente en el taller de la florería.
                                    </p>

                                    {/* storyboard resumido */}
                                    <div className="storyboard-steps-compact">
                                        <div className="compact-step">
                                            <strong>🎬 Hook Visual (1-3 seg):</strong> Plano de súper detalle mostrando la caída de gotas de agua sobre los pétalos de {customPromoProduct || 'las flores'}.
                                        </div>
                                        <div className="compact-step">
                                            <strong>✂️ Nudo Creativo (3-12 seg):</strong> Plano acelerado cenital mostrando tus manos combinando follajes verdes (eucalipto) con {customPromoProduct || 'las flores principales'}.
                                        </div>
                                        <div className="compact-step">
                                            <strong>📦 Desenlace / Cierre (12-15 seg):</strong> Plano medio sonriente abrazando el ramo y mostrándolo orgulloso/a a la cámara.
                                        </div>
                                    </div>

                                    {/* visual Instagram Grid Mockup */}
                                    <div className="grid-instagram-mockup-wrapper mt-6">
                                        <h5 className="font-bold text-micro text-muted flex items-center gap-1 mb-2">
                                            <Instagram size={14} />
                                            Simulador Visual de Feed (Mockup)
                                        </h5>
                                        <div className="instagram-grid-mockup">
                                            <div className="ig-grid-item active-preview">
                                                <span className="material-symbols-rounded">movie</span>
                                                <p className="mockup-label">Reel Sugerido</p>
                                                <div className="mockup-color-palette">
                                                    {getPaletteByProduct(customPromoProduct).colors.slice(0, 3).map((col, idx) => (
                                                        <span key={idx} style={{ backgroundColor: col }} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="ig-grid-item placeholder-grid">💐</div>
                                            <div className="ig-grid-item placeholder-grid">🌾</div>
                                            <div className="ig-grid-item placeholder-grid">🥀</div>
                                            <div className="ig-grid-item placeholder-grid">🌹</div>
                                            <div className="ig-grid-item placeholder-grid">🌷</div>
                                        </div>
                                        <p className="text-micro text-center text-muted mt-2">
                                            Tu Reel encajará estéticamente usando la paleta sugerida: <strong>{getPaletteByProduct(customPromoProduct).name}</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTENIDO DE PESTAÑA: GENERADOR DE COMBOS */}
                    {activeTab === 'promos' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>💼 Generador Inteligente de Combos & Promociones</h2>
                                <p>Combiná de forma automática tus productos con mayor sobrestock para armar ofertas tentadoras y de alta rentabilidad.</p>
                            </div>

                            {/* Controles de Combo */}
                            <div className="combo-generator-card glass-panel p-4 mb-6">
                                <div className="discount-slider-group mb-6">
                                    <label className="form-label font-bold flex justify-between">
                                        <span>Porcentaje de Descuento sugerido:</span>
                                        <span className="text-primary font-bold">{customDiscount}% OFF</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="10" 
                                        max="40" 
                                        step="5"
                                        value={customDiscount}
                                        onChange={(e) => setCustomDiscount(Number(e.target.value))}
                                        className="slider-input w-full"
                                    />
                                </div>

                                {suggestedCombo && (
                                    <div className="combo-result-card bg-surface p-4 rounded-xl border border-border">
                                        <div className="combo-tags">
                                            <span className="badge badge-primary">⚡ Combo sugerido por sobrestock</span>
                                        </div>
                                        <div className="combo-elements mt-3">
                                            <div className="combo-item">
                                                <span className="material-symbols-rounded item-icon">local_florist</span>
                                                <div>
                                                    <strong>{suggestedCombo.productA.name}</strong>
                                                    <p className="text-micro text-muted">Stock actual: {suggestedCombo.productA.stock} u. | Lista: ${suggestedCombo.productA.price.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="combo-plus-symbol">+</div>
                                            <div className="combo-item">
                                                <span className="material-symbols-rounded item-icon">spa</span>
                                                <div>
                                                    <strong>{suggestedCombo.productB.name}</strong>
                                                    <p className="text-micro text-muted">Stock actual: {suggestedCombo.productB.stock} u. | Lista: ${suggestedCombo.productB.price.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="combo-pricing-section border-t border-border mt-4 pt-4 flex justify-between items-center">
                                            <div>
                                                <span className="text-small text-muted line-through">Antes: ${suggestedCombo.originalPrice.toLocaleString()}</span>
                                                <h3 className="text-h2 text-success font-bold mt-1">Precio Promo: ${suggestedCombo.promoPrice.toLocaleString()}</h3>
                                            </div>
                                            <div className="code-badge-interactive">
                                                <span className="text-micro text-muted">CÓDIGO WEB:</span>
                                                <strong>{suggestedCombo.code}</strong>
                                            </div>
                                        </div>

                                        {/* whatsapp copy button */}
                                        <div className="whatsapp-blast-section border-t border-border mt-4 pt-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-small text-muted">Mensaje Listo para Enviar a Clientes (WhatsApp):</span>
                                                <button 
                                                    className="btn btn-secondary btn-sm flex items-center gap-1"
                                                    onClick={() => handleCopyToClipboard(suggestedCombo.whatsappText, 'combo')}
                                                    style={{ minHeight: '36px', padding: '0.5rem 1rem' }}
                                                >
                                                    {copiedTextType === 'combo' ? <CheckCircle2 size={16} className="text-success" /> : <Copy size={16} />}
                                                    <span>{copiedTextType === 'combo' ? '¡Copiado!' : 'Copiar Mensaje'}</span>
                                                </button>
                                            </div>
                                            <pre className="whatsapp-preview-box">{suggestedCombo.whatsappText}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONTENIDO DE PESTAÑA: MI JARDÍN DIGITAL */}
                    {activeTab === 'garden' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>🌱 Mi Jardín Digital & Historial Creativo</h2>
                                <p>Cuidar tu marketing es como cuidar tu flor favorita: la constancia diaria hace florecer tu negocio. Mirá tu progreso y las campañas completadas.</p>
                            </div>

                            <div className="garden-status-grid">
                                <div className="garden-rules-card glass-panel p-4 text-center">
                                    <span className="material-symbols-rounded trophy-icon">military_tech</span>
                                    <h3>Reglas del Cultivo Digital</h3>
                                    <p className="text-small mt-2">
                                        Cada sugerencia que marcas como **"Hecho"** en la pestaña principal de **Qué hacer hoy** te otorga **+15 XP** (Puntos de Experiencia). 
                                        Al llegar a 100 XP, subes de nivel creativo y tu flor crece. ¡Generá el hábito y mirá florecer tu local!
                                    </p>
                                </div>

                                <div className="garden-history-card glass-panel p-4">
                                    <h3 className="flex items-center gap-2 mb-3">
                                        <BookmarkCheck size={20} className="text-primary" />
                                        Historial de Acciones de Marketing
                                    </h3>
                                    {history.length === 0 ? (
                                        <p className="text-body text-center py-6 text-muted">Aún no has completado acciones de marketing. ¡Comenzá hoy mismo! 🌸</p>
                                    ) : (
                                        <div className="history-timeline">
                                            {history.map((item) => (
                                                <div key={item.id} className="history-item">
                                                    <div className="history-dot"></div>
                                                    <div className="history-content">
                                                        <strong>{item.title}</strong>
                                                        <div className="history-meta flex justify-between mt-1">
                                                            <span className="text-micro text-muted">{item.date}</span>
                                                            <span className="text-micro text-success font-bold">+{item.xpGained} XP</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUMNA DERECHA: El Corazón Creativo y Gamificado (JARDÍN DIGITAL) */}
                <div className="marketing-dashboard-sidebar">
                    {/* Widget del Estado del Jardín Digital */}
                    <div className="card garden-level-widget glass-panel text-center">
                        <div className="widget-header mb-4">
                            <span className="badge badge-accent flex items-center gap-1 mx-auto">
                                <Award size={16} />
                                <span>NIVEL CREATIVO {level}</span>
                            </span>
                        </div>

                        {/* Dibujo de la Flor Interactiva */}
                        <div className="flower-interactive-avatar">
                            <div className="sky-particles">
                                <span className="particle p1">✨</span>
                                <span className="particle p2">✨</span>
                                <span className="particle p3">✨</span>
                            </div>
                            <div className="flower-pot">
                                {/* Hojas y Tallos según el nivel */}
                                <div className="flower-stem">
                                    <div className="leaf left-leaf"></div>
                                    <div className="leaf right-leaf"></div>
                                </div>
                                {/* La flor en la cima cambando de color según el nivel */}
                                <div className={`flower-head level-color-${(level % 4) + 1}`}>
                                    <div className="flower-center"></div>
                                    <div className="petal p-top"></div>
                                    <div className="petal p-bottom"></div>
                                    <div className="petal p-left"></div>
                                    <div className="petal p-right"></div>
                                    <div className="petal p-tl"></div>
                                    <div className="petal p-tr"></div>
                                    <div className="petal p-bl"></div>
                                    <div className="petal p-br"></div>
                                </div>
                                <div className="pot-body">
                                    <div className="pot-rim"></div>
                                    <span className="pot-brand">FloriAI</span>
                                </div>
                            </div>
                        </div>

                        {/* Barra de progreso de XP */}
                        <div className="xp-progress-bar-container mt-4">
                            <div className="xp-labels flex justify-between text-micro font-bold mb-1">
                                <span>Progreso a Nivel {level + 1}</span>
                                <span>{xp} / 100 XP</span>
                            </div>
                            <div className="xp-bar-bg">
                                <div className="xp-bar-fill" style={{ width: `${xp}%` }}></div>
                            </div>
                        </div>

                        <p className="text-small text-muted mt-3 italic">
                            {xp < 40 ? '«Tu flor está pidiendo a gritos un Reel estético para crecer hoy.»' : ''}
                            {xp >= 40 && xp < 80 ? '«¡Va con fuerza! Una campaña más y tu flor florece a lo grande.»' : ''}
                            {xp >= 80 ? '«¡A punto de florecer! Escribile a ese cliente de cumpleaños para subir de nivel.»' : ''}
                        </p>
                    </div>

                    {/* Widget del Taller de Inspiración de Vidriera */}
                    <div className="card window-dressing-inspiration-widget glass-panel mt-6">
                        <h3 className="text-small font-bold flex items-center gap-2 mb-3">
                            <Compass size={18} className="text-accent" />
                            Inspiración de Vidriera (Visual Display)
                        </h3>
                        <p className="text-small">
                            El color dominante de la semana debe ser el **{getPaletteByProduct(currentSuggestion.details.idea).name}**. 
                            Colocá jarrones de barro rústico o cerámica en escalones a diferentes alturas en tu vidriera principal. 
                            Añadí una pequeña pizarra manuscrita con la frase:
                        </p>
                        <blockquote className="vidriera-quote mt-2">
                            "Tu hogar debería sentirse como un abrazo cálido al entrar. 🕯️🍂"
                        </blockquote>
                        <p className="text-micro text-muted mt-2">
                            💡 *Tip de iluminación:* Encendé luces cálidas tipo guirnalda led al atardecer para generar sensación de cobijo interior.
                        </p>
                    </div>
                </div>

            </div>

            {/* Notificación de Éxito de Tareas completadas */}
            {copiedTextType === 'success-complete' && (
                <div className="floriai-toast-notification animate-slide-in">
                    <span className="material-symbols-rounded icon">celebration</span>
                    <div className="toast-content">
                        <strong>¡Tarea Completada con éxito!</strong>
                        <p>Ganaste **+15 XP**. Tu jardín digital te lo agradece. 🌱✨</p>
                    </div>
                </div>
            )}
        </div>
    );
};
