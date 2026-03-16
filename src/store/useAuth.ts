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
        (set) => ({
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
                } catch (error: any) {
                    set({
                        error: error.message || 'Error al iniciar sesión',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            logout: () => {
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
