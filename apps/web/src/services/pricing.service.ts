import { apiClient } from "@/lib/api-client";
import { FuelType } from "@fuelintel/shared";
import { usePricingStore } from "@/stores/pricingStore";

interface StationPriceResponse {
  numero: string;
  prices: {
    fuel_type: FuelType;
    price: number;
    previous_price?: number;
    changed_at: string;
    detected_at: string;
  }[];
}

interface CompetitorResponse {
  user_station: {
    numero: string;
    nombre: string;
    lat: number;
    lng: number;
  };
  competitors: {
    numero: string;
    nombre: string;
    brand?: string;
    direccion: string;
    lat: number;
    lng: number;
    prices: Record<FuelType, number>;
    last_updated: string;
  }[];
}

interface CurrentPricesResponse {
  data: {
    station_numero: string;
    fuel_type: FuelType;
    price: number;
    previous_price?: number;
    changed_at: string;
    detected_at: string;
  }[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
  };
}

class PricingService {
  private abortControllers: Map<string, AbortController> = new Map();

  async getCurrentPrices(stationNumero: string): Promise<void> {
    const store = usePricingStore.getState();

    // Check cache validity
    if (store.isCacheValid(stationNumero)) {
      return; // Use cached data
    }

    // Cancel previous request for this station if exists
    this.cancelRequest(`prices-${stationNumero}`);

    const controller = new AbortController();
    this.abortControllers.set(`prices-${stationNumero}`, controller);

    store.setLoadingPrices(true);

    try {
      const response = await apiClient.get<CurrentPricesResponse>(
        "/api/v1/prices/current",
        {
          params: { station_numero: stationNumero, fresh: true },
          signal: controller.signal,
        },
      );

      const priceData = response.data.data.map((price) => ({
        station_numero: price.station_numero,
        fuel_type: price.fuel_type,
        price: price.price,
        previousPrice: price.previous_price,
        changed_at: price.changed_at,
        detected_at: price.detected_at,
      }));

      store.setCurrentPrices(stationNumero, priceData);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        const message =
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message || "Failed to fetch current prices";
        store.setPricesError(message);
      }
    } finally {
      this.abortControllers.delete(`prices-${stationNumero}`);
    }
  }

  async getNearbyCompetitors(
    stationNumero: string,
    radius?: number,
  ): Promise<void> {
    const store = usePricingStore.getState();
    const station = store.selectedStation;

    if (!station) {
      store.setCompetitorsError("No station selected");
      return;
    }

    // Cancel previous request if exists
    this.cancelRequest("competitors");

    const controller = new AbortController();
    this.abortControllers.set("competitors", controller);

    store.setLoadingCompetitors(true);

    try {
      const response = await apiClient.post<CompetitorResponse>(
        "/api/v1/prices/nearby",
        {
          lat: station.lat,
          lng: station.lng,
          radius: radius || store.filters.radius,
        },
        {
          signal: controller.signal,
        },
      );

      const competitors = response.data.competitors.map((competitor) => ({
        numero: competitor.numero,
        nombre: competitor.nombre,
        brand: competitor.brand,
        direccion: competitor.direccion,
        lat: competitor.lat,
        lng: competitor.lng,
        entidad_id: station.entidad_id,
        municipio_id: station.municipio_id,
        is_active: true,
        prices: competitor.prices,
        lastUpdated: competitor.last_updated,
      }));

      store.setCompetitors(competitors);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        const message =
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message || "Failed to fetch competitors";
        store.setCompetitorsError(message);
      }
    } finally {
      this.abortControllers.delete("competitors");
    }
  }

  async getStationPrices(stationNumero: string): Promise<void> {
    const store = usePricingStore.getState();

    // Cancel previous request if exists
    this.cancelRequest(`station-${stationNumero}`);

    const controller = new AbortController();
    this.abortControllers.set(`station-${stationNumero}`, controller);

    store.setLoadingPrices(true);

    try {
      const response = await apiClient.get<StationPriceResponse>(
        `/api/v1/prices/station/${stationNumero}`,
        {
          signal: controller.signal,
        },
      );

      const priceData = response.data.prices.map((price) => ({
        station_numero: stationNumero,
        fuel_type: price.fuel_type,
        price: price.price,
        previousPrice: price.previous_price,
        changed_at: price.changed_at,
        detected_at: price.detected_at,
      }));

      store.setCurrentPrices(stationNumero, priceData);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        const message =
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message || "Failed to fetch station prices";
        store.setPricesError(message);
      }
    } finally {
      this.abortControllers.delete(`station-${stationNumero}`);
    }
  }

  cancelRequest(key: string): void {
    const controller = this.abortControllers.get(key);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(key);
    }
  }

  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }

  // Convenience method to refresh all data for a station
  async refreshStationData(stationNumero: string): Promise<void> {
    const store = usePricingStore.getState();

    // Clear cache for fresh data
    store.clearCacheForStation(stationNumero);

    // Fetch both prices and competitors in parallel
    await Promise.all([
      this.getCurrentPrices(stationNumero),
      this.getNearbyCompetitors(stationNumero),
    ]);
  }

  // Helper method to get cached prices if available
  getCachedPrices(stationNumero: string) {
    const store = usePricingStore.getState();

    if (store.isCacheValid(stationNumero)) {
      return store.getStationPrices(stationNumero);
    }

    return null;
  }
}

export const pricingService = new PricingService();
