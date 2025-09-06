import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateMovingAverage,
  calculateExponentialMovingAverage,
  calculateVolatility,
  performLinearRegression,
  detectTrendDirection,
  performComprehensiveAnalysis,
  analyzeMarketComparison,
  detectSeasonalPatterns,
  analyzeMissingData,
} from '../trendCalculations';
import type { ChartDataPoint, ComparisonDataPoint, DateRange, FuelType } from '../../types/charts';

// Test data factory
const createChartDataPoint = (date: string, regular?: number, premium?: number, diesel?: number): ChartDataPoint => ({
  date,
  regular,
  premium,
  diesel,
});

const createComparisonDataPoint = (
  date: string,
  userPrice: number,
  marketPrice: number,
  currentStation: string = 'test-station'
): ComparisonDataPoint => ({
  date,
  userPrice,
  marketPrice,
  currentStation,
});

describe('trendCalculations', () => {
  let samplePrices: number[];
  let sampleData: ChartDataPoint[];
  let sampleComparisonData: ComparisonDataPoint[];
  let dateRange: DateRange;

  beforeEach(() => {
    samplePrices = [20, 22, 21, 23, 24, 22, 25, 26, 24, 27];
    sampleData = [
      createChartDataPoint('2024-01-01', 20, 22, 19),
      createChartDataPoint('2024-01-02', 22, 24, 21),
      createChartDataPoint('2024-01-03', 21, 23, 20),
      createChartDataPoint('2024-01-04', 23, 25, 22),
      createChartDataPoint('2024-01-05', 24, 26, 23),
    ];
    sampleComparisonData = [
      createComparisonDataPoint('2024-01-01', 20, 21),
      createComparisonDataPoint('2024-01-02', 22, 23),
      createComparisonDataPoint('2024-01-03', 21, 22),
      createComparisonDataPoint('2024-01-04', 23, 24),
      createComparisonDataPoint('2024-01-05', 24, 25),
    ];
    dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-05'),
      preset: '7d',
    };
  });

  describe('calculateMovingAverage', () => {
    it('should calculate simple moving average correctly', () => {
      const result = calculateMovingAverage([10, 20, 30, 40, 50], 3);
      expect(result).toEqual([10, 15, 20, 30, 40]);
    });

    it('should handle single value window', () => {
      const result = calculateMovingAverage([10, 20, 30], 1);
      expect(result).toEqual([10, 20, 30]);
    });

    it('should handle window larger than array', () => {
      const result = calculateMovingAverage([10, 20], 5);
      expect(result).toEqual([10, 15]);
    });

    it('should handle empty array', () => {
      const result = calculateMovingAverage([], 3);
      expect(result).toEqual([]);
    });

    it('should return correct statistics', () => {
      const result = calculateMovingAverage(samplePrices, 3);
      expect(result.length).toBe(samplePrices.length);
      expect(result[0]).toBe(samplePrices[0]); // First value should be unchanged
      expect(result[2]).toBeCloseTo((20 + 22 + 21) / 3, 2); // Third value should be average of first 3
    });
  });

  describe('calculateExponentialMovingAverage', () => {
    it('should calculate EMA correctly', () => {
      const result = calculateExponentialMovingAverage([10, 20, 30, 40], 2);
      expect(result.length).toBe(4);
      expect(result[0]).toBe(10); // First value unchanged
      expect(result[1]).toBeCloseTo(16.67, 1); // EMA calculation
    });

    it('should handle empty array', () => {
      const result = calculateExponentialMovingAverage([], 3);
      expect(result).toEqual([]);
    });

    it('should handle single value', () => {
      const result = calculateExponentialMovingAverage([10], 3);
      expect(result).toEqual([10]);
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate volatility metrics correctly', () => {
      const result = calculateVolatility([10, 15, 12, 18, 14]);
      expect(result.standardDeviation).toBeGreaterThan(0);
      expect(result.coefficientOfVariation).toBeGreaterThan(0);
      expect(result.average).toBe(13.8);
    });

    it('should handle single value', () => {
      const result = calculateVolatility([10]);
      expect(result.standardDeviation).toBe(0);
      expect(result.coefficientOfVariation).toBe(0);
      expect(result.average).toBe(10);
    });

    it('should handle empty array', () => {
      const result = calculateVolatility([]);
      expect(result.standardDeviation).toBe(0);
      expect(result.coefficientOfVariation).toBe(0);
      expect(result.average).toBe(0);
    });

    it('should calculate coefficient of variation correctly', () => {
      const prices = [100, 110, 90, 120, 80]; // Mean = 100, StdDev ≈ 15.81
      const result = calculateVolatility(prices);
      expect(result.coefficientOfVariation).toBeCloseTo(0.158, 2);
    });
  });

  describe('performLinearRegression', () => {
    it('should calculate linear regression correctly', () => {
      const prices = [1, 2, 3, 4, 5]; // Perfect positive correlation
      const result = performLinearRegression(prices);
      expect(result.slope).toBeCloseTo(1, 1);
      expect(result.rSquared).toBeCloseTo(1, 1);
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should handle flat trend', () => {
      const prices = [5, 5, 5, 5, 5]; // No trend
      const result = performLinearRegression(prices);
      expect(result.slope).toBeCloseTo(0, 2);
      expect(result.rSquared).toBe(0);
    });

    it('should handle negative trend', () => {
      const prices = [5, 4, 3, 2, 1]; // Perfect negative correlation
      const result = performLinearRegression(prices);
      expect(result.slope).toBeCloseTo(-1, 1);
      expect(result.rSquared).toBeCloseTo(1, 1);
    });

    it('should handle insufficient data', () => {
      const result = performLinearRegression([]);
      expect(result.slope).toBe(0);
      expect(result.rSquared).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectTrendDirection', () => {
    it('should detect rising trend', () => {
      const result = detectTrendDirection(0.5, 0.8);
      expect(result).toBe('rising');
    });

    it('should detect falling trend', () => {
      const result = detectTrendDirection(-0.5, 0.8);
      expect(result).toBe('falling');
    });

    it('should detect stable trend with low confidence', () => {
      const result = detectTrendDirection(0.1, 0.3);
      expect(result).toBe('stable');
    });

    it('should detect stable trend with small slope', () => {
      const result = detectTrendDirection(0.05, 0.9);
      expect(result).toBe('stable');
    });
  });

  describe('performComprehensiveAnalysis', () => {
    it('should perform comprehensive analysis correctly', () => {
      const result = performComprehensiveAnalysis(sampleData, 'regular', dateRange);
      
      expect(result.summary.average).toBeGreaterThan(0);
      expect(result.summary.min).toBeDefined();
      expect(result.summary.max).toBeDefined();
      expect(result.volatility.standardDeviation).toBeGreaterThan(0);
      expect(result.trend.direction).toMatch(/rising|falling|stable/);
      expect(result.movingAverage.length).toBe(sampleData.length);
    });

    it('should handle data with missing fuel type', () => {
      const dataWithMissing = [
        createChartDataPoint('2024-01-01', undefined, 22, 19),
        createChartDataPoint('2024-01-02', 22, 24, 21),
      ];
      
      const result = performComprehensiveAnalysis(dataWithMissing, 'regular', dateRange);
      expect(result.summary.dataPoints).toBe(1); // Only count non-null values
    });

    it('should handle empty data', () => {
      const result = performComprehensiveAnalysis([], 'regular', dateRange);
      expect(result.summary.average).toBe(0);
      expect(result.volatility.standardDeviation).toBe(0);
      expect(result.trend.direction).toBe('stable');
    });
  });

  describe('analyzeMarketComparison', () => {
    it('should analyze market comparison correctly', () => {
      const result = analyzeMarketComparison(sampleComparisonData, 'regular');
      
      expect(result.averageUserPrice).toBeGreaterThan(0);
      expect(result.averageMarketPrice).toBeGreaterThan(0);
      expect(result.averageDifference).toBeDefined();
      expect(result.advantagePercentage).toBeDefined();
      expect(result.competitivePosition).toMatch(/above_market|below_market|at_market/);
    });

    it('should detect below market position', () => {
      const belowMarketData = [
        createComparisonDataPoint('2024-01-01', 18, 20),
        createComparisonDataPoint('2024-01-02', 19, 21),
      ];
      
      const result = analyzeMarketComparison(belowMarketData, 'regular');
      expect(result.competitivePosition).toBe('below_market');
      expect(result.advantagePercentage).toBeGreaterThan(0);
    });

    it('should detect above market position', () => {
      const aboveMarketData = [
        createComparisonDataPoint('2024-01-01', 22, 20),
        createComparisonDataPoint('2024-01-02', 23, 21),
      ];
      
      const result = analyzeMarketComparison(aboveMarketData, 'regular');
      expect(result.competitivePosition).toBe('above_market');
      expect(result.advantagePercentage).toBeLessThan(0);
    });

    it('should handle empty data', () => {
      const result = analyzeMarketComparison([], 'regular');
      expect(result.averageUserPrice).toBe(0);
      expect(result.averageMarketPrice).toBe(0);
      expect(result.competitivePosition).toBe('at_market');
    });
  });

  describe('detectSeasonalPatterns', () => {
    it('should detect seasonal patterns', () => {
      // Create data with weekly pattern (higher prices on weekends)
      const seasonalData = [
        createChartDataPoint('2024-01-01', 20), // Monday
        createChartDataPoint('2024-01-02', 20), // Tuesday
        createChartDataPoint('2024-01-06', 25), // Saturday
        createChartDataPoint('2024-01-07', 25), // Sunday
        createChartDataPoint('2024-01-08', 20), // Monday
        createChartDataPoint('2024-01-13', 25), // Saturday
        createChartDataPoint('2024-01-14', 25), // Sunday
      ];
      
      const result = detectSeasonalPatterns(seasonalData, 'regular');
      expect(result.length).toBeGreaterThan(0);
      
      const weekendPattern = result.find(p => p.type === 'weekly' && p.pattern.includes('Weekend'));
      expect(weekendPattern).toBeDefined();
    });

    it('should handle insufficient data', () => {
      const result = detectSeasonalPatterns(sampleData, 'regular');
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect monthly patterns', () => {
      const monthlyData: ChartDataPoint[] = [];
      // Create 3 months of data with pattern: higher prices at month start
      for (let month = 1; month <= 3; month++) {
        for (let day = 1; day <= 10; day++) {
          const price = day <= 5 ? 25 : 20; // Higher prices first 5 days
          monthlyData.push(createChartDataPoint(
            `2024-0${month}-${day.toString().padStart(2, '0')}`,
            price
          ));
        }
      }
      
      const result = detectSeasonalPatterns(monthlyData, 'regular');
      const monthlyPattern = result.find(p => p.type === 'monthly');
      expect(monthlyPattern).toBeDefined();
    });
  });

  describe('analyzeMissingData', () => {
    it('should analyze missing data correctly', () => {
      const dataWithGaps = [
        createChartDataPoint('2024-01-01', 20),
        createChartDataPoint('2024-01-02', 21),
        // Missing 2024-01-03
        createChartDataPoint('2024-01-04', 22),
        // Missing 2024-01-05, 2024-01-06
        createChartDataPoint('2024-01-07', 23),
      ];
      
      const result = analyzeMissingData(dataWithGaps, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      });
      
      expect(result.totalExpectedPoints).toBe(7);
      expect(result.actualPoints).toBe(4);
      expect(result.missingPoints).toBe(3);
      expect(result.completenessPercentage).toBeCloseTo(57.14, 1);
      expect(result.gaps.length).toBe(2); // Two gaps identified
    });

    it('should handle complete data', () => {
      const result = analyzeMissingData(sampleData, dateRange);
      expect(result.completenessPercentage).toBe(100);
      expect(result.gaps.length).toBe(0);
    });

    it('should identify gap patterns', () => {
      const dataWithWeekendGaps = [
        createChartDataPoint('2024-01-01', 20), // Monday
        createChartDataPoint('2024-01-02', 21), // Tuesday
        createChartDataPoint('2024-01-03', 22), // Wednesday
        createChartDataPoint('2024-01-04', 23), // Thursday
        createChartDataPoint('2024-01-05', 24), // Friday
        // Missing weekend: Saturday (6th) and Sunday (7th)
        createChartDataPoint('2024-01-08', 25), // Monday
      ];
      
      const result = analyzeMissingData(dataWithWeekendGaps, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-08'),
      });
      
      expect(result.gaps.length).toBe(1);
      expect(result.gaps[0].duration).toBe(2);
      expect(result.gapPattern).toBe('weekend');
    });

    it('should detect random gap pattern', () => {
      const dataWithRandomGaps = [
        createChartDataPoint('2024-01-01', 20),
        // Missing 2024-01-02
        createChartDataPoint('2024-01-03', 22),
        createChartDataPoint('2024-01-04', 23),
        // Missing 2024-01-05
        createChartDataPoint('2024-01-06', 24),
      ];
      
      const result = analyzeMissingData(dataWithRandomGaps, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-06'),
      });
      
      expect(result.gapPattern).toBe('random');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined values gracefully', () => {
      const dataWithNulls = [
        createChartDataPoint('2024-01-01', null as any),
        createChartDataPoint('2024-01-02', undefined as any),
        createChartDataPoint('2024-01-03', 22),
      ];
      
      const result = performComprehensiveAnalysis(dataWithNulls, 'regular', dateRange);
      expect(result.summary.dataPoints).toBe(1);
    });

    it('should handle extreme values', () => {
      const extremeData = [
        createChartDataPoint('2024-01-01', 0.01),
        createChartDataPoint('2024-01-02', 1000000),
        createChartDataPoint('2024-01-03', 22),
      ];
      
      const result = performComprehensiveAnalysis(extremeData, 'regular', dateRange);
      expect(result.volatility.standardDeviation).toBeGreaterThan(0);
      expect(result.summary.average).toBeGreaterThan(0);
    });

    it('should handle very small datasets', () => {
      const smallData = [createChartDataPoint('2024-01-01', 20)];
      
      const result = performComprehensiveAnalysis(smallData, 'regular', dateRange);
      expect(result.summary.average).toBe(20);
      expect(result.volatility.standardDeviation).toBe(0);
      expect(result.trend.direction).toBe('stable');
    });
  });
});