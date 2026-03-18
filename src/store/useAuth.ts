import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import type { User } from '../services/api';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    register: (name: string, email: string, password: string, role?: 'admin' | 'seller' | 'viewer') => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

export const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.login(email, password);
                    set({
                        user: response.user,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Log login activity
                    try {
                        await api.request('/activity/log', {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'login',
                                resource_type: 'session',
                                details: { method: 'traditional' },
                            }),
                        });
                    } catch (logError) {
                        console.warn('Failed to log login activity:', logError);
                    }
                } catch (error: any) {
                    set({
                        error: error.message || 'Error al iniciar sesión',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            logout: () => {
                // Log logout activity before clearing token
                const { user, isAuthenticated } = get();
                if (isAuthenticated && user) {
                    api.request('/activity/log', {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'logout',
                            resource_type: 'session',
                            details: { method: 'manual' },
                        }),
                    }).catch(() => {}); // Ignore errors
                }

                api.logout();
                set({
                    user: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            register: async (name: string, email: string, password: string, role?: 'admin' | 'seller' | 'viewer') => {
                set({ isLoading: true, error: null });
                try {
                    await api.register(name, email, password, role);
                    set({ isLoading: false });
                } catch (error: any) {
                    set({
                        error: error.message || 'Error al registrar',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            checkAuth: async () => {
                const token = api.getToken();
                if (!token) {
                    set({ isAuthenticated: false, user: null, isLoading: false });
                    return;
                }

                try {
                    const user = await api.getCurrentUser();
                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    api.logout();
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'aster-auth-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
