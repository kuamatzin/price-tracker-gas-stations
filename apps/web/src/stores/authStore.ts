import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

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
    theme: "light" | "dark";
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

interface RegistrationResult {
  success: boolean;
  validationErrors?: Record<string, string[]>;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    email: string,
    password: string,
    passwordConfirmation: string,
    name: string,
  ) => Promise<RegistrationResult>;
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
            const response = await fetch(`${API_URL}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              throw new Error("Login failed");
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
              error: error instanceof Error ? error.message : "Login failed",
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
          localStorage.removeItem("auth-storage");
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

        refreshToken: async () => {
          const { token } = get();
          if (!token) return;

          try {
            // TODO: Replace with actual API call
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
            set({ token: data.token });
          } catch {
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
        name: "auth-storage",
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
    {
      name: "auth-store",
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === "true",
    },
  ),
);
