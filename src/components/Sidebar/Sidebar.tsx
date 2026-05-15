import { useState, useMemo } from 'react';
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
  ChevronDown,
  Calendar,
  Wrench,
  Lock,
  Star,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { useStore } from '../../store/useStore';
import { useSubscription, type SubscriptionState } from '../../store/useSubscription';
import { usePermissions } from '../../hooks/usePermissions';
import './Sidebar.css';

type NavLinkItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  highlight?: boolean;
  feature?: keyof SubscriptionState['features'];
  permission?: string;
};

type NavGroup = {
  id: string;
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  children: { path: string; label: string; icon?: typeof LayoutDashboard; feature?: keyof SubscriptionState['features']; permission?: string }[];
  permission?: string;
};

type NavItem = NavLinkItem | NavGroup;

// Navegación reorganizada con permisos
const navItems: NavItem[] = [
  { path: '/', icon: LayoutDashboard, label: 'Inicio', desc: 'Resumen del día' },
  { path: '/pos', icon: ShoppingCart, label: 'Vender', desc: 'Nueva venta rápida', highlight: true, permission: 'canManageOrders' },
  {
    id: 'pedidos',
    icon: Truck,
    label: 'Pedidos',
    desc: 'Entregas y envíos',
    permission: 'canViewOrders',
    children: [
      { path: '/pedidos', label: 'Gestión' },
      { path: '/logistica', label: 'Logística', icon: Map, feature: 'logistics', permission: 'canViewLogistics' },
      { path: '/calendario', label: 'Calendario', icon: Calendar, feature: 'calendar' },
    ]
  },
  {
    id: 'clientes',
    icon: Users,
    label: 'Clientes',
    desc: 'Base de datos',
    permission: 'canViewCustomers',
    children: [
      { path: '/clientes', label: 'Directorio' },
      { path: '/recordatorios', label: 'Recordatorios', icon: Bell, feature: 'reminders' },
    ]
  },
  {
    id: 'productos',
    icon: Package,
    label: 'Productos',
    desc: 'Inventario y stock',
    permission: 'canViewProducts',
    children: [
      { path: '/productos', label: 'Catálogo' },
      { path: '/paquetes', label: 'Ramos', icon: Layers, feature: 'packages' },
      { path: '/reposicion', label: 'Reposición', feature: 'restock', permission: 'canManageProducts' },
      { path: '/stock', label: 'Movimientos', icon: Activity, feature: 'stockMovements' },
      { path: '/mermas', label: 'Mermas', icon: Trash2, feature: 'waste', permission: 'canManageProducts' },
    ]
  },
  {
    id: 'proveedores',
    icon: Store,
    label: 'Proveedores',
    desc: 'Compras y suministros',
    permission: 'canManageProducts',
    children: [
      { path: '/proveedores', label: 'Directorio' },
      { path: '/compras', label: 'Compras', icon: ShoppingBag, feature: 'purchases' },
    ]
  },
  {
    id: 'finanzas',
    icon: Wallet,
    label: 'Finanzas',
    desc: 'Control económico',
    permission: 'canViewFinances',
    children: [
      { path: '/finanzas', label: 'Movimientos', permission: 'canManageFinances' },
      { path: '/ventas', label: 'Ventas', icon: FileText },
      { path: '/caja', label: 'Caja', icon: Vault, feature: 'cashRegister', permission: 'canManageFinances' },
      { path: '/reportes', label: 'Reportes', icon: BarChart3, feature: 'reports' },
    ]
  },
  {
    id: 'herramientas',
    icon: Wrench,
    label: 'Herramientas',
    desc: 'Utilidades operativas',
    children: [
      { path: '/herramientas', label: 'Ver Todas' },
      { path: '/herramientas/codigos', label: 'Códigos de Barra', feature: 'barcode', permission: 'canManageProducts' },
    ]
  },
  {
    id: 'ajustes',
    icon: Settings,
    label: 'Ajustes',
    desc: 'Configuración',
    children: [
      { path: '/configuracion', label: 'General', permission: 'canManageSettings' },
      { path: '/usuarios', label: 'Equipo', icon: UserCheck, permission: 'canManageUsers' },
      { path: '/configuracion?tab=subscription', label: 'Suscripción', icon: CreditCard, permission: 'canManageSubscription' },
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
  const perms = usePermissions();
  const products = useStore(state => state.products);
  const { status, features, showUpgradeModal } = useSubscription();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const restockItems = products.filter(p => p.stock <= (p.min || 0));
  const unassignedCount = restockItems.filter(p => !p.supplierId).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLinkClick = (e: React.MouseEvent, feature?: keyof SubscriptionState['features']) => {
    if (feature && !features[feature]) {
      e.preventDefault();
      e.stopPropagation();
      showUpgradeModal('Esta sección es exclusiva del plan Profesional.');
      return;
    }
    if (onClose) onClose();
  };

  const toggleSubmenu = (id: string) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter nav items based on permissions
  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      // Check top-level permission
      if (item.permission && !(perms as any)[item.permission]) {
        return false;
      }

      // If it's a group, check if it has at least one visible child
      if ('children' in item) {
        const visibleChildren = item.children.filter(child => {
          if (child.permission && !(perms as any)[child.permission]) {
            return false;
          }
          return true;
        });
        
        if (visibleChildren.length === 0) return false;
        
        // Update item with only visible children
        return { ...item, children: visibleChildren };
      }

      return true;
    });
  }, [perms]);

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
        <img src="/logo-app.png" className="brand-logo" alt="Mi Jardín Logo" style={{ borderRadius: '8px' }} />
        <h1 className="brand-text">Mi Jardín</h1>
      </div>

      <nav className="sidebar-nav">
        {filteredNavItems.map((item) => {
          // Collapsible group (has children)
          if (isNavGroup(item)) {
            // If the user has manually toggled it, use that. Otherwise, expand if a child is active.
            const isExpanded = expandedMenus[item.id] !== undefined 
              ? expandedMenus[item.id] 
              : isChildActive(item.children);

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
                  {item.children.map((child) => {
                    const isLocked = child.feature && !features[child.feature];
                    return (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `sidebar-sublink ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`
                        }
                        onClick={(e) => handleLinkClick(e, child.feature)}
                      >
                        <span className="sidebar-sublabel flex items-center justify-between w-full">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {child.label}
                            {isLocked && <Lock size={12} className="text-gray-400" />}
                          </span>
                          {child.path === '/reposicion' && restockItems.length > 0 && !isLocked && (
                            <span className={`px-2 py-0.5 ml-2 text-xs font-bold rounded-full ${unassignedCount > 0 ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                              {restockItems.length}
                            </span>
                          )}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Simple link (no children)
          const isLocked = item.feature && !features[item.feature];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${item.highlight ? 'sidebar-link-highlight' : ''} ${isLocked ? 'locked' : ''}`
              }
              title={item.desc}
              onClick={(e) => handleLinkClick(e, item.feature)}
              end={item.path === '/'}
            >
              <item.icon className="sidebar-icon" size={20} />
              <span className="sidebar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {item.label}
                {isLocked && <Lock size={14} className="text-gray-400" />}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {status === 'free' && (
          <button 
            className="sidebar-upgrade-card"
            onClick={() => navigate('/bienvenido')}
          >
            <div className="upgrade-card-icon">
              <Star size={20} fill="currentColor" />
            </div>
            <div className="upgrade-card-content">
              <span className="upgrade-card-title">Plan Profesional</span>
              <span className="upgrade-card-desc">Subí de nivel hoy</span>
            </div>
          </button>
        )}
        <div className="user-profile">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Usuario'}</span>
            <span className="user-role">
              {user?.role === 'owner' ? 'Dueño' :
                user?.role === 'admin' ? 'Administrador' :
                user?.role === 'employee' ? 'Empleado' :
                user?.role === 'finance' ? 'Finanzas' :
                user?.role === 'delivery' ? 'Repartidor' : 'Visualizador'}
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
