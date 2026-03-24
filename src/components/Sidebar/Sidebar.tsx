import { useState } from 'react';
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
  Layers,
  FileText,
  X,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import './Sidebar.css';

type NavLink = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  highlight?: boolean;
};

type NavGroup = {
  id: string;
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  children: { path: string; label: string; icon?: typeof LayoutDashboard }[];
};

type NavItem = NavLink | NavGroup;

// Navegación reorganizada: 8 items primarios con submenús
const navItems: NavItem[] = [
  // ── PRINCIPAL (siempre visible, sin grupo) ──
  { path: '/', icon: LayoutDashboard, label: 'Inicio', desc: 'Resumen del día' },
  { path: '/pos', icon: ShoppingCart, label: 'Vender', desc: 'Nueva venta rápida', highlight: true },
  { path: '/pedidos', icon: Truck, label: 'Pedidos', desc: 'Entregas y envíos' },
  { path: '/clientes', icon: Users, label: 'Clientes', desc: 'Base de datos' },

  // ── GESTIÓN (con submenús colapsables) ──
  {
    id: 'productos',
    icon: Package,
    label: 'Productos',
    desc: 'Inventario y stock',
    children: [
      { path: '/productos', label: 'Catálogo' },
      { path: '/paquetes', label: 'Ramos', icon: Layers },
      { path: '/stock', label: 'Movimientos', icon: Activity },
      { path: '/mermas', label: 'Mermas', icon: Trash2 },
    ]
  },
  {
    id: 'proveedores',
    icon: Store,
    label: 'Proveedores',
    desc: 'Compras y suministros',
    children: [
      { path: '/proveedores', label: 'Directorio' },
      { path: '/compras', label: 'Compras', icon: ShoppingBag },
    ]
  },
  {
    id: 'finanzas',
    icon: Wallet,
    label: 'Finanzas',
    desc: 'Control económico',
    children: [
      { path: '/finanzas', label: 'Ingresos y Egresos' },
      { path: '/ventas', label: 'Historial Ventas', icon: FileText },
      { path: '/caja', label: 'Caja Diaria', icon: Vault },
      { path: '/reportes', label: 'Reportes', icon: BarChart3 },
    ]
  },
  {
    id: 'ajustes',
    icon: Settings,
    label: 'Ajustes',
    desc: 'Configuración',
    children: [
      { path: '/configuracion', label: 'General' },
      { path: '/logistica', label: 'Logística', icon: Map },
      { path: '/recordatorios', label: 'Recordatorios', icon: Bell },
    ]
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSubmenu = (id: string) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Auto-expand a submenu if one of its children is the active route
  const isChildActive = (children: { path: string }[]) =>
    children.some(child =>
      child.path === '/' ? location.pathname === '/' : location.pathname.startsWith(child.path)
    );

  const isNavGroup = (item: NavItem): item is NavGroup => 'children' in item;

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile close button */}
      <div className="sidebar-mobile-close">
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X size={22} />
        </button>
      </div>

      <div className="sidebar-brand">
        <span className="brand-icon">✿</span>
        <h1 className="brand-text">Aster</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          // Collapsible group (has children)
          if (isNavGroup(item)) {
            const isExpanded = expandedMenus[item.id] || isChildActive(item.children);

            return (
              <div key={item.id} className={`sidebar-group ${isExpanded ? 'sidebar-group-open' : ''}`}>
                <button
                  className={`sidebar-link sidebar-group-toggle ${isChildActive(item.children) ? 'active' : ''}`}
                  onClick={() => toggleSubmenu(item.id)}
                  title={item.desc}
                >
                  <item.icon className="sidebar-icon" size={20} />
                  <span className="sidebar-label">{item.label}</span>
                  <ChevronDown
                    className={`sidebar-chevron ${isExpanded ? 'sidebar-chevron-open' : ''}`}
                    size={16}
                  />
                </button>

                <div className={`sidebar-submenu ${isExpanded ? 'sidebar-submenu-open' : ''}`}>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) =>
                        `sidebar-sublink ${isActive ? 'active' : ''}`
                      }
                      onClick={onClose}
                    >
                      <span className="sidebar-sublabel">{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          }

          // Simple link (no children)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${item.highlight ? 'sidebar-link-highlight' : ''}`
              }
              title={item.desc}
              onClick={onClose}
              end={item.path === '/'}
            >
              <item.icon className="sidebar-icon" size={20} />
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
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
