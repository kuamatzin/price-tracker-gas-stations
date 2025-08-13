import { PRICE_CHANGE_THRESHOLDS } from "../constants/fuel";

export function calculatePriceChange(
  oldPrice: number,
  newPrice: number,
): {
  amount: number;
  percentage: number;
  isSignificant: boolean;
  direction: "increase" | "decrease" | "stable";
} {
  const amount = newPrice - oldPrice;
  const percentage = (amount / oldPrice) * 100;

  const isSignificant =
    Math.abs(percentage / 100) >=
    Math.abs(PRICE_CHANGE_THRESHOLDS.SIGNIFICANT_INCREASE);

  let direction: "increase" | "decrease" | "stable" = "stable";
  if (amount > PRICE_CHANGE_THRESHOLDS.MINOR_CHANGE) {
    direction = "increase";
  } else if (amount < -PRICE_CHANGE_THRESHOLDS.MINOR_CHANGE) {
    direction = "decrease";
  }

  return {
    amount: parseFloat(amount.toFixed(2)),
    percentage: parseFloat(percentage.toFixed(2)),
    isSignificant,
    direction,
  };
}

export function formatPrice(price: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateAveragePrice(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return parseFloat((sum / prices.length).toFixed(2));
}

export function calculateMedianPrice(prices: number[]): number {
  if (prices.length === 0) return 0;

  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return parseFloat(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  }

  return parseFloat(sorted[middle].toFixed(2));
}

export function isValidPrice(price: number): boolean {
  return price > 0 && price < 100 && !isNaN(price);
}
