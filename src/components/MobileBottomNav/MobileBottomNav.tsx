import { useNavigate, useLocation } from 'react-router-dom';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
    className?: string;
}

export const MobileBottomNav = ({ className = '' }: MobileBottomNavProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/dashboard') {
            // Dashboard es el route index ("/")
            return location.pathname === '/' || location.pathname === '/dashboard';
        }
        return location.pathname.startsWith(path);
    };

    const handleNav = (path: string) => {
        navigate(path);
    };

    return (
        <nav className={`mobile-bottom-nav ${className}`}>
            {/* 1. INICIO */}
            <button
                className={`nav-btn ${isActive('/dashboard') ? 'active' : ''}`}
                onClick={() => handleNav('/dashboard')}
                aria-label="Inicio"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">home</span>
                </div>
                <span className="nav-label">Inicio</span>
            </button>

            {/* 2. VENTAS */}
            <button
                className={`nav-btn ${isActive('/pedidos') ? 'active' : ''}`}
                onClick={() => handleNav('/pedidos')}
                aria-label="Ventas"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">local_mall</span>
                </div>
                <span className="nav-label">Ventas</span>
            </button>

            {/* 3. + (ACCIÓN PRINCIPAL) */}
            <button
                className="nav-btn btn-center"
                onClick={() => handleNav('/pos')}
                aria-label="Nueva Acción"
            >
                <div className="icon-center-wrapper">
                    <span className="material-symbols-rounded">add</span>
                </div>
            </button>

            {/* 4. ALERTAS */}
            <button
                className={`nav-btn ${isActive('/alertas') ? 'active' : ''}`}
                onClick={() => handleNav('/alertas')}
                aria-label="Alertas"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">notifications</span>
                </div>
                <span className="nav-label">Alertas</span>
            </button>

            {/* 5. MÁS */}
            <button
                className={`nav-btn ${isActive('/menu') || isActive('/configuracion') ? 'active' : ''}`}
                onClick={() => handleNav('/menu')}
                aria-label="Más opciones"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">menu</span>
                </div>
                <span className="nav-label">Más</span>
            </button>
        </nav>
    );
};
