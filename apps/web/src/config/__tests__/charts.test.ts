import { describe, it, expect } from 'vitest';
import {
  CHART_CONFIG,
  DATE_PRESETS,
  FUEL_COLORS,
  getFuelColor,
  getChartHeight,
  getAnimationConfig,
  getMargins,
} from '../charts';
import type { FuelType } from '../../types/charts';

describe('Chart Configuration', () => {
  describe('CHART_CONFIG', () => {
    it('should have all required color properties', () => {
      expect(CHART_CONFIG.colors).toBeDefined();
      expect(CHART_CONFIG.colors.regular).toBe('#10B981');
      expect(CHART_CONFIG.colors.premium).toBe('#F59E0B');
      expect(CHART_CONFIG.colors.diesel).toBe('#3B82F6');
      expect(CHART_CONFIG.colors.market).toBe('#6B7280');
      expect(CHART_CONFIG.colors.positive).toBe('#10B981');
      expect(CHART_CONFIG.colors.negative).toBe('#EF4444');
    });

    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      
      Object.values(CHART_CONFIG.colors).forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have animation configuration', () => {
      expect(CHART_CONFIG.animations).toBeDefined();
      expect(CHART_CONFIG.animations.duration).toBe(300);
      expect(CHART_CONFIG.animations.easing).toBe('ease-in-out');
    });

    it('should have margin configuration', () => {
      expect(CHART_CONFIG.margins).toBeDefined();
      expect(CHART_CONFIG.margins.top).toBe(20);
      expect(CHART_CONFIG.margins.right).toBe(30);
      expect(CHART_CONFIG.margins.bottom).toBe(40);
      expect(CHART_CONFIG.margins.left).toBe(60);
    });

    it('should have responsive configuration', () => {
      expect(CHART_CONFIG.responsive).toBeDefined();
      expect(CHART_CONFIG.responsive.mobile.height).toBe(300);
      expect(CHART_CONFIG.responsive.tablet.height).toBe(400);
      expect(CHART_CONFIG.responsive.desktop.height).toBe(500);
    });
  });

  describe('DATE_PRESETS', () => {
    it('should have all required presets', () => {
      expect(DATE_PRESETS['7d']).toBeDefined();
      expect(DATE_PRESETS['15d']).toBeDefined();
      expect(DATE_PRESETS['30d']).toBeDefined();
    });

    it('should have correct labels', () => {
      expect(DATE_PRESETS['7d'].label).toBe('7 días');
      expect(DATE_PRESETS['15d'].label).toBe('15 días');
      expect(DATE_PRESETS['30d'].label).toBe('30 días');
    });

    it('should generate correct date ranges', () => {
      const now = new Date();
      const sevenDayRange = DATE_PRESETS['7d'].getDates();
      
      expect(sevenDayRange.startDate).toBeInstanceOf(Date);
      expect(sevenDayRange.endDate).toBeInstanceOf(Date);
      expect(sevenDayRange.endDate.getTime()).toBeGreaterThan(sevenDayRange.startDate.getTime());
      
      const daysDiff = Math.ceil(
        (sevenDayRange.endDate.getTime() - sevenDayRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(7);
    });

    it('should generate different ranges for different presets', () => {
      const sevenDay = DATE_PRESETS['7d'].getDates();
      const fifteenDay = DATE_PRESETS['15d'].getDates();
      const thirtyDay = DATE_PRESETS['30d'].getDates();
      
      expect(sevenDay.startDate.getTime()).toBeGreaterThan(fifteenDay.startDate.getTime());
      expect(fifteenDay.startDate.getTime()).toBeGreaterThan(thirtyDay.startDate.getTime());
    });
  });

  describe('FUEL_COLORS', () => {
    it('should have colors for all fuel types', () => {
      expect(FUEL_COLORS.regular).toBeDefined();
      expect(FUEL_COLORS.premium).toBeDefined();
      expect(FUEL_COLORS.diesel).toBeDefined();
    });

    it('should match CHART_CONFIG colors', () => {
      expect(FUEL_COLORS.regular).toBe(CHART_CONFIG.colors.regular);
      expect(FUEL_COLORS.premium).toBe(CHART_CONFIG.colors.premium);
      expect(FUEL_COLORS.diesel).toBe(CHART_CONFIG.colors.diesel);
    });
  });

  describe('getFuelColor', () => {
    it('should return correct color for valid fuel types', () => {
      expect(getFuelColor('regular')).toBe('#10B981');
      expect(getFuelColor('premium')).toBe('#F59E0B');
      expect(getFuelColor('diesel')).toBe('#3B82F6');
    });

    it('should return default color for invalid fuel type', () => {
      expect(getFuelColor('invalid' as FuelType)).toBe('#6B7280'); // market color as default
    });

    it('should handle undefined input', () => {
      expect(getFuelColor(undefined as any)).toBe('#6B7280');
    });

    it('should handle null input', () => {
      expect(getFuelColor(null as any)).toBe('#6B7280');
    });
  });

  describe('getChartHeight', () => {
    // Mock window.innerWidth
    const mockInnerWidth = (width: number) => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      });
    };

    it('should return mobile height for small screens', () => {
      mockInnerWidth(500);
      expect(getChartHeight()).toBe(300);
    });

    it('should return tablet height for medium screens', () => {
      mockInnerWidth(800);
      expect(getChartHeight()).toBe(400);
    });

    it('should return desktop height for large screens', () => {
      mockInnerWidth(1200);
      expect(getChartHeight()).toBe(500);
    });

    it('should handle edge cases at breakpoints', () => {
      mockInnerWidth(768); // Exactly at mobile/tablet boundary
      expect(getChartHeight()).toBe(400);
      
      mockInnerWidth(1024); // Exactly at tablet/desktop boundary
      expect(getChartHeight()).toBe(500);
    });

    it('should accept custom breakpoints', () => {
      expect(getChartHeight({ mobile: 768, desktop: 1200 })).toBeDefined();
    });
  });

  describe('getAnimationConfig', () => {
    it('should return default animation config', () => {
      const config = getAnimationConfig();
      expect(config.duration).toBe(300);
      expect(config.easing).toBe('ease-in-out');
    });

    it('should allow custom duration', () => {
      const config = getAnimationConfig({ duration: 500 });
      expect(config.duration).toBe(500);
      expect(config.easing).toBe('ease-in-out'); // Should keep default easing
    });

    it('should allow custom easing', () => {
      const config = getAnimationConfig({ easing: 'ease-out' });
      expect(config.duration).toBe(300); // Should keep default duration
      expect(config.easing).toBe('ease-out');
    });

    it('should allow both custom duration and easing', () => {
      const config = getAnimationConfig({ duration: 1000, easing: 'linear' });
      expect(config.duration).toBe(1000);
      expect(config.easing).toBe('linear');
    });

    it('should handle disabled animations', () => {
      const config = getAnimationConfig({ duration: 0 });
      expect(config.duration).toBe(0);
    });
  });

  describe('getMargins', () => {
    it('should return default margins', () => {
      const margins = getMargins();
      expect(margins.top).toBe(20);
      expect(margins.right).toBe(30);
      expect(margins.bottom).toBe(40);
      expect(margins.left).toBe(60);
    });

    it('should allow custom margins', () => {
      const margins = getMargins({ top: 10, left: 80 });
      expect(margins.top).toBe(10);
      expect(margins.right).toBe(30); // Default
      expect(margins.bottom).toBe(40); // Default
      expect(margins.left).toBe(80);
    });

    it('should handle zero margins', () => {
      const margins = getMargins({ top: 0, right: 0, bottom: 0, left: 0 });
      expect(margins.top).toBe(0);
      expect(margins.right).toBe(0);
      expect(margins.bottom).toBe(0);
      expect(margins.left).toBe(0);
    });

    it('should handle negative margins', () => {
      const margins = getMargins({ top: -5 });
      expect(margins.top).toBe(-5); // Should allow negative values
    });
  });

  describe('Configuration Integration', () => {
    it('should have consistent color scheme across configurations', () => {
      // Positive and regular should use same green
      expect(CHART_CONFIG.colors.positive).toBe(CHART_CONFIG.colors.regular);
      
      // Market color should be distinct from fuel colors
      expect(CHART_CONFIG.colors.market).not.toBe(CHART_CONFIG.colors.regular);
      expect(CHART_CONFIG.colors.market).not.toBe(CHART_CONFIG.colors.premium);
      expect(CHART_CONFIG.colors.market).not.toBe(CHART_CONFIG.colors.diesel);
    });

    it('should have reasonable default values', () => {
      // Animation duration should be fast enough for good UX
      expect(CHART_CONFIG.animations.duration).toBeLessThanOrEqual(500);
      
      // Chart heights should be reasonable for different screen sizes
      expect(CHART_CONFIG.responsive.mobile.height).toBeGreaterThanOrEqual(200);
      expect(CHART_CONFIG.responsive.desktop.height).toBeLessThanOrEqual(800);
      
      // Margins should provide adequate spacing
      expect(CHART_CONFIG.margins.left).toBeGreaterThanOrEqual(40); // Space for Y-axis labels
      expect(CHART_CONFIG.margins.bottom).toBeGreaterThanOrEqual(30); // Space for X-axis labels
    });

    it('should maintain accessibility contrast ratios', () => {
      // Colors should be sufficiently different for accessibility
      const colors = Object.values(FUEL_COLORS);
      
      // All colors should be different
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
      
      // Should not use pure black or pure white
      colors.forEach(color => {
        expect(color.toLowerCase()).not.toBe('#000000');
        expect(color.toLowerCase()).not.toBe('#ffffff');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should provide appropriate sizing for different devices', () => {
      const { mobile, tablet, desktop } = CHART_CONFIG.responsive;
      
      expect(mobile.height).toBeLessThan(tablet.height);
      expect(tablet.height).toBeLessThan(desktop.height);
      
      // Heights should be reasonable for their respective screen sizes
      expect(mobile.height).toBeGreaterThanOrEqual(250);
      expect(desktop.height).toBeLessThanOrEqual(600);
    });

    it('should scale appropriately with screen size', () => {
      const originalWidth = window.innerWidth;
      
      try {
        // Test various screen sizes
        const testSizes = [320, 480, 768, 1024, 1440, 1920];
        const heights = testSizes.map(width => {
          Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
          return getChartHeight();
        });
        
        // Heights should generally increase with screen size
        for (let i = 1; i < heights.length; i++) {
          expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
        }
      } finally {
        // Restore original width
        Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
      }
    });
  });

  describe('Performance Considerations', () => {
    it('should have reasonable animation duration for performance', () => {
      const config = getAnimationConfig();
      
      // Animation should be fast enough not to feel sluggish
      expect(config.duration).toBeLessThanOrEqual(500);
      
      // But long enough to be perceptible
      expect(config.duration).toBeGreaterThanOrEqual(150);
    });

    it('should allow disabling animations for performance', () => {
      const noAnimConfig = getAnimationConfig({ duration: 0 });
      expect(noAnimConfig.duration).toBe(0);
    });
  });

  describe('Theme Consistency', () => {
    it('should use semantic color naming', () => {
      expect(CHART_CONFIG.colors.positive).toBeDefined();
      expect(CHART_CONFIG.colors.negative).toBeDefined();
      
      // Positive should be green-ish, negative should be red-ish
      expect(CHART_CONFIG.colors.positive.toLowerCase()).toMatch(/#[0-9a-f]*[1-9a-f][0-9a-f]*[8-9a-f][0-9a-f]*/);
      expect(CHART_CONFIG.colors.negative.toLowerCase()).toMatch(/#[e-f][0-9a-f]*4[0-9a-f]*4[0-9a-f]*/);
    });

    it('should maintain visual hierarchy', () => {
      // Market color should be more muted than fuel colors for proper hierarchy
      const marketColor = CHART_CONFIG.colors.market;
      expect(marketColor).toBe('#6B7280'); // Gray color, visually secondary
    });
  });
});