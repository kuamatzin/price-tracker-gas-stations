import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePricingStore } from '../pricingStore';

// Mock the pricing service
vi.mock('../../services/api/pricing.service', () => ({
  pricingService: {
    getCurrentPrices: vi.fn(),
    getCompetitors: vi.fn(),
    getPriceHistory: vi.fn(),
    getMarketTrends: vi.fn(),
    updatePrice: vi.fn(),
    updateMultiplePrices: vi.fn(),
  },
}));

// Mock dynamic import
vi.mock('../../services/api/pricing.service', async () => {
  const actual = await vi.importActual('../../services/api/pricing.service');
  return {
    ...actual,
    pricingService: {
      getCurrentPrices: vi.fn(),
      getCompetitors: vi.fn(),
      getPriceHistory: vi.fn(),
      getMarketTrends: vi.fn(),
      updatePrice: vi.fn(),
      updateMultiplePrices: vi.fn(),
    },
  };
});

describe('pricingStore', () => {
  let mockService: any;

  beforeEach(() => {
    // Reset store state before each test
    usePricingStore.getState().clearCache();
    usePricingStore.setState({
      currentPrices: { regular: 0, premium: 0, diesel: 0 },
      competitors: [],
      history: [],
      marketAverages: {},
      isLoading: false,
      error: null,
      lastUpdated: '',
      filters: { fuelType: 'all', radius: 5, brands: [] },
      availableBrands: [],
      pagination: { total: 0, page: 1, limit: 20, hasNextPage: false, hasPrevPage: false },
      cache: new Map(),
      autoRefreshEnabled: false,
    });

    // Setup mock service
    vi.doMock('../../services/api/pricing.service', () => ({
      pricingService: {
        getCurrentPrices: vi.fn(),
        getCompetitors: vi.fn(),
        getPriceHistory: vi.fn(),
        getMarketTrends: vi.fn(),
        updatePrice: vi.fn(),
        updateMultiplePrices: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => usePricingStore());
      const state = result.current;

      expect(state.currentPrices).toEqual({ regular: 0, premium: 0, diesel: 0 });
      expect(state.competitors).toEqual([]);
      expect(state.history).toEqual([]);
      expect(state.marketAverages).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.filters).toEqual({ fuelType: 'all', radius: 5, brands: [] });
    });
  });

  describe('fetchCurrentPrices', () => {
    it('should fetch current prices successfully', async () => {
      const mockData = {
        prices: { regular: 22.50, premium: 24.80, diesel: 23.20 },
        station: { numero: '001', nombre: 'Test Station', direccion: 'Test Address', lat: 0, lng: 0, lastUpdated: '2024-01-01T12:00:00Z' },
        lastUpdated: '2024-01-01T12:00:00Z',
      };

      const { result } = renderHook(() => usePricingStore());

      // Mock the dynamic import
      vi.doMock('../../services/api/pricing.service', () => ({
        pricingService: {
          getCurrentPrices: vi.fn().mockResolvedValue(mockData),
        },
      }));

      await act(async () => {
        await result.current.fetchCurrentPrices();
      });

      expect(result.current.currentPrices).toEqual(mockData.prices);
      expect(result.current.userStation?.isUserStation).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch errors', async () => {
      const { result } = renderHook(() => usePricingStore());

      vi.doMock('../../services/api/pricing.service', () => ({
        pricingService: {
          getCurrentPrices: vi.fn().mockRejectedValue(new Error('API Error')),
        },
      }));

      await act(async () => {
        await result.current.fetchCurrentPrices();
      });

      expect(result.current.error).toBe('Failed to fetch prices');
      expect(result.current.isLoading).toBe(false);
    });

    it('should use cached data when available', async () => {
      const { result } = renderHook(() => usePricingStore());
      
      const cachedData = {
        prices: { regular: 22.00, premium: 24.00, diesel: 23.00 },
        userStation: undefined,
        lastUpdated: '2024-01-01T11:00:00Z',
      };

      // Set cache data
      result.current.setCachedData('currentPrices', cachedData);

      await act(async () => {
        await result.current.fetchCurrentPrices();
      });

      expect(result.current.currentPrices).toEqual(cachedData.prices);
      expect(result.current.lastUpdated).toBe(cachedData.lastUpdated);
    });
  });

  describe('fetchCompetitors', () => {
    it('should fetch competitors successfully', async () => {
      const mockData = {
        stations: [
          {
            numero: '002',
            nombre: 'Competitor 1',
            direccion: 'Address 1',
            lat: 0,
            lng: 0,
            distance: 1.5,
            regular: 22.80,
            brand: 'Shell',
            lastUpdated: '2024-01-01T12:00:00Z',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      const { result } = renderHook(() => usePricingStore());

      vi.doMock('../../services/api/pricing.service', () => ({
        pricingService: {
          getCompetitors: vi.fn().mockResolvedValue(mockData),
        },
      }));

      await act(async () => {
        await result.current.fetchCompetitors(1);
      });

      expect(result.current.competitors).toEqual(mockData.stations);
      expect(result.current.availableBrands).toContain('Shell');
      expect(result.current.pagination).toEqual(mockData.pagination);
    });

    it('should append data for subsequent pages', async () => {
      const { result } = renderHook(() => usePricingStore());

      // Set initial data
      const initialCompetitor = {
        numero: '001',
        nombre: 'Initial Competitor',
        direccion: 'Initial Address',
        lat: 0,
        lng: 0,
        lastUpdated: '2024-01-01T12:00:00Z',
      };

      act(() => {
        result.current.competitors.push(initialCompetitor);
      });

      const page2Data = {
        stations: [{
          numero: '002',
          nombre: 'Page 2 Competitor',
          direccion: 'Page 2 Address',
          lat: 0,
          lng: 0,
          lastUpdated: '2024-01-01T12:00:00Z',
        }],
        pagination: {
          total: 2,
          page: 2,
          limit: 20,
          hasNextPage: false,
          hasPrevPage: true,
        },
      };

      vi.doMock('../../services/api/pricing.service', () => ({
        pricingService: {
          getCompetitors: vi.fn().mockResolvedValue(page2Data),
        },
      }));

      await act(async () => {
        await result.current.fetchCompetitors(2);
      });

      expect(result.current.competitors).toHaveLength(2);
      expect(result.current.competitors[0].nombre).toBe('Initial Competitor');
      expect(result.current.competitors[1].nombre).toBe('Page 2 Competitor');
    });
  });

  describe('filter management', () => {
    it('should update filters and reset pagination', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.setFilters({ radius: 10, brands: ['Shell'] });
      });

      expect(result.current.filters.radius).toBe(10);
      expect(result.current.filters.brands).toEqual(['Shell']);
      expect(result.current.pagination.page).toBe(1);
      expect(result.current.competitors).toEqual([]);
    });

    it('should reset filters to default values', () => {
      const { result } = renderHook(() => usePricingStore());

      // Set some filters first
      act(() => {
        result.current.setFilters({ radius: 20, fuelType: 'premium', brands: ['Pemex'] });
      });

      // Reset filters
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual({
        fuelType: 'all',
        radius: 5,
        brands: [],
      });
    });
  });

  describe('cache management', () => {
    it('should set and get cached data', () => {
      const { result } = renderHook(() => usePricingStore());
      const testData = { test: 'data' };

      act(() => {
        result.current.setCachedData('testKey', testData);
      });

      const cachedData = result.current.getCachedData('testKey');
      expect(cachedData).toEqual(testData);
    });

    it('should return null for expired cache', () => {
      const { result } = renderHook(() => usePricingStore());
      const testData = { test: 'data' };

      act(() => {
        result.current.setCachedData('testKey', testData, -1000); // Expired TTL
      });

      const cachedData = result.current.getCachedData('testKey');
      expect(cachedData).toBeNull();
    });

    it('should clear specific cache entries', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.setCachedData('key1', { data: 1 });
        result.current.setCachedData('key2', { data: 2 });
      });

      act(() => {
        result.current.clearCache('key1');
      });

      expect(result.current.getCachedData('key1')).toBeNull();
      expect(result.current.getCachedData('key2')).toEqual({ data: 2 });
    });

    it('should clear all cache when no key provided', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.setCachedData('key1', { data: 1 });
        result.current.setCachedData('key2', { data: 2 });
      });

      act(() => {
        result.current.clearCache();
      });

      expect(result.current.getCachedData('key1')).toBeNull();
      expect(result.current.getCachedData('key2')).toBeNull();
    });
  });

  describe('auto-refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start auto-refresh', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.startAutoRefresh(1000);
      });

      expect(result.current.autoRefreshEnabled).toBe(true);
      expect(result.current.refreshInterval).toBeDefined();
    });

    it('should stop auto-refresh', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.startAutoRefresh(1000);
      });

      act(() => {
        result.current.stopAutoRefresh();
      });

      expect(result.current.autoRefreshEnabled).toBe(false);
      expect(result.current.refreshInterval).toBeUndefined();
    });

    it('should call refreshData at intervals', async () => {
      const { result } = renderHook(() => usePricingStore());
      
      // Mock refreshData method
      const mockRefreshData = vi.fn();
      result.current.refreshData = mockRefreshData;

      act(() => {
        result.current.startAutoRefresh(1000);
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockRefreshData).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockRefreshData).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.setState({ error: 'Test error' });
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should set loading state', () => {
      const { result } = renderHook(() => usePricingStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('pagination', () => {
    it('should reset pagination', () => {
      const { result } = renderHook(() => usePricingStore());

      // Set some pagination state
      act(() => {
        result.current.setState({
          pagination: { total: 100, page: 5, limit: 20, hasNextPage: true, hasPrevPage: true },
          competitors: [{ numero: '1', nombre: 'Test', direccion: 'Test', lat: 0, lng: 0, lastUpdated: '2024-01-01' }],
        });
      });

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.pagination.page).toBe(1);
      expect(result.current.competitors).toEqual([]);
    });
  });
});