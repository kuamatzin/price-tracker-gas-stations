import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { usePricingStore } from '@/stores/pricingStore';
import { useAlertStore } from '@/stores/alertStore';

// Mock localStorage
const createMockStorage = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() { return store; },
  };
};

let mockLocalStorage: ReturnType<typeof createMockStorage>;

describe('State Persistence Integration Tests', () => {
  beforeEach(() => {
    mockLocalStorage = createMockStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    
    // Clear all stores
    useAuthStore.getState().reset?.();
    useUIStore.getState().reset?.();
    usePricingStore.getState().reset?.();
    useAlertStore.getState().reset?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth Store Persistence', () => {
    it('should persist auth tokens to localStorage', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.setTokens('access-token-123', 'refresh-token-456');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auth_token',
        'access-token-123'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token-456'
      );
    });

    it('should restore auth state from localStorage on initialization', () => {
      // Pre-populate localStorage
      mockLocalStorage.store['auth_token'] = 'stored-access-token';
      mockLocalStorage.store['refresh_token'] = 'stored-refresh-token';
      mockLocalStorage.store['user_profile'] = JSON.stringify({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.token).toBe('stored-access-token');
      expect(result.current.refreshToken).toBe('stored-refresh-token');
      expect(result.current.user).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should clear localStorage on logout', () => {
      const { result } = renderHook(() => useAuthStore());
      
      // Set initial state
      act(() => {
        result.current.setTokens('token', 'refresh');
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        });
      });

      act(() => {
        result.current.logout();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user_profile');
      
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Set corrupted data
      mockLocalStorage.store['user_profile'] = 'invalid-json{';
      
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('UI Store Persistence', () => {
    it('should persist theme preference', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setTheme('dark');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'theme_preference',
        'dark'
      );
    });

    it('should restore theme from localStorage', () => {
      mockLocalStorage.store['theme_preference'] = 'dark';
      
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should persist sidebar state', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setSidebarOpen(false);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'sidebar_open',
        'false'
      );
    });

    it('should restore sidebar state from localStorage', () => {
      mockLocalStorage.store['sidebar_open'] = 'false';
      
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.sidebarOpen).toBe(false);
    });

    it('should persist active filters', () => {
      const { result } = renderHook(() => useUIStore());
      
      const filters = {
        dateRange: { from: '2025-08-01', to: '2025-09-01' },
        fuelTypes: ['REGULAR', 'PREMIUM'],
        priceRange: { min: 18.0, max: 25.0 },
      };

      act(() => {
        result.current.setFilters(filters);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'active_filters',
        JSON.stringify(filters)
      );
    });

    it('should restore filters from localStorage', () => {
      const savedFilters = {
        dateRange: { from: '2025-08-01', to: '2025-09-01' },
        fuelTypes: ['REGULAR', 'PREMIUM'],
        priceRange: { min: 18.0, max: 25.0 },
      };
      
      mockLocalStorage.store['active_filters'] = JSON.stringify(savedFilters);
      
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.activeFilters).toEqual(savedFilters);
    });

    it('should not persist loading states or errors', () => {
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.setLoading('test-operation', true);
        result.current.setError('test-error', new Error('Test error'));
      });

      // These should not be persisted
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining('loading'),
        expect.anything()
      );
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.anything()
      );
    });
  });

  describe('Pricing Store Persistence', () => {
    it('should persist last price update timestamp', () => {
      const { result } = renderHook(() => usePricingStore());
      
      const timestamp = '2025-09-01T12:00:00Z';
      
      act(() => {
        result.current.setLastUpdated(timestamp);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'price_last_updated',
        timestamp
      );
    });

    it('should persist current prices for offline access', () => {
      const { result } = renderHook(() => usePricingStore());
      
      const prices = {
        REGULAR: 20.50,
        PREMIUM: 22.30,
        DIESEL: 21.80,
      };
      
      act(() => {
        result.current.setCurrentPrices(prices);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'current_prices',
        JSON.stringify(prices)
      );
    });

    it('should restore pricing data from localStorage', () => {
      const prices = {
        REGULAR: 20.50,
        PREMIUM: 22.30,
        DIESEL: 21.80,
      };
      const timestamp = '2025-09-01T12:00:00Z';
      
      mockLocalStorage.store['current_prices'] = JSON.stringify(prices);
      mockLocalStorage.store['price_last_updated'] = timestamp;
      
      const { result } = renderHook(() => usePricingStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.currentPrices).toEqual(prices);
      expect(result.current.lastUpdated).toBe(timestamp);
    });

    it('should handle price data expiration', () => {
      const oldTimestamp = '2025-08-01T12:00:00Z'; // 30+ days old
      const prices = { REGULAR: 20.50 };
      
      mockLocalStorage.store['current_prices'] = JSON.stringify(prices);
      mockLocalStorage.store['price_last_updated'] = oldTimestamp;
      
      const { result } = renderHook(() => usePricingStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      // Old data should be cleared
      expect(result.current.currentPrices).toEqual({});
      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe('Alert Store Persistence', () => {
    it('should persist alert configurations', () => {
      const { result } = renderHook(() => useAlertStore());
      
      const configurations = [
        {
          id: '1',
          name: 'High Price Alert',
          fuelType: 'REGULAR',
          condition: 'ABOVE',
          threshold: 22.0,
          enabled: true,
        },
        {
          id: '2',
          name: 'Low Price Alert',
          fuelType: 'PREMIUM',
          condition: 'BELOW',
          threshold: 20.0,
          enabled: true,
        },
      ];
      
      act(() => {
        result.current.setConfigurations(configurations);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alert_configurations',
        JSON.stringify(configurations)
      );
    });

    it('should restore alert configurations from localStorage', () => {
      const savedConfigurations = [
        {
          id: '1',
          name: 'Saved Alert',
          fuelType: 'REGULAR',
          condition: 'ABOVE',
          threshold: 23.0,
          enabled: false,
        },
      ];
      
      mockLocalStorage.store['alert_configurations'] = JSON.stringify(savedConfigurations);
      
      const { result } = renderHook(() => useAlertStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(result.current.configurations).toEqual(savedConfigurations);
    });

    it('should persist notification preferences', () => {
      const { result } = renderHook(() => useAlertStore());
      
      const preferences = {
        email: true,
        browser: false,
        sound: true,
        frequency: 'IMMEDIATE',
      };
      
      act(() => {
        result.current.setNotificationPreferences(preferences);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notification_preferences',
        JSON.stringify(preferences)
      );
    });

    it('should not persist temporary alert list', () => {
      const { result } = renderHook(() => useAlertStore());
      
      const alerts = [
        { id: '1', message: 'Price alert', timestamp: '2025-09-01T12:00:00Z', read: false },
      ];
      
      act(() => {
        result.current.setAlerts(alerts);
      });

      // Temporary alert list should not be persisted
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'alerts',
        expect.anything()
      );
    });
  });

  describe('Cross-Store Persistence', () => {
    it('should maintain consistency across store rehydration', () => {
      // Set up interconnected state
      const authResult = renderHook(() => useAuthStore());
      const uiResult = renderHook(() => useUIStore());
      
      act(() => {
        // User login should trigger theme preference loading
        authResult.result.current.setUser({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { 
            theme: 'dark', 
            notifications: true, 
            autoRefresh: true, 
            refreshInterval: 5 
          },
        });
      });

      act(() => {
        uiResult.result.current.setTheme('dark');
      });

      // Both stores should have consistent theme
      expect(authResult.result.current.user?.preferences.theme).toBe('dark');
      expect(uiResult.result.current.theme).toBe('dark');
    });

    it('should handle partial storage corruption gracefully', () => {
      // Corrupt one store's data
      mockLocalStorage.store['auth_token'] = 'valid-token';
      mockLocalStorage.store['user_profile'] = 'corrupted-json{';
      mockLocalStorage.store['theme_preference'] = 'dark';
      
      const authResult = renderHook(() => useAuthStore());
      const uiResult = renderHook(() => useUIStore());
      
      act(() => {
        authResult.result.current.initializeFromStorage?.();
        uiResult.result.current.initializeFromStorage?.();
      });

      // UI store should load successfully despite auth store corruption
      expect(uiResult.result.current.theme).toBe('dark');
      expect(authResult.result.current.user).toBeNull();
    });
  });

  describe('Storage Cleanup', () => {
    it('should clean up expired data on initialization', () => {
      // Set expired data
      const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago
      
      mockLocalStorage.store['price_last_updated'] = expiredDate;
      mockLocalStorage.store['current_prices'] = JSON.stringify({ REGULAR: 20.0 });
      
      const { result } = renderHook(() => usePricingStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('price_last_updated');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('current_prices');
    });

    it('should migrate legacy storage keys', () => {
      // Set legacy key format
      mockLocalStorage.store['fuelintel_theme'] = 'light'; // Legacy key
      
      const { result } = renderHook(() => useUIStore());
      
      act(() => {
        result.current.initializeFromStorage?.();
      });

      // Should migrate to new key
      expect(result.current.theme).toBe('light');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme_preference', 'light');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('fuelintel_theme');
    });
  });

  describe('Performance Considerations', () => {
    it('should debounce frequent storage writes', async () => {
      const { result } = renderHook(() => useUIStore());
      
      // Make multiple rapid updates
      act(() => {
        result.current.setSidebarOpen(false);
        result.current.setSidebarOpen(true);
        result.current.setSidebarOpen(false);
      });

      // Should only write final state to reduce localStorage calls
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith(
        'sidebar_open',
        'false'
      );
    });

    it('should batch related storage operations', () => {
      const { result } = renderHook(() => useAuthStore());
      
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
        preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
      };
      
      act(() => {
        // Should batch these operations
        result.current.login(user, 'access-token', 'refresh-token');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'access-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user_profile', JSON.stringify(user));
    });
  });
});