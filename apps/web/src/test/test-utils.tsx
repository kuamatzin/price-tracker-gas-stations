import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { vi } from 'vitest';

// Mock stores for testing
const mockAuthStore = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
  updateUser: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  setLoading: vi.fn(),
};

const mockUIStore = {
  sidebarOpen: true,
  theme: 'light' as const,
  activeFilters: {
    dateRange: { from: '', to: '' },
    fuelTypes: [],
    priceRange: { min: 0, max: 100 },
  },
  loading: new Set(),
  errors: {},
  notifications: [],
  modals: {},
  toggleSidebar: vi.fn(),
  setSidebarOpen: vi.fn(),
  setTheme: vi.fn(),
  setFilters: vi.fn(),
  clearFilters: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  clearAllErrors: vi.fn(),
  addNotification: vi.fn(),
  markNotificationAsRead: vi.fn(),
  removeNotification: vi.fn(),
  clearNotifications: vi.fn(),
  openModal: vi.fn(),
  closeModal: vi.fn(),
  toggleModal: vi.fn(),
};

const mockAlertStore = {
  alerts: [],
  configurations: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  fetchAlerts: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteAlert: vi.fn(),
  clearAllAlerts: vi.fn(),
  fetchConfigurations: vi.fn(),
  createConfiguration: vi.fn(),
  updateConfiguration: vi.fn(),
  deleteConfiguration: vi.fn(),
  testAlert: vi.fn(),
  addAlert: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
};

// Mock the stores
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => mockUIStore,
}));

vi.mock('@/stores/alertStore', () => ({
  useAlertStore: () => mockAlertStore,
}));

// Test wrapper with all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Helper to create authenticated user state
export const createMockUser = () => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  station: {
    id: 'station-1',
    name: 'Test Station',
    location: { lat: 0, lng: 0 },
  },
  preferences: {
    theme: 'light' as const,
    notifications: true,
    autoRefresh: true,
    refreshInterval: 5,
  },
});

// Helper to update mock store states
export const updateMockAuthStore = (updates: Partial<typeof mockAuthStore>) => {
  Object.assign(mockAuthStore, updates);
};

export const updateMockUIStore = (updates: Partial<typeof mockUIStore>) => {
  Object.assign(mockUIStore, updates);
};

export const updateMockAlertStore = (updates: Partial<typeof mockAlertStore>) => {
  Object.assign(mockAlertStore, updates);
};

// Reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
  Object.assign(mockAuthStore, {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  Object.assign(mockUIStore, {
    sidebarOpen: true,
    theme: 'light',
    notifications: [],
  });
  Object.assign(mockAlertStore, {
    alerts: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
  });
};