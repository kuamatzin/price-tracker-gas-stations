import type { FuelType } from '@/stores/pricingStore';

export type CompetitivenessLevel = 'competitive' | 'average' | 'expensive';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface PriceCompetitivenessResult {
  level: CompetitivenessLevel;
  percentageDifference: number;
  absoluteDifference: number;
  isSignificant: boolean;
  rank?: number;
  percentile?: number;
}

export interface PriceTrendResult {
  direction: TrendDirection;
  change: number;
  changePercentage: number;
  isSignificant: boolean;
}

export interface MarketPosition {
  rank: number;
  percentile: number;
  totalStations: number;
  betterThan: number;
  worseThan: number;
}

export interface PriceRanking {
  cheapest: { price: number; stationId: string };
  mostExpensive: { price: number; stationId: string };
  median: number;
  average: number;
  standardDeviation: number;
  priceRange: number;
}

export interface CompetitivenessThresholds {
  competitive: number;  // Below market average minus this percentage
  expensive: number;    // Above market average plus this percentage
  significantChange: number; // Minimum percentage change to be considered significant
}

// Default thresholds based on story requirements
export const DEFAULT_THRESHOLDS: CompetitivenessThresholds = {
  competitive: 2, // Price < Market Average - 2%
  expensive: 2,   // Price > Market Average + 2%
  significantChange: 0.5, // 0.5% minimum change to be significant
};

/**
 * Calculate price competitiveness compared to market average
 */
export const calculatePriceCompetitiveness = (
  price: number,
  marketAverage: number,
  thresholds: CompetitivenessThresholds = DEFAULT_THRESHOLDS
): PriceCompetitivenessResult => {
  if (price <= 0 || marketAverage <= 0) {
    return {
      level: 'average',
      percentageDifference: 0,
      absoluteDifference: 0,
      isSignificant: false,
    };
  }

  const absoluteDifference = price - marketAverage;
  const percentageDifference = (absoluteDifference / marketAverage) * 100;

  let level: CompetitivenessLevel = 'average';
  
  if (percentageDifference < -thresholds.competitive) {
    level = 'competitive';
  } else if (percentageDifference > thresholds.expensive) {
    level = 'expensive';
  }

  const isSignificant = Math.abs(percentageDifference) >= thresholds.significantChange;

  return {
    level,
    percentageDifference,
    absoluteDifference,
    isSignificant,
  };
};

/**
 * Calculate price trend based on current and previous prices
 */
export const calculatePriceTrend = (
  currentPrice: number,
  previousPrice: number,
  thresholds: CompetitivenessThresholds = DEFAULT_THRESHOLDS
): PriceTrendResult => {
  if (currentPrice <= 0 || previousPrice <= 0) {
    return {
      direction: 'stable',
      change: 0,
      changePercentage: 0,
      isSignificant: false,
    };
  }

  const change = currentPrice - previousPrice;
  const changePercentage = (change / previousPrice) * 100;

  let direction: TrendDirection = 'stable';
  if (Math.abs(changePercentage) >= thresholds.significantChange) {
    direction = changePercentage > 0 ? 'up' : 'down';
  }

  return {
    direction,
    change,
    changePercentage,
    isSignificant: Math.abs(changePercentage) >= thresholds.significantChange,
  };
};

/**
 * Calculate market position for a price among competitors
 */
export const calculateMarketPosition = (
  price: number,
  competitorPrices: number[]
): MarketPosition => {
  if (price <= 0 || competitorPrices.length === 0) {
    return {
      rank: 1,
      percentile: 50,
      totalStations: 1,
      betterThan: 0,
      worseThan: 0,
    };
  }

  const allPrices = [...competitorPrices, price].filter(p => p > 0).sort((a, b) => a - b);
  const totalStations = allPrices.length;
  const rank = allPrices.indexOf(price) + 1; // 1-based ranking
  
  const betterThan = rank - 1; // Number of stations with higher prices
  const worseThan = totalStations - rank; // Number of stations with lower prices
  const percentile = Math.round(((totalStations - rank) / (totalStations - 1)) * 100);

  return {
    rank,
    percentile: totalStations > 1 ? percentile : 50,
    totalStations,
    betterThan,
    worseThan,
  };
};

/**
 * Calculate comprehensive price ranking statistics
 */
export const calculatePriceRanking = (
  prices: Array<{ price: number; stationId: string }>
): PriceRanking => {
  const validPrices = prices.filter(p => p.price > 0);
  
  if (validPrices.length === 0) {
    return {
      cheapest: { price: 0, stationId: '' },
      mostExpensive: { price: 0, stationId: '' },
      median: 0,
      average: 0,
      standardDeviation: 0,
      priceRange: 0,
    };
  }

  const sortedPrices = [...validPrices].sort((a, b) => a.price - b.price);
  const priceValues = sortedPrices.map(p => p.price);
  
  const cheapest = sortedPrices[0];
  const mostExpensive = sortedPrices[sortedPrices.length - 1];
  const average = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
  
  // Calculate median
  const midIndex = Math.floor(priceValues.length / 2);
  const median = priceValues.length % 2 === 0
    ? (priceValues[midIndex - 1] + priceValues[midIndex]) / 2
    : priceValues[midIndex];

  // Calculate standard deviation
  const variance = priceValues.reduce((sum, price) => {
    return sum + Math.pow(price - average, 2);
  }, 0) / priceValues.length;
  const standardDeviation = Math.sqrt(variance);

  const priceRange = mostExpensive.price - cheapest.price;

  return {
    cheapest,
    mostExpensive,
    median,
    average,
    standardDeviation,
    priceRange,
  };
};

/**
 * Get color class for price competitiveness level
 */
export const getCompetitivenessColor = (level: CompetitivenessLevel): string => {
  const colorMap = {
    competitive: 'text-green-600 dark:text-green-400',
    average: 'text-yellow-600 dark:text-yellow-400',
    expensive: 'text-red-600 dark:text-red-400',
  };
  return colorMap[level];
};

/**
 * Get background color class for price competitiveness level
 */
export const getCompetitivenessBgColor = (level: CompetitivenessLevel): string => {
  const colorMap = {
    competitive: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    average: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    expensive: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  };
  return colorMap[level];
};

/**
 * Get trend icon name for UI components
 */
export const getTrendIcon = (direction: TrendDirection): string => {
  const iconMap = {
    up: 'TrendingUp',
    down: 'TrendingDown',
    stable: 'Minus',
  };
  return iconMap[direction];
};

/**
 * Format price difference for display
 */
export const formatPriceDifference = (
  difference: number,
  percentage: number,
  currency: string = 'MXN'
): string => {
  const sign = difference >= 0 ? '+' : '';
  const formattedPrice = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(difference));
  
  return `${sign}${difference >= 0 ? formattedPrice : '-' + formattedPrice} (${sign}${percentage.toFixed(1)}%)`;
};

/**
 * Get competitiveness description in Spanish
 */
export const getCompetitivenessDescription = (
  result: PriceCompetitivenessResult
): string => {
  const { level, percentageDifference } = result;
  const absPercentage = Math.abs(percentageDifference);
  
  switch (level) {
    case 'competitive':
      return `${absPercentage.toFixed(1)}% más barato que el promedio`;
    case 'expensive':
      return `${absPercentage.toFixed(1)}% más caro que el promedio`;
    case 'average':
    default:
      return 'Precio similar al promedio del mercado';
  }
};

/**
 * Calculate multiple fuel types competitiveness for a station
 */
export const calculateStationCompetitiveness = (
  stationPrices: Partial<Record<FuelType, number>>,
  marketAverages: Partial<Record<FuelType, number>>,
  thresholds: CompetitivenessThresholds = DEFAULT_THRESHOLDS
): Record<FuelType, PriceCompetitivenessResult | null> => {
  const fuelTypes: FuelType[] = ['regular', 'premium', 'diesel'];
  const results: Partial<Record<FuelType, PriceCompetitivenessResult | null>> = {};

  fuelTypes.forEach(fuelType => {
    const price = stationPrices[fuelType];
    const average = marketAverages[fuelType];
    
    if (price && average) {
      results[fuelType] = calculatePriceCompetitiveness(price, average, thresholds);
    } else {
      results[fuelType] = null;
    }
  });

  return results as Record<FuelType, PriceCompetitivenessResult | null>;
};

/**
 * Get overall station competitiveness based on primary fuel type (usually regular)
 */
export const getOverallStationCompetitiveness = (
  stationPrices: Partial<Record<FuelType, number>>,
  marketAverages: Partial<Record<FuelType, number>>,
  primaryFuelType: FuelType = 'regular',
  thresholds: CompetitivenessThresholds = DEFAULT_THRESHOLDS
): CompetitivenessLevel => {
  // Try primary fuel type first
  if (stationPrices[primaryFuelType] && marketAverages[primaryFuelType]) {
    const result = calculatePriceCompetitiveness(
      stationPrices[primaryFuelType]!,
      marketAverages[primaryFuelType]!,
      thresholds
    );
    return result.level;
  }

  // Fallback to any available fuel type
  const fuelTypes: FuelType[] = ['regular', 'premium', 'diesel'];
  for (const fuelType of fuelTypes) {
    if (stationPrices[fuelType] && marketAverages[fuelType]) {
      const result = calculatePriceCompetitiveness(
        stationPrices[fuelType]!,
        marketAverages[fuelType]!,
        thresholds
      );
      return result.level;
    }
  }

  return 'average';
};

export default {
  calculatePriceCompetitiveness,
  calculatePriceTrend,
  calculateMarketPosition,
  calculatePriceRanking,
  calculateStationCompetitiveness,
  getOverallStationCompetitiveness,
  getCompetitivenessColor,
  getCompetitivenessBgColor,
  getTrendIcon,
  formatPriceDifference,
  getCompetitivenessDescription,
  DEFAULT_THRESHOLDS,
};