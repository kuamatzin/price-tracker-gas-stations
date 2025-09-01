import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  station: {
    id: string;
    name: string;
    location: {
      lat: number;
      lng: number;
    };
  } | null;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              throw new Error('Login failed');
            }

            const data = await response.json();
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Login failed',
              isLoading: false,
            });
          }
        },

        logout: () => {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
          localStorage.removeItem('auth-storage');
        },

        register: async (email: string, password: string, name: string) => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, name }),
            });

            if (!response.ok) {
              throw new Error('Registration failed');
            }

            const data = await response.json();
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Registration failed',
              isLoading: false,
            });
          }
        },

        refreshToken: async () => {
          const { token } = get();
          if (!token) return;

          try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error('Token refresh failed');
            }

            const data = await response.json();
            set({ token: data.token });
          } catch (error) {
            // If refresh fails, logout
            get().logout();
          }
        },

        updateUser: (userUpdate: Partial<User>) => {
          set((state) => ({
            user: state.user ? { ...state.user, ...userUpdate } : null,
          }));
        },

        setError: (error: string | null) => {
          set({ error });
        },

        clearError: () => {
          set({ error: null });
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    }
  )
);