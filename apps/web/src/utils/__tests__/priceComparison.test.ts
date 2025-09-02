import { describe, it, expect } from 'vitest';
import {
  calculatePriceCompetitiveness,
  calculatePriceTrend,
  calculateMarketPosition,
  calculatePriceRanking,
  calculateStationCompetitiveness,
  getOverallStationCompetitiveness,
  getCompetitivenessColor,
  getCompetitivenessBgColor,
  formatPriceDifference,
  getCompetitivenessDescription,
  DEFAULT_THRESHOLDS,
  type CompetitivenessLevel,
} from '../priceComparison';

describe('priceComparison', () => {
  describe('calculatePriceCompetitiveness', () => {
    it('should classify competitive prices correctly', () => {
      const result = calculatePriceCompetitiveness(20, 22); // 9.09% below average
      expect(result.level).toBe('competitive');
      expect(result.percentageDifference).toBeCloseTo(-9.09, 2);
      expect(result.absoluteDifference).toBe(-2);
      expect(result.isSignificant).toBe(true);
    });

    it('should classify expensive prices correctly', () => {
      const result = calculatePriceCompetitiveness(25, 22); // 13.64% above average
      expect(result.level).toBe('expensive');
      expect(result.percentageDifference).toBeCloseTo(13.64, 2);
      expect(result.absoluteDifference).toBe(3);
      expect(result.isSignificant).toBe(true);
    });

    it('should classify average prices correctly', () => {
      const result = calculatePriceCompetitiveness(22.2, 22); // 0.91% above average
      expect(result.level).toBe('average');
      expect(result.percentageDifference).toBeCloseTo(0.91, 2);
      expect(result.isSignificant).toBe(true);
    });

    it('should handle zero or negative prices', () => {
      const result1 = calculatePriceCompetitiveness(0, 22);
      expect(result1.level).toBe('average');
      expect(result1.isSignificant).toBe(false);

      const result2 = calculatePriceCompetitiveness(22, 0);
      expect(result2.level).toBe('average');
      expect(result2.isSignificant).toBe(false);
    });

    it('should use custom thresholds', () => {
      const customThresholds = { competitive: 5, expensive: 5, significantChange: 1 };
      const result = calculatePriceCompetitiveness(21, 22, customThresholds); // 4.55% below
      expect(result.level).toBe('average'); // Should be average with 5% threshold
    });
  });

  describe('calculatePriceTrend', () => {
    it('should detect upward trend', () => {
      const result = calculatePriceTrend(22, 20); // 10% increase
      expect(result.direction).toBe('up');
      expect(result.change).toBe(2);
      expect(result.changePercentage).toBe(10);
      expect(result.isSignificant).toBe(true);
    });

    it('should detect downward trend', () => {
      const result = calculatePriceTrend(20, 22); // 9.09% decrease
      expect(result.direction).toBe('down');
      expect(result.change).toBe(-2);
      expect(result.changePercentage).toBeCloseTo(-9.09, 2);
      expect(result.isSignificant).toBe(true);
    });

    it('should detect stable prices', () => {
      const result = calculatePriceTrend(22, 22.1); // 0.45% change
      expect(result.direction).toBe('stable');
      expect(result.isSignificant).toBe(false);
    });

    it('should handle zero prices', () => {
      const result = calculatePriceTrend(0, 22);
      expect(result.direction).toBe('stable');
      expect(result.change).toBe(0);
      expect(result.isSignificant).toBe(false);
    });
  });

  describe('calculateMarketPosition', () => {
    it('should calculate correct ranking', () => {
      const competitorPrices = [20, 22, 24, 26, 28];
      const result = calculateMarketPosition(23, competitorPrices);
      
      expect(result.totalStations).toBe(6);
      expect(result.rank).toBe(4); // 23 is the 4th lowest price
      expect(result.betterThan).toBe(3); // 3 stations have lower prices
      expect(result.worseThan).toBe(2); // 2 stations have higher prices
    });

    it('should handle single price', () => {
      const result = calculateMarketPosition(22, []);
      expect(result.totalStations).toBe(1);
      expect(result.rank).toBe(1);
      expect(result.percentile).toBe(50);
    });

    it('should handle best price', () => {
      const competitorPrices = [22, 24, 26, 28];
      const result = calculateMarketPosition(20, competitorPrices);
      
      expect(result.rank).toBe(1);
      expect(result.betterThan).toBe(0);
      expect(result.worseThan).toBe(4);
      expect(result.percentile).toBe(100);
    });

    it('should handle worst price', () => {
      const competitorPrices = [20, 22, 24, 26];
      const result = calculateMarketPosition(30, competitorPrices);
      
      expect(result.rank).toBe(5);
      expect(result.betterThan).toBe(4);
      expect(result.worseThan).toBe(0);
      expect(result.percentile).toBe(0);
    });
  });

  describe('calculatePriceRanking', () => {
    const samplePrices = [
      { price: 20, stationId: 'A' },
      { price: 22, stationId: 'B' },
      { price: 24, stationId: 'C' },
      { price: 26, stationId: 'D' },
      { price: 28, stationId: 'E' },
    ];

    it('should calculate correct statistics', () => {
      const result = calculatePriceRanking(samplePrices, 'regular');
      
      expect(result.cheapest).toEqual({ price: 20, stationId: 'A' });
      expect(result.mostExpensive).toEqual({ price: 28, stationId: 'E' });
      expect(result.average).toBe(24);
      expect(result.median).toBe(24);
      expect(result.priceRange).toBe(8);
      expect(result.standardDeviation).toBeCloseTo(2.83, 2);
    });

    it('should handle empty array', () => {
      const result = calculatePriceRanking([], 'regular');
      expect(result.cheapest.price).toBe(0);
      expect(result.average).toBe(0);
      expect(result.median).toBe(0);
    });

    it('should filter out invalid prices', () => {
      const pricesWithZeros = [
        { price: 0, stationId: 'A' },
        { price: 22, stationId: 'B' },
        { price: -5, stationId: 'C' },
        { price: 26, stationId: 'D' },
      ];
      
      const result = calculatePriceRanking(pricesWithZeros, 'regular');
      expect(result.cheapest).toEqual({ price: 22, stationId: 'B' });
      expect(result.mostExpensive).toEqual({ price: 26, stationId: 'D' });
    });
  });

  describe('calculateStationCompetitiveness', () => {
    it('should calculate competitiveness for all fuel types', () => {
      const stationPrices = { regular: 20, premium: 23, diesel: 22 };
      const marketAverages = { regular: 22, premium: 25, diesel: 24 };
      
      const result = calculateStationCompetitiveness(stationPrices, marketAverages);
      
      expect(result.regular?.level).toBe('competitive');
      expect(result.premium?.level).toBe('competitive');
      expect(result.diesel?.level).toBe('competitive');
    });

    it('should handle missing prices', () => {
      const stationPrices = { regular: 20 };
      const marketAverages = { regular: 22, premium: 25 };
      
      const result = calculateStationCompetitiveness(stationPrices, marketAverages);
      
      expect(result.regular?.level).toBe('competitive');
      expect(result.premium).toBeNull();
      expect(result.diesel).toBeNull();
    });
  });

  describe('getOverallStationCompetitiveness', () => {
    it('should use primary fuel type when available', () => {
      const stationPrices = { regular: 20, premium: 30 };
      const marketAverages = { regular: 22, premium: 25 };
      
      const result = getOverallStationCompetitiveness(stationPrices, marketAverages, 'regular');
      expect(result).toBe('competitive');
    });

    it('should fallback to available fuel type', () => {
      const stationPrices = { premium: 30 };
      const marketAverages = { premium: 25 };
      
      const result = getOverallStationCompetitiveness(stationPrices, marketAverages, 'regular');
      expect(result).toBe('expensive');
    });

    it('should return average when no prices available', () => {
      const result = getOverallStationCompetitiveness({}, {});
      expect(result).toBe('average');
    });
  });

  describe('utility functions', () => {
    describe('getCompetitivenessColor', () => {
      it('should return correct color classes', () => {
        expect(getCompetitivenessColor('competitive')).toContain('green');
        expect(getCompetitivenessColor('average')).toContain('yellow');
        expect(getCompetitivenessColor('expensive')).toContain('red');
      });
    });

    describe('getCompetitivenessBgColor', () => {
      it('should return correct background color classes', () => {
        expect(getCompetitivenessBgColor('competitive')).toContain('green');
        expect(getCompetitivenessBgColor('average')).toContain('yellow');
        expect(getCompetitivenessBgColor('expensive')).toContain('red');
      });
    });

    describe('formatPriceDifference', () => {
      it('should format positive differences', () => {
        const result = formatPriceDifference(2, 10);
        expect(result).toContain('+');
        expect(result).toContain('10.0%');
      });

      it('should format negative differences', () => {
        const result = formatPriceDifference(-2, -10);
        expect(result).toContain('-');
        expect(result).toContain('-10.0%');
      });
    });

    describe('getCompetitivenessDescription', () => {
      it('should return correct descriptions in Spanish', () => {
        const competitiveResult = { level: 'competitive' as CompetitivenessLevel, percentageDifference: -5, absoluteDifference: -1, isSignificant: true };
        const expensiveResult = { level: 'expensive' as CompetitivenessLevel, percentageDifference: 8, absoluteDifference: 2, isSignificant: true };
        const averageResult = { level: 'average' as CompetitivenessLevel, percentageDifference: 1, absoluteDifference: 0.2, isSignificant: false };

        expect(getCompetitivenessDescription(competitiveResult)).toContain('más barato');
        expect(getCompetitivenessDescription(expensiveResult)).toContain('más caro');
        expect(getCompetitivenessDescription(averageResult)).toContain('similar al promedio');
      });
    });
  });

  describe('DEFAULT_THRESHOLDS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_THRESHOLDS.competitive).toBe(2);
      expect(DEFAULT_THRESHOLDS.expensive).toBe(2);
      expect(DEFAULT_THRESHOLDS.significantChange).toBe(0.5);
    });
  });
});