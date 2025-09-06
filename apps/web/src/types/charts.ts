export type FuelType = 'regular' | 'premium' | 'diesel';

export interface ChartDataPoint {
  date: string; // ISO date
  regular?: number; // Price for regular
  premium?: number; // Price for premium
  diesel?: number; // Price for diesel
  events?: PriceEvent[]; // Price change events
}

export interface PriceEvent {
  type: 'price_change';
  fuel: FuelType;
  change: number; // Price difference
  changePercent: number; // Percentage change
}

export interface TrendStatistics {
  average: number;
  min: { value: number; date: string };
  max: { value: number; date: string };
  volatility: number; // Standard deviation
  trend: {
    direction: 'rising' | 'falling' | 'stable';
    slope: number;
    confidence: number; // R² value
  };
  changeCount: number; // Number of price changes
}

export interface DateRange {
  preset?: '7d' | '15d' | '30d' | 'custom';
  startDate: Date;
  endDate: Date;
}

export interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

export interface ChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  error?: string | null;
  selectedFuels?: FuelType[];
  onFuelToggle?: (fuel: FuelType) => void;
}

export interface ComparisonDataPoint extends ChartDataPoint {
  marketAverage?: {
    regular?: number;
    premium?: number;
    diesel?: number;
  };
}