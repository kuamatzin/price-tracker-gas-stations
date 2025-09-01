import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUIStore } from '@/stores/uiStore';

// Mock document
const mockDocumentElement = {
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
  },
};

Object.defineProperty(document, 'documentElement', {
  value: mockDocumentElement,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('UIStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useUIStore.setState({
      sidebarOpen: true,
      theme: 'system',
      activeFilters: {
        dateRange: { from: '', to: '' },
        fuelTypes: [],
        priceRange: { min: 0, max: 100 },
      },
      loading: new Set(),
      errors: {},
      notifications: [],
      modals: {},
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useUIStore.getState();
      
      expect(state.sidebarOpen).toBe(true);
      expect(state.theme).toBe('system');
      expect(state.loading.size).toBe(0);
      expect(state.errors).toEqual({});
      expect(state.notifications).toEqual([]);
      expect(state.modals).toEqual({});
    });
  });

  describe('Sidebar', () => {
    it('should toggle sidebar', () => {
      const { toggleSidebar } = useUIStore.getState();
      
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      
      toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      
      toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('should set sidebar open state', () => {
      const { setSidebarOpen } = useUIStore.getState();
      
      setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      
      setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('Theme', () => {
    it('should set dark theme', () => {
      const { setTheme } = useUIStore.getState();
      
      setTheme('dark');
      
      expect(useUIStore.getState().theme).toBe('dark');
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('should set light theme', () => {
      const { setTheme } = useUIStore.getState();
      
      setTheme('light');
      
      expect(useUIStore.getState().theme).toBe('light');
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('dark');
    });

    it('should handle system theme with dark preference', () => {
      // Mock dark mode preference
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)' ? true : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { setTheme } = useUIStore.getState();
      setTheme('system');

      expect(useUIStore.getState().theme).toBe('system');
      expect(mockDocumentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
    });

    it('should handle system theme with light preference', () => {
      // Mock light mode preference
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { setTheme } = useUIStore.getState();
      setTheme('system');

      expect(mockDocumentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
    });
  });

  describe('Filters', () => {
    it('should set filters', () => {
      const { setFilters } = useUIStore.getState();
      
      setFilters({
        fuelTypes: ['regular', 'premium'],
        priceRange: { min: 10, max: 50 },
      });
      
      const state = useUIStore.getState();
      expect(state.activeFilters.fuelTypes).toEqual(['regular', 'premium']);
      expect(state.activeFilters.priceRange).toEqual({ min: 10, max: 50 });
      expect(state.activeFilters.dateRange).toEqual({ from: '', to: '' }); // Should preserve other filters
    });

    it('should clear filters', () => {
      // Set some filters first
      useUIStore.setState({
        activeFilters: {
          dateRange: { from: '2024-01-01', to: '2024-01-31' },
          fuelTypes: ['regular', 'premium'],
          priceRange: { min: 10, max: 50 },
        },
      });

      const { clearFilters } = useUIStore.getState();
      clearFilters();

      const state = useUIStore.getState();
      expect(state.activeFilters).toEqual({
        dateRange: { from: '', to: '' },
        fuelTypes: [],
        priceRange: { min: 0, max: 100 },
      });
    });
  });

  describe('Loading State', () => {
    it('should set loading state', () => {
      const { setLoading } = useUIStore.getState();
      
      setLoading('api-call', true);
      expect(useUIStore.getState().loading.has('api-call')).toBe(true);
      
      setLoading('api-call', false);
      expect(useUIStore.getState().loading.has('api-call')).toBe(false);
    });

    it('should handle multiple loading states', () => {
      const { setLoading } = useUIStore.getState();
      
      setLoading('api-call-1', true);
      setLoading('api-call-2', true);
      
      const loadingSet = useUIStore.getState().loading;
      expect(loadingSet.has('api-call-1')).toBe(true);
      expect(loadingSet.has('api-call-2')).toBe(true);
      expect(loadingSet.size).toBe(2);
      
      setLoading('api-call-1', false);
      expect(useUIStore.getState().loading.has('api-call-1')).toBe(false);
      expect(useUIStore.getState().loading.has('api-call-2')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set error', () => {
      const { setError } = useUIStore.getState();
      const testError = new Error('Test error');
      
      setError('api', testError);
      
      expect(useUIStore.getState().errors.api).toBe(testError);
    });

    it('should clear error', () => {
      const testError = new Error('Test error');
      useUIStore.setState({ errors: { api: testError } });
      
      const { clearError } = useUIStore.getState();
      clearError('api');
      
      expect(useUIStore.getState().errors.api).toBeUndefined();
    });

    it('should clear all errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      useUIStore.setState({ errors: { api1: error1, api2: error2 } });
      
      const { clearAllErrors } = useUIStore.getState();
      clearAllErrors();
      
      expect(useUIStore.getState().errors).toEqual({});
    });
  });

  describe('Notifications', () => {
    it('should add notification', () => {
      const { addNotification } = useUIStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
      });
      
      const notifications = useUIStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].title).toBe('Success');
      expect(notifications[0].message).toBe('Operation completed');
      expect(notifications[0].read).toBe(false);
      expect(notifications[0].id).toBeDefined();
      expect(notifications[0].timestamp).toBeDefined();
    });

    it('should mark notification as read', () => {
      const { addNotification, markNotificationAsRead } = useUIStore.getState();
      
      addNotification({
        type: 'info',
        title: 'Info',
        message: 'Information',
      });
      
      const notificationId = useUIStore.getState().notifications[0].id;
      markNotificationAsRead(notificationId);
      
      expect(useUIStore.getState().notifications[0].read).toBe(true);
    });

    it('should remove notification', () => {
      const { addNotification, removeNotification } = useUIStore.getState();
      
      addNotification({
        type: 'warning',
        title: 'Warning',
        message: 'Warning message',
      });
      
      const notificationId = useUIStore.getState().notifications[0].id;
      removeNotification(notificationId);
      
      expect(useUIStore.getState().notifications).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      const { addNotification, clearNotifications } = useUIStore.getState();
      
      addNotification({ type: 'info', title: 'Info 1', message: 'Message 1' });
      addNotification({ type: 'info', title: 'Info 2', message: 'Message 2' });
      
      expect(useUIStore.getState().notifications).toHaveLength(2);
      
      clearNotifications();
      expect(useUIStore.getState().notifications).toHaveLength(0);
    });
  });

  describe('Modals', () => {
    it('should open modal', () => {
      const { openModal } = useUIStore.getState();
      
      openModal('confirmDialog');
      
      expect(useUIStore.getState().modals.confirmDialog).toBe(true);
    });

    it('should close modal', () => {
      useUIStore.setState({ modals: { confirmDialog: true } });
      
      const { closeModal } = useUIStore.getState();
      closeModal('confirmDialog');
      
      expect(useUIStore.getState().modals.confirmDialog).toBe(false);
    });

    it('should toggle modal', () => {
      const { toggleModal } = useUIStore.getState();
      
      toggleModal('testModal');
      expect(useUIStore.getState().modals.testModal).toBe(true);
      
      toggleModal('testModal');
      expect(useUIStore.getState().modals.testModal).toBe(false);
    });
  });
});