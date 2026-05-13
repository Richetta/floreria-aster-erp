import { useState, useEffect, useRef } from 'react';
import { Check, X, Star, Leaf } from 'lucide-react';
import './PricingSection.css';

// ============================================
// FADE-IN HOOK
// ============================================

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ============================================
// PLANS DATA
// ============================================

const plans = [
  {
    slug: 'semilla',
    name: 'Gratis',
    tagline: 'Gestión básica para emprendedores',
    icon: <Leaf size={28} />,
    priceMonthly: 0,
    priceAnnually: 0,
    badge: null,
    highlighted: false,
    limits: [
      { label: 'Usuario', value: '1' },
      { label: 'Productos', value: '50' },
      { label: 'Pedidos/mes', value: '30' },
      { label: 'Categorías', value: '1' },
    ],
    features: [
      'Punto de venta (POS)',
      'Dashboard básico',
      'Historial de ventas (30 días)',
      'Kanban de pedidos',
    ],
    missing: [
      'Sin reportes avanzados',
      'Sin caja diaria',
      'Sin código de barras',
      'Sin gestión de mermas',
    ],
    cta: 'Empezar Gratis',
    ctaVariant: 'outline' as const,
  },
  {
    slug: 'florecer',
    name: 'Profesional Completo',
    tagline: 'Control total de tu negocio y equipo',
    icon: <Star size={28} />,
    priceMonthly: 45000,
    priceAnnually: 450000,
    badge: '👑 RECOMENDADO',
    highlighted: true,
    limits: [
      { label: 'Usuarios', value: '5' },
      { label: 'Productos', value: '500' },
      { label: 'Pedidos', value: '200/mes' },
      { label: 'Categorías', value: '10' },
    ],
    features: [
      'TODO del plan Gratis',
      'Reportes avanzados y exportación',
      'Caja diaria y arqueos',
      'Gestión de mermas y auditoría',
      'Código de barras y etiquetas',
      'Vista calendario y logística',
      'Importación CSV de productos',
      'Soporte por email prioritario',
    ],
    missing: [],
    cta: 'Probar 15 Días Gratis',
    ctaVariant: 'primary' as const,
  },
];

// ============================================
// FORMAT CURRENCY
// ============================================

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

// ============================================
// PRICING CARD COMPONENT
// ============================================

interface PricingCardProps {
  plan: typeof plans[0];
  isAnnual: boolean;
  onSelect: (slug: string) => void;
}

const PricingCard = ({ plan, isAnnual, onSelect }: PricingCardProps) => {
  const price = isAnnual ? plan.priceAnnually : plan.priceMonthly;
  const monthlyEquivalent = isAnnual ? Math.round(plan.priceAnnually / 12) : plan.priceMonthly;
  const savings = isAnnual ? (plan.priceMonthly * 12) - plan.priceAnnually : 0;

  return (
    <div className={`pricing-card ${plan.highlighted ? 'pricing-card--highlighted' : ''}`}>
      {plan.badge && (
        <div className="pricing-card__badge">{plan.badge}</div>
      )}

      {/* Header */}
      <div className="pricing-card__header">
        <div className="pricing-card__icon">{plan.icon}</div>
        <h3 className="pricing-card__name">{plan.name}</h3>
        <p className="pricing-card__tagline">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="pricing-card__price">
        {price === 0 ? (
          <div className="pricing-card__price-free">
            <span className="pricing-card__amount">GRATIS</span>
            <span className="pricing-card__period">Para siempre</span>
          </div>
        ) : (
          <>
            <div className="pricing-card__amount">
              {isAnnual ? formatPrice(monthlyEquivalent) : formatPrice(price)}
              <span className="pricing-card__period-text">/mes</span>
            </div>
            {isAnnual && (
              <div className="pricing-card__annual-info">
                <span className="pricing-card__annual-total">
                  {formatPrice(plan.priceAnnually)}/año
                </span>
                <span className="pricing-card__annual-clarification">
                  (Un solo pago anual)
                </span>
                <span className="pricing-card__savings">
                  ¡Ahorrás {formatPrice(savings)}!
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Limits */}
      <div className="pricing-card__limits">
        {plan.limits.map((limit, i) => (
          <div key={i} className="pricing-card__limit">
            <span className="pricing-card__limit-value">{limit.value}</span>
            <span className="pricing-card__limit-label">{limit.label}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="pricing-card__divider" />

      {/* Features */}
      <div className="pricing-card__features">
        {plan.features.map((feature, i) => (
          <div key={i} className="pricing-card__feature pricing-card__feature--included">
            <Check size={16} />
            <span>{feature}</span>
          </div>
        ))}
        {plan.missing.map((feature, i) => (
          <div key={i} className="pricing-card__feature pricing-card__feature--missing">
            <X size={16} />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        className={`pricing-card__btn pricing-card__btn--${plan.ctaVariant}`}
        onClick={() => onSelect(plan.slug)}
      >
        {plan.cta}
      </button>
    </div>
  );
};

// ============================================
// FAQ DATA
// ============================================

const faqs = [
  {
    question: '¿Puedo cambiar de plan cuando quiera?',
    answer: 'Sí, podés hacer upgrade o downgrade en cualquier momento. El cambio se aplica inmediatamente.',
  },
  {
    question: '¿Qué pasa si supero el límite de mi plan?',
    answer: 'Te avisamos cuando estés cerca del límite (80%). Si lo alcanzás, podés esperar al próximo mes o hacer upgrade del plan.',
  },
  {
    question: '¿Hay período de prueba?',
    answer: 'Sí, el plan Profesional incluye 15 días de prueba gratis. Para activarla necesitás vincular una tarjeta vía MercadoPago — no se cobra nada durante los primeros 15 días. Podés cancelar en cualquier momento antes de que venza el período.',
  },
  {
    question: '¿Cómo puedo pagar?',
    answer: 'Procesamos los pagos via MercadoPago. Aceptamos tarjetas de crédito y débito, transferencia bancaria y el saldo de tu cuenta de MercadoPago.',
  },
  {
    question: '¿Puedo cancelar mi suscripción?',
    answer: 'Sí, cuando quieras, sin penalties ni preguntas incómodas. Si cancelás, mantenés el acceso hasta el final del período pagado.',
  },
  {
    question: '¿El débito es automático?',
    answer: 'Sí, el plan se renueva automáticamente cada mes (o año si elegís pago anual). Podés desactivar el débito automático desde Configuración > Suscripción en cualquier momento.',
  },
];

// ============================================
// FAQ COMPONENT
// ============================================

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`faq-item ${open ? 'faq-item--open' : ''}`}>
      <button className="faq-item__question" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className="faq-item__toggle">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="faq-item__answer">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN PRICING SECTION
// ============================================

interface PricingSectionProps {
  onPlanSelect?: (slug: string) => void;
}

export const PricingSection = ({ onPlanSelect }: PricingSectionProps) => {
  const [isAnnual, setIsAnnual] = useState(true);
  const sectionRef = useFadeIn();

  const [_isCheckingOut, setIsCheckingOut] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const handlePlanSelect = async (slug: string) => {
    if (slug === 'semilla' || slug === 'gratis') {
      // Free plan — go to login/register
      window.location.href = '/login?plan=gratis';
      return;
    }

    // Paid plan — check if user is logged in
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Not logged in — redirect to login with plan intent
      window.location.href = `/login?plan=${slug}&billing=${isAnnual ? 'annually' : 'monthly'}`;
      return;
    }

    // Logged in — initiate MP checkout
    setIsCheckingOut(true);
    try {
      const res = await fetch(`${API_URL}/subscription/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_slug: slug,
          billing_cycle: isAnnual ? 'annually' : 'monthly',
          include_trial: !isAnnual
        })
      });
      const data = await res.json();

      if (data.error === 'payment_not_configured') {
        // MP not configured yet — redirect to dashboard
        window.location.href = '/';
        return;
      }

      if (data.success && data.data?.init_point) {
        window.location.href = data.data.init_point;
      } else {
        alert('No se pudo iniciar el pago. Intentá de nuevo.');
      }
    } catch (e) {
      alert('Error de conexión. Intentá de nuevo.');
    } finally {
      setIsCheckingOut(false);
    }
    if (onPlanSelect) onPlanSelect(slug);
  };

  return (
    <section className="lp-section lp-pricing-section" id="pricing" ref={sectionRef}>
      <div className="lp-container">
        {/* Header */}
        <div className="lp-section__header fade-up">
          <p className="lp-section__eyebrow lp-section__eyebrow--accent">Planes y Precios</p>
          <h2 className="lp-section__title">Elegí el plan perfecto para tu florería</h2>
          <p className="lp-section__subtitle">
            Empezá gratis y escalá cuando tu negocio crezca
          </p>
        </div>

        {/* Toggle */}
        <div className="pricing-toggle fade-up">
          <button
            className={`pricing-toggle__btn ${!isAnnual ? 'pricing-toggle__btn--active' : ''}`}
            onClick={() => setIsAnnual(false)}
          >
            Mensual
          </button>
          <button
            className={`pricing-toggle__btn ${isAnnual ? 'pricing-toggle__btn--active' : ''}`}
            onClick={() => setIsAnnual(true)}
          >
            Anual
            <span className="pricing-toggle__badge">Ahorrá 2 meses</span>
          </button>
        </div>

        {/* Plans Grid */}
        <div className="pricing-grid fade-up">
          {plans.map((plan) => (
            <PricingCard
              key={plan.slug}
              plan={plan}
              isAnnual={isAnnual}
              onSelect={handlePlanSelect}
            />
          ))}
        </div>

        {/* Social Proof */}
        <div className="pricing-social fade-up">
          <div className="pricing-social__content">
            <Star size={20} className="pricing-social__star" />
            <span className="pricing-social__text">
              <strong>+150 florerías</strong> ya usan Mi Jardín ERP · ⭐⭐⭐⭐⭐ 4.8/5 basado en 120 reseñas
            </span>
          </div>
          <blockquote className="pricing-social__quote">
            "Con el plan Profesional recuperé la inversión en la primera semana. Los reportes me ayudaron a subir mis márgenes un 30%."
            <cite>— María, Florería Rosalinda, Buenos Aires</cite>
          </blockquote>
        </div>

        {/* FAQ */}
        <div className="pricing-faq fade-up">
          <h3 className="pricing-faq__title">Preguntas Frecuentes</h3>
          <div className="pricing-faq__list">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
