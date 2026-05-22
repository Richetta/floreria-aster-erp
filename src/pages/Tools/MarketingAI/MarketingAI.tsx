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
    Instagram,
    Palette,
    Layers,
    ArrowLeft,
    CheckCircle2,
    BookmarkCheck,
    Dices,
    Send,
    Trash2
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { useNavigate } from 'react-router-dom';
import type { Product, Customer } from '../../../store/slices/types';
import './MarketingAI.css';

// Interfaces locales para el motor de marketing
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
        hooks: Record<string, string>; // Tono -> hook
        copies: Record<string, string>; // Tono -> copy
        ctas: Record<string, string>;   // Tono -> cta
        hashtags: string[];
    };
    relatedProduct?: Product;
    relatedCustomer?: Customer;
    palette?: { name: string; colors: string[] };
}

// Logros / Medallas Creativas
const ACHIEVEMENTS = [
    { id: 'first_task', title: 'Semilla Creativa', desc: 'Completar tu primera sugerencia en "Qué hacer hoy".', icon: '🌱' },
    { id: 'dice_roll', title: 'Inspiración Infinita', desc: 'Tirar el Dado de la Inspiración Infinita 5 veces.', icon: '🎲' },
    { id: 'combo_gen', title: 'Combo Master', desc: 'Generar un combo de sobrestock con descuento.', icon: '⚡' },
    { id: 'fidelizador', title: 'Fidelizador', desc: 'Copiar un mensaje de WhatsApp para clientes en fechas especiales.', icon: '💖' },
    { id: 'garden_lvl3', title: 'Jardín de Oro', desc: 'Subir al Nivel Creativo 3 o superior.', icon: '🏆' },
    { id: 'cross_inspiration', title: 'Mente Abierta', desc: 'Explorar una sugerencia de Inspiración Cruzada.', icon: '🌎' }
];

// Presets de Comentarios para CM
const CM_PRESETS = [
    {
        id: 'cm-1',
        comment: '¿Hacen envíos hoy a Palermo? ¿Cuánto cuesta el envío?',
        replies: {
            emotional: '¡Hola! ❤️ Claro que sí, queremos que tu sorpresa llegue perfecta hoy. Hacemos envíos rápidos a Palermo con todo nuestro cuidado y amor. El costo es de $800 y podés personalizar la tarjeta dedicatoria rústica totalmente gratis. ¡Coordinemos por privado!',
            funny: '¡Hola! 🚴💨 ¡Más rápido que un pétalo al viento! Hacemos envíos hoy mismo a Palermo por $800. Prometemos que las flores llegan más frescas que lechuga recién cortada. ¡Escribinos al MD y lo preparamos volando!',
            sales: '¡Hola! 🌟 Sí, tenemos cupos disponibles para Palermo hoy mismo. El costo es de $800. Si hacés tu pedido en los próximos 15 minutos, te regalamos una ramita de eucalipto aromático para tu ducha. ¡Escribinos ya para reservar tu franja horaria!'
        }
    },
    {
        id: 'cm-2',
        comment: 'Me encantaron las rosas rojas, ¿qué precio tienen y de qué tamaño viene el ramo?',
        replies: {
            emotional: '¡Muchas gracias! ❤️ Nuestras rosas importadas rojas son verdaderas portadoras de historias. El ramo premium viene de 12 tallos seleccionados y limpios a mano, envuelto en papel kraft rústico por $28.000. Queda espectacular en cualquier rincón del hogar.',
            funny: '¡Hola! 😍 Son una locura de lindas, ¡y huelen a romance puro! Vienen en un ramo generoso de 12 rosas de tallo largo por $28.000 (perfecto para impresionar o auto-regalarse, que es el mejor amor propio 🌹). ¡Escribinos para encargar el tuyo!',
            sales: '¡Hola! 🎉 Qué excelente gusto. El ramo de 12 Rosas Rojas Importadas está a solo $28.000. Podés pagar en hasta 3 cuotas sin interés y coordinar el envío hoy. ¡Escribinos por privado o tocala en nuestra web para asegurar tu ramo!'
        }
    },
    {
        id: 'cm-3',
        comment: 'Se acerca el aniversario de mi mamá, ¿qué me recomiendan que sea fino y duradero?',
        replies: {
            emotional: '¡Qué momento tan hermoso! ❤️ Para mamá te recomiendo nuestro "Sueño Silvestre" con Asters y Lirios Perfumados. Son flores sumamente elegantes y duraderas, ideales para recordarle tu cariño cada mañana cuando cambie el agua de su florero.',
            funny: '¡Feliz aniversario para ella! 🎉 Para que dure más que las reuniones que pudieron ser un mail 😂, te súper recomiendo un combo de Lirios Blancos y Eucalipto Rústico. Queda finísimo y va a perfumar toda su casa por semanas. ¡Te asesoramos en el MD!',
            sales: '¡Hola! 🌟 Excelente ocasión. Te recomendamos nuestro Ramo de Lirios Perfumados Blancos ($2.300 por vara). Súper duraderos y elegantes. Agregando una tarjeta dedicatoria premium manuscrita tenés envío gratis hoy. ¡Escribinos por MD para armarlo!'
        }
    },
    {
        id: 'cm-4',
        comment: '¡Qué hermoso local! ¿Tienen taller o cursos para aprender a diseñar ramos?',
        replies: {
            emotional: '¡Qué alegría leerte! ❤️ Diseñar con flores es una forma hermosa de meditación y conexión con la naturaleza. Sí, estamos preparando nuestro próximo taller presencial de Otoño/Invierno. Dejanos tu correo por privado y te avisamos antes que a nadie.',
            funny: '¡Muchas gracias! 🌸 Prometemos que barremos el piso del local con una sonrisa 😂. ¡Sí! Muy pronto se viene nuestro workshop para aprender a diseñar ramos sin morir en el intento de limpiar espinas. Escribinos para anotarte en la lista de espera.',
            sales: '¡Hola! ¡Qué bueno que te guste! 🌿 Sí, abrimos inscripciones la semana que viene para el Taller Virtual de Ramos de Diseño. El cupo es limitado e incluye kit de flores a domicilio. Escribinos por MD para reservar tu preventa con descuento.'
        }
    }
];

// Fechas Clave del Calendario Inteligente (Mayo 2026)
const CALENDAR_DATES: Record<number, { title: string; type: 'comercial' | 'eco' | 'tip'; content: string }> = {
    1: { title: 'Día del Trabajador', type: 'comercial', content: 'Promocioná ramos corporativos de agradecimiento. Tip: Creá una placa para LinkedIn ofreciendo combos express.' },
    5: { title: 'Martes de Tips', type: 'tip', content: 'Hacé un video corto explicando por qué cortar los tallos a 45° duplica la vida de las flores.' },
    10: { title: 'Día de la Madre (Latam)', type: 'comercial', content: 'Campaña principal. El 70% de las compras son de última hora. Publicá tus ramos premium con franja horaria asegurada.' },
    12: { title: 'Martes de Cuidados', type: 'tip', content: 'Subí una historia interactiva con una trivia sobre cuánta agua necesita una orquídea.' },
    15: { title: 'Día de las PyMEs', type: 'eco', content: 'Celebrá el esfuerzo local. Ofrecé un 10% OFF a otros comercios de tu barrio y mostrá comunidad.' },
    19: { title: 'Martes de Tendencias', type: 'tip', content: 'Publicá un carrusel con las 3 paletas florales de otoño que son tendencia en diseño de interiores.' },
    22: { title: 'Día de la Biodiversidad', type: 'eco', content: '¡Hoy! Mostrá la variedad de flores nativas y silvestres en tu taller. Explicá cómo cada flor Aster ayuda a las abejas.' },
    25: { title: 'Revolución de Mayo', type: 'comercial', content: 'Día patrio en Argentina. Lanzá el Combo Escarapela: Claveles celestes y blancos con dedicatoria tradicional.' },
    26: { title: 'Martes de ASMR', type: 'tip', content: 'Subí un video ASMR de 15 segundos limpiando tallos de rosas importadas. Sonido real de corte.' },
    30: { title: 'Sábado de Renovación', type: 'comercial', content: 'Fin de mes. Incentivá la renovación del florero del hogar con envíos sin cargo en tu zona.' }
};

export const MarketingAI: React.FC = () => {
    const navigate = useNavigate();

    // Obtener datos reales del ERP
    const products = useStore(state => state.products) as Product[];
    const customers = useStore(state => state.customers) as Customer[];
    const shopInfo = useStore(state => state.shopInfo);
    const loadProducts = useStore(state => state.loadProducts);
    const loadCustomers = useStore(state => state.loadCustomers);

    // Estados de navegación y UI (Ampliados para 7 Sub-áreas)
    const [activeTab, setActiveTab] = useState<'today' | 'reels' | 'promos' | 'cm-replies' | 'calendar' | 'cross-inspiration' | 'garden'>('today');
    const [selectedSuggestion, setSelectedSuggestion] = useState<MarketingSuggestion | null>(null);
    const [selectedTone, setSelectedTone] = useState<string>('emotional'); // emotional, fun, educational, sales
    const [copiedTextType, setCopiedTextType] = useState<string | null>(null); // 'copy', 'hook', 'cta', 'whatsapp', 'combo', 'success-complete', 'achievement-...'
    const [customPromoProduct, setCustomPromoProduct] = useState<string>('');
    const [customDiscount, setCustomDiscount] = useState<number>(15);

    // Estados de Gamificación (Business Memory en localStorage)
    const [xp, setXp] = useState<number>(0);
    const [level, setLevel] = useState<number>(1);
    const [completedSuggestions, setCompletedSuggestions] = useState<string[]>([]);
    const [history, setHistory] = useState<{ id: string; title: string; date: string; xpGained: number }[]>([]);

    // NUEVOS ESTADOS PREMIUM
    const [favorites, setFavorites] = useState<any[]>([]);
    const [rolledIdea, setRolledIdea] = useState<any | null>(null);
    const [isRolling, setIsRolling] = useState<boolean>(false);
    const [rollCount, setRollCount] = useState<number>(0);
    const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
    
    // Community Manager
    const [cmSelectedPreset, setCmSelectedPreset] = useState<string>('cm-1');
    const [cmCustomText, setCmCustomText] = useState<string>('');
    const [cmSelectedTone, setCmSelectedTone] = useState<'emotional' | 'funny' | 'sales'>('emotional');
    
    // Calendario
    const [selectedCalDate, setSelectedCalDate] = useState<number | null>(22); // 22 de Mayo (Hoy) por defecto

    // Cargar datos y persistencia al montar
    useEffect(() => {
        const fetchAll = async () => {
            try {
                await Promise.allSettled([loadProducts(), loadCustomers()]);
            } catch (e) {
                console.error("Error al cargar datos en FloriAI:", e);
            }
        };
        fetchAll();

        // Cargar gamificación y nuevos estados de localStorage
        const storedXp = localStorage.getItem('floriai_xp');
        const storedLevel = localStorage.getItem('floriai_level');
        const storedCompleted = localStorage.getItem('floriai_completed_suggestions');
        const storedHistory = localStorage.getItem('floriai_history');

        const storedFavorites = localStorage.getItem('floriai_favorites');
        const storedRollCount = localStorage.getItem('floriai_roll_count');
        const storedAchievements = localStorage.getItem('floriai_achievements');

        if (storedXp) setXp(Number(storedXp));
        if (storedLevel) setLevel(Number(storedLevel));
        if (storedCompleted) setCompletedSuggestions(JSON.parse(storedCompleted));
        if (storedHistory) setHistory(JSON.parse(storedHistory));

        if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
        if (storedRollCount) setRollCount(Number(storedRollCount));
        if (storedAchievements) setUnlockedAchievements(JSON.parse(storedAchievements));
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

    // Escucha automática para desbloquear Nivel 3
    useEffect(() => {
        if (level >= 3) {
            const stored = localStorage.getItem('floriai_achievements');
            const currentUnlocked = stored ? JSON.parse(stored) : [];
            if (!currentUnlocked.includes('garden_lvl3')) {
                const updated = [...currentUnlocked, 'garden_lvl3'];
                localStorage.setItem('floriai_achievements', JSON.stringify(updated));
                setUnlockedAchievements(updated);
                
                // Recompensar con 20 XP
                const xpReward = 20;
                let newXp = xp + xpReward;
                let newLevel = level;
                if (newXp >= 100) {
                    newXp = newXp - 100;
                    newLevel = level + 1;
                }
                saveProgress(newXp, newLevel, completedSuggestions, [
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        title: `🏆 Desbloqueaste la Medalla: Jardín de Oro`,
                        date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        xpGained: xpReward
                    },
                    ...history
                ]);
                setCopiedTextType('achievement-garden_lvl3');
                setTimeout(() => setCopiedTextType(null), 4000);
            }
        }
    }, [level]);

    // Desbloquear medalla programáticamente
    const triggerUnlock = (achievementId: string) => {
        const stored = localStorage.getItem('floriai_achievements');
        const currentUnlocked = stored ? JSON.parse(stored) : [];
        if (currentUnlocked.includes(achievementId)) return;

        const updated = [...currentUnlocked, achievementId];
        localStorage.setItem('floriai_achievements', JSON.stringify(updated));
        setUnlockedAchievements(updated);

        // Recompensar con 20 XP
        const xpReward = 20;
        let newXp = xp + xpReward;
        let newLevel = level;
        if (newXp >= 100) {
            newXp = newXp - 100;
            newLevel = level + 1;
        }
        
        saveProgress(newXp, newLevel, completedSuggestions, [
            {
                id: Math.random().toString(36).substr(2, 9),
                title: `🏆 Desbloqueaste la Medalla: ${ACHIEVEMENTS.find(a => a.id === achievementId)?.title}`,
                date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                xpGained: xpReward
            },
            ...history
        ]);

        setCopiedTextType(`achievement-${achievementId}`);
        setTimeout(() => setCopiedTextType(null), 4000);
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

        // Activar medalla Semilla Creativa
        triggerUnlock('first_task');

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

    // Procesar datos y correr el "Marketing Engine" Heurístico
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
                            { shot: 'Primer plano (Macro)', description: `Mapea de cerca los pétalos de tus hermosas/os ${cleanName}, mostrando el rocío de agua fresca.`, duration: '3s' },
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
                            { shot: 'WhatsApp', description: `Revisar el historial de compras de ${client.name} para sugerir algo acorde a sus gustos.`, duration: '1m' },
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

    const currentSuggestion = selectedSuggestion || suggestions[0];

    // Manejar copiado al portapapeles con feedback visual
    const handleCopyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        setCopiedTextType(type);
        setTimeout(() => setCopiedTextType(null), 2000);

        // Desbloquear logro Fidelizador si copia un mensaje de cliente
        if (type === 'whatsapp') {
            triggerUnlock('fidelizador');
        }
    };

    // Crear combo promocional interactivo
    const suggestedCombo = useMemo(() => {
        const listProducts = products.length > 0 ? products : defaultProducts;
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

    // Triggerear Combo Master cuando cambia el slider o copia el combo
    const handleComboAction = () => {
        triggerUnlock('combo_gen');
    };

    // BASE DE DATOS DEL DADO: 16 Prompts Hiper-Creativos
    const ROLLED_IDEAS = [
        {
            id: 'roll-1',
            title: '☕ Café con aroma de Aster',
            category: 'Aesthetic & Lofi',
            whyRecommended: 'Combina dos placeres cotidianos para generar empatía y comunidad en Instagram.',
            music: 'Lofi Jazz o Chillhop relajado',
            steps: [
                { shot: 'Primer plano (Macro)', description: 'Una taza de café humeante y caliente al lado de un ramo de Asters rústicos.', duration: '3s' },
                { shot: 'Plano cenital', description: 'Tus manos abriendo un libro de poemas o diseño, hojeando suavemente.', duration: '5s' },
                { shot: 'Plano detalle', description: 'Colocar delicadamente una flor de Aster como señalador de páginas.', duration: '4s' }
            ],
            hooks: {
                emotional: '«¿Sabías que combinar café y flores frescas en tu escritorio reduce el estrés diario? Hoy te muestro mi ritual...»',
                fun: '«Mi psicólogo me dijo que busque pasatiempos tranquilos... y acá estoy, gastando todo en café especial y flores 😂»',
                sales: '«El combo de escritorio perfecto: Levantá tu ánimo con nuestro mini-ramo Aster del día con taza de regalo hoy.»'
            },
            copies: {
                emotional: 'Hay mañanas que piden ir más despacio. El aroma del café recién hecho y el violeta de los Asters son el recordatorio perfecto de que el presente es el único lugar donde florecemos. ☕💜\n\n¿Cuál es tu ritual favorito hoy?',
                fun: 'El club del café frío y las manos perfumadas a eucalipto reportándose. 🙋‍♀️☕💐 Hoy decidimos que tu escritorio se merece subir de nivel estético. ¡Un toque de naturaleza alegra cualquier mail! 🤭',
                sales: '¡Renová la energía de tus mañanas! 🌟 Diseñamos los arreglos mini de flores frescas que duran semanas en agua, perfectos para tu taza de café. Enlace de compra en bio. ¡Enviamos en el día! 🚚'
            },
            ctas: {
                emotional: 'Compartí calma con esa persona que lo necesita hoy.',
                fun: 'Comentá ☕ si vos también necesitás cafeína y flores hoy.',
                sales: 'Reservá tu mini-arreglo hoy mismo haciendo clic en el perfil.'
            },
            hashtags: ['cafeconflores', 'aestheticflower', 'astersilvestre', 'decordesk', 'rituales']
        },
        {
            id: 'roll-2',
            title: '🌿 Susurros de Eucalipto (Spa en Baño)',
            category: 'Bienestar / DIY',
            whyRecommended: 'Los videos de cuidado personal y aromaterapia en casa tienen un engagement arrollador.',
            music: 'ASMR de agua cayendo + Lofi suave',
            steps: [
                { shot: 'Plano medio', description: 'Tus manos amarrando tres ramas grandes de Eucalipto fresco con hilo de yute rústico.', duration: '4s' },
                { shot: 'Plano de primer plano', description: 'Colgar el ramito de eucalipto directamente detrás de la flor de ducha.', duration: '4s' },
                { shot: 'Plano macro vapor', description: 'El vapor del baño cubriendo las hojas, liberando los aceites esenciales medicinales.', duration: '5s' }
            ],
            hooks: {
                emotional: '«Tu ducha diaria puede sentirse como un sauna de lujo en medio del bosque... Dejame mostrarte este truco...»',
                fun: '«Hice esto en mi ducha y ahora mi baño parece un sauna de alta montaña. No quiero salir nunca 😂»',
                sales: '«Lanzamos el Ramillete de Ducha: Ramas gigantes de Eucalipto medicinal listas para colgar por un precio mínimo.»'
            },
            copies: {
                emotional: 'Spa botánico en casa 🛁🌿. El vapor de agua ayuda a liberar los aceites esenciales del eucalipto, actuando como descongestivo natural y relajante mental. Un mimo que tu cuerpo merece al final de la semana. 💚',
                fun: 'Chau resfríos y tensiones del día. 👋 Colgar eucalipto en la ducha es el hack definitivo de Pinterest. ¿Ya lo probaste? Advertencia: es un camino de ida. 🚿🤭',
                sales: '¡Transformá tu baño hoy! 🎉 Conseguí tu manojo de Eucalipto Fresco cortado en el día para máxima fragancia en nuestro taller.\n\n👉 Encargalo por mensaje y retirá esta tarde. ¡Coordinemos!'
            },
            ctas: {
                emotional: 'Guardá este tip para preparar tu fin de semana de relax.',
                fun: 'Dejanos un emoji de ramita 🌿 si vas a probar este truco hoy.',
                sales: 'Escribinos "QUIERO SPA" y reservamos tu manojo aromático ya.'
            },
            hashtags: ['eucaliptofresco', 'spacasero', 'wellness', 'aromaterapia', 'tipsnaturales']
        },
        {
            id: 'roll-3',
            title: '🎀 El Arte del Envoltorio Perfecto',
            category: 'Detrás de Escena / Tutorial',
            whyRecommended: 'Los procesos manuales elegantes aumentan el valor percibido de tus arreglos.',
            music: 'Indie Folk acústico y enérgico',
            steps: [
                { shot: 'Plano cenital rápido', description: 'Extender papel kraft de doble cara sobre la mesa de trabajo de madera.', duration: '3s' },
                { shot: 'Plano detalle (Macro)', description: 'Tus dedos haciendo pliegues perfectos y abanicando el papel alrededor de los tallos.', duration: '5s' },
                { shot: 'Plano medio de cierre', description: 'Amarrar el ramo con una cinta de seda color terracota y cortar los bordes en diagonal.', duration: '4s' }
            ],
            hooks: {
                emotional: '«Envolver un ramo de flores es como abrigar una carta de amor... cada pliegue tiene un sentido...»',
                fun: '«Expectativa: Envolver un ramo en 5 segundos. Realidad: Papel arrugado e hilo de yute pegado en los dedos 😂...»',
                sales: '«Cuidamos el diseño de punta a punta. Envolvemos con papel kraft de importación y lazos de seda. Mirá este resultado...»'
            },
            copies: {
                emotional: 'Para nosotros, el envoltorio no es un agregado: es la presentación formal de tus sentimientos. 💌💐 Cuidamos cada pliegue para que la experiencia de recibir sea inolvidable desde el primer tacto.\n\n¿Qué te parece este diseño?',
                fun: 'Pelearse con el rollo de cinta es parte de nuestro entrenamiento diario. 🥊😂 Pero ver al ramo cobijado en su papel kraft rústico hace que todo el desorden valga la pena.\n\n¿Sos de los que guardan los papeles de regalos? 🎁👇',
                sales: '✨ Detalles que enamoran ✨. Todos nuestros ramos especiales se entregan listos para lucir con envoltorios premium que conservan la humedad de las flores en el viaje.\n\nPedilo online y personalizá tu tarjeta. 🛒'
            },
            ctas: {
                emotional: 'Hacé tu encargo especial y escribimos tu dedicatoria a mano.',
                fun: 'Etiquetá a tu amigo/a perfeccionista que ama los empaques prolijos.',
                sales: 'Comprá hoy y llevate el envoltorio premium de estación sin costo adicional.'
            },
            hashtags: ['empaque', 'hechoamano', 'tallerfloral', 'diseñoexclusivo', 'detalles']
        },
        {
            id: 'roll-4',
            title: '🍂 Paleta de Otoño Arcilla (Transición)',
            category: 'Visual & Aesthetic',
            whyRecommended: 'Aprovecha la estación para asociar tu marca a tendencias Pinterest de decoración acogedora.',
            music: 'Indie Folk otoñal instrumental',
            steps: [
                { shot: 'Plano medio', description: 'Flores frescas vibrantes en tonos terracota, ocre y trigo sobre una mesa rústica.', duration: '4s' },
                { shot: 'Chasquido de dedos (Transición)', description: 'Cambiar instantáneamente al ramo deshidratado / seco con una vela encendida.', duration: '3s' },
                { shot: 'Plano de detalle', description: 'El jarrón de barro en un rincón cálido iluminado con luz led de fondo.', duration: '5s' }
            ],
            hooks: {
                emotional: '«El otoño no es el fin de la belleza, sino su versión más cálida y nostálgica...»',
                fun: '«Inaugurada oficialmente la temporada de té caliente, mantas y flores secas que no tengo que regar 🤫🍂»',
                sales: '«Nueva Colección Cálido Hogar: Set de jarrón de barro + ramo seco premium con 15% OFF esta semana.»'
            },
            copies: {
                emotional: 'Tonos que reconfortan el alma. 🍁 El terracota, el ocre y el trigo deshidratado se unen en este ramo que celebra la calma otoñal. Una propuesta para transformar tu casa en un refugio acogedor frente al frío exterior. 🕯️🍂',
                fun: 'Si tus plantas mueren por olvido... 🤫 Te traemos la solución Pinterest: flores secas. Duran meses intactas y no se quejan si no les das agua. 😂 ¡Escribinos por el tuyo!',
                sales: '🔥 Colección Otoño/Invierno 2026 🔥. Arreglos secos duraderos ideales para interiores calefaccionados. Aportan estilo rústico y cero mantenimiento.\n\nEnvíos en zona sin cargo. ¡Pedí el tuyo! 🚚'
            },
            ctas: {
                emotional: 'Elegí tu paleta otoñal favorita en nuestro catálogo.',
                fun: 'Comentá una hoja seca 🍂 si vos también amás el otoño.',
                sales: 'Comprá tu set decorativo hoy haciendo clic en el link de la bio.'
            },
            hashtags: ['paletadeotoño', 'decoracionrustica', 'floressecas', 'PinterestVibes', 'cozyhome']
        },
        {
            id: 'roll-5',
            title: '🔮 Tu Flor Guardiana según tu Mes',
            category: 'Interactividad / Comunidad',
            whyRecommended: 'Las dinámicas que invitan a comentar tienen un alcance orgánico descomunal en Instagram.',
            music: 'Sonido pop rítmico o campanas mágicas',
            steps: [
                { shot: 'Plano medio', description: 'Mostrar una cartelera con 12 fotos bonitas de flores para cada mes.', duration: '4s' },
                { shot: 'Plano rápido alternado', description: 'Señalar meses clave: Enero (Clavel), Mayo (Aster), Octubre (Rosas).', duration: '4s' },
                { shot: 'Primer plano sonriente', description: 'Hacer el gesto de "dejamelo abajo en comentarios" apuntando.', duration: '4s' }
            ],
            hooks: {
                emotional: '«¿Sabías que tu mes de nacimiento determina tu flor guardiana y su significado botánico?...»',
                fun: '«Dime en qué mes naciste y te diré qué tan dramático/a eres según tu flor protectora... 👀💐»',
                sales: '«¡Cumpleañeros de Mayo! Comenten su fecha y les regalamos un beneficio exclusivo por privado.»'
            },
            copies: {
                emotional: 'La astrología de las flores existe. 🔮 Cada mes del año tiene una flor asociada. Quienes nacieron bajo el Aster en Mayo representan la paciencia, el misterio y el amor por los detalles. 💜\n\n¿Cuál es tu mes? Comentá abajo y te cuento tu significado.',
                fun: '¿Sos una Rosa elegante o una Margarita todoterreno que sobrevive al desierto? 😂 Poné tu mes en comentarios y descubramos tu alter ego floral. ¡A ver cuántos coinciden! 👇',
                sales: '🎂 ¡Festejamos tu día especial! 🎂 Si cumplís años esta semana, dejá tu fecha en comentarios y te mandamos por privado un **15% OFF de regalo** para tu mesa de celebración. ¡Hagamos magia! ✨'
            },
            ctas: {
                emotional: 'Comentá tu mes y descubrí tu flor guardiana hoy.',
                fun: 'Etiquetá a tu amigo/a de Mayo para que reclame su flor.',
                sales: 'Dejanos tu fecha y te enviamos tu cupón de regalo al instante.'
            },
            hashtags: ['astrologiafloral', 'mesdenacimiento', 'regalos', 'floresycumple', 'interaccion']
        },
        {
            id: 'roll-6',
            title: '🧘 Limpieza Zen (Sonidos ASMR)',
            category: 'ASMR / Relajación',
            whyRecommended: 'Los videos con sonidos naturales rítmicos generan un efecto hipnótico que retiene al espectador.',
            music: 'Sin música. Sonido ambiente nítido (ASMR de tijeras, crujido de hojas y spray de agua)',
            steps: [
                { shot: 'Plano súper cerrado', description: 'Tijeras de metal rústicas haciendo clic de manera rítmica.', duration: '4s' },
                { shot: 'Plano detalle tallos', description: 'El crujido seco al remover las hojas y espinas de una rosa importada.', duration: '5s' },
                { shot: 'Plano macro capullo', description: 'Pulverizar rocío de agua fina sobre los pétalos con sonido de spray suave.', duration: '4s' }
            ],
            hooks: {
                emotional: '«Subí el volumen... disfrutá de 15 segundos de meditación floral y olvidate de todo...»',
                fun: '«El sonido de limpiar rosas es mi ruido blanco favorito para mi mente ansiosa 😂. Escuchá esto...»',
                sales: '«Preparamos cada ramo limpiando tallo por tallo para que tu regalo llegue perfecto. Encargá calidad hoy...»'
            },
            copies: {
                emotional: 'Pausa conscientes en tu día. 🌿💆‍♂️ Ponete auriculares, subí el volumen y escuchá el acondicionamiento de nuestras flores frescas. Es nuestro pequeño ritual de amor y respeto hacia la naturaleza. Ojalá te traiga paz.',
                fun: 'Chau ruidos molestos del tráfico, hola clic-clic de las tijeras del florista. ✂️🌹 El verdadero sonido ASMR de un taller creativo.\n\n¿Te quedarías horas viendo esto? Confirmemos que no soy la única. 😂',
                sales: 'Artesanía floral en cada detalle. ✨ Acondicionamos individualmente cada tallo para garantizar que tus flores duren el doble de tiempo en casa. Pedí tus Rosas Rojas Importadas hoy con envío rápido. 🚚'
            },
            ctas: {
                emotional: 'Guardá este video para cuando necesites 15 segundos de respiración consciente.',
                fun: 'Dejanos un emoji de tijera ✂️ si este sonido te relaja.',
                sales: 'Encargá tu ramo impecable haciendo clic en el botón de la tienda.'
            },
            hashtags: ['asmrfloral', 'relajacion', 'detrásdeescena', 'tallerderosas', 'zenstyle']
        },
        {
            id: 'roll-7',
            title: '🏺 Centro de Mesa Express en 3 Pasos',
            category: 'Tutorial / DIY',
            whyRecommended: 'Resuelve un problema cotidiano para comidas o eventos informales, aportando valor práctico.',
            music: 'Ukelele o guitarra acústica alegre',
            steps: [
                { shot: 'Plano subjetivo (POV)', description: 'Tus manos midiendo y recortando los tallos sobrantes a tres alturas distintas.', duration: '3s' },
                { shot: 'Plano de colocación', description: 'Acomodar las flores en una taza vintage de té con agua fresca.', duration: '5s' },
                { shot: 'Plano final emplazado', description: 'El arreglo rústico en la mesa al lado de una vajilla bonita y una vela encendida.', duration: '4s' }
            ],
            hooks: {
                emotional: '«No necesitás vajilla de lujo para que tu mesa familiar parezca sacada de una revista de diseño...»',
                fun: '«Hice este centro express y ahora mis amigas piensan que soy decoradora profesional 😂. Mirá qué simple...»',
                sales: '«Lanzamos el Combo Mesa Express: Pack de flores silvestres variadas + frasco vintage rústico de regalo hoy.»'
            },
            copies: {
                emotional: 'El arte de recibir en casa. 🏡🌸 Un centro de mesa no requiere ser costoso: con flores sencillas del día, una taza antigua heredada y una vela, podés transformar la cena y hacer sentir especiales a tus invitados. ¿Te animás?',
                fun: 'El hack definitivo para cuando te avisan a último momento que van a cenar a tu casa y la mesa es un desierto. 🚨😂 Cortá asters y margaritas, ponelos en un vaso con agua, encendé una vela y ¡listo! Sofisticación express.',
                sales: '¡Llená de encanto tus cenas! 🌟 Te preparamos la caja "Diseño Express": una selección de flores de corte variadas y follajes silvestres para que juegues a armar tus propios mini arreglos decorativos.\n\nPedila online hoy con un 10% de descuento. 🛒✨'
            },
            ctas: {
                emotional: 'Compartilo con esa persona que ama ser anfitriona en su casa.',
                fun: 'Comentá "MESA" y te mandamos nuestra guía completa de combinación de colores para vajilla.',
                sales: 'Comprá tu pack de flores de corte express hoy tocando el link de la bio.'
            },
            hashtags: ['centrodemesa', 'diydecoracion', 'mesasbonitas', 'anfitriones', 'ramosilvestre']
        },
        {
            id: 'roll-8',
            title: '👗 Outfits que combinan con tus Flores',
            category: 'Moda / Estilo de vida',
            whyRecommended: 'Asocia tu marca con estilo de vida premium, aumentando la retención en público joven.',
            music: 'Pop moderno con cambios marcados en el beat',
            steps: [
                { shot: 'Plano general', description: 'Modelo vestida con tapado beige sosteniendo un ramo seco terracota con trigo.', duration: '4s' },
                { shot: 'Transición rápida en el beat', description: 'Cambio de outfit a gabardina verde militar con un ramo fresco de eucalipto.', duration: '4s' },
                { shot: 'Plano detalle girando', description: 'Giro coqueto mostrando las flores a la par de la textura de la ropa.', duration: '4s' }
            ],
            hooks: {
                emotional: '«¿Sabías que las flores de estación son el accesorio de diseño definitivo para tu outfit?...»',
                fun: '«Combinando mi ropa con las flores de mi taller para combatir el gris de la calefacción 😂. ¿Cuál preferís?»',
                sales: '«Estilo que inspira. Llevate el ramo del día que mejor combina con los tonos abrigados de esta estación.»'
            },
            copies: {
                emotional: 'Moda que florece. 🍂 El frío nos invita a abrigarnos, pero también a jugar con texturas: la lana combina a la perfección con la rugosidad rústica de las flores secas y la frescura de los follajes. Llevá el diseño a tu vida diaria.',
                fun: 'Sí, soy el tipo de persona que planea su outfit en base a las flores que entraron al local. 😂 Y la verdad no me arrepiento de nada. El terracota y el verde pino son mi obsesión otoñal. ¿Votos para el 1 o el 2? 👇',
                sales: '✨ Las flores son estilo de vida ✨. Más allá de un regalo, un arreglo floral es el toque de diseño que define la estética de tu hogar. Encontrá combinaciones exquisitas en nuestro catálogo de Otoño/Invierno.\n\nHacemos envíos programados con envoltorio impermeable de regalo. 🚚🛍'
            },
            ctas: {
                emotional: 'Guardá este post para inspirarte en tus combinaciones estéticas.',
                fun: 'Etiquetá a tu amiga amante de la moda Pinterest.',
                sales: 'Escribinos "LOOKBOOK" para asesorarte sobre qué ramos combinan con tu sala.'
            },
            hashtags: ['lookbookfloral', 'modayflores', 'estilodevida', 'coloresdeotoño', 'accesoriosPinterest']
        },
        {
            id: 'roll-9',
            title: '📦 Desembalaje Enérgico (Unboxing de Cultivo)',
            category: 'Detrás de escena',
            whyRecommended: 'Mostrar el producto crudo recién llegado genera sensación de frescura y honestidad absoluta.',
            music: 'Rock alternativo enérgico o sintetizador rápido',
            steps: [
                { shot: 'Plano subjetivo', description: 'Tus manos rompiendo la cinta de embalaje de una gran caja de cartón de mercado.', duration: '3s' },
                { shot: 'Plano de volcado alegre', description: 'Abrir las solapas y revelar decenas de paquetes de flores frescas en papel de diario húmedo.', duration: '5s' },
                { shot: 'Plano de velocidad', description: 'Colocar los paquetes en baldes grandes con agua limpia en un timelapse veloz.', duration: '4s' }
            ],
            hooks: {
                emotional: '«Así se siente abrir un cofre de perfumes directos del campo de cultivo... Acompañame hoy...»',
                fun: '«Unboxing botánico a velocidad de la luz. ¡Llegó la mercadería y el local explota de aromas! 🤩💨»',
                sales: '«¡Acaban de entrar! Rosas, lirios y asters recién desembalados. Reservá los tuyos antes de que se los lleven.»'
            },
            copies: {
                emotional: '¡Día de mercado! 📦🌸 Recibir las flores frescas del cultivo directo es uno de nuestros momentos favoritos de la semana. La fragancia inunda todo el local y nos da esa energía única para ponernos a diseñar para ustedes.',
                fun: 'Expectativa: Unboxing súper prolijo y estético con música de fondo. Realidad: Cajas gigantes de cartón, barro en el piso y nosotros corriendo para hidratar todo antes de que protesten 😂. ¡Pero amamos este caos!',
                sales: '¡Flores fresquísimas recién bajadas del camión! 🚚✨ Diseñamos ramos en el acto con las variedades más selectas de esta semana. Reservá tu envío hoy directo desde la tienda web o WhatsApp.'
            },
            ctas: {
                emotional: 'Dejanos un comentario si querés ver qué ramo armamos con este lote.',
                fun: 'Comentá con tu emoji de flor favorito si te tienta ver el detrás de escena.',
                sales: 'Mandanos un mensaje directo y reservá tu ramo del día súper fresco.'
            },
            hashtags: ['unboxingfloral', 'floresfrescas', 'detrásdeescena', 'tallerderosas', 'diademercado']
        },
        {
            id: 'roll-10',
            title: '🍵 Taza Floral Vintage (Upcycling)',
            category: 'Ecológico / DIY',
            whyRecommended: 'Fomenta el reciclaje creativo y atrae a clientes interesados en vajilla antigua y diseño rústico.',
            music: 'Acústica indie folk tranquila',
            steps: [
                { shot: 'Plano detalle', description: 'Una taza de té antigua de porcelana con flores pintadas a mano, heredada o de feria.', duration: '4s' },
                { shot: 'Plano de corte', description: 'Medir el tallo de pequeñas margaritas y asters y recortarlos bien cortitos.', duration: '4s' },
                { shot: 'Plano cenital', description: 'Acomodar las flores en la taza con agua limpia, creando un domo floral miniatura.', duration: '4s' }
            ],
            hooks: {
                emotional: '«Dale una segunda vida a esa taza de porcelana rota de tu abuela que no te animás a tirar...»',
                fun: '«Fui a una feria de pulgas y salí con esta taza espectacular. Spoiler: ahora tiene asters silvestres 🤭»',
                sales: '«Set Vintage Especial: Te enviamos la taza rústica reciclada + ramito de margaritas listo por un valor promocional.»'
            },
            copies: {
                emotional: 'Historias que vuelven a florecer. 🍵✨ Esa taza antigua que ya no usás o que tiene una pequeña rajadura puede convertirse en el contenedor de tus mañanas alegres. El upcycling floral llena tu hogar de recuerdos bonitos.',
                fun: '¿Vajilla de la abuela rota? No se tira, ¡se florece! 😂 Margaritas, asters y hojitas de menta. Queda espectacular en la mesa de luz y el perfume es mil veces mejor que cualquier aromatizante artificial.',
                sales: '¡Colección Vajilla Florecida! 🌟 Diseñamos mini arreglos en recipientes vintage de cerámica y loza recuperada. Un detalle único para regalar o mimarte hoy. Pedilo con envío rápido en bio.'
            },
            ctas: {
                emotional: 'Guardá esta publicación para tu próxima tarde de manualidades en casa.',
                fun: 'Etiquetá a tu amigo/a fan de lo retro y el reciclaje.',
                sales: 'Escribinos "VINTAGE" y te mandamos fotos de las tazas exclusivas de esta semana.'
            },
            hashtags: ['upcycling', 'tazavintage', 'floresycafé', 'manualidades', 'decoracionretro']
        },
        {
            id: 'roll-11',
            title: '🔬 El Secreto del Agua Limpia',
            category: 'Educativo / Ciencia',
            whyRecommended: 'Los videos que resuelven una frustración común (flores que mueren rápido) generan muchas compartidas y guardados.',
            music: 'Música de misterio / educativa alegre',
            steps: [
                { shot: 'Plano detalle florero', description: 'Florero con agua turbia y flores tristes. Mostrar cara de decepción.', duration: '3s' },
                { shot: 'Plano de ingredientes', description: 'Agregar agua limpia, una gota de cloro y una monedita de cobre al florero.', duration: '5s' },
                { shot: 'Plano final comparativo', description: 'Mostrar las flores erguidas y radiantes 5 días después.', duration: '4s' }
            ],
            hooks: {
                emotional: '«La razón por la que tus flores duran tan poco en casa es este error simple que todos cometen...»',
                fun: '«Mi abuela me reveló este hack de florista y ahora mis jarrones duran más que mis relaciones 😂...»',
                sales: '«Queremos que disfrutes tus ramos por semanas. Te regalamos un sobrecito de nutrientes botánicos con tu compra hoy.»'
            },
            copies: {
                emotional: 'El secreto para un florero eterno. 🌿💧 El agua estancada acumula bacterias que obstruyen los tallos. Con una sola gota de cloro para desinfectar y una moneda de cobre que actúa como alguicida, tus flores van a lucir frescas por el doble de tiempo.',
                fun: 'Hack botánico del día: ¿Tus ramos duran menos de tres días? 🚨 ¡No más flores tristes! Hacé esto hoy mismo y mirá la diferencia. Contame en comentarios si ya conocías el truco de la moneda.',
                sales: 'En nuestra tienda no solo vendemos flores, te enseñamos a cuidarlas. 🌸 Cada pedido de esta semana incluye una tarjeta con los 5 mandamientos del cuidado floral y un sobre de alimento gratis. ¡Encargá online!'
            },
            ctas: {
                emotional: 'Guardá este post para cuando compres tus próximas flores frescas.',
                fun: 'Dejanos un emoji de agua 💧 si te sirvió el secreto de hoy.',
                sales: 'Hacé clic abajo y llevate tus asters con nutrientes de regalo.'
            },
            hashtags: ['cuidadodeflores', 'hacksdelhogar', 'floreroeterno', 'tipbotanico', 'educacionfloral']
        },
        {
            id: 'roll-12',
            title: '🤍 Monocromático Premium Blanco',
            category: 'Aesthetic / Minimalismo',
            whyRecommended: 'El diseño limpio e higiénico tiene una alta percepción de sofisticación de lujo.',
            music: 'Piano clásico minimalista o lofi de piano',
            steps: [
                { shot: 'Plano detalle mesa', description: 'Un jarrón de vidrio transparente impecable con agua y rocas blancas abajo.', duration: '4s' },
                { shot: 'Plano de ensamble', description: 'Colocar lirios blancos, margaritas y rosas blancas formando una nube compacta.', duration: '5s' },
                { shot: 'Plano general', description: 'El ramo monocromático en un ambiente minimalista escandinavo moderno.', duration: '3s' }
            ],
            hooks: {
                emotional: '«A veces, la mayor sofisticación se esconde en la ausencia total de color... solo luz y perfume...»',
                fun: '«El equipo monocromo reportándose. Porque el blanco combina con absolutamente todo y queda finísimo 🤍...»',
                sales: '«Lanzamos el Ramo Nube Blanca: Lirios Perfumados + Rosas Blancas con envoltorio satinado de regalo hoy.»'
            },
            copies: {
                emotional: 'Pureza y balance. 🤍 Diseñamos este ramo monocromático integrando lirios perfumados y margaritas silvestres. Sin ruidos visuales, solo la textura de la naturaleza y una fragancia sutil que pacifica cualquier habitación. ✨',
                fun: 'Minimalismo floral para los que le temen al exceso de colores. 🤭 Un ramo 100% blanco que grita elegancia nórdica y huele a paraíso. Ideal para regalar a ese amigo/a de gustos hiper finos.',
                sales: '✨ Colección Lujo Silencioso ✨. Agregá luz a tus ambientes con nuestro ramo premium Nube Blanca. Hecho con flores de corte seleccionadas a mano. Pedilo en la web con envío gratis en la zona. 🚚'
            },
            ctas: {
                emotional: 'Reservá un momento de serenidad. Tocá el enlace de la bio.',
                fun: 'Dejanos un emoji blanco 🤍 si sos fan de este estilo.',
                sales: 'Comprá hoy mismo y programá tu entrega para el fin de semana.'
            },
            hashtags: ['minimalismofloral', 'floresblancas', 'decoracionpremium', 'lujosilencioso', 'ramosesteticos']
        },
        {
            id: 'roll-13',
            title: '🌾 Colgante DIY de Flores Secas',
            category: 'Tutorial / Manualidades',
            whyRecommended: 'Fomenta el concepto de diseño duradero y genera guardados por ser un tutorial paso a paso visual.',
            music: 'Folk rústico acústico e instrumental',
            steps: [
                { shot: 'Plano medio', description: 'Una rama seca bonita de árbol y cordeles finos de yute.', duration: '4s' },
                { shot: 'Plano detalle dedos', description: 'Atar pequeños ramilletes de lavanda seca y asters boca abajo a lo largo de la rama.', duration: '5s' },
                { shot: 'Plano general final', description: 'Colgar el móvil rústico en una pared neutra o puerta de entrada.', duration: '3s' }
            ],
            hooks: {
                emotional: '«Traé un pedacito de bosque a tu pared con esta manualidad rústica que dura para siempre...»',
                fun: '«Mi nuevo proyecto de domingo para ocultar que la pared de mi cuarto está vacía 😂. Quedó genial...»',
                sales: '«Kit Colgante DIY: Te enviamos la rama de pino pulida, yute y flores secas de lavanda listas para armar.»'
            },
            copies: {
                emotional: 'Móviles de naturaleza para tu hogar. 🌾🏡 Armar un colgante rústico con lavanda y flores secas no solo aromatiza tu espacio, sino que te brinda un momento de desconexión y creación manual. El arte de habitar con calma.',
                fun: 'Terapia de domingo: atar flores a una rama y fingir que tengo mi vida resuelta. 🤭😂 Pero en serio, este móvil de lavanda seca perfuma toda la entrada de casa y se ve súper Pinterest. ¿Qué opinan?',
                sales: '¡Lanzamos el Kit Creativo DIY! 🎨💐 Incluye todo lo necesario para diseñar tu colgante de pared rústico en casa: flores secas surtidas, rama curada de pino e hilo de yute. Encargalo hoy en la tienda con 10% OFF.'
            },
            ctas: {
                emotional: 'Guardá este Reel para cuando tengas una tarde libre y quieras crear.',
                fun: 'Comentá "KIT" y te mandamos el catálogo de flores secas sueltas.',
                sales: 'Hacé tu pedido del kit creativo hoy tocando el botón.'
            },
            hashtags: ['colgantediy', 'floressecas', 'manualidadesrusticas', 'hechoamano', 'pintereststyle']
        },
        {
            id: 'roll-14',
            title: '✍️ Flores & Caligrafía Emotiva',
            category: 'Aesthetic / Detrás de escena',
            whyRecommended: 'La escritura manual fluida y estética es súper relajante y fomenta el valor de los regalos.',
            music: 'Piano clásico muy suave e instrumental',
            steps: [
                { shot: 'Plano cenital', description: 'Una tarjeta rústica de papel kraft al lado de pétalos sueltos de rosas y asters.', duration: '3s' },
                { shot: 'Plano macro de pluma', description: 'Una mano escribiendo con caligrafía elegante una dedicatoria emotiva en la tarjeta.', duration: '6s' },
                { shot: 'Plano de cierre', description: 'Colocar la tarjeta caligrafiada en medio del ramo de diseño listo para entrega.', duration: '3s' }
            ],
            hooks: {
                emotional: '«En la era de los mensajes de texto fríos, una carta escrita a mano y rodeada de flores vale el triple...»',
                fun: '«Mi caligrafía parece de médico de guardia 😂, pero por suerte en el local tenemos a un artista escribiendo sus dedicatorias...»',
                sales: '«Hacemos tus dedicatorias premium escritas a mano con tinta caligráfica sin cargo adicional en tu pedido hoy.»'
            },
            copies: {
                emotional: 'El peso de las palabras. 📝❤️ Creemos que un regalo floral está incompleto sin una dedicatoria sincera. Por eso, en nuestro taller escribimos cada tarjeta a mano con pluma y caligrafía clásica, cuidando que tu mensaje llegue tan profundo como el perfume de las flores.',
                fun: 'Escribir a mano en 2026 es casi un deporte extremo. 😂 Pero ver la cara de emoción al recibir una tarjeta dedicada con puño y letra es irremplazable. Prometemos que nuestra caligrafía es de cuento de hadas.',
                sales: '✨ Personalización Premium Total ✨. Sorprendé a la distancia con un ramo de diseño y una tarjeta dedicatoria manuscrita totalmente de cortesía. Encargá seguro en nuestra tienda online. 🚚💌'
            },
            ctas: {
                emotional: 'Coordiná tu envío hoy y déjanos el texto de tu dedicatoria especial.',
                fun: 'Dejanos un emoji de lápiz ✍️ si vos también preferís las cartas de antes.',
                sales: 'Canjeá tu tarjeta caligráfica gratis encargando tu ramo en la web hoy.'
            },
            hashtags: ['caligrafia', 'tarjetasdedicatorias', 'cartasamano', 'ramospremium', 'sorpresas']
        },
        {
            id: 'roll-15',
            title: '🧹 Expectativa vs. Realidad de Florista',
            category: 'Comedia / Humor Real',
            whyRecommended: 'Humaniza la marca, divierte al público y genera empatía inmediata con tus clientes.',
            music: 'Música de comedia / transición rápida',
            steps: [
                { shot: 'Plano de expectativa', description: 'Tú sosteniendo un ramo estético impecable con una sonrisa perfecta y música lofi.', duration: '4s' },
                { shot: 'Transición abrupta (Realidad)', description: 'Barriendo una montaña de hojas secas del piso por décima vez en el día con pelo despeinado.', duration: '5s' },
                { shot: 'Plano cómico de suspiro', description: 'Tomando café frío de una taza rodeado de espinas de rosa y sonriendo con resignación.', duration: '3s' }
            ],
            hooks: {
                emotional: '«Detrás de cada post estético de Instagram, hay horas de trabajo duro y pasión botánica...»',
                fun: '«Expectativa: Ser florista es súper estético y tranquilo. Realidad: Espinas clavadas en los dedos y barriendo hojas sin parar 😂...»',
                sales: '«Amamos el desorden de nuestro taller porque el resultado es siempre perfecto para vos. Mirá nuestros ramos listos hoy...»'
            },
            copies: {
                emotional: 'El amor detrás del desorden. 🌿 Detrás de cada reel estético con música de violines, hay un equipo con espinas en las manos, barriendo el piso y cargando baldes pesados de agua. Es el trabajo duro que nos apasiona hacer para llenar sus casas de sonrisas.',
                fun: 'Spoiler: el glamour floral no viene incluido con la escoba. 🧹😂 Si pensabas que nos pasábamos el día oliendo rosas con vestidos de lino, lamento desilusionarte. Pero el café frío en este taller tiene sabor a gloria floral.',
                sales: '¡Trabajamos con pasión real! 🎉 Diseñamos arreglos florales únicos cuidando cada detalle del detrás de escena para que a tu casa llegue solo la perfección absoluta. Encargá el tuyo online hoy con envío rápido.'
            },
            ctas: {
                emotional: 'Dejanos un mensaje de aliento para nuestro equipo de diseño.',
                fun: 'Comentá con un emoji cómico si te divertiste con nuestra realidad.',
                sales: 'Comprá hoy mismo y apoya al trabajo artesanal de nuestro local.'
            },
            hashtags: ['expectativavsrealidad', 'humorflorista', 'detrásdeescena', 'tallerbotanico', 'vidadelocal']
        },
        {
            id: 'roll-16',
            title: '💻 El Ramillete Escritorio Alegre (Home Office)',
            category: 'Aesthetic / Productividad',
            whyRecommended: 'Atrae a clientes de oficina / home office que quieren mejorar la vibra y el diseño de su zona de trabajo.',
            music: 'Chill Lofi Beats moderno',
            steps: [
                { shot: 'Plano subjetivo', description: 'Un escritorio de oficina aburrido lleno de cables, cuadernos y carpetas.', duration: '3s' },
                { shot: 'Plano de colocación', description: 'Colocar un pequeño florero con asters morados y una ramita de eucalipto fresco al lado del monitor.', duration: '5s' },
                { shot: 'Plano general estético', description: 'La luz de la pantalla iluminando las flores, creando un espacio de trabajo alegre y renovado.', duration: '4s' }
            ],
            hooks: {
                emotional: '«Tu zona de home office no tiene por qué sentirse fría y corporativa... dale vida a tu día laboral...»',
                fun: '«Estudios científicos inventados por mí confirman que mirar un aster morado mientras tu jefe te manda un mail molesto reduce el enojo un 80% 😂...»',
                sales: '«Lanzamos el Set Productivo: Mini florero de cerámica + manojo de flores de oficina de larga duración por un precio mínimo hoy.»'
            },
            copies: {
                emotional: 'Productividad botánica. 💻🌿 Rodearse de elementos naturales en tu zona de trabajo no solo alegra el espacio, sino que reduce la fatiga visual y promueve la concentración. Dale a tu rutina diaria laboral un respiro de perfume a campo.',
                fun: '¿Días de home office interminables frente al monitor? 🖥️ Margaritas y eucalipto al rescate. El hack definitivo para fingir que tenés tu oficina de diseño nórdico súper controlada. Contanos: ¿flores en tu escritorio sí o no? 👇',
                sales: '✨ Colección Home Office 2026 ✨. Diseñamos ramilletes compactos de flores súper duraderas en agua que no molestan con los cables y alegran tu espacio de trabajo diario. Compralo hoy con entrega rápida en la bio.'
            },
            ctas: {
                emotional: 'Guardá esta idea para cuando reacomodes tu escritorio de oficina.',
                fun: 'Etiquetá a tu compañero/a de trabajo que necesita un poco de vida en su mesa.',
                sales: 'Pedí tu ramillete de escritorio hoy y cambiale la cara a tu jornada.'
            },
            hashtags: ['homeoffice', 'escritoriocreativo', 'productividad', 'decoraciondeoficina', 'margaritasilvestre']
        }
    ];

    // Tirar el Dado de Inspiración Infinita
    const handleRollDice = () => {
        if (isRolling) return;
        setIsRolling(true);

        // Simular tirada animada de dado
        setTimeout(() => {
            const randomIndex = Math.floor(Math.random() * ROLLED_IDEAS.length);
            setRolledIdea(ROLLED_IDEAS[randomIndex]);
            setIsRolling(false);

            // Incrementar contador de dados
            const newCount = rollCount + 1;
            setRollCount(newCount);
            localStorage.setItem('floriai_roll_count', newCount.toString());

            // Medalla de Inspiración Infinita si llega a 5
            if (newCount >= 5) {
                triggerUnlock('dice_roll');
            }
        }, 1200);
    };

    // Agregar o quitar favoritos
    const handleToggleFavorite = (item: any, type: 'sugerencia' | 'dado') => {
        const itemWithMeta = {
            ...item,
            favType: type,
            savedAt: new Date().toLocaleDateString('es-AR')
        };
        const exists = favorites.some(fav => fav.id === item.id);
        let updated;

        if (exists) {
            updated = favorites.filter(fav => fav.id !== item.id);
        } else {
            updated = [...favorites, itemWithMeta];
        }

        setFavorites(updated);
        localStorage.setItem('floriai_favorites', JSON.stringify(updated));

        // Toast de guardado
        setCopiedTextType(exists ? 'fav-removed' : 'fav-saved');
        setTimeout(() => setCopiedTextType(null), 2000);
    };

    // Respuestas Sugeridas del Community Manager
    const activeCMReplies = useMemo(() => {
        if (cmSelectedPreset === 'custom') {
            if (!cmCustomText.trim()) return null;
            return {
                emotional: `¡Hola! ❤️ Qué lindo tu mensaje. Nos encanta que conectes con nuestras flores de esta manera. Respecto a lo que nos comentás: "${cmCustomText}", estamos súper predispuestos a ayudarte de forma totalmente personalizada. ¡Escribinos por privado para charlarlo mejor!`,
                funny: `¡Hola! 😄 ¡Qué gran consulta! Sobre "${cmCustomText}": nos pusimos a charlar con los girasoles del local y están 100% de acuerdo en que es una genialidad. Hablemos por privado para coordinar todos los detalles divertidos.`,
                sales: `¡Hola! ✨ Muchas gracias por consultarnos. Respecto a "${cmCustomText}", te cuento que tenemos promociones espectaculares activas y stock disponible para entrega inmediata hoy mismo. ¡Escribinos por MD o WhatsApp para resolverlo ya!`
            };
        }
        const preset = CM_PRESETS.find(p => p.id === cmSelectedPreset);
        return preset ? preset.replies : null;
    }, [cmSelectedPreset, cmCustomText]);

    // Triggerear Mente Abierta (Cross Inspiration)
    const handleExploreCrossInspiration = (rubro: string) => {
        triggerUnlock('cross_inspiration');
        setCopiedTextType(`cross-${rubro}`);
        setTimeout(() => setCopiedTextType(null), 3000);
    };

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
                        <span>FloriAI Copiloto v2.5</span>
                    </div>
                    <h1>Copiloto de Marketing & Asistente Creativo</h1>
                    <p>Tu community manager, director de reels y planificador inteligente alimentado por el stock real de tu florería.</p>
                </div>
            </div>

            {/* Layout Principal de Dos Columnas */}
            <div className="marketing-content-grid">
                
                {/* COLUMNA IZQUIERDA: Herramientas y Pestañas de Navegación de Roles */}
                <div className="marketing-tools-container">
                    <div className="marketing-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
                            onClick={() => setActiveTab('today')}
                        >
                            <Calendar size={18} />
                            <span>Hoy / Asesor</span>
                            <span className="badge-count">3</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'reels' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reels')}
                        >
                            <Camera size={18} />
                            <span>Reels / Director</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'promos' ? 'active' : ''}`}
                            onClick={() => setActiveTab('promos')}
                        >
                            <ShoppingBag size={18} />
                            <span>Combos / Analista</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'cm-replies' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cm-replies')}
                        >
                            <Send size={18} />
                            <span>Respuestas CM</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                            onClick={() => setActiveTab('calendar')}
                        >
                            <Calendar size={18} />
                            <span>Calendario</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'cross-inspiration' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cross-inspiration')}
                        >
                            <Compass size={18} />
                            <span>Inspiración Cruzada</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'garden' ? 'active' : ''}`}
                            onClick={() => setActiveTab('garden')}
                        >
                            <Award size={18} />
                            <span>Jardín & Logros</span>
                        </button>
                    </div>

                    {/* TABS CONTENIDOS */}

                    {/* TAB 1: HOY / ASESOR */}
                    {activeTab === 'today' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>📋 Tu rutina de crecimiento de hoy</h2>
                                <p>Sugerencias personalizadas en base a tu stock e inventario en tiempo real para generar hábito y traccionar ventas diarias.</p>
                            </div>

                            {/* Sugerencias Heurísticas */}
                            <div className="suggestions-list">
                                {suggestions.map((sug) => {
                                    const isSelected = currentSuggestion?.id === sug.id;
                                    const isCompleted = completedSuggestions.includes(sug.id);
                                    const isFav = favorites.some(fav => fav.id === sug.id);

                                    return (
                                        <div 
                                            key={sug.id}
                                            className={`suggestion-card border-priority-${sug.priority} ${isSelected ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                            onClick={() => setSelectedSuggestion(sug)}
                                        >
                                            <div className="suggestion-status-indicator flex justify-between items-center">
                                                <div>
                                                    {sug.priority === 'urgent' && <span className="status-badge urgent">🔴 Urgente</span>}
                                                    {sug.priority === 'recommended' && <span className="status-badge recommended">🟡 Recomendado</span>}
                                                    {sug.priority === 'opportunity' && <span className="status-badge opportunity">🟢 Oportunidad</span>}
                                                </div>
                                                <button 
                                                    className={`fav-btn-bubble ${isFav ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFavorite(sug, 'sugerencia');
                                                    }}
                                                >
                                                    <Heart size={16} fill={isFav ? '#e11d48' : 'none'} />
                                                </button>
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

                            {/* Detalle Ampliado de Sugerencia Seleccionada */}
                            {currentSuggestion && (
                                <div className="suggestion-details-card glass-panel mt-6">
                                    <div className="sug-details-header">
                                        <div className="sug-details-title-row">
                                            <span className="material-symbols-rounded header-icon">{currentSuggestion.icon}</span>
                                            <div>
                                                <h3>{currentSuggestion.title}</h3>
                                                <p className="sug-accent-reason">{currentSuggestion.reason}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
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
                                    </div>

                                    <div className="suggestion-info-blocks">
                                        <div className="info-block">
                                            <strong>💡 La Idea</strong>
                                            <p>{currentSuggestion.details.idea}</p>
                                        </div>
                                        <div className="info-block">
                                            <strong>🎯 Objetivo</strong>
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
                                                <span>Paleta: <strong>{currentSuggestion.palette.name}</strong></span>
                                                <div className="palette-preview-dots">
                                                    {currentSuggestion.palette.colors.slice(0, 3).map((col, idx) => (
                                                        <span key={idx} className="color-dot" style={{ backgroundColor: col }} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Copies & Generador de Textos */}
                                    <div className="copywriter-section">
                                        <div className="copywriter-header">
                                            <h4>✍️ Generador de Textos en Múltiples Tonos</h4>
                                            <div className="tone-selector">
                                                {['emotional', 'fun', 'educational', 'sales'].map(t => (
                                                    <button 
                                                        key={t}
                                                        className={`tone-btn ${selectedTone === t ? 'active' : ''}`}
                                                        onClick={() => setSelectedTone(t)}
                                                    >
                                                        <span>{t === 'emotional' ? '❤️ Emocional' : t === 'fun' ? '😂 Divertido' : t === 'educational' ? '📖 Educativo' : '💰 Ventas'}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="copy-blocks-grid">
                                            <div className="copy-block-card">
                                                <div className="copy-card-header">
                                                    <span>🔥 Gancho / Hook</span>
                                                    <button className="copy-text-btn" onClick={() => handleCopyToClipboard(currentSuggestion.details.hooks[selectedTone] || '', 'hook')}>
                                                        {copiedTextType === 'hook' ? <Check size={16} /> : <Copy size={16} />}
                                                        <span>Copiar</span>
                                                    </button>
                                                </div>
                                                <p className="copy-text-content">"{currentSuggestion.details.hooks[selectedTone]}"</p>
                                            </div>

                                            <div className="copy-block-card">
                                                <div className="copy-card-header">
                                                    <span>📝 Caption Principal</span>
                                                    <button className="copy-text-btn" onClick={() => handleCopyToClipboard(currentSuggestion.details.copies[selectedTone] || '', 'copy')}>
                                                        {copiedTextType === 'copy' ? <Check size={16} /> : <Copy size={16} />}
                                                        <span>Copiar</span>
                                                    </button>
                                                </div>
                                                <p className="copy-text-content pre-wrap">{currentSuggestion.details.copies[selectedTone]}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 🎲 SECCIÓN DADO DE LA INSPIRACIÓN INFINITA */}
                            <div className="dice-inspiration-card glass-panel mt-8 text-center p-6">
                                <div className="rainbow-glow-border"></div>
                                <span className="badge badge-accent mx-auto mb-2">🎲 GENERADOR INFINITO</span>
                                <h3>Dado de la Inspiración Infinita</h3>
                                <p className="text-small text-muted max-w-md mx-auto mb-6">
                                    ¿Te quedaste sin ideas creativas para hoy? Tirás el dado estético y FloriAI seleccionará uno de los 16 guiones hiper-específicos del rubro floral.
                                </p>
                                
                                <button 
                                    className={`dice-roll-btn ${isRolling ? 'rolling' : ''}`}
                                    onClick={handleRollDice}
                                    disabled={isRolling}
                                >
                                    <Dices size={24} />
                                    <span>{isRolling ? 'Sorteando Ideas...' : 'Tirar Dado Creativo'}</span>
                                </button>

                                {rolledIdea && !isRolling && (
                                    <div className="rolled-idea-display-card animate-fade-in mt-6 p-4 text-left border border-primary rounded-xl bg-surface relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="badge badge-primary">{rolledIdea.category}</span>
                                            <div className="flex gap-2">
                                                <button 
                                                    className="fav-btn-bubble"
                                                    onClick={() => handleToggleFavorite(rolledIdea, 'dado')}
                                                >
                                                    <Heart size={16} fill={favorites.some(fav => fav.id === rolledIdea.id) ? '#e11d48' : 'none'} />
                                                </button>
                                                <button 
                                                    className="btn-copy-all text-micro flex items-center gap-1"
                                                    onClick={() => handleCopyToClipboard(rolledIdea.copies.emotional, 'rolled-copy')}
                                                >
                                                    {copiedTextType === 'rolled-copy' ? <Check size={14} /> : <Copy size={14} />}
                                                    <span>Copiar Copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-lg text-primary">{rolledIdea.title}</h4>
                                        <p className="text-small text-muted mb-4">{rolledIdea.whyRecommended}</p>
                                        
                                        <div className="p-3 bg-background rounded-lg border mb-4">
                                            <strong className="text-micro text-primary uppercase">Guía rápida de grabación:</strong>
                                            <ul className="list-disc pl-4 text-small text-muted mt-2 space-y-1">
                                                {rolledIdea.steps.map((st: any, idx: number) => (
                                                    <li key={idx}><strong>{st.shot}</strong>: {st.description}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="p-3 bg-surface border rounded-lg">
                                            <strong className="text-micro text-primary uppercase block mb-1">Textos Sugeridos:</strong>
                                            <p className="text-small"><strong>Hook:</strong> "{rolledIdea.hooks.emotional}"</p>
                                            <p className="text-small mt-1"><strong>Copy:</strong> {rolledIdea.copies.emotional.slice(0, 100)}...</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 💖 GRID DE FAVORITOS Y GUARDADOS */}
                            {favorites.length > 0 && (
                                <div className="favorites-shelf-container glass-panel mt-8 p-6">
                                    <h3 className="flex items-center gap-2 mb-4">
                                        <Heart size={20} fill="#e11d48" color="#e11d48" />
                                        <span>Tus Ideas Guardadas & Favoritas ({favorites.length})</span>
                                    </h3>
                                    <div className="favorites-grid">
                                        {favorites.map((fav) => (
                                            <div key={fav.id} className="fav-card p-4 rounded-xl border bg-surface">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-micro text-muted font-bold">Guardado el {fav.savedAt}</span>
                                                    <button 
                                                        className="text-danger flex items-center gap-1"
                                                        onClick={() => handleToggleFavorite(fav, fav.favType)}
                                                    >
                                                        <Trash2 size={14} />
                                                        <span className="text-micro">Quitar</span>
                                                    </button>
                                                </div>
                                                <h4 className="font-bold text-primary">{fav.title}</h4>
                                                <p className="text-small text-muted line-clamp-2 mt-1">{fav.reason || fav.whyRecommended}</p>
                                                <button 
                                                    className="btn btn-secondary btn-sm mt-3 w-full"
                                                    onClick={() => {
                                                        if (fav.favType === 'sugerencia') {
                                                            setSelectedSuggestion(fav);
                                                            setActiveTab('today');
                                                        } else {
                                                            setRolledIdea(fav);
                                                            setActiveTab('today');
                                                        }
                                                    }}
                                                >
                                                    Abrir sugerencia
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: REELS / DIRECTOR CREATIVO */}
                    {activeTab === 'reels' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>🎥 Estudio de Creación de Reels</h2>
                                <p>Crea guiones cinematográficos estéticos para cualquier flor de tu catálogo adaptados a tu taller botánico.</p>
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

                                    {/* Instagram Feed Mockup */}
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

                    {/* TAB 3: COMBOS / ANALISTA COMERCIAL */}
                    {activeTab === 'promos' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>💼 Generador Inteligente de Combos & Promociones</h2>
                                <p>Combiná de forma automática tus productos con mayor sobrestock para armar ofertas tentadoras y de alta rentabilidad.</p>
                            </div>

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
                                        onChange={(e) => {
                                            setCustomDiscount(Number(e.target.value));
                                            handleComboAction();
                                        }}
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

                                        <div className="whatsapp-blast-section border-t border-border mt-4 pt-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-small text-muted">Mensaje Listo para Enviar a Clientes (WhatsApp):</span>
                                                <button 
                                                    className="btn btn-secondary btn-sm flex items-center gap-1"
                                                    onClick={() => {
                                                        handleCopyToClipboard(suggestedCombo.whatsappText, 'combo');
                                                        handleComboAction();
                                                    }}
                                                    style={{ minHeight: '36px', padding: '0.5rem 1rem' }}
                                                >
                                                    {copiedTextType === 'combo' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
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

                    {/* TAB 4: COMMUNITY MANAGER / SIMULADOR DE COMENTARIOS IA */}
                    {activeTab === 'cm-replies' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>💬 Community Manager: Simulador de Respuestas Rápidas</h2>
                                <p>Simulá las consultas de tus clientes y FloriAI redactará respuestas optimizadas en diferentes tonos para copiar al portapapeles al instante.</p>
                            </div>

                            <div className="cm-simulation-card glass-panel p-6">
                                <div className="presets-list mb-6">
                                    <label className="form-label font-bold text-small block mb-2">Seleccioná un Comentario Común de Redes:</label>
                                    <div className="presets-grid">
                                        {CM_PRESETS.map((item) => (
                                            <button 
                                                key={item.id}
                                                className={`preset-comment-btn ${cmSelectedPreset === item.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    setCmSelectedPreset(item.id);
                                                    setCmCustomText('');
                                                }}
                                            >
                                                "{item.comment}"
                                            </button>
                                        ))}
                                        <button 
                                            className={`preset-comment-btn ${cmSelectedPreset === 'custom' ? 'active' : ''}`}
                                            onClick={() => setCmSelectedPreset('custom')}
                                        >
                                            ✏️ Escribir comentario personalizado...
                                        </button>
                                    </div>
                                </div>

                                {cmSelectedPreset === 'custom' && (
                                    <div className="form-group mb-6 animate-fade-in">
                                        <label className="form-label text-small font-bold">Escribí tu consulta personalizada de cliente:</label>
                                        <textarea
                                            className="form-input w-full p-3 border rounded-xl"
                                            rows={3}
                                            value={cmCustomText}
                                            onChange={(e) => setCmCustomText(e.target.value)}
                                            placeholder="Ej. Hola! ¿Hacen coronas florales de entierro y cuánto tardan en entregar?"
                                        />
                                    </div>
                                )}

                                {/* Chat Mockup View */}
                                <div className="chat-mockup-wrapper bg-background border rounded-xl p-4 mb-6">
                                    <div className="chat-bubble customer-bubble bg-surface p-3 rounded-xl max-w-md mb-4 border border-border shadow-sm">
                                        <span className="text-micro font-bold text-muted block mb-1">Cliente Dice:</span>
                                        <p className="text-body text-black">
                                            {cmSelectedPreset === 'custom' ? (cmCustomText || 'Esperando tu consulta...') : (CM_PRESETS.find(p => p.id === cmSelectedPreset)?.comment)}
                                        </p>
                                    </div>

                                    {activeCMReplies && (
                                        <div className="chat-bubble ai-reply-bubble bg-surface-hover p-4 rounded-xl border border-primary relative shadow-md">
                                            <div className="rainbow-glow-border"></div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="badge badge-accent flex items-center gap-1">
                                                    <Sparkles size={12} />
                                                    <span>FloriAI Respuestas</span>
                                                </span>
                                                <div className="tone-selector">
                                                    {['emotional', 'funny', 'sales'].map((t) => (
                                                        <button 
                                                            key={t}
                                                            className={`tone-btn-micro ${cmSelectedTone === t ? 'active' : ''}`}
                                                            onClick={() => setCmSelectedTone(t as any)}
                                                        >
                                                            <span>{t === 'emotional' ? '❤️ Emocional' : t === 'funny' ? '😂 Divertido' : '💰 Vendedor'}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="reply-content-box p-3 bg-surface rounded-lg border mb-3">
                                                <p className="text-body text-black">
                                                    {activeCMReplies[cmSelectedTone]}
                                                </p>
                                            </div>

                                            <button 
                                                className="btn btn-primary w-full flex items-center justify-center gap-2"
                                                onClick={() => handleCopyToClipboard(activeCMReplies[cmSelectedTone], 'cm-copy')}
                                                style={{ minHeight: '44px' }}
                                            >
                                                {copiedTextType === 'cm-copy' ? <Check size={18} /> : <Copy size={18} />}
                                                <span>{copiedTextType === 'cm-copy' ? '¡Copiado al Portapapeles!' : 'Copiar esta Respuesta'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: CALENDARIO INTELIGENTE */}
                    {activeTab === 'calendar' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>📅 Calendario Inteligente & Efemérides de Contenido</h2>
                                <p>Planificá tus redes y promociones en base a las fechas importantes de floricultura y eventos comerciales de Mayo 2026.</p>
                            </div>

                            <div className="calendar-panel-grid glass-panel p-6">
                                <div className="calendar-month-selector text-center mb-6">
                                    <h3 className="text-xl font-bold text-primary flex items-center justify-center gap-2">
                                        <Calendar size={20} />
                                        <span>Mayo 2026</span>
                                    </h3>
                                    <p className="text-micro text-muted">Hacé clic en cualquier fecha destacada para ver la sugerencia de marketing.</p>
                                </div>

                                <div className="calendar-grid-container mb-6">
                                    {/* Encabezados de días */}
                                    <div className="calendar-day-headers">
                                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                            <div key={d} className="day-header">{d}</div>
                                        ))}
                                    </div>

                                    {/* Grilla de celdas */}
                                    <div className="calendar-grid-cells">
                                        {/* Celdas vacías de relleno (1 de Mayo fue viernes, por ende 4 vacías) */}
                                        {Array.from({ length: 4 }).map((_, idx) => (
                                            <div key={`empty-${idx}`} className="calendar-cell empty"></div>
                                        ))}

                                        {/* Días del mes (1 al 31) */}
                                        {Array.from({ length: 31 }).map((_, idx) => {
                                            const day = idx + 1;
                                            const isEvent = !!CALENDAR_DATES[day];
                                            const isSelected = selectedCalDate === day;
                                            const eventType = isEvent ? CALENDAR_DATES[day].type : null;

                                            return (
                                                <button 
                                                    key={day}
                                                    className={`calendar-cell ${isEvent ? 'has-event' : ''} ${isSelected ? 'selected' : ''} event-${eventType}`}
                                                    onClick={() => setSelectedCalDate(day)}
                                                >
                                                    <span className="day-num">{day}</span>
                                                    {isEvent && <span className="event-dot"></span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Detalles de la fecha seleccionada */}
                                {selectedCalDate && (
                                    <div className="selected-date-detail-card bg-surface p-4 border rounded-xl animate-fade-in flex flex-col md:flex-row gap-4 justify-between items-start">
                                        <div>
                                            <span className="text-micro font-bold uppercase text-primary">Detalle de Fecha: {selectedCalDate} de Mayo 2026</span>
                                            {CALENDAR_DATES[selectedCalDate] ? (
                                                <>
                                                    <h4 className="font-bold text-lg text-primary mt-1">
                                                        {CALENDAR_DATES[selectedCalDate].type === 'comercial' ? '💰 ' : CALENDAR_DATES[selectedCalDate].type === 'eco' ? '🌱 ' : '💡 '}
                                                        {CALENDAR_DATES[selectedCalDate].title}
                                                    </h4>
                                                    <p className="text-small text-muted mt-2">{CALENDAR_DATES[selectedCalDate].content}</p>
                                                </>
                                            ) : (
                                                <>
                                                    <h4 className="font-bold text-lg text-primary mt-1">🌿 Planificación Floral Semanal</h4>
                                                    <p className="text-small text-muted mt-2">
                                                        Día idóneo para postear historias mostrando la llegada de tallos frescos o consejos rápidos de diseño para el hogar.
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        <button 
                                            className="btn btn-secondary btn-sm flex items-center gap-1 self-end md:self-center"
                                            onClick={() => handleCopyToClipboard(CALENDAR_DATES[selectedCalDate]?.content || 'Idea de planificación floral.', 'cal-tip')}
                                        >
                                            {copiedTextType === 'cal-tip' ? <Check size={14} /> : <Copy size={14} />}
                                            <span>Copiar Idea</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 6: INSPIRACIÓN CRUZADA */}
                    {activeTab === 'cross-inspiration' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>🌎 Inspiración Cruzada: Ideas de otros Rubros comerciales</h2>
                                <p>Aprendé de los sectores de marketing digital más avanzados y traducí exactamente sus conceptos estéticos a tu florería.</p>
                            </div>

                            <div className="cross-inspiration-grid">
                                {/* Rubro 1: Café */}
                                <div className="cross-niche-card glass-panel p-5">
                                    <div className="niche-header flex justify-between items-center mb-3">
                                        <span className="niche-badge cafe">☕ CAFETERÍA DE ESPECIALIDAD</span>
                                        <button 
                                            className="btn-explore-niche"
                                            onClick={() => handleExploreCrossInspiration('cafe')}
                                        >
                                            Explorar Traducción
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-primary">El Lazo de Seda como Latte Art</h3>
                                    <p className="text-small text-muted mt-2">
                                        En el café se graba en cámara súper lenta el vertido de leche espumosa sobre el café.
                                    </p>
                                    <div className="translation-box p-3 bg-surface rounded-lg border mt-3 text-small">
                                        <strong>Traducción a Florería:</strong> Grabá un plano de detalle extremo de tus manos amarrando con un lazo de seda fluida un ramo especial. La caída libre de la cinta simula visualmente la cremosidad de la leche y eleva la estética.
                                    </div>
                                </div>

                                {/* Rubro 2: Cosmética */}
                                <div className="cross-niche-card glass-panel p-5">
                                    <div className="niche-header flex justify-between items-center mb-3">
                                        <span className="niche-badge cosmetics">🌿 COSMÉTICA ORGÁNICA</span>
                                        <button 
                                            className="btn-explore-niche"
                                            onClick={() => handleExploreCrossInspiration('cosmetica')}
                                        >
                                            Explorar Traducción
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-primary">El Rocío Tacto en Pétalo</h3>
                                    <p className="text-small text-muted mt-2">
                                        En cosmética se graba la hidratación extrema y las texturas acuosas fluidas en la piel.
                                    </p>
                                    <div className="translation-box p-3 bg-surface rounded-lg border mt-3 text-small">
                                        <strong>Traducción a Florería:</strong> Usá un atomizador de cobre dorado para rociar agua fina sobre un ramo de rosas importadas a contraluz. Mapeá con el micrófono del celular el sonido de lluvia fina (ASMR).
                                    </div>
                                </div>

                                {/* Rubro 3: Interiores */}
                                <div className="cross-niche-card glass-panel p-5">
                                    <div className="niche-header flex justify-between items-center mb-3">
                                        <span className="niche-badge interior">🏡 DISEÑO DE INTERIORES</span>
                                        <button 
                                            className="btn-explore-niche"
                                            onClick={() => handleExploreCrossInspiration('interiores')}
                                        >
                                            Explorar Traducción
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-primary">Simetría Zen / Ikebana</h3>
                                    <p className="text-small text-muted mt-2">
                                        Se resalta el balance simétrico, el espacio vacío y la colocación en jarrones minimalistas.
                                    </p>
                                    <div className="translation-box p-3 bg-surface rounded-lg border mt-3 text-small">
                                        <strong>Traducción a Florería:</strong> Hacé un tutorial de cómo armar un arreglo floral con la técnica japonesa Ikebana usando asters y ramas secas dobladas. Enfocá tu fondo en una pared lisa de tonos arena para lograr estilo Pinterest.
                                    </div>
                                </div>

                                {/* Rubro 4: Moda */}
                                <div className="cross-niche-card glass-panel p-5">
                                    <div className="niche-header flex justify-between items-center mb-3">
                                        <span className="niche-badge fashion">👗 BOUTIQUE DE MODA</span>
                                        <button 
                                            className="btn-explore-niche"
                                            onClick={() => handleExploreCrossInspiration('moda')}
                                        >
                                            Explorar Traducción
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-primary">Lookbook de Ramos de Estación</h3>
                                    <p className="text-small text-muted mt-2">
                                        Las tiendas de ropa hacen videos rápidos cambiando de outfit para el cambio de temporada.
                                    </p>
                                    <div className="translation-box p-3 bg-surface rounded-lg border mt-3 text-small">
                                        <strong>Traducción a Florería:</strong> Armá un lookbook donde salgas con abrigos invernales de lana sosteniendo diferentes ramos rústicos de otoño que combinen con la ropa. Asocia las flores a un accesorio indispensable.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 7: MI JARDÍN DIGITAL & MEDALLAS */}
                    {activeTab === 'garden' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="pane-header">
                                <h2>🌱 Mi Jardín Digital & Historial Creativo</h2>
                                <p>Cuidar tu marketing es como cuidar tu flor favorita: la constancia hace florecer tu ERP. Mirá tu progreso, XP y logros.</p>
                            </div>

                            <div className="garden-status-grid">
                                <div className="garden-rules-card glass-panel p-4 text-center">
                                    <span className="material-symbols-rounded trophy-icon">military_tech</span>
                                    <h3>Reglas del Cultivo Digital</h3>
                                    <p className="text-small mt-2">
                                        Cada sugerencia completada en **"Qué hacer hoy"** te otorga **+15 XP**. Al llegar a 100 XP, subes de nivel creativo y tu flor cambia de color y florece. ¡Los logros desbloqueados te premian con **+20 XP** adicionales!
                                    </p>
                                </div>

                                {/* 🏆 SISTEMA DE MEDALLAS / LOGROS */}
                                <div className="achievements-section-card glass-panel p-6">
                                    <h3 className="flex items-center gap-2 mb-4">
                                        <Award size={20} className="text-accent" />
                                        <span>Tus Medallas y Logros Creativos</span>
                                    </h3>
                                    <div className="achievements-grid">
                                        {ACHIEVEMENTS.map((ach) => {
                                            const isUnlocked = unlockedAchievements.includes(ach.id);
                                            return (
                                                <div 
                                                    key={ach.id} 
                                                    className={`achievement-badge-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                                                    title={ach.desc}
                                                >
                                                    <div className="badge-icon-wrap">
                                                        <span className="badge-emoji">{ach.icon}</span>
                                                        {!isUnlocked && <span className="lock-icon">🔒</span>}
                                                    </div>
                                                    <h4>{ach.title}</h4>
                                                    <p className="text-micro text-center text-muted mt-1">{ach.desc}</p>
                                                    {isUnlocked ? (
                                                        <span className="badge-status-unlocked text-micro text-success">¡Desbloqueado!</span>
                                                    ) : (
                                                        <span className="badge-status-locked text-micro text-muted">Bloqueado</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
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

                {/* COLUMNA DERECHA: El Corazón Creativo y Gamificado (JARDÍN DIGITAL SIDEBAR) */}
                <div className="marketing-dashboard-sidebar">
                    {/* Widget del Estado del Jardín Digital */}
                    <div className="card garden-level-widget glass-panel text-center">
                        <div className="widget-header mb-4">
                            <span className="badge badge-accent flex items-center gap-1 mx-auto">
                                <Award size={16} />
                                <span>NIVEL CREATIVO {level}</span>
                            </span>
                        </div>

                        {/* Dibujo de la Flor Interactiva con Sway Effect en CSS */}
                        <div className="flower-interactive-avatar" onClick={() => triggerUnlock('garden_lvl3')}>
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
                                {/* La flor en la cima cambiando de color según el nivel */}
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

            {/* Notificación de Éxito de Tareas completadas o Logros */}
            {copiedTextType === 'success-complete' && (
                <div className="floriai-toast-notification animate-slide-in">
                    <span className="material-symbols-rounded icon">celebration</span>
                    <div className="toast-content">
                        <strong>¡Tarea Completada!</strong>
                        <p>Ganaste **+15 XP**. Tu jardín digital te lo agradece. 🌱✨</p>
                    </div>
                </div>
            )}

            {copiedTextType && copiedTextType.startsWith('achievement-') && (
                <div className="floriai-toast-notification achievement animate-slide-in">
                    <span className="material-symbols-rounded icon">military_tech</span>
                    <div className="toast-content">
                        <strong>🏆 ¡MEDALLA DESBLOQUEADA!</strong>
                        <p>
                            Desbloqueaste el logro **{ACHIEVEMENTS.find(a => a.id === copiedTextType.replace('achievement-', ''))?.title}**. 
                            Ganás **+20 XP**. ¡Excelente hábito! 🏅🌿
                        </p>
                    </div>
                </div>
            )}

            {copiedTextType === 'fav-saved' && (
                <div className="floriai-toast-notification fav-toast animate-slide-in">
                    <span className="material-symbols-rounded icon">favorite</span>
                    <div className="toast-content">
                        <strong>¡Idea Guardada!</strong>
                        <p>Se guardó en tu bandeja de Favoritos con éxito. 💖</p>
                    </div>
                </div>
            )}

            {copiedTextType === 'fav-removed' && (
                <div className="floriai-toast-notification fav-toast animate-slide-in">
                    <span className="material-symbols-rounded icon">heart_broken</span>
                    <div className="toast-content">
                        <strong>Idea Eliminada</strong>
                        <p>Se removió de tus guardados correctamente.</p>
                    </div>
                </div>
            )}

            {copiedTextType && copiedTextType.startsWith('cross-') && (
                <div className="floriai-toast-notification cross-toast animate-slide-in">
                    <span className="material-symbols-rounded icon">psychology</span>
                    <div className="toast-content">
                        <strong>Traducción Explorada</strong>
                        <p>¡Inspiración agregada a tu mente creativa! +20 XP. 🧠💡</p>
                    </div>
                </div>
            )}
        </div>
    );
};
