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
            {/* 1. INICIO - Dashboard principal */}
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

            {/* 2. PEDIDOS - Gestión de entregas */}
            <button
                className={`nav-btn ${isActive('/pedidos') ? 'active' : ''}`}
                onClick={() => handleNav('/pedidos')}
                aria-label="Pedidos"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">receipt_long</span>
                </div>
                <span className="nav-label">Pedidos</span>
            </button>

            {/* 3. VENDER - Acción principal (CENTRAL) */}
            <button
                className={`nav-btn btn-center ${isActive('/pos') ? 'active' : ''}`}
                onClick={() => handleNav('/pos')}
                aria-label="Nueva Venta"
            >
                <div className="icon-center-wrapper">
                    <span className="material-symbols-rounded">shopping_cart</span>
                </div>
                <span className="nav-label">Vender</span>
            </button>

            {/* 4. PRODUCTOS - Catálogo e inventario */}
            <button
                className={`nav-btn ${isActive('/productos') ? 'active' : ''}`}
                onClick={() => handleNav('/productos')}
                aria-label="Productos"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">inventory</span>
                </div>
                <span className="nav-label">Productos</span>
            </button>

            {/* 5. MÁS - Menú completo */}
            <button
                className={`nav-btn ${isActive('/menu') || isActive('/configuracion') ? 'active' : ''}`}
                onClick={() => handleNav('/menu')}
                aria-label="Más opciones"
            >
                <div className="icon-container">
                    <span className="material-symbols-rounded">grid_view</span>
                </div>
                <span className="nav-label">Más</span>
            </button>
        </nav>
    );
};
