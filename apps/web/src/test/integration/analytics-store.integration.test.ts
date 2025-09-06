import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { analyticsService } from '../../services/api/analytics.service';
import type { ChartDataPoint, ComparisonDataPoint, FuelType, DateRange } from '../../types/charts';

// Mock data generators
const generateHistoricalData = (days: number = 7): ChartDataPoint[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    regular: 20 + Math.random() * 2,
    premium: 22 + Math.random() * 2,
    diesel: 19 + Math.random() * 2,
  }));
};

const generateComparisonData = (days: number = 7): ComparisonDataPoint[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    userPrice: 20 + Math.random() * 2,
    marketPrice: 21 + Math.random() * 2,
    currentStation: 'test-station',
  }));
};

// MSW server setup
const server = setupServer(
  http.get('*/prices/history/*', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    const start = new Date(startDate || '2024-01-01');
    const end = new Date(endDate || '2024-01-07');
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return HttpResponse.json({
      data: generateHistoricalData(Math.min(days, 30)),
    });
  }),

  http.get('*/trends/market', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    const start = new Date(startDate || '2024-01-01');
    const end = new Date(endDate || '2024-01-07');
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const comparisonData = generateComparisonData(Math.min(days, 30));
    
    return HttpResponse.json({
      data: comparisonData.map(point => ({
        date: point.date,
        user_price: point.userPrice,
        market_price: point.marketPrice,
        station_id: point.currentStation,
      })),
    });
  }),

  http.get('*/trends/station/*', () => {
    return HttpResponse.json({
      data: [{
        fuel_type: 'regular',
        average: 21.02,
        min: { value: 20.50, date: '2024-01-01' },
        max: { value: 21.75, date: '2024-01-15' },
        volatility: 0.32,
        trend: { direction: 'rising', slope: 0.08, confidence: 0.78 },
        change_count: 8,
      }],
    });
  }),

  // Error endpoints for testing error handling
  http.get('*/prices/history/error-station', () => {
    return HttpResponse.json(
      { error: 'Station not found' },
      { status: 404 }
    );
  }),

  http.get('*/trends/market/error', () => {
    return HttpResponse.json(
      { error: 'Market data unavailable' },
      { status: 503 }
    );
  }),
);

describe('Analytics Store Integration Tests', () => {
  beforeEach(() => {
    server.listen();
    vi.clearAllTimers();
    vi.useFakeTimers();
    analyticsService.clearCache();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.useRealTimers();
  });

  describe('Store Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.historicalData).toEqual([]);
      expect(result.current.comparisonData).toEqual([]);
      expect(result.current.selectedFuels).toEqual(['regular']);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isOptimizedMode).toBe(true);
    });

    it('should have all required methods', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      expect(typeof result.current.fetchDataForRange).toBe('function');
      expect(typeof result.current.fetchComparisonDataForRange).toBe('function');
      expect(typeof result.current.setSelectedFuels).toBe('function');
      expect(typeof result.current.performAllCalculations).toBe('function');
      expect(typeof result.current.getOptimizedData).toBe('function');
      expect(typeof result.current.getOptimizedComparisonData).toBe('function');
    });
  });

  describe('Data Fetching Integration', () => {
    it('should fetch historical data successfully', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      // Should set loading state
      expect(result.current.loading).toBe(true);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.historicalData.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it('should fetch comparison data successfully', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchComparisonDataForRange(dateRange);
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.comparisonData.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Mock error response
      server.use(
        http.get('*/prices/history/*', () => {
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          );
        })
      );

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should fallback to mock data or handle error
      expect(result.current.error).not.toBeNull();
    });

    it('should cache fetched data', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      // First fetch
      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const firstData = result.current.historicalData;

      // Second fetch with same parameters
      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return same data (from cache)
      expect(result.current.historicalData).toEqual(firstData);
    });
  });

  describe('State Management Integration', () => {
    it('should update selected fuels', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      act(() => {
        result.current.setSelectedFuels(['premium', 'diesel']);
      });

      expect(result.current.selectedFuels).toEqual(['premium', 'diesel']);
    });

    it('should handle fuel type changes with data refetch', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Initial data fetch
      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialDataLength = result.current.historicalData.length;

      // Change fuel selection
      act(() => {
        result.current.setSelectedFuels(['premium']);
      });

      expect(result.current.selectedFuels).toEqual(['premium']);
      // Data should remain the same as fuel selection is applied at render time
      expect(result.current.historicalData.length).toBe(initialDataLength);
    });

    it('should manage loading states correctly', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.loading).toBe(false);

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should clear error state on successful fetch', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // First, create an error state
      server.use(
        http.get('*/prices/history/*', () => {
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          );
        })
      );

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Reset server to successful responses
      server.resetHandlers();

      // Retry fetch
      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.historicalData.length).toBeGreaterThan(0);
    });
  });

  describe('Calculations Integration', () => {
    it('should perform calculations when data is loaded', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Advance timers to trigger calculations
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should have calculated trend analysis
      expect(result.current.trendAnalysis).toBeDefined();
      expect(Object.keys(result.current.trendAnalysis).length).toBeGreaterThan(0);
    });

    it('should recalculate when data changes', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Initial data
      const dateRange1: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange1);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const initialTrendAnalysis = result.current.trendAnalysis;

      // New data with different date range
      const dateRange2: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-15'),
        preset: '15d',
      };

      act(() => {
        result.current.fetchDataForRange(dateRange2);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should have updated calculations
      expect(result.current.trendAnalysis).not.toEqual(initialTrendAnalysis);
    });

    it('should handle market comparison calculations', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      // Fetch both historical and comparison data
      act(() => {
        result.current.fetchDataForRange(dateRange);
        result.current.fetchComparisonDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.comparisonData.length).toBeGreaterThan(0);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.marketComparison).toBeDefined();
    });
  });

  describe('Performance Optimization Integration', () => {
    it('should handle optimized data mode', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.isOptimizedMode).toBe(true);

      const testData = generateHistoricalData(1000); // Large dataset

      // Get optimized data
      const optimizedData = result.current.getOptimizedData(testData);

      // Should be decimated for large datasets
      expect(optimizedData.length).toBeLessThanOrEqual(testData.length);
    });

    it('should toggle optimization mode', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      expect(result.current.isOptimizedMode).toBe(true);

      act(() => {
        result.current.setOptimizedMode(false);
      });

      expect(result.current.isOptimizedMode).toBe(false);
    });

    it('should apply different optimizations based on data size', () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const smallData = generateHistoricalData(10);
      const largeData = generateHistoricalData(1000);

      const optimizedSmall = result.current.getOptimizedData(smallData);
      const optimizedLarge = result.current.getOptimizedData(largeData);

      // Small data should remain unchanged
      expect(optimizedSmall.length).toBe(smallData.length);
      
      // Large data should be decimated
      expect(optimizedLarge.length).toBeLessThan(largeData.length);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle concurrent data fetches', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange1: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      const dateRange2: DateRange = {
        startDate: new Date('2024-01-08'),
        endDate: new Date('2024-01-14'),
        preset: '7d',
      };

      // Start concurrent fetches
      act(() => {
        result.current.fetchDataForRange(dateRange1);
        result.current.fetchComparisonDataForRange(dateRange2);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.historicalData.length).toBeGreaterThan(0);
      expect(result.current.comparisonData.length).toBeGreaterThan(0);
    });

    it('should handle rapid state changes', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Rapid fuel type changes
      const fuelTypes: FuelType[][] = [
        ['regular'],
        ['premium'],
        ['diesel'],
        ['regular', 'premium'],
        ['premium', 'diesel'],
        ['regular', 'premium', 'diesel'],
      ];

      fuelTypes.forEach(fuels => {
        act(() => {
          result.current.setSelectedFuels(fuels);
        });
      });

      expect(result.current.selectedFuels).toEqual(['regular', 'premium', 'diesel']);
    });

    it('should maintain data consistency during updates', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      // Fetch initial data
      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialData = [...result.current.historicalData];

      // Change fuel selection
      act(() => {
        result.current.setSelectedFuels(['premium']);
      });

      // Data should remain consistent
      expect(result.current.historicalData).toEqual(initialData);

      // Only fuel selection should change
      expect(result.current.selectedFuels).toEqual(['premium']);
    });

    it('should handle error recovery across different data types', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Set up error for historical data only
      server.use(
        http.get('*/prices/history/*', () => {
          return HttpResponse.json(
            { error: 'Historical data error' },
            { status: 500 }
          );
        })
      );

      const dateRange: DateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d',
      };

      // Try to fetch both types
      act(() => {
        result.current.fetchDataForRange(dateRange);
        result.current.fetchComparisonDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Historical data should error, comparison should succeed
      expect(result.current.error).not.toBeNull();
      expect(result.current.comparisonData.length).toBeGreaterThan(0);

      // Reset and retry
      server.resetHandlers();

      act(() => {
        result.current.fetchDataForRange(dateRange);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should recover from error
      expect(result.current.error).toBeNull();
      expect(result.current.historicalData.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup properly', () => {
      const { result, unmount } = renderHook(() => useAnalyticsStore());

      // Perform some operations
      act(() => {
        result.current.setSelectedFuels(['premium']);
        result.current.setOptimizedMode(false);
      });

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle large datasets without memory issues', async () => {
      const { result } = renderHook(() => useAnalyticsStore());

      // Generate very large dataset
      const largeData = generateHistoricalData(10000);

      // This should not cause memory issues
      const optimizedData = result.current.getOptimizedData(largeData);
      
      expect(optimizedData.length).toBeLessThan(1000); // Should be heavily decimated
      expect(optimizedData.length).toBeGreaterThan(0);
    });
  });
});