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
  private readonly baseUrl = '/api/v1/prices';
  private abortControllers = new Map<string, AbortController>();

  // Request cancellation utility
  private createAbortController(key: string): AbortController {
    // Cancel any existing request with the same key
    const existingController = this.abortControllers.get(key);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    this.abortControllers.set(key, controller);
    
    // Clean up after request completes
    controller.signal.addEventListener('abort', () => {
      this.abortControllers.delete(key);
    });

    return controller;
  }

  private handleApiError(error: unknown, operation: string): never {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`${operation} was cancelled`);
      }
      throw new Error(`${operation} failed: ${error.message}`);
    }
    throw new Error(`${operation} failed: Unknown error`);
  }

  async getCurrentPrices(): Promise<CurrentPricesResponse> {
    const controller = this.createAbortController('getCurrentPrices');
    
    try {
      const response = await apiClient.get<CurrentPricesResponse>(
        `${this.baseUrl}/current`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get current prices');
    }
  }

  async getStationPrices(stationNumber: string): Promise<Station> {
    const controller = this.createAbortController(`getStationPrices-${stationNumber}`);
    
    try {
      const response = await apiClient.get<Station>(
        `${this.baseUrl}/station/${stationNumber}`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get station prices');
    }
  }

  async getNearbyCompetitors(lat: number, lng: number, radius: number = 5): Promise<CompetitorsResponse> {
    const controller = this.createAbortController('getNearbyCompetitors');
    
    try {
      const response = await apiClient.post<CompetitorsResponse>(
        `${this.baseUrl}/nearby`,
        { lat, lng, radius },
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get nearby competitors');
    }
  }

  async getCompetitors(filters?: CompetitorsFilters): Promise<CompetitorsResponse> {
    const controller = this.createAbortController('getCompetitors');
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.radius) params.append('radius', filters.radius.toString());
      if (filters.fuelTypes?.length) params.append('fuel_type', filters.fuelTypes.join(','));
      if (filters.brands?.length) params.append('brand', filters.brands.join(','));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    try {
      const response = await apiClient.get<CompetitorsResponse>(
        `/api/v1/competitors?${params.toString()}`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get competitors');
    }
  }

  async getPriceHistory(filters?: HistoryFilters): Promise<HistoryResponse> {
    const controller = this.createAbortController('getPriceHistory');
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.days) params.append('days', filters.days.toString());
      if (filters.fuelTypes?.length) params.append('fuel_type', filters.fuelTypes.join(','));
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    try {
      const response = await apiClient.get<HistoryResponse>(
        `${this.baseUrl}/history?${params.toString()}`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get price history');
    }
  }

  async updatePrice(request: UpdatePriceRequest): Promise<{ message: string; change: PriceChange }> {
    const controller = this.createAbortController('updatePrice');
    
    try {
      const response = await apiClient.post<{ message: string; change: PriceChange }>(
        `${this.baseUrl}/update`,
        request,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Update price');
    }
  }

  async updateMultiplePrices(prices: UpdatePriceRequest[]): Promise<{ message: string; changes: PriceChange[] }> {
    const controller = this.createAbortController('updateMultiplePrices');
    
    try {
      const response = await apiClient.post<{ message: string; changes: PriceChange[] }>(
        `${this.baseUrl}/update-multiple`,
        { prices },
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Update multiple prices');
    }
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
    const controller = this.createAbortController('getMarketTrends');
    
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/market-trends?days=${days}`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get market trends');
    }
  }

  async getNearbyStations(lat: number, lng: number, radius: number = 5): Promise<Station[]> {
    const controller = this.createAbortController('getNearbyStations');
    
    try {
      const response = await apiClient.get<Station[]>(
        `${this.baseUrl}/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get nearby stations');
    }
  }

  async getStationDetails(stationId: string): Promise<Station> {
    const controller = this.createAbortController(`getStationDetails-${stationId}`);
    
    try {
      const response = await apiClient.get<Station>(
        `${this.baseUrl}/stations/${stationId}`,
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Get station details');
    }
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
    const controller = this.createAbortController('compareStations');
    
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/compare`,
        { stationIds },
        { signal: controller.signal }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'Compare stations');
    }
  }

  // Request cancellation method
  cancelRequest(key: string): void {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
    }
  }

  // Cancel all pending requests
  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }
}

export const pricingService = new PricingService();
export default pricingService;