import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface FilterState {
  dateRange: {
    from: string;
    to: string;
  };
  fuelTypes: string[];
  priceRange: {
    min: number;
    max: number;
  };
}

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  activeFilters: FilterState;
  loading: Set<string>;
  errors: Record<string, Error>;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>;
  modals: Record<string, boolean>;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFilters: (filters: Partial<FilterState>) => void;
  clearFilters: () => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: Error | null) => void;
  clearError: (key: string) => void;
  clearAllErrors: () => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  openModal: (key: string) => void;
  closeModal: (key: string) => void;
  toggleModal: (key: string) => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  sidebarOpen: true,
  theme: 'system',
  activeFilters: {
    dateRange: {
      from: '',
      to: '',
    },
    fuelTypes: [],
    priceRange: {
      min: 0,
      max: 100,
    },
  },
  loading: new Set(),
  errors: {},
  notifications: [],
  modals: {},
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        toggleSidebar: () => {
          set((state) => ({ sidebarOpen: !state.sidebarOpen }));
        },

        setSidebarOpen: (open: boolean) => {
          set({ sidebarOpen: open });
        },

        setTheme: (theme: 'light' | 'dark' | 'system') => {
          set({ theme });
          // Apply theme to document
          const root = document.documentElement;
          if (theme === 'dark') {
            root.classList.add('dark');
          } else if (theme === 'light') {
            root.classList.remove('dark');
          } else {
            // System theme
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
          }
        },

        setFilters: (filters: Partial<FilterState>) => {
          set((state) => ({
            activeFilters: { ...state.activeFilters, ...filters },
          }));
        },

        clearFilters: () => {
          set({
            activeFilters: {
              dateRange: { from: '', to: '' },
              fuelTypes: [],
              priceRange: { min: 0, max: 100 },
            },
          });
        },

        setLoading: (key: string, loading: boolean) => {
          set((state) => {
            const newLoading = new Set(state.loading);
            if (loading) {
              newLoading.add(key);
            } else {
              newLoading.delete(key);
            }
            return { loading: newLoading };
          });
        },

        setError: (key: string, error: Error | null) => {
          set((state) => {
            const newErrors = { ...state.errors };
            if (error) {
              newErrors[key] = error;
            } else {
              delete newErrors[key];
            }
            return { errors: newErrors };
          });
        },

        clearError: (key: string) => {
          set((state) => {
            const newErrors = { ...state.errors };
            delete newErrors[key];
            return { errors: newErrors };
          });
        },

        clearAllErrors: () => {
          set({ errors: {} });
        },

        addNotification: (notification) => {
          const id = Math.random().toString(36).substring(2, 15);
          const newNotification = {
            ...notification,
            id,
            timestamp: new Date().toISOString(),
            read: false,
          };
          
          set((state) => ({
            notifications: [newNotification, ...state.notifications],
          }));

          // Auto-remove after 5 seconds for success notifications
          if (notification.type === 'success') {
            setTimeout(() => {
              get().removeNotification(id);
            }, 5000);
          }
        },

        markNotificationAsRead: (id: string) => {
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          }));
        },

        removeNotification: (id: string) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        },

        clearNotifications: () => {
          set({ notifications: [] });
        },

        openModal: (key: string) => {
          set((state) => ({
            modals: { ...state.modals, [key]: true },
          }));
        },

        closeModal: (key: string) => {
          set((state) => ({
            modals: { ...state.modals, [key]: false },
          }));
        },

        toggleModal: (key: string) => {
          set((state) => ({
            modals: { ...state.modals, [key]: !state.modals[key] },
          }));
        },
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          theme: state.theme,
          activeFilters: state.activeFilters,
        }),
      }
    ),
    {
      name: 'ui-store',
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    }
  )
);