import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import {
    Lock, Mail, Flower2, AlertCircle, Eye, EyeOff,
    Package, ShoppingCart, TrendingUp, Truck,
    BarChart3, ChevronDown, CheckCircle2, Zap, Clock,
    ClipboardList, AlertTriangle, BarChart2, ArrowRight,
    Star, Play
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { api } from '../../services/api';
import './Login.css';

// ============================================
// LOGIN FORM COMPONENT (unchanged)
// ============================================

const LoginForm = ({ compact = false }: { compact?: boolean }) => {
    const navigate = useNavigate();
    const { login, error, clearError, isLoading } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        clearError();

        if (!formData.email || !formData.password) {
            setLocalError('Por favor completa todos los campos');
            return;
        }

        try {
            await login(formData.email, formData.password);
            navigate('/');
        } catch (err: any) {
            setLocalError(err.message || 'Error al iniciar sesión');
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        try {
            clearError();
            setLocalError(null);

            if (!credentialResponse.credential) {
                setLocalError('No se recibió credencial de Google');
                return;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credentialResponse.credential }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en autenticación con Google');
            }

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                api.setToken(data.token);
                useAuth.setState({
                    user: data.user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null
                });

                try {
                    await fetch(`${import.meta.env.VITE_API_URL}/activity/log`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${data.token}`,
                        },
                        body: JSON.stringify({
                            action: 'login',
                            resource_type: 'session',
                            details: { method: 'google', email: data.user.email },
                        }),
                    });
                } catch (logError) {
                    console.warn('Failed to log Google login activity:', logError);
                }

                navigate('/');
            }
        } catch (err: any) {
            console.error('Google login error:', err);
            setLocalError(err.message || 'Error al iniciar sesión con Google');
        }
    };

    const handleGoogleError = () => {
        setLocalError('Error al iniciar sesión con Google');
    };

    const displayError = localError || error;

    return (
        <div className={`login-card ${compact ? 'login-card--compact' : ''}`}>
            {/* Header */}
            <div className="login-header">
                <div className="login-logo">
                    <Flower2 size={compact ? 40 : 56} className="logo-icon" />
                </div>
                <h2 className="login-title">Florería Aster</h2>
                <p className="login-subtitle">Sistema de Gestión ERP</p>
            </div>

            {/* Error Message */}
            {displayError && (
                <div className="login-error">
                    <AlertCircle size={20} />
                    <span>{displayError}</span>
                </div>
            )}

            {/* Install App Button */}
            {deferredPrompt && (
                <div className="install-pwa-container mb-6">
                    <button type="button" className="install-pwa-button" onClick={handleInstallClick}>
                        <span>⬇️</span> Descargar e Instalar Florería Aster ERP
                    </button>
                </div>
            )}

            {/* Google Sign-In Button */}
            <div className="google-login-container mb-6">
                <div className="google-login-wrapper">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        useOneTap={!compact}
                        text="signin_with"
                        shape="rectangular"
                        size="large"
                        theme="outline"
                    />
                </div>
            </div>

            {/* Divider */}
            <div className="login-divider">
                <span>o continúa con email</span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                    <label className="form-label">
                        <Mail size={18} />
                        Email
                    </label>
                    <div className="input-wrapper">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="admin o email..."
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={isLoading}
                            autoFocus={!compact}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">
                        <Lock size={18} />
                        Contraseña
                    </label>
                    <div className="input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button type="submit" className="login-button" disabled={isLoading}>
                    {isLoading ? (
                        <span className="loading-spinner">Iniciando sesión...</span>
                    ) : (
                        <>
                            <Lock size={20} />
                            Iniciar Sesión
                        </>
                    )}
                </button>
            </form>

            {/* Demo Credentials */}
            <div className="demo-credentials">
                <p className="demo-title">🔑 Acceso rápido de desarrollo:</p>
                <div className="demo-info">
                    <span className="demo-label">Usuario:</span>
                    <code>admin</code>
                </div>
                <div className="demo-info">
                    <span className="demo-label">Password:</span>
                    <code>admin</code>
                </div>
            </div>

            {/* Footer */}
            <div className="login-footer">
                <p className="copyright">© 2026 Florería Aster ERP</p>
            </div>
        </div>
    );
};

// ============================================
// FADE-IN HOOK FOR SCROLL ANIMATIONS
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
// SECTION: PROBLEMS
// ============================================

const problems = [
    {
        icon: <ClipboardList size={32} />,
        title: 'Gestión manual desbordante',
        desc: 'Planillas de Excel, papeles y llamados perdidos que consumen horas de trabajo todos los días.',
    },
    {
        icon: <AlertTriangle size={32} />,
        title: 'Sin control de stock',
        desc: 'No sabés cuántas flores te quedan hasta que llegó un pedido y ya es tarde para reponer.',
    },
    {
        icon: <BarChart2 size={32} />,
        title: 'Cero visibilidad financiera',
        desc: 'Tus ventas del día se mezclan con gastos y no tenés claridad real sobre la rentabilidad.',
    },
];

// ============================================
// SECTION: FEATURES / SOLUTION
// ============================================

const features = [
    { icon: <ShoppingCart size={28} />, title: 'Punto de Venta', desc: 'Vendé rápido con búsqueda de productos, cálculo automático y tickets digitales.' },
    { icon: <Package size={28} />, title: 'Inventario', desc: 'Control de stock en tiempo real con alertas de reposición y movimientos detallados.' },
    { icon: <ClipboardList size={28} />, title: 'Pedidos', desc: 'Creá y seguí pedidos de clientes con fechas de entrega, notas y estados.' },
    { icon: <Truck size={28} />, title: 'Proveedores', desc: 'Registrá compras, comparás precios y gestionás tus proveedores en un solo lugar.' },
    { icon: <TrendingUp size={28} />, title: 'Finanzas', desc: 'Resumen de ingresos, egresos y caja diaria para saber exactamente cómo va tu negocio.' },
    { icon: <BarChart3 size={28} />, title: 'Reportes', desc: 'Gráficos de ventas, productos más vendidos y análisis para tomar mejores decisiones.' },
];

// ============================================
// SECTION: BENEFITS
// ============================================

const benefits = [
    { metric: '3hs', label: 'menos trabajo manual por día', icon: <Clock size={24} /> },
    { metric: '0', label: 'ventas perdidas por falta de stock', icon: <Package size={24} /> },
    { metric: '100%', label: 'visibilidad de tu negocio', icon: <BarChart3 size={24} /> },
    { metric: '1 sola', label: 'herramienta para todo', icon: <Zap size={24} /> },
];

// ============================================
// MAIN LOGIN PAGE COMPONENT
// ============================================

export const Login = () => {
    const [demoPlaying, setDemoPlaying] = useState(false);
    const heroRef = useFadeIn();
    const problemsRef = useFadeIn();
    const solutionRef = useFadeIn();
    const demoRef = useFadeIn();
    const benefitsRef = useFadeIn();
    const ctaRef = useFadeIn();

    const scrollToHero = () => {
        document.getElementById('login-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
        <div className="lp-page">
            {/* ── Navbar ── */}
            <nav className="lp-navbar">
                <div className="lp-navbar__inner">
                    <div className="lp-navbar__brand">
                        <div className="lp-navbar__logo">
                            <Flower2 size={22} />
                        </div>
                        <span className="lp-navbar__name">Florería Aster</span>
                        <span className="lp-navbar__badge">ERP</span>
                    </div>
                    <div className="lp-navbar__actions">
                        <a href="#features" className="lp-navbar__link">Funciones</a>
                        <a href="#benefits" className="lp-navbar__link">Beneficios</a>
                        <button className="lp-navbar__cta" onClick={scrollToHero}>
                            Iniciar Sesión
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section className="lp-hero" id="hero">
                {/* Background particles */}
                <div className="lp-hero__bg">
                    <div className="lp-particle" style={{ top: '12%', left: '8%', animationDelay: '0s' }}>🌸</div>
                    <div className="lp-particle" style={{ top: '25%', right: '12%', animationDelay: '1.5s' }}>🌷</div>
                    <div className="lp-particle" style={{ bottom: '20%', left: '15%', animationDelay: '3s' }}>🌺</div>
                    <div className="lp-particle" style={{ bottom: '35%', right: '8%', animationDelay: '0.8s' }}>🌹</div>
                    <div className="lp-particle" style={{ top: '55%', left: '4%', animationDelay: '2.2s' }}>💐</div>
                    <div className="lp-particle" style={{ top: '70%', right: '22%', animationDelay: '1s' }}>🌼</div>
                </div>

                <div className="lp-hero__inner" ref={heroRef}>
                    {/* Left: Copy */}
                    <div className="lp-hero__copy fade-up">
                        <div className="lp-hero__eyebrow">
                            <Star size={14} /> Software de gestión para florerías
                        </div>
                        <h1 className="lp-hero__headline">
                            Tu florería,<br />
                            <span className="lp-hero__highlight">sin el caos</span>
                        </h1>
                        <p className="lp-hero__subline">
                            Vendé, controlá el stock, manejá pedidos y conocé tu negocio —
                            todo desde una sola herramienta diseñada para florerías.
                        </p>
                        <div className="lp-hero__actions">
                            <button className="lp-btn lp-btn--primary" onClick={scrollToHero}>
                                Ingresar al sistema
                                <ArrowRight size={18} />
                            </button>
                            <a href="#demo" className="lp-btn lp-btn--ghost">
                                <Play size={16} />
                                Ver cómo funciona
                            </a>
                        </div>
                        <div className="lp-hero__trust">
                            <CheckCircle2 size={16} className="lp-hero__trust-icon" />
                            <span>Acceso instantáneo · Sin contratos · Soporte incluido</span>
                        </div>
                    </div>

                    {/* Right: Login Card */}
                    <div className="lp-hero__form fade-up fade-up--delay" id="login-form-anchor">
                        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                            <LoginForm />
                        </GoogleOAuthProvider>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="lp-hero__scroll" onClick={() => document.getElementById('problems')?.scrollIntoView({ behavior: 'smooth' })}>
                    <ChevronDown size={24} />
                </div>
            </section>

            {/* ── PROBLEMS ── */}
            <section className="lp-section lp-section--light" id="problems">
                <div className="lp-container" ref={problemsRef}>
                    <div className="lp-section__header fade-up">
                        <p className="lp-section__eyebrow">¿Te suena familiar?</p>
                        <h2 className="lp-section__title">Problemas que frenan tu crecimiento</h2>
                    </div>
                    <div className="lp-problems__grid fade-up">
                        {problems.map((p, i) => (
                            <div className="lp-problem-card" key={i}>
                                <div className="lp-problem-card__icon">{p.icon}</div>
                                <h3 className="lp-problem-card__title">{p.title}</h3>
                                <p className="lp-problem-card__desc">{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SOLUTION / FEATURES ── */}
            <section className="lp-section lp-section--dark" id="features">
                <div className="lp-container" ref={solutionRef}>
                    <div className="lp-section__header fade-up">
                        <p className="lp-section__eyebrow lp-section__eyebrow--light">La solución</p>
                        <h2 className="lp-section__title lp-section__title--light">Todo lo que necesitás, en un solo lugar</h2>
                        <p className="lp-section__subtitle lp-section__subtitle--light">
                            Florería Aster ERP unifica todas las áreas de tu negocio
                        </p>
                    </div>
                    <div className="lp-features__grid fade-up">
                        {features.map((f, i) => (
                            <div className="lp-feature-card" key={i}>
                                <div className="lp-feature-card__icon">{f.icon}</div>
                                <h3 className="lp-feature-card__title">{f.title}</h3>
                                <p className="lp-feature-card__desc">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── DEMO ── */}
            <section className="lp-section lp-section--gradient" id="demo">
                <div className="lp-container" ref={demoRef}>
                    <div className="lp-section__header fade-up">
                        <p className="lp-section__eyebrow">Vista previa</p>
                        <h2 className="lp-section__title">Así se ve tu negocio en tiempo real</h2>
                        <p className="lp-section__subtitle">
                            Dashboard limpio, información clara, decisiones rápidas
                        </p>
                    </div>
                    <div className="lp-demo__wrapper fade-up">
                        <div className="lp-demo__frame">
                            <div className="lp-demo__bar">
                                <span className="lp-demo__dot lp-demo__dot--red"></span>
                                <span className="lp-demo__dot lp-demo__dot--yellow"></span>
                                <span className="lp-demo__dot lp-demo__dot--green"></span>
                                <span className="lp-demo__url">floreria-aster-erp.vercel.app</span>
                            </div>
                            <div className="lp-demo__screen">
                                {!demoPlaying ? (
                                    <div className="lp-demo__placeholder">
                                        <div className="lp-demo__play-btn" onClick={() => setDemoPlaying(true)}>
                                            <Play size={32} />
                                        </div>
                                        <p>Ver demo del sistema</p>
                                    </div>
                                ) : (
                                    <div className="lp-demo__live">
                                        <div className="lp-demo__sidebar">
                                            <div className="lp-demo__sidebar-logo">🌸</div>
                                            {['Panel', 'Ventas', 'Stock', 'Pedidos', 'Proveedores', 'Finanzas'].map((item, i) => (
                                                <div key={i} className={`lp-demo__sidebar-item ${i === 0 ? 'active' : ''}`}>{item}</div>
                                            ))}
                                        </div>
                                        <div className="lp-demo__content">
                                            <div className="lp-demo__stats">
                                                {[
                                                    { label: 'Ventas hoy', value: '$48,200', change: '+12%' },
                                                    { label: 'Pedidos', value: '14', change: '+3' },
                                                    { label: 'Productos', value: '86', change: 'activos' },
                                                ].map((s, i) => (
                                                    <div key={i} className="lp-demo__stat-card">
                                                        <span className="lp-demo__stat-label">{s.label}</span>
                                                        <span className="lp-demo__stat-value">{s.value}</span>
                                                        <span className="lp-demo__stat-change">{s.change}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="lp-demo__chart-placeholder">
                                                <div className="lp-demo__chart-bars">
                                                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                                        <div key={i} className="lp-demo__bar-item" style={{ height: `${h}%` }}></div>
                                                    ))}
                                                </div>
                                                <p className="lp-demo__chart-label">Ventas últimos 7 días</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── BENEFITS ── */}
            <section className="lp-section lp-section--light" id="benefits">
                <div className="lp-container" ref={benefitsRef}>
                    <div className="lp-section__header fade-up">
                        <p className="lp-section__eyebrow">Resultados reales</p>
                        <h2 className="lp-section__title">Lo que ganás al usar Florería Aster</h2>
                    </div>
                    <div className="lp-benefits__grid fade-up">
                        {benefits.map((b, i) => (
                            <div className="lp-benefit-card" key={i}>
                                <div className="lp-benefit-card__icon">{b.icon}</div>
                                <div className="lp-benefit-card__metric">{b.metric}</div>
                                <p className="lp-benefit-card__label">{b.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA FINAL ── */}
            <section className="lp-section lp-section--cta" id="cta">
                <div className="lp-container lp-container--center" ref={ctaRef}>
                    <div className="lp-cta__header fade-up">
                        <h2 className="lp-cta__title">Empezá hoy mismo</h2>
                        <p className="lp-cta__subtitle">
                            Una cuenta. Todo el sistema. Sin complicaciones.
                        </p>
                        <button className="lp-btn lp-btn--primary lp-cta__scroll-btn" onClick={scrollToHero}>
                            Ir al login
                            <ArrowRight size={18} />
                        </button>
                    </div>
                    <div className="lp-cta__card fade-up fade-up--delay">
                        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                            <LoginForm compact />
                        </GoogleOAuthProvider>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="lp-footer">
                <div className="lp-footer__inner">
                    <div className="lp-footer__brand">
                        <Flower2 size={18} />
                        <span>Florería Aster ERP · © 2026</span>
                    </div>
                    <p className="lp-footer__tagline">Hecho con 💜 para florerías</p>
                </div>
            </footer>
        </div>
    );
};
