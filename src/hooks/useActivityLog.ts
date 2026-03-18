import { useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../store/useAuth';

// ============================================
// TYPES
// ============================================

export type UserActivity = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
};

export type ActivityLogParams = {
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, any>;
};

// ============================================
// ACTIVITY LOG HOOK
// ============================================

export const useActivityLog = () => {
  const { user, isAuthenticated } = useAuth();

  /**
   * Log user activity
   */
  const logActivity = useCallback(async (params: ActivityLogParams) => {
    if (!isAuthenticated || !user) return;

    try {
      await api.request('/activity/log', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch (error) {
      // Silently fail - activity logging should not block user actions
      console.error('Failed to log activity:', error);
    }
  }, [isAuthenticated, user]);

  /**
   * Log page view
   */
  const logPageView = useCallback(async (pageName: string) => {
    await logActivity({
      action: 'page_view',
      resource_type: 'page',
      details: { page: pageName, path: window.location.pathname },
    });
  }, [logActivity]);

  /**
   * Log CRUD operations
   */
  const logCreate = useCallback(async (resourceType: string, resourceId: string, details?: Record<string, any>) => {
    await logActivity({
      action: 'create',
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  }, [logActivity]);

  const logUpdate = useCallback(async (resourceType: string, resourceId: string, details?: Record<string, any>) => {
    await logActivity({
      action: 'update',
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  }, [logActivity]);

  const logDelete = useCallback(async (resourceType: string, resourceId: string, details?: Record<string, any>) => {
    await logActivity({
      action: 'delete',
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  }, [logActivity]);

  const logView = useCallback(async (resourceType: string, resourceId: string, details?: Record<string, any>) => {
    await logActivity({
      action: 'view',
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  }, [logActivity]);

  /**
   * Log special actions
   */
  const logLogin = useCallback(async () => {
    await logActivity({
      action: 'login',
      resource_type: 'session',
      details: { timestamp: new Date().toISOString() },
    });
  }, [logActivity]);

  const logLogout = useCallback(async () => {
    await logActivity({
      action: 'logout',
      resource_type: 'session',
      details: { timestamp: new Date().toISOString() },
    });
  }, [logActivity]);

  const logExport = useCallback(async (resourceType: string, details?: Record<string, any>) => {
    await logActivity({
      action: 'export',
      resource_type: resourceType,
      details,
    });
  }, [logActivity]);

  const logPrint = useCallback(async (resourceType: string, details?: Record<string, any>) => {
    await logActivity({
      action: 'print',
      resource_type: resourceType,
      details,
    });
  }, [logActivity]);

  return {
    logActivity,
    logPageView,
    logCreate,
    logUpdate,
    logDelete,
    logView,
    logLogin,
    logLogout,
    logExport,
    logPrint,
  };
};

// ============================================
// AUTO-TRACKING HOOK FOR ROUTES
// ============================================

export const useAutoTrackPages = () => {
  const { logPageView } = useActivityLog();

  useEffect(() => {
    // Log initial page view
    const pageName = window.location.pathname.slice(1) || 'dashboard';
    logPageView(pageName);

    // Track page changes
    const handleRouteChange = () => {
      const pageName = window.location.pathname.slice(1) || 'dashboard';
      logPageView(pageName);
    };

    // Listen for navigation events
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('pushstate', handleRouteChange);
    window.addEventListener('replacestate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('pushstate', handleRouteChange);
      window.removeEventListener('replacestate', handleRouteChange);
    };
  }, [logPageView]);
};
