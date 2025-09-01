import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface Alert {
  id: string;
  type: 'price_increase' | 'price_decrease' | 'competitor_change' | 'market_trend' | 'system';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  timestamp: string;
  data?: {
    stationId?: string;
    fuelType?: string;
    oldPrice?: number;
    newPrice?: number;
    competitorName?: string;
  };
  actions?: Array<{
    label: string;
    action: string;
    primary?: boolean;
  }>;
}

interface AlertConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    type: 'price_change' | 'competitor_price' | 'market_trend';
    fuelTypes: string[];
    threshold: number;
    comparison: 'greater' | 'less' | 'equal';
    timeFrame: number; // minutes
  };
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

interface AlertState {
  alerts: Alert[];
  configurations: AlertConfiguration[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

interface AlertActions {
  fetchAlerts: () => Promise<void>;
  markAsRead: (alertId: string) => void;
  markAllAsRead: () => void;
  deleteAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  fetchConfigurations: () => Promise<void>;
  createConfiguration: (config: Omit<AlertConfiguration, 'id'>) => Promise<void>;
  updateConfiguration: (id: string, config: Partial<AlertConfiguration>) => Promise<void>;
  deleteConfiguration: (id: string) => Promise<void>;
  testAlert: (configId: string) => Promise<void>;
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type AlertStore = AlertState & AlertActions;

const initialState: AlertState = {
  alerts: [],
  configurations: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
};

export const useAlertStore = create<AlertStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        fetchAlerts: async () => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/alerts');
            if (!response.ok) throw new Error('Failed to fetch alerts');
            
            const data = await response.json();
            const unreadCount = data.alerts.filter((alert: Alert) => !alert.read).length;
            
            set({
              alerts: data.alerts,
              unreadCount,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to fetch alerts',
              isLoading: false,
            });
          }
        },

        markAsRead: (alertId: string) => {
          set((state) => ({
            alerts: state.alerts.map((alert) =>
              alert.id === alertId ? { ...alert, read: true } : alert
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }));

          // TODO: Sync with backend
          fetch(`/api/alerts/${alertId}/read`, { method: 'POST' }).catch(() => {
            // Handle error silently for now
          });
        },

        markAllAsRead: () => {
          set((state) => ({
            alerts: state.alerts.map((alert) => ({ ...alert, read: true })),
            unreadCount: 0,
          }));

          // TODO: Sync with backend
          fetch('/api/alerts/read-all', { method: 'POST' }).catch(() => {
            // Handle error silently for now
          });
        },

        deleteAlert: (alertId: string) => {
          set((state) => {
            const alertToDelete = state.alerts.find((a) => a.id === alertId);
            const newUnreadCount = alertToDelete && !alertToDelete.read 
              ? Math.max(0, state.unreadCount - 1) 
              : state.unreadCount;
            
            return {
              alerts: state.alerts.filter((alert) => alert.id !== alertId),
              unreadCount: newUnreadCount,
            };
          });

          // TODO: Sync with backend
          fetch(`/api/alerts/${alertId}`, { method: 'DELETE' }).catch(() => {
            // Handle error silently for now
          });
        },

        clearAllAlerts: () => {
          set({ alerts: [], unreadCount: 0 });
          
          // TODO: Sync with backend
          fetch('/api/alerts', { method: 'DELETE' }).catch(() => {
            // Handle error silently for now
          });
        },

        fetchConfigurations: async () => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/alert-configurations');
            if (!response.ok) throw new Error('Failed to fetch configurations');
            
            const data = await response.json();
            set({
              configurations: data.configurations,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to fetch configurations',
              isLoading: false,
            });
          }
        },

        createConfiguration: async (config: Omit<AlertConfiguration, 'id'>) => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch('/api/alert-configurations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(config),
            });
            
            if (!response.ok) throw new Error('Failed to create configuration');
            
            const data = await response.json();
            set((state) => ({
              configurations: [...state.configurations, data.configuration],
              isLoading: false,
            }));
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to create configuration',
              isLoading: false,
            });
          }
        },

        updateConfiguration: async (id: string, config: Partial<AlertConfiguration>) => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch(`/api/alert-configurations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(config),
            });
            
            if (!response.ok) throw new Error('Failed to update configuration');
            
            const data = await response.json();
            set((state) => ({
              configurations: state.configurations.map((c) =>
                c.id === id ? data.configuration : c
              ),
              isLoading: false,
            }));
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to update configuration',
              isLoading: false,
            });
          }
        },

        deleteConfiguration: async (id: string) => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch(`/api/alert-configurations/${id}`, {
              method: 'DELETE',
            });
            
            if (!response.ok) throw new Error('Failed to delete configuration');
            
            set((state) => ({
              configurations: state.configurations.filter((c) => c.id !== id),
              isLoading: false,
            }));
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to delete configuration',
              isLoading: false,
            });
          }
        },

        testAlert: async (configId: string) => {
          set({ isLoading: true, error: null });
          try {
            // TODO: Replace with actual API call
            const response = await fetch(`/api/alert-configurations/${configId}/test`, {
              method: 'POST',
            });
            
            if (!response.ok) throw new Error('Failed to test alert');
            
            set({ isLoading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to test alert',
              isLoading: false,
            });
          }
        },

        addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => {
          const newAlert: Alert = {
            ...alert,
            id: Math.random().toString(36).substring(2, 15),
            timestamp: new Date().toISOString(),
          };
          
          set((state) => ({
            alerts: [newAlert, ...state.alerts],
            unreadCount: alert.read ? state.unreadCount : state.unreadCount + 1,
          }));
        },

        setError: (error: string | null) => {
          set({ error });
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'alert-storage',
        partialize: (state) => ({
          configurations: state.configurations,
        }),
      }
    ),
    {
      name: 'alert-store',
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    }
  )
);