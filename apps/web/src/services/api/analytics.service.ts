import { apiClient } from './client';
import { FuelType } from './pricing.service';
import type { ChartDataPoint, TrendStatistics, ComparisonDataPoint } from '../../types/charts';

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  fuelTypes?: FuelType[];
  radius?: number;
  includeCompetitors?: boolean;
}

// Historical Trends Interfaces
export interface StationHistoryParams {
  stationId: string;
  days?: 7 | 15 | 30;
  fuelType?: FuelType;
  startDate?: string;
  endDate?: string;
}

export interface MarketTrendsParams {
  entidadId?: string;
  municipioId?: string;
  startDate: string;
  endDate: string;
  grouping?: 'daily' | 'weekly' | 'monthly';
  fuelTypes?: FuelType[];
}

export interface TrendAnalysisParams {
  stationId: string;
  startDate: string;
  endDate: string;
  period?: 'daily' | 'weekly' | 'monthly';
  fuelTypes?: FuelType[];
}

export interface GapFillOptions {
  method: 'last_known' | 'interpolation' | 'market_average';
  maxGapDays?: number;
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
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly dataCache = new Map<string, { data: any; timestamp: number }>();

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

  // Historical Trends Methods
  async getStationHistory(params: StationHistoryParams): Promise<ChartDataPoint[]> {
    const cacheKey = `station-history-${JSON.stringify(params)}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    
    const queryParams = new URLSearchParams();
    queryParams.append('station_id', params.stationId);
    if (params.days) queryParams.append('days', params.days.toString());
    if (params.fuelType) queryParams.append('fuel_type', params.fuelType);
    if (params.startDate) queryParams.append('start_date', params.startDate);
    if (params.endDate) queryParams.append('end_date', params.endDate);
    
    const response = await apiClient.get<ChartDataPoint[]>(
      `/prices/history/${params.stationId}?${queryParams.toString()}`
    );
    
    // Process and gap-fill data
    const processedData = this.gapFillTimeSeries(response.data);
    
    // Cache the result
    this.setCachedData(cacheKey, processedData);
    
    return processedData;
  }

  async getMarketTrends(params: MarketTrendsParams): Promise<ComparisonDataPoint[]> {
    const cacheKey = `market-trends-${JSON.stringify(params)}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.startDate);
    queryParams.append('end_date', params.endDate);
    if (params.entidadId) queryParams.append('entidad_id', params.entidadId);
    if (params.municipioId) queryParams.append('municipio_id', params.municipioId);
    if (params.grouping) queryParams.append('grouping', params.grouping);
    if (params.fuelTypes?.length) queryParams.append('fuel_types', params.fuelTypes.join(','));
    
    const response = await apiClient.get<ComparisonDataPoint[]>(
      `/trends/market?${queryParams.toString()}`
    );
    
    // Process and gap-fill data
    const processedData = this.gapFillTimeSeries(response.data);
    
    // Cache the result
    this.setCachedData(cacheKey, processedData);
    
    return processedData;
  }

  async getTrendAnalysis(params: TrendAnalysisParams): Promise<TrendStatistics[]> {
    const cacheKey = `trend-analysis-${JSON.stringify(params)}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;
    
    const queryParams = new URLSearchParams();
    queryParams.append('station_id', params.stationId);
    queryParams.append('start_date', params.startDate);
    queryParams.append('end_date', params.endDate);
    if (params.period) queryParams.append('period', params.period);
    if (params.fuelTypes?.length) queryParams.append('fuel_types', params.fuelTypes.join(','));
    
    const response = await apiClient.get<TrendStatistics[]>(
      `/trends/station/${params.stationId}?${queryParams.toString()}`
    );
    
    // Cache the result
    this.setCachedData(cacheKey, response.data);
    
    return response.data;
  }

  // Data transformation utilities
  private transformChartData(rawData: any[]): ChartDataPoint[] {
    return rawData.map(item => ({
      date: item.date || item.fecha,
      regular: item.regular || item.magna,
      premium: item.premium || item.premium,
      diesel: item.diesel || item.diesel,
      events: item.events || []
    }));
  }

  private transformComparisonData(rawData: any[]): ComparisonDataPoint[] {
    return rawData.map(item => ({
      date: item.date || item.fecha,
      regular: item.regular || item.magna,
      premium: item.premium || item.premium,
      diesel: item.diesel || item.diesel,
      marketAverage: {
        regular: item.market_regular || item.market_magna,
        premium: item.market_premium || item.market_premium,
        diesel: item.market_diesel || item.market_diesel
      },
      events: item.events || []
    }));
  }

  // Gap filling in time series
  private gapFillTimeSeries<T extends ChartDataPoint>(data: T[], options: GapFillOptions = { method: 'last_known' }): T[] {
    if (!data.length) return data;
    
    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const result: T[] = [];
    
    // Fill gaps between existing data points
    for (let i = 0; i < sortedData.length; i++) {
      result.push(sortedData[i]);
      
      // Check if there's a gap to the next data point
      if (i < sortedData.length - 1) {
        const currentDate = new Date(sortedData[i].date);
        const nextDate = new Date(sortedData[i + 1].date);
        const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Fill gaps if more than 1 day
        if (daysDiff > 1 && (!options.maxGapDays || daysDiff <= options.maxGapDays)) {
          const gapData = this.generateGapData(sortedData[i], sortedData[i + 1], daysDiff - 1, options.method);
          result.push(...gapData);
        }
      }
    }
    
    return result;
  }

  private generateGapData<T extends ChartDataPoint>(startPoint: T, endPoint: T, gapDays: number, method: GapFillOptions['method']): T[] {
    const result: T[] = [];
    const startDate = new Date(startPoint.date);
    
    for (let i = 1; i <= gapDays; i++) {
      const gapDate = new Date(startDate);
      gapDate.setDate(startDate.getDate() + i);
      
      let gapPoint: T;
      
      switch (method) {
        case 'last_known':
          gapPoint = {
            ...startPoint,
            date: gapDate.toISOString().split('T')[0]
          };
          break;
        
        case 'interpolation':
          const ratio = i / (gapDays + 1);
          gapPoint = {
            ...startPoint,
            date: gapDate.toISOString().split('T')[0],
            regular: startPoint.regular && endPoint.regular 
              ? Number((startPoint.regular + (endPoint.regular - startPoint.regular) * ratio).toFixed(2))
              : startPoint.regular || endPoint.regular,
            premium: startPoint.premium && endPoint.premium 
              ? Number((startPoint.premium + (endPoint.premium - startPoint.premium) * ratio).toFixed(2))
              : startPoint.premium || endPoint.premium,
            diesel: startPoint.diesel && endPoint.diesel 
              ? Number((startPoint.diesel + (endPoint.diesel - startPoint.diesel) * ratio).toFixed(2))
              : startPoint.diesel || endPoint.diesel,
          } as T;
          break;
        
        case 'market_average':
        default:
          // For market_average, we would need market data - fallback to last_known
          gapPoint = {
            ...startPoint,
            date: gapDate.toISOString().split('T')[0]
          };
          break;
      }
      
      result.push(gapPoint);
    }
    
    return result;
  }

  // Request caching implementation
  private getCachedData<T>(key: string): T | null {
    const cached = this.dataCache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.dataCache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setCachedData<T>(key: string, data: T): void {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  public clearCache(): void {
    this.dataCache.clear();
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