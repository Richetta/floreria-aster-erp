import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Package, Users, FileText, MoreHorizontal, Home, TrendingUp, Settings } from 'lucide-react';
import './BottomNav.css';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showMore, setShowMore] = useState(false);

    const mainItems = [
        { icon: ShoppingCart, label: 'Vender', path: '/pos' },
        { icon: Package, label: 'Productos', path: '/productos' },
        { icon: Home, label: 'Inicio', path: '/dashboard' },
        { icon: FileText, label: 'Ventas', path: '/ventas' },
        { icon: Users, label: 'Clientes', path: '/clientes' },
    ];

    const moreItems = [
        { icon: TrendingUp, label: 'Reportes', path: '/reportes' },
        { icon: Settings, label: 'Config', path: '/configuracion' },
    ];

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const handleNav = (path: string) => {
        navigate(path);
        setShowMore(false);
    };

    return (
        <>
            <nav className="bottom-nav">
                {mainItems.map((item) => (
                    <button
                        key={item.path}
                        className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
                        onClick={() => handleNav(item.path)}
                    >
                        <item.icon size={20} strokeWidth={2.5} />
                        <span>{item.label}</span>
                    </button>
                ))}
                
                <button
                    className={`bottom-nav-item more-toggle ${showMore ? 'active' : ''}`}
                    onClick={() => setShowMore(!showMore)}
                >
                    <MoreHorizontal size={20} strokeWidth={2.5} />
                    <span>Más</span>
                </button>
            </nav>

            {showMore && (
                <div className="bottom-nav-more-overlay" onClick={() => setShowMore(false)}>
                    <div className="bottom-nav-more-panel" onClick={e => e.stopPropagation()}>
                        {moreItems.map((item) => (
                            <button
                                key={item.path}
                                className={`bottom-nav-more-item ${isActive(item.path) ? 'active' : ''}`}
                                onClick={() => handleNav(item.path)}
                            >
                                <item.icon size={20} strokeWidth={2.5} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};
