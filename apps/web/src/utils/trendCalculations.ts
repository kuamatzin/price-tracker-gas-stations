import type { ChartDataPoint, FuelType, ComparisonDataPoint } from '../types/charts';

export interface MovingAverageResult {
  value: number;
  date: string;
  period: number;
}

export interface VolatilityResult {
  value: number;
  period: 'daily' | 'weekly' | 'monthly';
  standardDeviation: number;
  coefficient: number; // Coefficient of variation (volatility / mean)
}

export interface TrendResult {
  direction: 'rising' | 'falling' | 'stable';
  slope: number;
  confidence: number; // R-squared value (0-1)
  strength: 'weak' | 'moderate' | 'strong';
}

export interface MarketComparisonResult {
  advantage: 'lower' | 'higher' | 'equal';
  difference: number;
  differencePercent: number;
  avgUserPrice: number;
  avgMarketPrice: number;
  advantageDays: number;
  totalDays: number;
}

export interface SeasonalPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  pattern: Array<{
    period: string | number;
    avgPrice: number;
    deviation: number;
    confidence: number;
  }>;
  strength: number; // 0-1, how strong the seasonal pattern is
}

export interface MissingDataInfo {
  totalPoints: number;
  missingPoints: number;
  missingPercentage: number;
  gaps: Array<{
    start: string;
    end: string;
    duration: number; // days
  }>;
}

/**
 * Calculate simple moving average for a series of prices
 */
export const calculateMovingAverage = (
  prices: number[], 
  window: number
): number[] => {
  if (window <= 0 || window > prices.length) {
    return prices;
  }

  return prices.map((_, index, array) => {
    const start = Math.max(0, index - window + 1);
    const subset = array.slice(start, index + 1);
    return subset.reduce((a, b) => a + b, 0) / subset.length;
  });
};

/**
 * Calculate exponential moving average (EMA) for smoother trending
 */
export const calculateExponentialMovingAverage = (
  prices: number[], 
  window: number
): number[] => {
  if (window <= 0 || prices.length === 0) {
    return prices;
  }

  const multiplier = 2 / (window + 1);
  const result: number[] = [];
  
  // Start with simple average for first value
  result[0] = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    result[i] = (prices[i] * multiplier) + (result[i - 1] * (1 - multiplier));
  }
  
  return result;
};

/**
 * Calculate volatility (standard deviation) for price series
 */
export const calculateVolatility = (prices: number[]): VolatilityResult => {
  if (prices.length < 2) {
    return {
      value: 0,
      period: 'daily',
      standardDeviation: 0,
      coefficient: 0
    };
  }

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const squaredDiffs = prices.map((price) => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    value: standardDeviation,
    period: 'daily',
    standardDeviation,
    coefficient: mean !== 0 ? standardDeviation / mean : 0
  };
};

/**
 * Detect trend using linear regression
 */
export const detectTrend = (prices: number[]): TrendResult => {
  if (prices.length < 3) {
    return {
      direction: 'stable',
      slope: 0,
      confidence: 0,
      strength: 'weak'
    };
  }

  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i);
  
  // Calculate means
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = prices.reduce((a, b) => a + b, 0) / n;
  
  // Calculate slope (beta1) and correlation coefficient
  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = prices[i] - yMean;
    numerator += xDiff * yDiff;
    denominatorX += xDiff * xDiff;
    denominatorY += yDiff * yDiff;
  }
  
  const slope = denominatorX !== 0 ? numerator / denominatorX : 0;
  
  // Calculate R-squared (coefficient of determination)
  const rSquared = denominatorX !== 0 && denominatorY !== 0 
    ? Math.pow(numerator, 2) / (denominatorX * denominatorY) 
    : 0;
  
  // Determine direction based on slope
  let direction: 'rising' | 'falling' | 'stable';
  const slopeThreshold = 0.01; // Minimum slope to consider significant
  
  if (Math.abs(slope) < slopeThreshold) {
    direction = 'stable';
  } else if (slope > 0) {
    direction = 'rising';
  } else {
    direction = 'falling';
  }
  
  // Determine strength based on R-squared
  let strength: 'weak' | 'moderate' | 'strong';
  if (rSquared < 0.3) {
    strength = 'weak';
  } else if (rSquared < 0.7) {
    strength = 'moderate';
  } else {
    strength = 'strong';
  }

  return {
    direction,
    slope,
    confidence: rSquared,
    strength
  };
};

/**
 * Compare user prices with market averages
 */
export const analyzeMarketComparison = (
  data: ComparisonDataPoint[],
  fuelType: FuelType
): MarketComparisonResult => {
  if (!data.length) {
    return {
      advantage: 'equal',
      difference: 0,
      differencePercent: 0,
      avgUserPrice: 0,
      avgMarketPrice: 0,
      advantageDays: 0,
      totalDays: 0
    };
  }

  const validData = data.filter(point => 
    point[fuelType] !== undefined && 
    point.marketAverage?.[fuelType] !== undefined
  );

  if (!validData.length) {
    return {
      advantage: 'equal',
      difference: 0,
      differencePercent: 0,
      avgUserPrice: 0,
      avgMarketPrice: 0,
      advantageDays: 0,
      totalDays: 0
    };
  }

  const userPrices = validData.map(point => point[fuelType]!);
  const marketPrices = validData.map(point => point.marketAverage![fuelType]!);

  const avgUserPrice = userPrices.reduce((a, b) => a + b, 0) / userPrices.length;
  const avgMarketPrice = marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length;
  
  const difference = avgUserPrice - avgMarketPrice;
  const differencePercent = avgMarketPrice !== 0 ? (difference / avgMarketPrice) * 100 : 0;

  // Count days where user has advantage (lower prices)
  const advantageDays = validData.filter(point => 
    point[fuelType]! < point.marketAverage![fuelType]!
  ).length;

  let advantage: 'lower' | 'higher' | 'equal';
  const threshold = 0.01; // 1 cent threshold for "equal"
  
  if (Math.abs(difference) < threshold) {
    advantage = 'equal';
  } else if (difference < 0) {
    advantage = 'lower';
  } else {
    advantage = 'higher';
  }

  return {
    advantage,
    difference,
    differencePercent,
    avgUserPrice,
    avgMarketPrice,
    advantageDays,
    totalDays: validData.length
  };
};

/**
 * Handle and analyze missing data points
 */
export const analyzeMissingData = (
  data: ChartDataPoint[],
  expectedDateRange: { start: Date; end: Date }
): MissingDataInfo => {
  if (!data.length) {
    return {
      totalPoints: 0,
      missingPoints: 0,
      missingPercentage: 0,
      gaps: []
    };
  }

  // Calculate expected number of days
  const daysDiff = Math.ceil(
    (expectedDateRange.end.getTime() - expectedDateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1; // +1 to include both start and end dates

  const sortedData = [...data].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const gaps: Array<{ start: string; end: string; duration: number }> = [];
  let currentDate = new Date(expectedDateRange.start);

  for (let i = 0; i < sortedData.length; i++) {
    const dataDate = new Date(sortedData[i].date);
    
    // Check for gap before this data point
    if (currentDate < dataDate) {
      const gapStart = new Date(currentDate);
      const gapEnd = new Date(dataDate);
      gapEnd.setDate(gapEnd.getDate() - 1); // End gap the day before data point
      
      const duration = Math.ceil(
        (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      
      if (duration > 0) {
        gaps.push({
          start: gapStart.toISOString().split('T')[0],
          end: gapEnd.toISOString().split('T')[0],
          duration
        });
      }
    }
    
    // Move current date to day after this data point
    currentDate = new Date(dataDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Check for gap after last data point
  if (currentDate <= expectedDateRange.end) {
    const duration = Math.ceil(
      (expectedDateRange.end.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    
    if (duration > 0) {
      gaps.push({
        start: currentDate.toISOString().split('T')[0],
        end: expectedDateRange.end.toISOString().split('T')[0],
        duration
      });
    }
  }

  const missingPoints = gaps.reduce((sum, gap) => sum + gap.duration, 0);
  const missingPercentage = daysDiff > 0 ? (missingPoints / daysDiff) * 100 : 0;

  return {
    totalPoints: daysDiff,
    missingPoints,
    missingPercentage,
    gaps
  };
};

/**
 * Detect seasonal patterns in price data
 */
export const detectSeasonalPatterns = (
  data: ChartDataPoint[],
  fuelType: FuelType
): SeasonalPattern[] => {
  if (!data.length) return [];

  const patterns: SeasonalPattern[] = [];
  const validData = data.filter(point => point[fuelType] !== undefined);

  if (validData.length < 7) return patterns; // Need at least a week of data

  // Weekly pattern analysis
  const weeklyData: { [key: number]: number[] } = {};
  validData.forEach(point => {
    const date = new Date(point.date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (!weeklyData[dayOfWeek]) {
      weeklyData[dayOfWeek] = [];
    }
    weeklyData[dayOfWeek].push(point[fuelType]!);
  });

  // Calculate weekly pattern if we have data for multiple weeks
  const daysWithData = Object.keys(weeklyData).length;
  if (daysWithData >= 4) { // At least 4 different days of the week
    const weeklyPattern = Object.entries(weeklyData).map(([day, prices]) => {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
      const deviation = Math.sqrt(variance);
      const confidence = prices.length >= 3 ? Math.min(prices.length / 10, 1) : 0.5;
      
      return {
        period: parseInt(day), // Day of week
        avgPrice,
        deviation,
        confidence
      };
    }).sort((a, b) => a.period - b.period);

    // Calculate pattern strength based on variance between days
    const dailyAverages = weeklyPattern.map(p => p.avgPrice);
    const overallAvg = dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length;
    const dayVariance = dailyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / dailyAverages.length;
    const strength = Math.min(dayVariance / (overallAvg * overallAvg), 1); // Normalize by price level

    patterns.push({
      type: 'weekly',
      pattern: weeklyPattern,
      strength
    });
  }

  // Monthly pattern analysis (if we have enough data)
  if (validData.length >= 30) {
    const monthlyData: { [key: number]: number[] } = {};
    validData.forEach(point => {
      const date = new Date(point.date);
      const month = date.getMonth(); // 0 = January, 1 = February, etc.
      
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(point[fuelType]!);
    });

    const monthsWithData = Object.keys(monthlyData).length;
    if (monthsWithData >= 3) {
      const monthlyPattern = Object.entries(monthlyData).map(([month, prices]) => {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
        const deviation = Math.sqrt(variance);
        const confidence = prices.length >= 5 ? Math.min(prices.length / 20, 1) : 0.3;
        
        return {
          period: parseInt(month),
          avgPrice,
          deviation,
          confidence
        };
      }).sort((a, b) => a.period - b.period);

      const monthlyAverages = monthlyPattern.map(p => p.avgPrice);
      const overallAvg = monthlyAverages.reduce((a, b) => a + b, 0) / monthlyAverages.length;
      const monthVariance = monthlyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / monthlyAverages.length;
      const strength = Math.min(monthVariance / (overallAvg * overallAvg), 1);

      patterns.push({
        type: 'monthly',
        pattern: monthlyPattern,
        strength
      });
    }
  }

  return patterns;
};

/**
 * Comprehensive trend analysis that combines multiple calculations
 */
export const performComprehensiveAnalysis = (
  data: ChartDataPoint[],
  fuelType: FuelType,
  dateRange?: { start: Date; end: Date }
) => {
  const prices = data
    .filter(point => point[fuelType] !== undefined)
    .map(point => point[fuelType]!);

  const movingAverage7 = calculateMovingAverage(prices, 7);
  const movingAverage15 = calculateMovingAverage(prices, 15);
  const exponentialMA = calculateExponentialMovingAverage(prices, 10);
  
  const volatility = calculateVolatility(prices);
  const trend = detectTrend(prices);
  
  const missingDataInfo = dateRange 
    ? analyzeMissingData(data, dateRange)
    : null;
  
  const seasonalPatterns = detectSeasonalPatterns(data, fuelType);

  return {
    prices,
    movingAverages: {
      sma7: movingAverage7,
      sma15: movingAverage15,
      ema10: exponentialMA
    },
    volatility,
    trend,
    missingData: missingDataInfo,
    seasonalPatterns,
    summary: {
      totalPoints: data.length,
      validPricePoints: prices.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      priceRange: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0
    }
  };
};