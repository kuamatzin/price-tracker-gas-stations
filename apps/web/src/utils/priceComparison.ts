import { FuelType } from "@fuelintel/shared";

interface CompetitorPrice {
  numero: string;
  nombre: string;
  brand?: string;
  distance?: number;
  prices: {
    [key in FuelType]?: number;
  };
}

interface PriceComparisonResult {
  competitiveness: "competitive" | "average" | "expensive";
  percentile: number;
  ranking: number;
  totalCompetitors: number;
  bestPrice: number;
  worstPrice: number;
  averagePrice: number;
  priceDifference: number;
  percentageDifference: number;
}

/**
 * Calculate price competitiveness based on thresholds
 */
export const calculateCompetitiveness = (
  price: number,
  marketAverage: number,
  thresholdPercentage: number = 2,
): "competitive" | "average" | "expensive" => {
  const percentDiff = ((price - marketAverage) / marketAverage) * 100;

  if (percentDiff < -thresholdPercentage) return "competitive";
  if (percentDiff > thresholdPercentage) return "expensive";
  return "average";
};

/**
 * Calculate market position percentile (0 = cheapest, 100 = most expensive)
 */
export const calculateMarketPercentile = (
  price: number,
  competitorPrices: number[],
): number => {
  if (competitorPrices.length === 0) return 50;

  const sortedPrices = [...competitorPrices].sort((a, b) => a - b);
  const position = sortedPrices.findIndex((p) => p >= price);

  if (position === -1) return 100; // Most expensive
  if (position === 0) return 0; // Cheapest

  return Math.round((position / competitorPrices.length) * 100);
};

/**
 * Get price ranking (1 = best/cheapest)
 */
export const calculatePriceRanking = (
  price: number,
  competitorPrices: number[],
): number => {
  const allPrices = [price, ...competitorPrices].sort((a, b) => a - b);
  return allPrices.indexOf(price) + 1;
};

/**
 * Find best and worst prices among competitors
 */
export const findBestWorstPrices = (
  prices: number[],
): { best: number; worst: number } => {
  if (prices.length === 0) return { best: 0, worst: 0 };

  return {
    best: Math.min(...prices),
    worst: Math.max(...prices),
  };
};

/**
 * Calculate average price from array
 */
export const calculateAveragePrice = (prices: number[]): number => {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return sum / prices.length;
};

/**
 * Main comparison function for a station's price against competitors
 */
export const compareStationPrice = (
  stationPrice: number,
  fuelType: FuelType,
  competitors: CompetitorPrice[],
): PriceComparisonResult => {
  // Extract competitor prices for the fuel type
  const competitorPrices = competitors
    .map((c) => c.prices[fuelType])
    .filter((price): price is number => price !== undefined && price > 0);

  const averagePrice = calculateAveragePrice(competitorPrices);
  const { best, worst } = findBestWorstPrices(competitorPrices);
  const percentile = calculateMarketPercentile(stationPrice, competitorPrices);
  const ranking = calculatePriceRanking(stationPrice, competitorPrices);
  const competitiveness = calculateCompetitiveness(stationPrice, averagePrice);

  return {
    competitiveness,
    percentile,
    ranking,
    totalCompetitors: competitorPrices.length,
    bestPrice: best,
    worstPrice: worst,
    averagePrice,
    priceDifference: stationPrice - averagePrice,
    percentageDifference:
      averagePrice > 0
        ? ((stationPrice - averagePrice) / averagePrice) * 100
        : 0,
  };
};

/**
 * Get competitors sorted by price for a specific fuel type
 */
export const getSortedCompetitorsByPrice = (
  competitors: CompetitorPrice[],
  fuelType: FuelType,
  ascending: boolean = true,
): CompetitorPrice[] => {
  return [...competitors]
    .filter((c) => c.prices[fuelType] !== undefined)
    .sort((a, b) => {
      const priceA = a.prices[fuelType] || 0;
      const priceB = b.prices[fuelType] || 0;
      return ascending ? priceA - priceB : priceB - priceA;
    });
};

/**
 * Get nearby cheapest competitors within a radius
 */
export const getNearbyCheapest = (
  competitors: CompetitorPrice[],
  fuelType: FuelType,
  maxDistance: number,
  limit: number = 5,
): CompetitorPrice[] => {
  return competitors
    .filter(
      (c) =>
        c.distance !== undefined &&
        c.distance <= maxDistance &&
        c.prices[fuelType] !== undefined,
    )
    .sort((a, b) => (a.prices[fuelType] || 0) - (b.prices[fuelType] || 0))
    .slice(0, limit);
};

/**
 * Calculate price trends over time
 */
export const calculatePriceTrend = (
  currentPrice: number,
  previousPrice?: number,
): "up" | "down" | "stable" | "unknown" => {
  if (!previousPrice) return "unknown";

  const difference = currentPrice - previousPrice;
  const threshold = 0.01; // 1 cent threshold for stability

  if (Math.abs(difference) < threshold) return "stable";
  return difference > 0 ? "up" : "down";
};

/**
 * Get price competitiveness color
 */
export const getPriceColor = (
  competitiveness: "competitive" | "average" | "expensive",
): string => {
  switch (competitiveness) {
    case "competitive":
      return "#10b981"; // green
    case "expensive":
      return "#ef4444"; // red
    default:
      return "#f59e0b"; // yellow
  }
};

/**
 * Format price comparison message
 */
export const formatComparisonMessage = (
  result: PriceComparisonResult,
): string => {
  const { ranking, totalCompetitors, percentageDifference, competitiveness } =
    result;

  let message = `Ranking: ${ranking} de ${totalCompetitors + 1} estaciones. `;

  if (competitiveness === "competitive") {
    message += `Precio competitivo (${Math.abs(percentageDifference).toFixed(1)}% por debajo del promedio).`;
  } else if (competitiveness === "expensive") {
    message += `Precio alto (${percentageDifference.toFixed(1)}% por encima del promedio).`;
  } else {
    message += `Precio promedio del mercado.`;
  }

  return message;
};

/**
 * Identify price outliers (stations with unusually high or low prices)
 */
export const identifyPriceOutliers = (
  prices: number[],
  threshold: number = 1.5, // IQR multiplier
): { outliers: number[]; normal: number[] } => {
  if (prices.length < 4) {
    return { outliers: [], normal: prices };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - threshold * iqr;
  const upperBound = q3 + threshold * iqr;

  const outliers = prices.filter((p) => p < lowerBound || p > upperBound);
  const normal = prices.filter((p) => p >= lowerBound && p <= upperBound);

  return { outliers, normal };
};

/**
 * Check if price data is stale
 */
export const isPriceStale = (
  lastUpdated: string | Date,
  thresholdMinutes: number = 360, // 6 hours default
): boolean => {
  const lastUpdateTime = new Date(lastUpdated).getTime();
  const currentTime = new Date().getTime();
  const differenceInMinutes = (currentTime - lastUpdateTime) / (1000 * 60);

  return differenceInMinutes > thresholdMinutes;
};
