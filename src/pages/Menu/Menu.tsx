import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    Truck,
    Package,
    Layers,
    Users,
    Store,
    Wallet,
    Settings,
    Trash2,
    Navigation,
    ChevronRight
} from 'lucide-react';
import './Menu.css';

const menuGroups = [
    {
        title: 'Operaciones',
        items: [
            { path: '/', icon: LayoutDashboard, label: 'Dashboard', desc: 'Resumen del día' },
            { path: '/pos', icon: ShoppingCart, label: 'Venta Rápida', desc: 'Nueva venta' },
            { path: '/pedidos', icon: Truck, label: 'Pedidos', desc: 'Gestión de entregas' },
            { path: '/logistica', icon: Navigation, label: 'Logística', desc: 'Rutas de reparto' },
        ]
    },
    {
        title: 'Inventario',
        items: [
            { path: '/productos', icon: Package, label: 'Stock', desc: 'Control de inventario' },
            { path: '/paquetes', icon: Layers, label: 'Paquetes', desc: 'Combos y ramos' },
            { path: '/mermas', icon: Trash2, label: 'Mermas', desc: 'Pérdidas y desperdicio' },
        ]
    },
    {
        title: 'Contactos',
        items: [
            { path: '/clientes', icon: Users, label: 'Clientes', desc: 'Base de datos CRM' },
            { path: '/proveedores', icon: Store, label: 'Proveedores', desc: 'Agenda de compras' },
        ]
    },
    {
        title: 'Administración',
        items: [
            { path: '/finanzas', icon: Wallet, label: 'Finanzas', desc: 'Libro mayor y caja' },
            { path: '/configuracion', icon: Settings, label: 'Ajustes', desc: 'Configuración general' },
        ]
    },
];

export const Menu = () => {
    const navigate = useNavigate();

    return (
        <div className="menu-page p-6 pb-24">
            <header className="menu-header mb-8">
                <h1 className="text-h1">Menú General</h1>
                <p className="text-body text-muted">Todos los módulos del sistema agrupados.</p>
            </header>

            <div className="menu-groups-container">
                {menuGroups.map((group) => (
                    <div key={group.title} className="menu-section mb-8">
                        <h2 className="text-h3 mb-4 text-primary">{group.title}</h2>
                        <div className="menu-grid">
                            {group.items.map((item) => (
                                <button
                                    key={item.path}
                                    className="menu-item-card card"
                                    onClick={() => navigate(item.path)}
                                >
                                    <div className="menu-item-icon-wrapper">
                                        <item.icon size={24} />
                                    </div>
                                    <div className="menu-item-info">
                                        <div className="flex justify-between items-center w-full">
                                            <span className="font-bold">{item.label}</span>
                                            <ChevronRight size={16} className="text-muted" />
                                        </div>
                                        <p className="text-micro text-muted">{item.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="menu-footer text-center mt-4">
                <p className="text-micro text-muted">Aster ERP v1.0.0</p>
            </div>
        </div>
    );
};
