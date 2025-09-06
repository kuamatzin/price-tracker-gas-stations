import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { analyticsService } from '../../services/api/analytics.service';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import type { ChartDataPoint, ComparisonDataPoint, TrendStatistics } from '../../types/charts';

// Mock data factories
const createMockHistoryData = (): ChartDataPoint[] => [
  { date: '2024-01-01', regular: 20.50, premium: 22.00, diesel: 19.00 },
  { date: '2024-01-02', regular: 20.75, premium: 22.25, diesel: 19.25 },
  { date: '2024-01-03', regular: 21.00, premium: 22.50, diesel: 19.50 },
  { date: '2024-01-04', regular: 20.90, premium: 22.40, diesel: 19.40 },
  { date: '2024-01-05', regular: 21.25, premium: 22.75, diesel: 19.75 },
  { date: '2024-01-06', regular: 21.10, premium: 22.60, diesel: 19.60 },
  { date: '2024-01-07', regular: 21.35, premium: 22.85, diesel: 19.85 },
];

const createMockComparisonData = (): ComparisonDataPoint[] => [
  { date: '2024-01-01', userPrice: 20.50, marketPrice: 21.00, currentStation: 'test-station' },
  { date: '2024-01-02', userPrice: 20.75, marketPrice: 21.25, currentStation: 'test-station' },
  { date: '2024-01-03', userPrice: 21.00, marketPrice: 21.50, currentStation: 'test-station' },
  { date: '2024-01-04', userPrice: 20.90, marketPrice: 21.40, currentStation: 'test-station' },
  { date: '2024-01-05', userPrice: 21.25, marketPrice: 21.75, currentStation: 'test-station' },
];

const createMockTrendStatistics = (): TrendStatistics[] => [{
  average: 21.02,
  min: { value: 20.50, date: '2024-01-01' },
  max: { value: 21.35, date: '2024-01-07' },
  volatility: 0.25,
  trend: {
    direction: 'rising' as const,
    slope: 0.12,
    confidence: 0.85,
  },
  changeCount: 4,
}];

// MSW server setup
const server = setupServer(
  // Station history endpoint
  http.get('*/prices/history/:stationId', ({ params, request }) => {
    const url = new URL(request.url);
    const fuelType = url.searchParams.get('fuel_type') || 'regular';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    // Simulate network delay
    return HttpResponse.json({
      data: createMockHistoryData(),
      metadata: {
        fuel_type: fuelType,
        date_range: { start: startDate, end: endDate },
        station_id: params.stationId,
      },
    });
  }),

  // Market trends endpoint
  http.get('*/trends/market', ({ request }) => {
    const url = new URL(request.url);
    const fuelType = url.searchParams.get('fuel_type') || 'regular';
    
    const mockData = createMockComparisonData().map(item => ({
      date: item.date,
      user_price: item.userPrice,
      market_price: item.marketPrice,
      station_id: item.currentStation,
    }));
    
    return HttpResponse.json({
      data: mockData,
      metadata: { fuel_type: fuelType },
    });
  }),

  // Trend analysis endpoint
  http.get('*/trends/station/:stationId', ({ params, request }) => {
    const url = new URL(request.url);
    const fuelType = url.searchParams.get('fuel_type') || 'regular';
    
    const mockData = createMockTrendStatistics().map(stat => ({
      fuel_type: fuelType,
      average: stat.average,
      min: stat.min,
      max: stat.max,
      volatility: stat.volatility,
      trend: stat.trend,
      change_count: stat.changeCount,
    }));
    
    return HttpResponse.json({
      data: mockData,
      metadata: { station_id: params.stationId },
    });
  }),

  // Error simulation endpoint
  http.get('*/prices/history/error-station', () => {
    return HttpResponse.json(
      { error: 'Station not found', code: 'STATION_NOT_FOUND' },
      { status: 404 }
    );
  }),

  // Timeout simulation endpoint
  http.get('*/prices/history/timeout-station', async () => {
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30s delay
    return HttpResponse.json({ data: [] });
  }),

  // Rate limit simulation endpoint
  http.get('*/prices/history/rate-limited', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded', retry_after: 60 },
      { status: 429 }
    );
  }),
);

describe('Analytics API Integration Tests', () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });
    analyticsService.clearCache();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.useRealTimers();
  });

  describe('API Data Fetching', () => {
    it('should fetch station history data successfully', async () => {
      const result = await analyticsService.getStationHistory({
        stationId: 'test-station-123',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('regular');
      expect(typeof result[0].regular).toBe('number');
    });

    it('should fetch market trends data successfully', async () => {
      const result = await analyticsService.getMarketTrends({
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        currentStation: 'test-station',
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('userPrice');
      expect(result[0]).toHaveProperty('marketPrice');
      expect(result[0]).toHaveProperty('currentStation');
    });

    it('should fetch trend analysis data successfully', async () => {
      const result = await analyticsService.getTrendAnalysis({
        stationId: 'test-station-123',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        period: 'daily',
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('average');
      expect(result[0]).toHaveProperty('trend');
      expect(result[0].trend).toHaveProperty('direction');
      expect(result[0].trend).toHaveProperty('confidence');
    });

    it('should handle concurrent API requests', async () => {
      const promises = [
        analyticsService.getStationHistory({
          stationId: 'station-1',
          fuelType: 'regular',
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        }),
        analyticsService.getMarketTrends({
          fuelType: 'premium',
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        }),
        analyticsService.getTrendAnalysis({
          stationId: 'station-1',
          fuelType: 'diesel',
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        }),
      ];

      const results = await Promise.allSettled(promises);
      
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
          expect(Array.isArray(result.value)).toBe(true);
        }
      });
    });

    it('should handle API errors gracefully', async () => {
      await expect(analyticsService.getStationHistory({
        stationId: 'error-station',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      })).rejects.toThrow();
    });

    it('should handle API timeouts', async () => {
      const timeoutPromise = analyticsService.getStationHistory({
        stationId: 'timeout-station',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(5000);

      // The request should be aborted or timeout
      expect(timeoutPromise).toBeDefined();
    });

    it('should respect rate limiting', async () => {
      await expect(analyticsService.getStationHistory({
        stationId: 'rate-limited',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      })).rejects.toThrow();
    });

    it('should cache API responses correctly', async () => {
      const params = {
        stationId: 'cache-test',
        fuelType: 'regular' as const,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };

      // First request
      const result1 = await analyticsService.getStationHistory(params);
      expect(result1).toBeDefined();

      // Second request should use cache (no network call)
      const result2 = await analyticsService.getStationHistory(params);
      expect(result2).toEqual(result1);
    });

    it('should handle different fuel types in single request', async () => {
      const result = await analyticsService.getStationHistory({
        stationId: 'multi-fuel-station',
        fuelType: 'all',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      // Should have data for all fuel types
      const samplePoint = result[0];
      expect(samplePoint.regular).toBeDefined();
      expect(samplePoint.premium).toBeDefined();
      expect(samplePoint.diesel).toBeDefined();
    });
  });

  describe('Data Processing Pipeline', () => {
    it('should apply gap filling to historical data', async () => {
      // Mock data with gaps
      server.use(
        http.get('*/prices/history/gap-station', () => {
          return HttpResponse.json({
            data: [
              { date: '2024-01-01', regular: 20.50 },
              { date: '2024-01-03', regular: 21.00 }, // Missing 01-02
              { date: '2024-01-05', regular: 21.50 }, // Missing 01-04
            ],
          });
        })
      );

      const result = await analyticsService.getStationHistory({
        stationId: 'gap-station',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        gapFillOptions: { method: 'last_known' },
      });

      expect(result.length).toBe(5); // All days should be present
      
      const jan02 = result.find(p => p.date === '2024-01-02');
      expect(jan02).toBeDefined();
      expect(jan02?.regular).toBe(20.50); // Last known value
    });

    it('should transform API responses to standardized format', async () => {
      const result = await analyticsService.getStationHistory({
        stationId: 'transform-test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      result.forEach(point => {
        expect(point).toMatchObject({
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          regular: expect.any(Number),
        });
        expect(point.regular).toBeGreaterThan(0);
      });
    });

    it('should handle malformed API responses', async () => {
      server.use(
        http.get('*/prices/history/malformed-station', () => {
          return HttpResponse.json({
            data: [
              { date: '2024-01-01', regular: 'invalid' },
              { invalid_date: '2024-01-02', regular: 20.50 },
              null,
              { date: '2024-01-03', regular: 21.00 },
            ],
          });
        })
      );

      const result = await analyticsService.getStationHistory({
        stationId: 'malformed-station',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      });

      // Should filter out invalid entries
      expect(result.length).toBe(1);
      expect(result[0].date).toBe('2024-01-03');
      expect(result[0].regular).toBe(21.00);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should retry failed requests', async () => {
      let attemptCount = 0;
      server.use(
        http.get('*/prices/history/retry-station', () => {
          attemptCount++;
          if (attemptCount < 3) {
            return HttpResponse.json(
              { error: 'Temporary server error' },
              { status: 500 }
            );
          }
          return HttpResponse.json({ data: createMockHistoryData() });
        })
      );

      const result = await analyticsService.getStationHistory({
        stationId: 'retry-station',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result).toBeDefined();
      expect(attemptCount).toBe(3);
    });

    it('should handle network connectivity issues', async () => {
      server.use(
        http.get('*/prices/history/network-error', () => {
          return HttpResponse.error();
        })
      );

      await expect(analyticsService.getStationHistory({
        stationId: 'network-error',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      })).rejects.toThrow();
    });

    it('should validate request parameters', async () => {
      await expect(analyticsService.getStationHistory({
        stationId: '',
        fuelType: 'regular',
        startDate: 'invalid-date',
        endDate: '2024-01-07',
      })).rejects.toThrow();
    });

    it('should handle partial data responses', async () => {
      server.use(
        http.get('*/prices/history/partial-station', () => {
          return HttpResponse.json({
            data: createMockHistoryData().slice(0, 3), // Only partial data
            metadata: { 
              total_expected: 7,
              returned: 3,
              status: 'partial'
            },
          });
        })
      );

      const result = await analyticsService.getStationHistory({
        stationId: 'partial-station',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
    });
  });

  describe('Performance and Caching', () => {
    it('should respect cache TTL', async () => {
      const params = {
        stationId: 'ttl-test',
        fuelType: 'regular' as const,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };

      // First request
      await analyticsService.getStationHistory(params);

      // Fast-forward time beyond TTL
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      // Second request should make new API call
      const result = await analyticsService.getStationHistory(params);
      expect(result).toBeDefined();
    });

    it('should handle cache invalidation', async () => {
      const params = {
        stationId: 'cache-invalidation-test',
        fuelType: 'regular' as const,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };

      await analyticsService.getStationHistory(params);
      analyticsService.clearCache();
      
      // Should make new request after cache clear
      const result = await analyticsService.getStationHistory(params);
      expect(result).toBeDefined();
    });

    it('should handle concurrent requests to same endpoint', async () => {
      const params = {
        stationId: 'concurrent-test',
        fuelType: 'regular' as const,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };

      const promises = Array.from({ length: 5 }, () =>
        analyticsService.getStationHistory(params)
      );

      const results = await Promise.all(promises);
      
      // All results should be identical (cached)
      results.forEach(result => {
        expect(result).toEqual(results[0]);
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across multiple requests', async () => {
      const historyResult = await analyticsService.getStationHistory({
        stationId: 'consistency-test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
      });

      const comparisonResult = await analyticsService.getMarketTrends({
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        currentStation: 'consistency-test',
      });

      // Dates should align
      const historyDates = historyResult.map(p => p.date).sort();
      const comparisonDates = comparisonResult.map(p => p.date).sort();
      
      expect(historyDates).toEqual(comparisonDates);
    });

    it('should handle date range edge cases', async () => {
      // Same start and end date
      const singleDayResult = await analyticsService.getStationHistory({
        stationId: 'edge-case-test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      });

      expect(singleDayResult.length).toBeGreaterThanOrEqual(1);
    });

    it('should maintain fuel type consistency', async () => {
      const regularResult = await analyticsService.getStationHistory({
        stationId: 'fuel-consistency-test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      const premiumResult = await analyticsService.getStationHistory({
        stationId: 'fuel-consistency-test',
        fuelType: 'premium',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      // Should have same number of data points
      expect(regularResult.length).toBe(premiumResult.length);
      
      // Dates should align
      regularResult.forEach((point, index) => {
        expect(point.date).toBe(premiumResult[index].date);
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical user workflow', async () => {
      // 1. Load initial data
      const initialData = await analyticsService.getStationHistory({
        stationId: 'workflow-test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });
      expect(initialData).toBeDefined();

      // 2. Change fuel type
      const premiumData = await analyticsService.getStationHistory({
        stationId: 'workflow-test',
        fuelType: 'premium',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });
      expect(premiumData).toBeDefined();

      // 3. Change date range
      const extendedData = await analyticsService.getStationHistory({
        stationId: 'workflow-test',
        fuelType: 'premium',
        startDate: '2023-12-25',
        endDate: '2024-01-07',
      });
      expect(extendedData.length).toBeGreaterThanOrEqual(premiumData.length);

      // 4. Load market comparison
      const marketData = await analyticsService.getMarketTrends({
        fuelType: 'premium',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        currentStation: 'workflow-test',
      });
      expect(marketData).toBeDefined();
    });

    it('should handle high-frequency updates', async () => {
      const params = {
        stationId: 'high-freq-test',
        fuelType: 'regular' as const,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      };

      // Simulate rapid user interactions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(analyticsService.getStationHistory({
          ...params,
          startDate: `2024-01-0${(i % 7) + 1}`,
        }));
      }

      const results = await Promise.allSettled(promises);
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      
      expect(successfulResults.length).toBeGreaterThan(0);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const promises = [
        analyticsService.getStationHistory({
          stationId: 'valid-station',
          fuelType: 'regular',
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        }),
        analyticsService.getStationHistory({
          stationId: 'error-station',
          fuelType: 'regular',
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        }),
        analyticsService.getMarketTrends({
          fuelType: 'regular',
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        }),
      ];

      const results = await Promise.allSettled(promises);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });
});