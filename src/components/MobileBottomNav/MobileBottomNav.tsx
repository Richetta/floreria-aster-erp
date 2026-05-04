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
            return location.pathname === '/' || location.pathname === '/dashboard';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className={`mobile-bottom-nav ${className}`}>
            {/* 1. INICIO */}
            <button
                className={`nav-btn ${isActive('/dashboard') ? 'active' : ''}`}
                onClick={() => navigate('/dashboard')}
            >
                <span className="material-symbols-rounded">home</span>
                <span className="nav-label">Inicio</span>
            </button>

            {/* 2. PEDIDOS */}
            <button
                className={`nav-btn ${isActive('/pedidos') ? 'active' : ''}`}
                onClick={() => navigate('/pedidos')}
            >
                <span className="material-symbols-rounded">receipt_long</span>
                <span className="nav-label">Pedidos</span>
            </button>

            {/* 3. VENDER (Central) */}
            <button
                className={`nav-btn btn-center ${isActive('/pos') ? 'active' : ''}`}
                onClick={() => navigate('/pos')}
            >
                <div className="icon-center-wrapper">
                    <span className="material-symbols-rounded">point_of_sale</span>
                </div>
                <span className="nav-label">Vender</span>
            </button>

            {/* 4. STOCK */}
            <button
                className={`nav-btn ${isActive('/productos') ? 'active' : ''}`}
                onClick={() => navigate('/productos')}
            >
                <span className="material-symbols-rounded">inventory_2</span>
                <span className="nav-label">Stock</span>
            </button>

            {/* 5. MÁS */}
            <button
                className={`nav-btn ${isActive('/menu') || isActive('/configuracion') ? 'active' : ''}`}
                onClick={() => navigate('/menu')}
            >
                <span className="material-symbols-rounded">grid_view</span>
                <span className="nav-label">Más</span>
            </button>
        </nav>
    );
};
