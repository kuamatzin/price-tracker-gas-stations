import { apiClient } from './client';
import { FuelType } from './pricing.service';

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  fuelTypes?: FuelType[];
  radius?: number;
  includeCompetitors?: boolean;
}

export interface SalesMetrics {
  totalRevenue: number;
  totalVolume: number;
  averageMargin: number;
  transactionCount: number;
  revenueChange: number;
  volumeChange: number;
  marginChange: number;
  transactionChange: number;
}

export interface MarketPosition {
  ranking: number;
  totalStations: number;
  marketShare: number;
  competitiveAdvantage: {
    fuelType: FuelType;
    advantage: number; // positive = better than average, negative = worse
    description: string;
  }[];
}

export interface PriceOptimization {
  recommendations: {
    fuelType: FuelType;
    currentPrice: number;
    recommendedPrice: number;
    expectedImpact: {
      revenueChange: number;
      volumeChange: number;
      marginChange: number;
    };
    confidence: number;
    reasoning: string;
  }[];
}

export interface CustomerInsights {
  peakHours: {
    hour: number;
    volume: number;
  }[];
  fuelTypePreferences: {
    fuelType: FuelType;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  loyaltyMetrics: {
    repeatCustomers: number;
    averageVisitsPerMonth: number;
    retentionRate: number;
  };
}

export interface CompetitorAnalysis {
  competitors: {
    id: string;
    name: string;
    brand: string;
    distance: number;
    priceComparison: {
      fuelType: FuelType;
      theirPrice: number;
      ourPrice: number;
      difference: number;
      advantage: 'higher' | 'lower' | 'equal';
    }[];
    threatLevel: 'low' | 'medium' | 'high';
  }[];
  marketTrends: {
    averagePrices: Record<FuelType, number>;
    priceVolatility: Record<FuelType, number>;
    demandTrends: {
      fuelType: FuelType;
      trend: 'increasing' | 'decreasing' | 'stable';
      changePercentage: number;
    }[];
  };
}

export interface RevenueAnalysis {
  daily: {
    date: string;
    revenue: number;
    volume: number;
    averageMargin: number;
  }[];
  monthly: {
    month: string;
    revenue: number;
    volume: number;
    averageMargin: number;
  }[];
  forecasts: {
    date: string;
    predictedRevenue: number;
    confidence: number;
  }[];
}

class AnalyticsService {
  private readonly baseUrl = '/analytics';

  async getSalesMetrics(filters?: AnalyticsFilters): Promise<SalesMetrics> {
    const params = this.buildParams(filters);
    const response = await apiClient.get<SalesMetrics>(
      `${this.baseUrl}/sales-metrics?${params.toString()}`
    );
    return response.data;
  }

  async getMarketPosition(filters?: AnalyticsFilters): Promise<MarketPosition> {
    const params = this.buildParams(filters);
    const response = await apiClient.get<MarketPosition>(
      `${this.baseUrl}/market-position?${params.toString()}`
    );
    return response.data;
  }

  async getPriceOptimization(filters?: AnalyticsFilters): Promise<PriceOptimization> {
    const params = this.buildParams(filters);
    const response = await apiClient.get<PriceOptimization>(
      `${this.baseUrl}/price-optimization?${params.toString()}`
    );
    return response.data;
  }

  async getCustomerInsights(filters?: AnalyticsFilters): Promise<CustomerInsights> {
    const params = this.buildParams(filters);
    const response = await apiClient.get<CustomerInsights>(
      `${this.baseUrl}/customer-insights?${params.toString()}`
    );
    return response.data;
  }

  async getCompetitorAnalysis(filters?: AnalyticsFilters): Promise<CompetitorAnalysis> {
    const params = this.buildParams(filters);
    const response = await apiClient.get<CompetitorAnalysis>(
      `${this.baseUrl}/competitor-analysis?${params.toString()}`
    );
    return response.data;
  }

  async getRevenueAnalysis(filters?: AnalyticsFilters): Promise<RevenueAnalysis> {
    const params = this.buildParams(filters);
    const response = await apiClient.get<RevenueAnalysis>(
      `${this.baseUrl}/revenue-analysis?${params.toString()}`
    );
    return response.data;
  }

  async getDashboardData(filters?: AnalyticsFilters): Promise<{
    salesMetrics: SalesMetrics;
    marketPosition: MarketPosition;
    recentChanges: {
      id: string;
      type: 'price_change' | 'competitor_change' | 'market_shift';
      description: string;
      impact: 'positive' | 'negative' | 'neutral';
      timestamp: string;
    }[];
    alerts: {
      id: string;
      type: 'urgent' | 'warning' | 'info';
      title: string;
      message: string;
      timestamp: string;
    }[];
  }> {
    const params = this.buildParams(filters);
    const response = await apiClient.get(
      `${this.baseUrl}/dashboard?${params.toString()}`
    );
    return response.data;
  }

  async generateReport(type: 'sales' | 'competition' | 'market' | 'comprehensive', filters?: AnalyticsFilters): Promise<{
    reportId: string;
    status: 'generating' | 'completed' | 'failed';
    downloadUrl?: string;
  }> {
    const params = this.buildParams(filters);
    params.append('type', type);
    
    const response = await apiClient.post(
      `${this.baseUrl}/generate-report`,
      filters,
      {
        params: { type }
      }
    );
    return response.data;
  }

  async getReportStatus(reportId: string): Promise<{
    reportId: string;
    status: 'generating' | 'completed' | 'failed';
    progress: number;
    downloadUrl?: string;
    error?: string;
  }> {
    const response = await apiClient.get(
      `${this.baseUrl}/reports/${reportId}/status`
    );
    return response.data;
  }

  async downloadReport(reportId: string): Promise<Blob> {
    const response = await apiClient.get(
      `${this.baseUrl}/reports/${reportId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  private buildParams(filters?: AnalyticsFilters): URLSearchParams {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.fuelTypes?.length) params.append('fuelTypes', filters.fuelTypes.join(','));
      if (filters.radius) params.append('radius', filters.radius.toString());
      if (filters.includeCompetitors !== undefined) {
        params.append('includeCompetitors', filters.includeCompetitors.toString());
      }
    }

    return params;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;