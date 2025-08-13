import { FuelType } from "../types/models";

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.REGULAR]: "Magna (Regular)",
  [FuelType.PREMIUM]: "Premium",
  [FuelType.DIESEL]: "Diésel",
};

export const FUEL_TYPE_COLORS: Record<FuelType, string> = {
  [FuelType.REGULAR]: "#10B981",
  [FuelType.PREMIUM]: "#EF4444",
  [FuelType.DIESEL]: "#3B82F6",
};

export const GOVERNMENT_FUEL_MAPPING: Record<string, FuelType> = {
  "Gasolina Regular": FuelType.REGULAR,
  Regular: FuelType.REGULAR,
  Magna: FuelType.REGULAR,
  "Gasolina Magna": FuelType.REGULAR,
  "Gasolina Premium": FuelType.PREMIUM,
  Premium: FuelType.PREMIUM,
  Diesel: FuelType.DIESEL,
  Diésel: FuelType.DIESEL,
  "Diesel S-500": FuelType.DIESEL,
  "Diesel UBA": FuelType.DIESEL,
};

export const DEFAULT_FUEL_TYPE = FuelType.REGULAR;

export const FUEL_OCTANE_RATINGS: Record<FuelType, number> = {
  [FuelType.REGULAR]: 87,
  [FuelType.PREMIUM]: 91,
  [FuelType.DIESEL]: 0,
};

export const PRICE_CHANGE_THRESHOLDS = {
  SIGNIFICANT_INCREASE: 0.05,
  SIGNIFICANT_DECREASE: -0.05,
  MINOR_CHANGE: 0.01,
};
