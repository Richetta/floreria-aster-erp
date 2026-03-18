import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { Lock, Mail, Flower2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import './Login.css';

// ============================================
// LOGIN FORM COMPONENT
// ============================================

const LoginForm = () => {
    const navigate = useNavigate();
    const { login, error, clearError, isLoading } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

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

            // Send credential to backend
            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credential: credentialResponse.credential
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en autenticación con Google');
            }

            // Store token and user
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Update auth store directly
                useAuth.setState({
                    user: data.user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null
                });

                // Log Google login activity
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
        <div className="login-card">
            {/* Header */}
            <div className="login-header">
                <div className="login-logo">
                    <Flower2 size={64} className="logo-icon" />
                </div>
                <h1 className="login-title">Florería Aster</h1>
                <p className="login-subtitle">Sistema de Gestión ERP</p>
            </div>

            {/* Error Message */}
            {displayError && (
                <div className="login-error">
                    <AlertCircle size={20} />
                    <span>{displayError}</span>
                </div>
            )}

            {/* Google Sign-In Button */}
            <div className="google-login-container mb-6">
                <div className="google-login-wrapper">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        useOneTap
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
                            autoFocus
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

                <button
                    type="submit"
                    className="login-button"
                    disabled={isLoading}
                >
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
// MAIN LOGIN PAGE COMPONENT
// ============================================

export const Login = () => {
    return (
        <div className="login-page">
            <div className="login-background">
                <div className="floating-flower" style={{ top: '10%', left: '10%' }}>🌸</div>
                <div className="floating-flower" style={{ top: '20%', right: '15%' }}>🌹</div>
                <div className="floating-flower" style={{ bottom: '15%', left: '20%' }}>🌺</div>
                <div className="floating-flower" style={{ bottom: '25%', right: '10%' }}>🌻</div>
                <div className="floating-flower" style={{ top: '50%', left: '5%' }}>🌷</div>
                <div className="floating-flower" style={{ top: '70%', right: '20%' }}>💐</div>
            </div>

            <div className="login-container">
                <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                    <LoginForm />
                </GoogleOAuthProvider>
            </div>
        </div>
    );
};
