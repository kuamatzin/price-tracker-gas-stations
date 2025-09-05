import { describe, it, expect } from 'vitest';
import {
  calculatePriceCompetitiveness,
  getPriceColorClass,
  calculateMarketPosition,
  calculatePercentile,
  detectPriceOutliers,
  getPriceRanking,
  calculatePriceTrend,
} from '@/utils/priceComparison';

describe('priceComparison', () => {
  describe('calculatePriceCompetitiveness', () => {
    it('returns competitive for price below market average by more than 2%', () => {
      const result = calculatePriceCompetitiveness(22.00, 23.00);
      expect(result).toBe('competitive');
    });

    it('returns average for price within 2% of market average', () => {
      const result1 = calculatePriceCompetitiveness(23.20, 23.00);
      expect(result1).toBe('average');
      
      const result2 = calculatePriceCompetitiveness(22.80, 23.00);
      expect(result2).toBe('average');
    });

    it('returns expensive for price above market average by more than 2%', () => {
      const result = calculatePriceCompetitiveness(24.00, 23.00);
      expect(result).toBe('expensive');
    });

    it('handles edge cases', () => {
      // Exactly 2% below
      const result1 = calculatePriceCompetitiveness(22.54, 23.00);
      expect(result1).toBe('competitive');
      
      // Exactly 2% above
      const result2 = calculatePriceCompetitiveness(23.46, 23.00);
      expect(result2).toBe('expensive');
    });

    it('handles zero market average', () => {
      const result = calculatePriceCompetitiveness(23.00, 0);
      expect(result).toBe('average'); // Should handle gracefully
    });

    it('handles negative prices', () => {
      const result = calculatePriceCompetitiveness(-1, 23.00);
      expect(result).toBe('competitive'); // Negative is definitely below average
    });
  });

  describe('getPriceColorClass', () => {
    it('returns correct color classes for competitiveness levels', () => {
      expect(getPriceColorClass('competitive')).toEqual({
        text: 'text-green-500',
        bg: 'bg-green-50',
        border: 'border-green-500',
      });
      
      expect(getPriceColorClass('average')).toEqual({
        text: 'text-yellow-500',
        bg: 'bg-yellow-50',
        border: 'border-yellow-500',
      });
      
      expect(getPriceColorClass('expensive')).toEqual({
        text: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-500',
      });
    });

    it('returns default classes for unknown level', () => {
      const result = getPriceColorClass('unknown' as any);
      expect(result).toEqual({
        text: 'text-gray-500',
        bg: 'bg-gray-50',
        border: 'border-gray-500',
      });
    });
  });

  describe('calculateMarketPosition', () => {
    it('calculates correct position in market', () => {
      const prices = [22.00, 22.50, 23.00, 23.50, 24.00];
      
      // Lowest price
      expect(calculateMarketPosition(22.00, prices)).toBe(1);
      
      // Highest price
      expect(calculateMarketPosition(24.00, prices)).toBe(5);
      
      // Middle price
      expect(calculateMarketPosition(23.00, prices)).toBe(3);
    });

    it('handles price not in list', () => {
      const prices = [22.00, 23.00, 24.00];
      
      // Price between existing prices
      expect(calculateMarketPosition(22.50, prices)).toBe(2);
      
      // Price below all
      expect(calculateMarketPosition(21.00, prices)).toBe(1);
      
      // Price above all
      expect(calculateMarketPosition(25.00, prices)).toBe(4);
    });

    it('handles duplicate prices', () => {
      const prices = [22.00, 22.00, 23.00, 23.00, 24.00];
      
      expect(calculateMarketPosition(22.00, prices)).toBe(1);
      expect(calculateMarketPosition(23.00, prices)).toBe(3);
    });

    it('handles empty price list', () => {
      expect(calculateMarketPosition(23.00, [])).toBe(1);
    });

    it('handles single price in list', () => {
      expect(calculateMarketPosition(23.00, [23.00])).toBe(1);
      expect(calculateMarketPosition(24.00, [23.00])).toBe(2);
      expect(calculateMarketPosition(22.00, [23.00])).toBe(1);
    });
  });

  describe('calculatePercentile', () => {
    it('calculates percentile correctly', () => {
      const prices = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
      
      // Lowest price = 0th percentile
      expect(calculatePercentile(20, prices)).toBe(0);
      
      // Highest price = 100th percentile  
      expect(calculatePercentile(30, prices)).toBe(100);
      
      // Middle price ≈ 50th percentile
      expect(calculatePercentile(25, prices)).toBeCloseTo(50, 0);
    });

    it('handles price not in list', () => {
      const prices = [20, 25, 30];
      
      // Price between values
      expect(calculatePercentile(22.5, prices)).toBeCloseTo(33, 0);
      
      // Price below all
      expect(calculatePercentile(15, prices)).toBe(0);
      
      // Price above all
      expect(calculatePercentile(35, prices)).toBe(100);
    });

    it('handles empty list', () => {
      expect(calculatePercentile(25, [])).toBe(50); // Default to middle
    });

    it('handles single value', () => {
      expect(calculatePercentile(25, [25])).toBe(50);
      expect(calculatePercentile(20, [25])).toBe(0);
      expect(calculatePercentile(30, [25])).toBe(100);
    });

    it('rounds to nearest integer', () => {
      const prices = [20, 21, 22, 23, 24];
      const percentile = calculatePercentile(21.5, prices);
      expect(Number.isInteger(percentile)).toBe(true);
    });
  });

  describe('detectPriceOutliers', () => {
    it('detects outliers using IQR method', () => {
      const prices = [20, 21, 22, 23, 24, 25, 26, 27, 28, 40]; // 40 is outlier
      const outliers = detectPriceOutliers(prices);
      
      expect(outliers).toContain(40);
      expect(outliers).not.toContain(25);
    });

    it('handles no outliers', () => {
      const prices = [20, 21, 22, 23, 24, 25];
      const outliers = detectPriceOutliers(prices);
      
      expect(outliers).toHaveLength(0);
    });

    it('detects both high and low outliers', () => {
      const prices = [5, 20, 21, 22, 23, 24, 25, 50]; // 5 and 50 are outliers
      const outliers = detectPriceOutliers(prices);
      
      expect(outliers).toContain(5);
      expect(outliers).toContain(50);
    });

    it('handles small datasets', () => {
      const prices = [20, 21, 22];
      const outliers = detectPriceOutliers(prices);
      
      expect(outliers).toHaveLength(0);
    });

    it('handles empty array', () => {
      const outliers = detectPriceOutliers([]);
      expect(outliers).toHaveLength(0);
    });

    it('uses correct IQR calculation', () => {
      // Dataset where Q1=22, Q3=28, IQR=6
      // Lower fence = 22 - 1.5*6 = 13
      // Upper fence = 28 + 1.5*6 = 37
      const prices = [20, 22, 24, 26, 28, 30, 10, 40];
      const outliers = detectPriceOutliers(prices);
      
      expect(outliers).toContain(10); // Below lower fence
      expect(outliers).toContain(40); // Above upper fence
      expect(outliers).not.toContain(20); // Within range
      expect(outliers).not.toContain(30); // Within range
    });
  });

  describe('getPriceRanking', () => {
    it('ranks prices correctly', () => {
      const prices = [
        { numero: '1', price: 22.00 },
        { numero: '2', price: 23.50 },
        { numero: '3', price: 21.50 },
        { numero: '4', price: 24.00 },
      ];
      
      const ranked = getPriceRanking(prices);
      
      expect(ranked[0]).toEqual({ numero: '3', price: 21.50, rank: 1 });
      expect(ranked[1]).toEqual({ numero: '1', price: 22.00, rank: 2 });
      expect(ranked[2]).toEqual({ numero: '2', price: 23.50, rank: 3 });
      expect(ranked[3]).toEqual({ numero: '4', price: 24.00, rank: 4 });
    });

    it('handles tied prices', () => {
      const prices = [
        { numero: '1', price: 22.00 },
        { numero: '2', price: 22.00 },
        { numero: '3', price: 23.00 },
      ];
      
      const ranked = getPriceRanking(prices);
      
      // Both stations with price 22.00 should have rank 1
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(3); // Next rank after tie
    });

    it('handles empty array', () => {
      const ranked = getPriceRanking([]);
      expect(ranked).toHaveLength(0);
    });

    it('handles single station', () => {
      const prices = [{ numero: '1', price: 22.00 }];
      const ranked = getPriceRanking(prices);
      
      expect(ranked[0].rank).toBe(1);
    });

    it('filters out invalid prices', () => {
      const prices = [
        { numero: '1', price: 22.00 },
        { numero: '2', price: null as any },
        { numero: '3', price: undefined as any },
        { numero: '4', price: 0 },
        { numero: '5', price: 23.00 },
      ];
      
      const ranked = getPriceRanking(prices);
      
      // Should only rank valid prices
      expect(ranked).toHaveLength(2);
      expect(ranked[0].numero).toBe('1');
      expect(ranked[1].numero).toBe('5');
    });
  });

  describe('calculatePriceTrend', () => {
    it('calculates upward trend', () => {
      const trend = calculatePriceTrend(23.50, 22.00);
      
      expect(trend.direction).toBe('up');
      expect(trend.percentage).toBeCloseTo(6.82, 1);
      expect(trend.arrow).toBe('↑');
      expect(trend.color).toBe('text-red-500');
    });

    it('calculates downward trend', () => {
      const trend = calculatePriceTrend(22.00, 23.50);
      
      expect(trend.direction).toBe('down');
      expect(trend.percentage).toBeCloseTo(6.38, 1);
      expect(trend.arrow).toBe('↓');
      expect(trend.color).toBe('text-green-500');
    });

    it('calculates neutral trend', () => {
      const trend = calculatePriceTrend(22.00, 22.00);
      
      expect(trend.direction).toBe('neutral');
      expect(trend.percentage).toBe(0);
      expect(trend.arrow).toBe('→');
      expect(trend.color).toBe('text-gray-500');
    });

    it('handles very small changes as neutral', () => {
      const trend = calculatePriceTrend(22.001, 22.000);
      
      expect(trend.direction).toBe('neutral');
      expect(trend.percentage).toBeCloseTo(0, 1);
    });

    it('handles missing previous price', () => {
      const trend = calculatePriceTrend(22.00, null as any);
      
      expect(trend.direction).toBe('neutral');
      expect(trend.percentage).toBe(0);
      expect(trend.arrow).toBe('→');
    });

    it('handles zero previous price', () => {
      const trend = calculatePriceTrend(22.00, 0);
      
      expect(trend.direction).toBe('up');
      expect(trend.percentage).toBe(100); // Infinity handled as 100%
    });

    it('formats percentage to 2 decimal places', () => {
      const trend = calculatePriceTrend(22.567, 22.123);
      
      const percentageString = trend.percentage.toFixed(2);
      expect(percentageString).toMatch(/^\d+\.\d{2}$/);
    });
  });
});