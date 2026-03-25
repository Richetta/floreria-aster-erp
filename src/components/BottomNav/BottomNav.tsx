import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, Plus, Menu, Package, Users, FileText, TrendingUp, Settings, Truck, Wallet, BookOpen } from 'lucide-react';
import './BottomNav.css';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showMore, setShowMore] = useState(false);

    // 4 items principales - límite de Miller's Law
    const mainItems = [
        { icon: Home, label: 'Inicio', path: '/dashboard' },
        { icon: ShoppingCart, label: 'Vender', path: '/pos' },
        { icon: ClipboardList, label: 'Pedidos', path: '/pedidos' },
    ];

    // Menú Más organizado por categorías
    const moreItems = [
        {
            category: 'Gestión',
            items: [
                { icon: Package, label: 'Productos', path: '/productos' },
                { icon: Users, label: 'Clientes', path: '/clientes' },
                { icon: FileText, label: 'Ventas', path: '/ventas' },
            ]
        },
        {
            category: 'Finanzas',
            items: [
                { icon: Wallet, label: 'Caja', path: '/caja' },
                { icon: TrendingUp, label: 'Reportes', path: '/reportes' },
            ]
        },
        {
            category: 'Operaciones',
            items: [
                { icon: Truck, label: 'Logística', path: '/logistica' },
                { icon: BookOpen, label: 'Inventario', path: '/inventario' },
            ]
        },
        {
            category: 'Sistema',
            items: [
                { icon: Settings, label: 'Configuración', path: '/configuracion' },
            ]
        },
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
                        <div className="nav-icon-wrapper">
                            <item.icon size={22} strokeWidth={2} />
                        </div>
                        <span>{item.label}</span>
                    </button>
                ))}

                {/* Botón central "+" para acción rápida */}
                <button
                    className="bottom-nav-action"
                    onClick={() => navigate('/pos')}
                >
                    <Plus size={28} strokeWidth={2.5} />
                </button>

                <button
                    className={`bottom-nav-item more-toggle ${showMore ? 'active' : ''}`}
                    onClick={() => setShowMore(!showMore)}
                >
                    <div className="nav-icon-wrapper">
                        <Menu size={22} strokeWidth={2} />
                    </div>
                    <span>Más</span>
                </button>
            </nav>

            {showMore && (
                <div className="bottom-nav-more-overlay" onClick={() => setShowMore(false)}>
                    <div className="bottom-nav-more-panel" onClick={e => e.stopPropagation()}>
                        <div className="more-panel-header">
                            <h3>Menú</h3>
                            <button className="close-more" onClick={() => setShowMore(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="more-panel-content">
                            {moreItems.map((group, groupIdx) => (
                                <div key={groupIdx} className="more-group">
                                    <h4 className="more-group-title">{group.category}</h4>
                                    {group.items.map((item) => (
                                        <button
                                            key={item.path}
                                            className={`more-nav-item ${isActive(item.path) ? 'active' : ''}`}
                                            onClick={() => handleNav(item.path)}
                                        >
                                            <item.icon size={20} strokeWidth={2} />
                                            <span>{item.label}</span>
                                            {isActive(item.path) && (
                                                <span className="active-indicator" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
