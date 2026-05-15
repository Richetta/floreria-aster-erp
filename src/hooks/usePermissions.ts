import { useAuth } from '../store/useAuth';
import type { UserRole } from '../types';

export const usePermissions = () => {
  const { user } = useAuth();
  const role = user?.role as UserRole;

  const hasRole = (roles: UserRole[]) => {
    return user && roles.includes(role);
  };

  const permissions = {
    // Modules Access
    canViewFinances: hasRole(['owner', 'admin', 'finance', 'viewer']),
    canManageFinances: hasRole(['owner', 'finance']),
    
    canViewProducts: hasRole(['owner', 'admin', 'employee', 'finance', 'viewer']),
    canManageProducts: hasRole(['owner', 'admin', 'employee']),
    
    canViewOrders: hasRole(['owner', 'admin', 'employee', 'delivery', 'viewer']),
    canManageOrders: hasRole(['owner', 'admin', 'employee']),
    canUpdateOrderStatus: hasRole(['owner', 'admin', 'employee', 'delivery']),
    
    canViewCustomers: hasRole(['owner', 'admin', 'employee', 'delivery', 'viewer']),
    canManageCustomers: hasRole(['owner', 'admin', 'employee']),
    
    canViewReports: hasRole(['owner', 'admin', 'finance', 'viewer']),
    
    // Management
    canManageUsers: hasRole(['owner', 'admin']),
    canManageSettings: hasRole(['owner']),
    canManageSubscription: hasRole(['owner']),
    
    // Actions
    canDeleteBusiness: role === 'owner',
    canEditPrices: hasRole(['owner', 'admin']),
    canEditStock: hasRole(['owner', 'admin', 'employee']),
    
    // Logistics
    canViewLogistics: hasRole(['owner', 'admin', 'employee', 'delivery', 'viewer']),
    canManageLogistics: hasRole(['owner', 'admin', 'delivery']),
  };

  return {
    role,
    user,
    ...permissions,
    hasRole,
  };
};
