import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { analyticsService } from '../analytics.service';
import { apiClient } from '../client';
import type { ChartDataPoint, ComparisonDataPoint, TrendStatistics } from '../../../types/charts';

// Mock the API client
vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('AnalyticsService', () => {
  const mockApiClient = apiClient as any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    analyticsService.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStationHistory', () => {
    const mockParams = {
      stationId: 'test-station-123',
      fuelType: 'regular' as const,
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      gapFillOptions: { method: 'last_known' as const },
    };

    const mockApiResponse = {
      data: [
        { date: '2024-01-01', regular: 20.50 },
        { date: '2024-01-02', regular: 20.75 },
        { date: '2024-01-04', regular: 21.00 }, // Gap on 01-03
        { date: '2024-01-05', regular: 21.25 },
      ],
    };

    it('should fetch station history successfully', async () => {
      mockApiClient.get.mockResolvedValue(mockApiResponse);

      const result = await analyticsService.getStationHistory(mockParams);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/prices/history/${mockParams.stationId}`,
        {
          params: {
            fuel_type: 'regular',
            start_date: '2024-01-01',
            end_date: '2024-01-07',
            gap_fill: 'last_known',
          },
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('regular');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(analyticsService.getStationHistory(mockParams)).rejects.toThrow('Network error');
    });

    it('should transform API response to ChartDataPoint format', async () => {
      mockApiClient.get.mockResolvedValue(mockApiResponse);

      const result = await analyticsService.getStationHistory(mockParams);

      result.forEach((point: ChartDataPoint) => {
        expect(point).toHaveProperty('date');
        expect(typeof point.date).toBe('string');
        if (point.regular !== undefined) {
          expect(typeof point.regular).toBe('number');
        }
      });
    });

    it('should apply gap filling to time series', async () => {
      const responseWithGaps = {
        data: [
          { date: '2024-01-01', regular: 20.50 },
          { date: '2024-01-03', regular: 21.00 }, // Missing 01-02
          { date: '2024-01-05', regular: 21.50 }, // Missing 01-04
        ],
      };
      mockApiClient.get.mockResolvedValue(responseWithGaps);

      const result = await analyticsService.getStationHistory({
        ...mockParams,
        gapFillOptions: { method: 'last_known' },
      });

      // Should have filled gaps
      expect(result.length).toBeGreaterThan(3);
      
      // Find filled data point
      const filledPoint = result.find(p => p.date === '2024-01-02');
      expect(filledPoint).toBeDefined();
      expect(filledPoint?.regular).toBe(20.50); // Last known value
    });

    it('should cache responses correctly', async () => {
      mockApiClient.get.mockResolvedValue(mockApiResponse);

      // First call
      await analyticsService.getStationHistory(mockParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);

      // Second call with same params - should use cache
      await analyticsService.getStationHistory(mockParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1); // No additional API call

      // Call with different params - should make new API call
      await analyticsService.getStationHistory({ ...mockParams, fuelType: 'premium' });
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle different fuel types', async () => {
      const multiResponse = {
        data: [
          { date: '2024-01-01', regular: 20.50, premium: 22.00, diesel: 19.00 },
          { date: '2024-01-02', regular: 20.75, premium: 22.25, diesel: 19.25 },
        ],
      };
      mockApiClient.get.mockResolvedValue(multiResponse);

      const result = await analyticsService.getStationHistory({
        ...mockParams,
        fuelType: 'all',
      });

      result.forEach((point: ChartDataPoint) => {
        expect(point.regular).toBeDefined();
        expect(point.premium).toBeDefined();
        expect(point.diesel).toBeDefined();
      });
    });
  });

  describe('getMarketTrends', () => {
    const mockParams = {
      entidadId: 'test-state',
      municipioId: 'test-city',
      fuelType: 'regular' as const,
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      currentStation: 'test-station-123',
    };

    const mockMarketResponse = {
      data: [
        { date: '2024-01-01', user_price: 20.50, market_price: 21.00 },
        { date: '2024-01-02', user_price: 20.75, market_price: 21.25 },
        { date: '2024-01-03', user_price: 21.00, market_price: 21.50 },
      ],
    };

    it('should fetch market trends successfully', async () => {
      mockApiClient.get.mockResolvedValue(mockMarketResponse);

      const result = await analyticsService.getMarketTrends(mockParams);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/trends/market',
        {
          params: {
            entidad_id: 'test-state',
            municipio_id: 'test-city',
            fuel_type: 'regular',
            start_date: '2024-01-01',
            end_date: '2024-01-07',
            current_station: 'test-station-123',
          },
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should transform market response to ComparisonDataPoint format', async () => {
      mockApiClient.get.mockResolvedValue(mockMarketResponse);

      const result = await analyticsService.getMarketTrends(mockParams);

      result.forEach((point: ComparisonDataPoint) => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('userPrice');
        expect(point).toHaveProperty('marketPrice');
        expect(point).toHaveProperty('currentStation');
        expect(typeof point.userPrice).toBe('number');
        expect(typeof point.marketPrice).toBe('number');
      });
    });

    it('should handle optional parameters', async () => {
      mockApiClient.get.mockResolvedValue(mockMarketResponse);

      await analyticsService.getMarketTrends({
        fuelType: 'premium',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/trends/market',
        {
          params: {
            fuel_type: 'premium',
            start_date: '2024-01-01',
            end_date: '2024-01-07',
          },
        }
      );
    });
  });

  describe('getTrendAnalysis', () => {
    const mockParams = {
      stationId: 'test-station-123',
      fuelType: 'regular' as const,
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      period: 'daily' as const,
    };

    const mockAnalysisResponse = {
      data: [
        {
          fuel_type: 'regular',
          average: 21.25,
          min: { value: 20.50, date: '2024-01-01' },
          max: { value: 22.00, date: '2024-01-05' },
          volatility: 0.45,
          trend: {
            direction: 'rising',
            slope: 0.15,
            confidence: 0.87,
          },
          change_count: 3,
        },
      ],
    };

    it('should fetch trend analysis successfully', async () => {
      mockApiClient.get.mockResolvedValue(mockAnalysisResponse);

      const result = await analyticsService.getTrendAnalysis(mockParams);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/trends/station/${mockParams.stationId}`,
        {
          params: {
            fuel_type: 'regular',
            start_date: '2024-01-01',
            end_date: '2024-01-07',
            period: 'daily',
          },
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should transform analysis response to TrendStatistics format', async () => {
      mockApiClient.get.mockResolvedValue(mockAnalysisResponse);

      const result = await analyticsService.getTrendAnalysis(mockParams);

      result.forEach((stat: TrendStatistics) => {
        expect(stat).toHaveProperty('average');
        expect(stat).toHaveProperty('min');
        expect(stat).toHaveProperty('max');
        expect(stat).toHaveProperty('volatility');
        expect(stat).toHaveProperty('trend');
        expect(stat.min).toHaveProperty('value');
        expect(stat.min).toHaveProperty('date');
        expect(stat.max).toHaveProperty('value');
        expect(stat.max).toHaveProperty('date');
        expect(stat.trend).toHaveProperty('direction');
        expect(stat.trend).toHaveProperty('slope');
        expect(stat.trend).toHaveProperty('confidence');
      });
    });
  });

  describe('Data Transformation', () => {
    it('should handle missing fuel type data', async () => {
      const partialData = {
        data: [
          { date: '2024-01-01', regular: 20.50 },
          { date: '2024-01-02', premium: 22.00 }, // Missing regular
          { date: '2024-01-03', regular: 20.75, premium: 22.25 },
        ],
      };
      mockApiClient.get.mockResolvedValue(partialData);

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      });

      expect(result).toBeDefined();
      expect(result[1].regular).toBeUndefined(); // Missing data preserved
      expect(result[1].premium).toBe(22.00); // Other fuel types preserved
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = {
        data: [
          { date: '2024-01-01', regular: 'invalid-price' },
          { invalid_date: '2024-01-02', regular: 20.50 },
          null,
          { date: '2024-01-03', regular: 20.75 },
        ],
      };
      mockApiClient.get.mockResolvedValue(malformedResponse);

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      });

      // Should filter out invalid entries and continue processing
      expect(result.length).toBe(1); // Only one valid entry
      expect(result[0].date).toBe('2024-01-03');
      expect(result[0].regular).toBe(20.75);
    });
  });

  describe('Gap Filling', () => {
    const gapData = {
      data: [
        { date: '2024-01-01', regular: 20.00 },
        { date: '2024-01-04', regular: 21.00 }, // 2-day gap
        { date: '2024-01-07', regular: 22.00 }, // 2-day gap
      ],
    };

    it('should fill gaps using last known method', async () => {
      mockApiClient.get.mockResolvedValue(gapData);

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        gapFillOptions: { method: 'last_known' },
      });

      // Should have all 7 days
      expect(result.length).toBe(7);
      
      // Check filled values
      const jan02 = result.find(p => p.date === '2024-01-02');
      const jan03 = result.find(p => p.date === '2024-01-03');
      expect(jan02?.regular).toBe(20.00); // Last known
      expect(jan03?.regular).toBe(20.00); // Last known
    });

    it('should fill gaps using interpolation method', async () => {
      mockApiClient.get.mockResolvedValue(gapData);

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        gapFillOptions: { method: 'interpolation' },
      });

      // Check interpolated values
      const jan02 = result.find(p => p.date === '2024-01-02');
      const jan03 = result.find(p => p.date === '2024-01-03');
      
      // Should be interpolated between 20.00 and 21.00
      expect(jan02?.regular).toBeCloseTo(20.33, 1);
      expect(jan03?.regular).toBeCloseTo(20.67, 1);
    });

    it('should fill gaps using market average method', async () => {
      mockApiClient.get.mockResolvedValue(gapData);

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        gapFillOptions: { method: 'market_average' },
      });

      // Should attempt to use market average (mocked as interpolation fallback)
      expect(result.length).toBe(7);
      
      const filledPoints = result.filter(p => 
        p.date === '2024-01-02' || p.date === '2024-01-03'
      );
      filledPoints.forEach(point => {
        expect(point.regular).toBeGreaterThan(0);
      });
    });

    it('should handle gaps at the beginning of time series', async () => {
      const startGapData = {
        data: [
          { date: '2024-01-03', regular: 21.00 }, // First 2 days missing
          { date: '2024-01-04', regular: 21.25 },
          { date: '2024-01-05', regular: 21.50 },
        ],
      };
      mockApiClient.get.mockResolvedValue(startGapData);

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        gapFillOptions: { method: 'last_known' },
      });

      expect(result.length).toBe(5);
      
      // First gaps should use next known value (reverse fill)
      const jan01 = result.find(p => p.date === '2024-01-01');
      const jan02 = result.find(p => p.date === '2024-01-02');
      expect(jan01?.regular).toBe(21.00); // Forward filled from first available
      expect(jan02?.regular).toBe(21.00); // Forward filled from first available
    });
  });

  describe('Caching', () => {
    const testParams = {
      stationId: 'cache-test',
      fuelType: 'regular' as const,
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    };

    it('should cache responses with TTL', async () => {
      const response = { data: [{ date: '2024-01-01', regular: 20.50 }] };
      mockApiClient.get.mockResolvedValue(response);

      // First call
      const result1 = await analyticsService.getStationHistory(testParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);

      // Second call within TTL
      const result2 = await analyticsService.getStationHistory(testParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1); // Should use cache
      expect(result1).toEqual(result2);
    });

    it('should generate unique cache keys for different parameters', async () => {
      const response = { data: [{ date: '2024-01-01', regular: 20.50 }] };
      mockApiClient.get.mockResolvedValue(response);

      await analyticsService.getStationHistory(testParams);
      await analyticsService.getStationHistory({ ...testParams, fuelType: 'premium' });
      await analyticsService.getStationHistory({ ...testParams, startDate: '2024-01-02' });

      expect(mockApiClient.get).toHaveBeenCalledTimes(3); // Different cache keys
    });

    it('should clear cache correctly', async () => {
      const response = { data: [{ date: '2024-01-01', regular: 20.50 }] };
      mockApiClient.get.mockResolvedValue(response);

      await analyticsService.getStationHistory(testParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);

      analyticsService.clearCache();

      await analyticsService.getStationHistory(testParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(2); // Cache cleared, new API call
    });

    it('should respect cache TTL expiration', async () => {
      // Mock a very short TTL for testing
      const originalTimeout = (analyticsService as any).cacheTimeout;
      (analyticsService as any).cacheTimeout = 10; // 10ms TTL

      const response = { data: [{ date: '2024-01-01', regular: 20.50 }] };
      mockApiClient.get.mockResolvedValue(response);

      await analyticsService.getStationHistory(testParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 15));

      await analyticsService.getStationHistory(testParams);
      expect(mockApiClient.get).toHaveBeenCalledTimes(2); // Cache expired, new API call

      // Restore original timeout
      (analyticsService as any).cacheTimeout = originalTimeout;
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockApiClient.get.mockRejectedValue(new Error('TIMEOUT'));

      await expect(analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      })).rejects.toThrow('TIMEOUT');
    });

    it('should handle 404 errors', async () => {
      mockApiClient.get.mockRejectedValue({ 
        response: { status: 404, data: { message: 'Station not found' } } 
      });

      await expect(analyticsService.getStationHistory({
        stationId: 'nonexistent',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      })).rejects.toMatchObject({
        response: { status: 404 }
      });
    });

    it('should handle invalid parameter validation', async () => {
      // Invalid date format
      await expect(analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: 'invalid-date',
        endDate: '2024-01-07',
      })).rejects.toThrow();
    });

    it('should handle empty API responses gracefully', async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });

      const result = await analyticsService.getStationHistory({
        stationId: 'test',
        fuelType: 'regular',
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result).toEqual([]);
    });
  });
});