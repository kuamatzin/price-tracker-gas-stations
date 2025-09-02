import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

interface User {
  id: string;
  email: string;
  name: string;
  station: {
    numero: string;
    nombre: string;
    municipio: string;
    entidad: string;
  } | null;
  subscription_tier: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;
}

interface RegistrationResult {
  success: boolean;
  validationErrors?: Record<string, string[]>;
}

interface AuthActions {
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
    passwordConfirmation: string,
    name: string,
  ) => Promise<RegistrationResult>;
  refresh: () => Promise<void>;
  checkAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  token: null,
  expiresAt: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  rememberMe: false,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        login: async (email: string, password: string, remember: boolean) => {
          set({ isLoading: true, error: null, rememberMe: remember });
          try {
            const response = await fetch(`${API_URL}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, remember }),
            });

            if (!response.ok) {
              const data = await response.json();
              const errorMessage = data.error || data.message || "Credenciales inválidas";
              throw new Error(errorMessage);
            }

            const data = await response.json();
            
            // Store token and expiration info in localStorage
            const TOKEN_KEY = "fuelintel_token";
            const TOKEN_EXPIRY_KEY = "fuelintel_token_expiry";
            const USER_KEY = "fuelintel_user";
            
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(TOKEN_EXPIRY_KEY, data.expires_at);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            
            set({
              user: data.user,
              token: data.token,
              expiresAt: data.expires_at,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : "Error al iniciar sesión",
              isLoading: false,
            });
            throw error;
          }
        },

        logout: async () => {
          const { token } = get();
          
          // Call API logout if we have a token
          if (token) {
            try {
              await fetch(`${API_URL}/auth/logout`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
            } catch {
              // Continue with logout even if API call fails
            }
          }
          
          // Clear all tokens and user data
          const TOKEN_KEY = "fuelintel_token";
          const TOKEN_EXPIRY_KEY = "fuelintel_token_expiry";
          const USER_KEY = "fuelintel_user";
          
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem("auth-storage");
          
          set({
            user: null,
            token: null,
            expiresAt: null,
            isAuthenticated: false,
            rememberMe: false,
            error: null,
          });
        },

        register: async (
          email: string,
          password: string,
          passwordConfirmation: string,
          name: string,
        ): Promise<RegistrationResult> => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch(`${API_URL}/auth/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                password,
                password_confirmation: passwordConfirmation,
                name,
              }),
            });

            const data = await response.json();

            if (response.status === 422 && data.error?.validation_errors) {
              // Handle validation errors
              set({ isLoading: false });
              return {
                success: false,
                validationErrors: data.error.validation_errors,
              };
            }

            if (!response.ok) {
              // Handle other errors
              const errorMessage =
                data.error?.detail || data.message || "Registration failed";
              set({
                error: errorMessage,
                isLoading: false,
              });
              return { success: false };
            }

            // Success - expect data.data structure from API
            const userData = data.data || data;
            set({
              user: userData.user,
              token: userData.token,
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true };
          } catch (error) {
            set({
              error:
                error instanceof Error ? error.message : "Registration failed",
              isLoading: false,
            });
            return { success: false };
          }
        },

        refresh: async () => {
          const { token } = get();
          if (!token) return;

          try {
            const response = await fetch(`${API_URL}/auth/refresh`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error("Token refresh failed");
            }

            const data = await response.json();
            
            // Update stored tokens
            const TOKEN_KEY = "fuelintel_token";
            const TOKEN_EXPIRY_KEY = "fuelintel_token_expiry";
            
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(TOKEN_EXPIRY_KEY, data.expires_at);
            
            set({ 
              token: data.token, 
              expiresAt: data.expires_at 
            });
          } catch {
            // If refresh fails, logout
            await get().logout();
          }
        },

        checkAuth: () => {
          const TOKEN_KEY = "fuelintel_token";
          const TOKEN_EXPIRY_KEY = "fuelintel_token_expiry";
          const USER_KEY = "fuelintel_user";
          
          const token = localStorage.getItem(TOKEN_KEY);
          const expiresAt = localStorage.getItem(TOKEN_EXPIRY_KEY);
          const userStr = localStorage.getItem(USER_KEY);
          
          if (token && expiresAt && userStr) {
            try {
              const user = JSON.parse(userStr);
              const expiryTime = new Date(expiresAt).getTime();
              const currentTime = Date.now();
              
              // Check if token is still valid (not expired)
              if (expiryTime > currentTime) {
                set({
                  user,
                  token,
                  expiresAt,
                  isAuthenticated: true,
                });
                
                // Check if we need to refresh soon (5 minutes)
                const timeUntilExpiry = expiryTime - currentTime;
                if (timeUntilExpiry < 5 * 60 * 1000) {
                  get().refresh();
                }
              } else {
                // Token expired, clear everything
                get().logout();
              }
            } catch {
              // Invalid stored data, clear everything
              get().logout();
            }
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
        name: "auth-storage",
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          expiresAt: state.expiresAt,
          isAuthenticated: state.isAuthenticated,
          rememberMe: state.rememberMe,
        }),
      },
    ),
    {
      name: "auth-store",
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === "true",
    },
  ),
);
