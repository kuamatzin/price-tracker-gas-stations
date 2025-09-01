// Export API client
export { apiClient, ApiClient } from './client';

// Export services
export { authService } from './auth.service';
export { pricingService } from './pricing.service';
export { analyticsService } from './analytics.service';

// Export types
export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenResponse,
} from './auth.service';

export type {
  FuelType,
  Station,
  PriceChange,
  CurrentPricesResponse,
  CompetitorsResponse,
  HistoryResponse,
  UpdatePriceRequest,
  CompetitorsFilters,
  HistoryFilters,
} from './pricing.service';

export type {
  AnalyticsFilters,
  SalesMetrics,
  MarketPosition,
  PriceOptimization,
  CustomerInsights,
  CompetitorAnalysis,
  RevenueAnalysis,
} from './analytics.service';