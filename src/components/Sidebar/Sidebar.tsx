import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Settings,
  LogOut,
  Package,
  BarChart3,
  Vault,
  Activity,
  Store,
  ShoppingBag,
  Trash2,
  Map,
  Bell,
  Layers
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import './Sidebar.css';

// Navegación organizada y con sentido para Alejandra
const navGroups = [
  {
    id: 'principal',
    title: 'VENTAS Y CLIENTES',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Inicio', desc: 'Resumen del día' },
      { path: '/pos', icon: ShoppingCart, label: 'Vender', desc: 'Nueva venta rápida' },
      { path: '/pedidos', icon: Truck, label: 'Pedidos', desc: 'Entregas y envíos' },
      { path: '/clientes', icon: Users, label: 'Clientes', desc: 'Base de datos de clientes' },
    ]
  },
  {
    id: 'inventario',
    title: 'PRODUCTOS Y STOCK',
    items: [
      { path: '/productos', icon: Package, label: 'Productos', desc: 'Gestión de productos y precios' },
      { path: '/paquetes', icon: Layers, label: 'Ramos', desc: 'Gestión de ramos y artículos compuestos' },
      { path: '/stock', icon: Activity, label: 'Movimientos', desc: 'Historial de stock' },
      { path: '/mermas', icon: Trash2, label: 'Mermas', desc: 'Registro de desperdicios' },
    ]
  },
  {
    id: 'suministros',
    title: 'COMPRAS Y SUMINISTROS',
    items: [
      { path: '/proveedores', icon: Store, label: 'Proveedores', desc: 'Gestión de proveedores' },
      { path: '/compras', icon: ShoppingBag, label: 'Compras', desc: 'Registro de facturas y compras' },
    ]
  },
  {
    id: 'gestion',
    title: 'OPERACIONES',
    items: [
      { path: '/logistica', icon: Map, label: 'Logística', desc: 'Planificación de rutas' },
      { path: '/recordatorios', icon: Bell, label: 'Recordatorios', desc: 'Alertas y avisos' },
    ]
  },
  {
    id: 'administracion',
    title: 'ADMINISTRACIÓN',
    items: [
      { path: '/finanzas', icon: Wallet, label: 'Finanzas', desc: 'Control de ingresos y egresos' },
      { path: '/caja', icon: Vault, label: 'Caja', desc: 'Apertura y cierre de caja diaria' },
      { path: '/reportes', icon: BarChart3, label: 'Reportes', desc: 'Estadísticas e informes gerenciales' },
      { path: '/configuracion', icon: Settings, label: 'Ajustes', desc: 'Configuración técnica' },
    ]
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión?')) {
      logout();
      navigate('/login');
    }
  };

  return (
    <aside className="sidebar hidden-mobile">
      <div className="sidebar-brand">
        <span className="brand-icon">✿</span>
        <h1 className="brand-text">Aster</h1>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => {
          const isActiveGroup = group.items.some(item =>
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          );

          return (
            <div key={group.id} className={`nav-group ${isActiveGroup ? 'group-active' : ''}`}>
              <h3 className="nav-group-title">{group.title}</h3>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                  title={item.desc}
                >
                  <item.icon className="sidebar-icon" size={18} />
                  <span className="sidebar-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Usuario'}</span>
            <span className="user-role">
              {user?.role === 'admin' ? 'Administrador' :
                user?.role === 'seller' ? 'Vendedor' :
                  user?.role === 'driver' ? 'Repartidor' : 'Visualizador'}
            </span>
          </div>
          <button className="btn-icon-logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
