import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { usePricingStore } from '@/stores/pricingStore';
import { useAlertStore } from '@/stores/alertStore';

// Mock API services
vi.mock('@/services/api/pricing.service', () => ({
  pricingService: {
    getCurrentPrices: vi.fn(),
    updatePrice: vi.fn(),
    getCompetitorPrices: vi.fn(),
  },
}));

vi.mock('@/services/api/analytics.service', () => ({
  analyticsService: {
    getDashboardStats: vi.fn(),
    getPriceHistory: vi.fn(),
  },
}));

describe('Store Interactions Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all stores to initial state
    useAuthStore.getState().reset?.();
    useUIStore.getState().reset?.();
    usePricingStore.getState().reset?.();
    useAlertStore.getState().reset?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth and UI Store Interaction', () => {
    it('should sync theme preference between auth user and UI store', () => {
      const authResult = renderHook(() => useAuthStore());
      const uiResult = renderHook(() => useUIStore());

      act(() => {
        authResult.result.current.setUser({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: {
            id: 'station-1',
            name: 'Test Station',
            location: { lat: 0, lng: 0 },
          },
          preferences: {
            theme: 'dark',
            notifications: true,
            autoRefresh: true,
            refreshInterval: 10,
          },
        });
      });

      // UI store should sync with user preference
      expect(uiResult.result.current.theme).toBe('dark');

      act(() => {
        uiResult.result.current.setTheme('light');
      });

      // User preferences should be updated
      expect(authResult.result.current.user?.preferences.theme).toBe('light');
    });

    it('should clear UI state on logout', () => {
      const authResult = renderHook(() => useAuthStore());
      const uiResult = renderHook(() => useUIStore());

      // Set up authenticated state with UI modifications
      act(() => {
        authResult.result.current.login(
          {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
            preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
          },
          'token',
          'refresh-token'
        );

        uiResult.result.current.setSidebarOpen(false);
        uiResult.result.current.setFilters({
          dateRange: { from: '2025-08-01', to: '2025-09-01' },
          fuelTypes: ['REGULAR'],
          priceRange: { min: 18, max: 25 },
        });
        uiResult.result.current.addNotification({
          id: '1',
          type: 'info',
          message: 'Test notification',
          timestamp: new Date().toISOString(),
          read: false,
        });
      });

      act(() => {
        authResult.result.current.logout();
      });

      // UI state should be reset to defaults
      expect(uiResult.result.current.sidebarOpen).toBe(true); // Default state
      expect(uiResult.result.current.activeFilters).toEqual({
        dateRange: { from: '', to: '' },
        fuelTypes: [],
        priceRange: { min: 0, max: 100 },
      });
      expect(uiResult.result.current.notifications).toHaveLength(0);
    });

    it('should handle loading states across stores', () => {
      const authResult = renderHook(() => useAuthStore());
      const uiResult = renderHook(() => useUIStore());

      act(() => {
        authResult.result.current.setLoading(true);
      });

      expect(authResult.result.current.isLoading).toBe(true);
      expect(uiResult.result.current.loading.has('auth')).toBe(true);

      act(() => {
        authResult.result.current.setLoading(false);
      });

      expect(authResult.result.current.isLoading).toBe(false);
      expect(uiResult.result.current.loading.has('auth')).toBe(false);
    });
  });

  describe('Pricing and Alert Store Interaction', () => {
    it('should trigger alerts when price thresholds are exceeded', () => {
      const pricingResult = renderHook(() => usePricingStore());
      const alertResult = renderHook(() => useAlertStore());

      // Set up alert configurations
      act(() => {
        alertResult.result.current.setConfigurations([
          {
            id: '1',
            name: 'High Premium Price',
            fuelType: 'PREMIUM',
            condition: 'ABOVE',
            threshold: 23.0,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: '2',
            name: 'Low Regular Price',
            fuelType: 'REGULAR',
            condition: 'BELOW',
            threshold: 19.0,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      });

      // Update prices that trigger alerts
      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 18.5, // Below threshold
          PREMIUM: 23.5, // Above threshold
          DIESEL: 21.0,
        });
      });

      // Check that alerts were generated
      const alerts = alertResult.result.current.alerts;
      expect(alerts).toHaveLength(2);
      
      const premiumAlert = alerts.find(alert => alert.message.includes('PREMIUM'));
      const regularAlert = alerts.find(alert => alert.message.includes('REGULAR'));
      
      expect(premiumAlert).toBeDefined();
      expect(regularAlert).toBeDefined();
      expect(alertResult.result.current.unreadCount).toBe(2);
    });

    it('should track price history when prices change', () => {
      const pricingResult = renderHook(() => usePricingStore());

      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.0,
          PREMIUM: 22.0,
          DIESEL: 21.0,
        });
      });

      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.5, // Price increased
          PREMIUM: 22.0, // No change
          DIESEL: 20.8,  // Price decreased
        });
      });

      const history = pricingResult.result.current.history;
      expect(history).toHaveLength(2); // Two price changes (REGULAR and DIESEL)
      
      const regularChange = history.find(h => h.fuelType === 'REGULAR');
      const dieselChange = history.find(h => h.fuelType === 'DIESEL');
      
      expect(regularChange?.oldPrice).toBe(20.0);
      expect(regularChange?.newPrice).toBe(20.5);
      expect(dieselChange?.oldPrice).toBe(21.0);
      expect(dieselChange?.newPrice).toBe(20.8);
    });

    it('should update competitor analysis when prices change', () => {
      const pricingResult = renderHook(() => usePricingStore());

      // Set competitor data
      act(() => {
        pricingResult.result.current.setCompetitors([
          {
            id: 'comp-1',
            name: 'Competitor A',
            location: { lat: 1, lng: 1 },
            distance: 0.5,
            prices: { REGULAR: 19.8, PREMIUM: 21.8, DIESEL: 20.5 },
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'comp-2',
            name: 'Competitor B',
            location: { lat: 2, lng: 2 },
            distance: 1.2,
            prices: { REGULAR: 20.2, PREMIUM: 22.5, DIESEL: 21.2 },
            lastUpdated: new Date().toISOString(),
          },
        ]);
      });

      // Update own prices
      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.0,
          PREMIUM: 22.0,
          DIESEL: 21.0,
        });
      });

      // Check competitive analysis
      const analysis = pricingResult.result.current.competitiveAnalysis;
      expect(analysis.REGULAR.position).toBe('MIDDLE'); // Between 19.8 and 20.2
      expect(analysis.PREMIUM.position).toBe('LOWEST'); // Below both competitors
      expect(analysis.DIESEL.position).toBe('MIDDLE');
      expect(analysis.REGULAR.averageCompetitorPrice).toBe(20.0); // (19.8 + 20.2) / 2
    });
  });

  describe('UI and Pricing Store Interaction', () => {
    it('should sync loading states during price updates', async () => {
      const pricingResult = renderHook(() => usePricingStore());
      const uiResult = renderHook(() => useUIStore());

      // Start price update operation
      act(() => {
        pricingResult.result.current.setLoading(true);
      });

      expect(pricingResult.result.current.isLoading).toBe(true);
      expect(uiResult.result.current.loading.has('pricing')).toBe(true);

      // Complete operation
      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.5,
          PREMIUM: 22.3,
          DIESEL: 21.8,
        });
        pricingResult.result.current.setLoading(false);
      });

      expect(pricingResult.result.current.isLoading).toBe(false);
      expect(uiResult.result.current.loading.has('pricing')).toBe(false);
    });

    it('should handle pricing errors in UI store', () => {
      const pricingResult = renderHook(() => usePricingStore());
      const uiResult = renderHook(() => useUIStore());

      const error = new Error('Failed to update prices');

      act(() => {
        pricingResult.result.current.setError(error);
      });

      expect(pricingResult.result.current.error).toEqual(error);
      expect(uiResult.result.current.errors['pricing']).toEqual(error);

      // Should also add error notification
      const notifications = uiResult.result.current.notifications;
      const errorNotification = notifications.find(n => n.type === 'error');
      expect(errorNotification).toBeDefined();
      expect(errorNotification?.message).toContain('Failed to update prices');
    });

    it('should filter pricing data based on UI filters', () => {
      const pricingResult = renderHook(() => usePricingStore());
      const uiResult = renderHook(() => useUIStore());

      // Set up pricing history
      act(() => {
        pricingResult.result.current.setHistory([
          {
            id: '1',
            fuelType: 'REGULAR',
            oldPrice: 19.8,
            newPrice: 20.0,
            timestamp: '2025-08-15T10:00:00Z',
            stationId: 'station-1',
          },
          {
            id: '2',
            fuelType: 'PREMIUM',
            oldPrice: 21.8,
            newPrice: 22.0,
            timestamp: '2025-08-16T11:00:00Z',
            stationId: 'station-1',
          },
          {
            id: '3',
            fuelType: 'REGULAR',
            oldPrice: 20.0,
            newPrice: 20.2,
            timestamp: '2025-09-01T12:00:00Z',
            stationId: 'station-1',
          },
        ]);
      });

      // Apply filters
      act(() => {
        uiResult.result.current.setFilters({
          dateRange: { from: '2025-08-16', to: '2025-09-01' },
          fuelTypes: ['REGULAR'],
          priceRange: { min: 19.5, max: 21.0 },
        });
      });

      // Get filtered data
      const filteredHistory = pricingResult.result.current.getFilteredHistory(
        uiResult.result.current.activeFilters
      );

      expect(filteredHistory).toHaveLength(1); // Only the last REGULAR entry
      expect(filteredHistory[0].id).toBe('3');
    });
  });

  describe('Alert and UI Store Interaction', () => {
    it('should show alert notifications in UI', () => {
      const alertResult = renderHook(() => useAlertStore());
      const uiResult = renderHook(() => useUIStore());

      act(() => {
        alertResult.result.current.addAlert({
          id: '1',
          message: 'Premium price exceeded threshold',
          type: 'PRICE_ALERT',
          fuelType: 'PREMIUM',
          threshold: 23.0,
          actualPrice: 23.5,
          timestamp: new Date().toISOString(),
          read: false,
        });
      });

      // Check that notification appears in UI store
      const notifications = uiResult.result.current.notifications;
      const alertNotification = notifications.find(n => 
        n.message.includes('Premium price exceeded')
      );
      expect(alertNotification).toBeDefined();
      expect(alertNotification?.type).toBe('warning');
    });

    it('should sync read status between alert and notification', () => {
      const alertResult = renderHook(() => useAlertStore());
      const uiResult = renderHook(() => useUIStore());

      // Add alert
      act(() => {
        alertResult.result.current.addAlert({
          id: '1',
          message: 'Test alert',
          type: 'PRICE_ALERT',
          fuelType: 'REGULAR',
          threshold: 20.0,
          actualPrice: 20.5,
          timestamp: new Date().toISOString(),
          read: false,
        });
      });

      expect(alertResult.result.current.unreadCount).toBe(1);

      // Mark as read
      act(() => {
        alertResult.result.current.markAsRead('1');
      });

      expect(alertResult.result.current.unreadCount).toBe(0);
      
      // Corresponding notification should also be marked as read
      const notification = uiResult.result.current.notifications.find(n =>
        n.message.includes('Test alert')
      );
      expect(notification?.read).toBe(true);
    });
  });

  describe('Cross-Store Error Handling', () => {
    it('should propagate critical errors across stores', () => {
      const authResult = renderHook(() => useAuthStore());
      const uiResult = renderHook(() => useUIStore());
      const pricingResult = renderHook(() => usePricingStore());

      // Simulate critical auth error
      const authError = new Error('Authentication failed');
      act(() => {
        authResult.result.current.setError(authError);
      });

      // Should appear in UI store
      expect(uiResult.result.current.errors['auth']).toEqual(authError);

      // Should clear pricing data for security
      expect(pricingResult.result.current.currentPrices).toEqual({});
      expect(pricingResult.result.current.history).toHaveLength(0);
    });

    it('should recover from transient errors', () => {
      const pricingResult = renderHook(() => usePricingStore());
      const uiResult = renderHook(() => useUIStore());

      // Simulate network error
      const networkError = new Error('Network request failed');
      act(() => {
        pricingResult.result.current.setError(networkError);
      });

      // Should show retry option in UI
      const notifications = uiResult.result.current.notifications;
      const errorNotification = notifications.find(n => n.type === 'error');
      expect(errorNotification?.actions).toBeDefined();
      expect(errorNotification?.actions).toContain('retry');

      // Clear error and retry
      act(() => {
        pricingResult.result.current.clearError();
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.0,
          PREMIUM: 22.0,
          DIESEL: 21.0,
        });
      });

      expect(pricingResult.result.current.error).toBeNull();
      expect(uiResult.result.current.errors['pricing']).toBeUndefined();
    });
  });

  describe('Store Synchronization', () => {
    it('should maintain consistency during rapid updates', () => {
      const pricingResult = renderHook(() => usePricingStore());
      const alertResult = renderHook(() => useAlertStore());
      const uiResult = renderHook(() => useUIStore());

      // Set up alert configuration
      act(() => {
        alertResult.result.current.setConfigurations([
          {
            id: '1',
            name: 'Price Monitor',
            fuelType: 'REGULAR',
            condition: 'ABOVE',
            threshold: 20.0,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      });

      // Rapid price updates
      act(() => {
        pricingResult.result.current.setCurrentPrices({ REGULAR: 19.8, PREMIUM: 22.0, DIESEL: 21.0 });
        pricingResult.result.current.setCurrentPrices({ REGULAR: 20.2, PREMIUM: 22.0, DIESEL: 21.0 });
        pricingResult.result.current.setCurrentPrices({ REGULAR: 20.5, PREMIUM: 22.0, DIESEL: 21.0 });
      });

      // Should generate correct number of alerts (only for threshold crosses)
      const alerts = alertResult.result.current.alerts;
      const priceAlerts = alerts.filter(a => a.fuelType === 'REGULAR');
      expect(priceAlerts).toHaveLength(1); // Only one alert for crossing threshold

      // UI should show appropriate notifications
      const notifications = uiResult.result.current.notifications;
      const priceNotifications = notifications.filter(n => 
        n.message.includes('REGULAR') && n.type === 'warning'
      );
      expect(priceNotifications).toHaveLength(1);
    });

    it('should handle store initialization order', () => {
      // Initialize stores in different orders
      const uiResult = renderHook(() => useUIStore());
      const pricingResult = renderHook(() => usePricingStore());
      const authResult = renderHook(() => useAuthStore());
      const alertResult = renderHook(() => useAlertStore());

      // Set auth first
      act(() => {
        authResult.result.current.setUser({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'dark', notifications: true, autoRefresh: true, refreshInterval: 5 },
        });
      });

      // UI should sync with user preferences
      expect(uiResult.result.current.theme).toBe('dark');

      // Pricing updates should work correctly
      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.0,
          PREMIUM: 22.0,
          DIESEL: 21.0,
        });
      });

      expect(pricingResult.result.current.currentPrices.REGULAR).toBe(20.0);
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce frequent store updates', async () => {
      const uiResult = renderHook(() => useUIStore());
      const updateSpy = vi.spyOn(uiResult.result.current, 'setFilters');

      // Rapid filter changes
      act(() => {
        uiResult.result.current.setFilters({ dateRange: { from: '2025-08-01', to: '2025-08-15' }, fuelTypes: [], priceRange: { min: 0, max: 100 } });
        uiResult.result.current.setFilters({ dateRange: { from: '2025-08-01', to: '2025-08-20' }, fuelTypes: [], priceRange: { min: 0, max: 100 } });
        uiResult.result.current.setFilters({ dateRange: { from: '2025-08-01', to: '2025-08-25' }, fuelTypes: [], priceRange: { min: 0, max: 100 } });
      });

      // Should debounce and only apply final state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(uiResult.result.current.activeFilters.dateRange.to).toBe('2025-08-25');
    });

    it('should memoize computed values across stores', () => {
      const pricingResult = renderHook(() => usePricingStore());
      
      // Set up data
      act(() => {
        pricingResult.result.current.setCurrentPrices({
          REGULAR: 20.0,
          PREMIUM: 22.0,
          DIESEL: 21.0,
        });
        pricingResult.result.current.setCompetitors([
          {
            id: 'comp-1',
            name: 'Competitor A',
            location: { lat: 1, lng: 1 },
            distance: 0.5,
            prices: { REGULAR: 19.8, PREMIUM: 21.8, DIESEL: 20.5 },
            lastUpdated: new Date().toISOString(),
          },
        ]);
      });

      // Get computed value multiple times
      const analysis1 = pricingResult.result.current.competitiveAnalysis;
      const analysis2 = pricingResult.result.current.competitiveAnalysis;

      // Should return same reference (memoized)
      expect(analysis1).toBe(analysis2);
    });
  });
});