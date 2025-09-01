import { apiClient } from './client';

export type FuelType = 'regular' | 'premium' | 'diesel';

export interface Station {
  id: string;
  name: string;
  brand: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    municipality: string;
    state: string;
  };
  distance?: number;
  prices: Record<FuelType, number>;
  lastUpdated: string;
}

export interface PriceChange {
  id: string;
  stationId: string;
  fuelType: FuelType;
  oldPrice: number;
  newPrice: number;
  change: number;
  percentage: number;
  timestamp: string;
}

export interface CurrentPricesResponse {
  prices: Record<FuelType, number>;
  station: Station;
  lastUpdated: string;
}

export interface CompetitorsResponse {
  stations: Station[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface HistoryResponse {
  changes: PriceChange[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UpdatePriceRequest {
  fuelType: FuelType;
  price: number;
}

export interface CompetitorsFilters {
  radius?: number;
  fuelTypes?: FuelType[];
  brands?: string[];
  sortBy?: 'price' | 'distance' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface HistoryFilters {
  days?: number;
  fuelTypes?: FuelType[];
  page?: number;
  limit?: number;
}

class PricingService {
  private readonly baseUrl = '/pricing';

  async getCurrentPrices(): Promise<CurrentPricesResponse> {
    const response = await apiClient.get<CurrentPricesResponse>(
      `${this.baseUrl}/current`
    );
    return response.data;
  }

  async getCompetitors(filters?: CompetitorsFilters): Promise<CompetitorsResponse> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.radius) params.append('radius', filters.radius.toString());
      if (filters.fuelTypes?.length) params.append('fuelTypes', filters.fuelTypes.join(','));
      if (filters.brands?.length) params.append('brands', filters.brands.join(','));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const response = await apiClient.get<CompetitorsResponse>(
      `${this.baseUrl}/competitors?${params.toString()}`
    );
    return response.data;
  }

  async getPriceHistory(filters?: HistoryFilters): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.days) params.append('days', filters.days.toString());
      if (filters.fuelTypes?.length) params.append('fuelTypes', filters.fuelTypes.join(','));
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const response = await apiClient.get<HistoryResponse>(
      `${this.baseUrl}/history?${params.toString()}`
    );
    return response.data;
  }

  async updatePrice(request: UpdatePriceRequest): Promise<{ message: string; change: PriceChange }> {
    const response = await apiClient.post<{ message: string; change: PriceChange }>(
      `${this.baseUrl}/update`,
      request
    );
    return response.data;
  }

  async updateMultiplePrices(prices: UpdatePriceRequest[]): Promise<{ message: string; changes: PriceChange[] }> {
    const response = await apiClient.post<{ message: string; changes: PriceChange[] }>(
      `${this.baseUrl}/update-multiple`,
      { prices }
    );
    return response.data;
  }

  async getMarketTrends(days: number = 30): Promise<{
    trends: Array<{
      date: string;
      fuelType: FuelType;
      averagePrice: number;
      change: number;
      changePercentage: number;
    }>;
  }> {
    const response = await apiClient.get(
      `${this.baseUrl}/market-trends?days=${days}`
    );
    return response.data;
  }

  async getNearbyStations(lat: number, lng: number, radius: number = 5): Promise<Station[]> {
    const response = await apiClient.get<Station[]>(
      `${this.baseUrl}/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    );
    return response.data;
  }

  async getStationDetails(stationId: string): Promise<Station> {
    const response = await apiClient.get<Station>(
      `${this.baseUrl}/stations/${stationId}`
    );
    return response.data;
  }

  async compareStations(stationIds: string[]): Promise<{
    stations: Station[];
    comparison: {
      fuelType: FuelType;
      cheapest: Station;
      mostExpensive: Station;
      averagePrice: number;
      priceRange: number;
    }[];
  }> {
    const response = await apiClient.post(
      `${this.baseUrl}/compare`,
      { stationIds }
    );
    return response.data;
  }
}

export const pricingService = new PricingService();
export default pricingService;