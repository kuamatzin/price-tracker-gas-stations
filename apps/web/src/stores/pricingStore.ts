import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type FuelType = "regular" | "premium" | "diesel";

export interface Station {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  lat: number;
  lng: number;
  distance?: number;
  regular?: number;
  premium?: number;
  diesel?: number;
  lastUpdated: string;
  isUserStation?: boolean;
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

export interface PriceFilters {
  fuelType: "all" | FuelType;
  radius: number;
  brands: string[];
}

export interface MarketAverages {
  regular?: number;
  premium?: number;
  diesel?: number;
}

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface PricingState {
  // Core Data
  currentPrices: Record<FuelType, number>;
  userStation?: Station;
  competitors: Station[];
  history: PriceChange[];
  marketAverages: MarketAverages;

  // Meta
  lastUpdated: string;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: PriceFilters;
  availableBrands: string[];

  // Pagination
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };

  // Cache
  cache: Map<string, CacheEntry>;

  // Auto-refresh
  refreshInterval?: NodeJS.Timeout;
  autoRefreshEnabled: boolean;
}

interface PricingActions {
  // Data fetching
  fetchCurrentPrices: () => Promise<void>;
  fetchCompetitors: (page?: number) => Promise<void>;
  fetchHistory: (days?: number) => Promise<void>;
  fetchMarketAverages: () => Promise<void>;
  fetchUserStation: () => Promise<void>;

  // Price management
  updatePrice: (fuelType: FuelType, price: number) => Promise<void>;
  updateMultiplePrices: (
    prices: Array<{ fuelType: FuelType; price: number }>,
  ) => Promise<void>;

  // Filter management
  setFilters: (filters: Partial<PriceFilters>) => void;
  resetFilters: () => void;

  // Cache management
  getCachedData: <T>(key: string) => T | null;
  setCachedData: <T>(key: string, data: T, ttl?: number) => void;
  clearCache: (key?: string) => void;

  // Auto-refresh
  startAutoRefresh: (interval?: number) => void;
  stopAutoRefresh: () => void;
  refreshData: () => Promise<void>;

  // Utilities
  clearError: () => void;
  setLoading: (loading: boolean) => void;

  // Pagination
  loadNextPage: () => Promise<void>;
  loadPreviousPage: () => Promise<void>;
  resetPagination: () => void;
}

type PricingStore = PricingState & PricingActions;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const initialState: PricingState = {
  // Core Data
  currentPrices: {
    regular: 0,
    premium: 0,
    diesel: 0,
  },
  userStation: undefined,
  competitors: [],
  history: [],
  marketAverages: {},

  // Meta
  lastUpdated: "",
  isLoading: false,
  error: null,

  // Filters
  filters: {
    fuelType: "all",
    radius: 5,
    brands: [],
  },
  availableBrands: [],

  // Pagination
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  },

  // Cache
  cache: new Map(),

  // Auto-refresh
  refreshInterval: undefined,
  autoRefreshEnabled: false,
};

export const usePricingStore = create<PricingStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Data fetching
        fetchCurrentPrices: async () => {
          const cacheKey = "currentPrices";
          const cached = get().getCachedData<{
            prices: Record<FuelType, number>;
            userStation?: Station;
            lastUpdated: string;
          }>(cacheKey);
          if (cached) {
            set({
              currentPrices: cached.prices,
              userStation: cached.userStation,
              lastUpdated: cached.lastUpdated,
            });
            return;
          }

          set({ isLoading: true, error: null });
          try {
            // Import the pricing service
            const { pricingService } = await import(
              "../services/api/pricing.service"
            );
            const data = await pricingService.getCurrentPrices();

            set({
              currentPrices: data.prices,
              userStation: data.station
                ? { ...data.station, isUserStation: true }
                : undefined,
              lastUpdated: data.lastUpdated,
              isLoading: false,
            });

            get().setCachedData(cacheKey, data, CACHE_TTL);
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch prices",
              isLoading: false,
            });
          }
        },

        fetchCompetitors: async (page = 1) => {
          const state = get();
          const cacheKey = `competitors_${JSON.stringify(state.filters)}_${page}`;
          const cached = get().getCachedData<{
            stations: Station[];
            pagination: {
              total: number;
              page: number;
              limit: number;
              hasNextPage: boolean;
              hasPrevPage: boolean;
            };
          }>(cacheKey);

          if (cached) {
            set({
              competitors:
                page === 1
                  ? cached.stations
                  : [...state.competitors, ...cached.stations],
              pagination: cached.pagination,
              availableBrands: [
                ...new Set([
                  ...state.availableBrands,
                  ...cached.stations
                    .map((s: Station) => s.brand)
                    .filter(Boolean),
                ]),
              ],
            });
            return;
          }

          set({ isLoading: true, error: null });
          try {
            const { pricingService } = await import(
              "../services/api/pricing.service"
            );
            const filters = {
              radius: state.filters.radius,
              fuelTypes:
                state.filters.fuelType === "all"
                  ? undefined
                  : [state.filters.fuelType],
              brands:
                state.filters.brands.length > 0
                  ? state.filters.brands
                  : undefined,
              page,
              limit: state.pagination.limit,
            };

            const data = await pricingService.getCompetitors(filters);

            set({
              competitors:
                page === 1
                  ? data.stations
                  : [...state.competitors, ...data.stations],
              pagination: data.pagination,
              availableBrands: [
                ...new Set([
                  ...state.availableBrands,
                  ...data.stations.map((s) => s.brand).filter(Boolean),
                ]),
              ],
              isLoading: false,
            });

            get().setCachedData(cacheKey, data, CACHE_TTL);
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch competitors",
              isLoading: false,
            });
          }
        },

        fetchHistory: async (days = 30) => {
          const cacheKey = `history_${days}`;
          const cached = get().getCachedData<{
            stations: Station[];
            pagination: {
              total: number;
              page: number;
              limit: number;
              hasNextPage: boolean;
              hasPrevPage: boolean;
            };
          }>(cacheKey);
          if (cached) {
            set({ history: cached.changes });
            return;
          }

          set({ isLoading: true, error: null });
          try {
            const { pricingService } = await import(
              "../services/api/pricing.service"
            );
            const data = await pricingService.getPriceHistory({ days });

            set({
              history: data.changes,
              isLoading: false,
            });

            get().setCachedData(cacheKey, data, CACHE_TTL);
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to fetch history",
              isLoading: false,
            });
          }
        },

        fetchMarketAverages: async () => {
          const cacheKey = "marketAverages";
          const cached = get().getCachedData<MarketAverages>(cacheKey);
          if (cached) {
            set({ marketAverages: cached });
            return;
          }

          try {
            const { pricingService } = await import(
              "../services/api/pricing.service"
            );
            const trends = await pricingService.getMarketTrends(7);

            // Calculate averages from trends
            const averages: MarketAverages = {};
            const fuelTypes: FuelType[] = ["regular", "premium", "diesel"];

            fuelTypes.forEach((fuelType) => {
              const fuelTrends = trends.trends.filter(
                (t) => t.fuelType === fuelType,
              );
              if (fuelTrends.length > 0) {
                averages[fuelType] =
                  fuelTrends[fuelTrends.length - 1].averagePrice;
              }
            });

            set({ marketAverages: averages });
            get().setCachedData(cacheKey, averages, CACHE_TTL);
          } catch (error) {
            console.warn("Failed to fetch market averages:", error);
          }
        },

        fetchUserStation: async () => {
          try {
            // This would typically get the user's station from their profile
            // For now, we'll handle it in fetchCurrentPrices
            await get().fetchCurrentPrices();
          } catch (error) {
            console.warn("Failed to fetch user station:", error);
          }
        },

        // Price management
        updatePrice: async (fuelType: FuelType, price: number) => {
          set({ isLoading: true, error: null });
          try {
            const { pricingService } = await import(
              "../services/api/pricing.service"
            );
            await pricingService.updatePrice({ fuelType, price });

            set((state) => ({
              currentPrices: {
                ...state.currentPrices,
                [fuelType]: price,
              },
              lastUpdated: new Date().toISOString(),
              isLoading: false,
            }));

            // Clear relevant caches
            get().clearCache("currentPrices");
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update price",
              isLoading: false,
            });
          }
        },

        updateMultiplePrices: async (prices) => {
          set({ isLoading: true, error: null });
          try {
            const { pricingService } = await import(
              "../services/api/pricing.service"
            );
            await pricingService.updateMultiplePrices(prices);

            set((state) => {
              const newPrices = { ...state.currentPrices };
              prices.forEach(({ fuelType, price }) => {
                newPrices[fuelType] = price;
              });

              return {
                currentPrices: newPrices,
                lastUpdated: new Date().toISOString(),
                isLoading: false,
              };
            });

            get().clearCache("currentPrices");
          } catch (error) {
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update prices",
              isLoading: false,
            });
          }
        },

        // Filter management
        setFilters: (newFilters: Partial<PriceFilters>) => {
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
            pagination: { ...state.pagination, page: 1 }, // Reset pagination
            competitors: [], // Clear current competitors
          }));

          // Fetch new data with updated filters
          get().fetchCompetitors(1);
        },

        resetFilters: () => {
          const defaultFilters: PriceFilters = {
            fuelType: "all",
            radius: 5,
            brands: [],
          };
          get().setFilters(defaultFilters);
        },

        // Cache management
        getCachedData: <T>(key: string): T | null => {
          const cache = get().cache;
          const entry = cache.get(key);

          if (!entry) return null;

          if (Date.now() > entry.timestamp + entry.ttl) {
            cache.delete(key);
            return null;
          }

          return entry.data;
        },

        setCachedData: <T>(key: string, data: T, ttl = CACHE_TTL) => {
          const cache = get().cache;
          cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
          });
        },

        clearCache: (key?: string) => {
          const cache = get().cache;
          if (key) {
            cache.delete(key);
          } else {
            cache.clear();
          }
        },

        // Auto-refresh
        startAutoRefresh: (interval = REFRESH_INTERVAL) => {
          const state = get();
          if (state.refreshInterval) {
            clearInterval(state.refreshInterval);
          }

          const intervalId = setInterval(() => {
            get().refreshData();
          }, interval);

          set({
            refreshInterval: intervalId,
            autoRefreshEnabled: true,
          });
        },

        stopAutoRefresh: () => {
          const state = get();
          if (state.refreshInterval) {
            clearInterval(state.refreshInterval);
          }
          set({
            refreshInterval: undefined,
            autoRefreshEnabled: false,
          });
        },

        refreshData: async () => {
          const state = get();
          try {
            await Promise.all([
              state.fetchCurrentPrices(),
              state.fetchCompetitors(1),
              state.fetchMarketAverages(),
            ]);
          } catch (error) {
            console.warn("Auto-refresh failed:", error);
          }
        },

        // Utilities
        clearError: () => {
          set({ error: null });
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },

        // Pagination
        loadNextPage: async () => {
          const state = get();
          if (state.pagination.hasNextPage && !state.isLoading) {
            await state.fetchCompetitors(state.pagination.page + 1);
          }
        },

        loadPreviousPage: async () => {
          const state = get();
          if (state.pagination.hasPrevPage && !state.isLoading) {
            await state.fetchCompetitors(state.pagination.page - 1);
          }
        },

        resetPagination: () => {
          set((state) => ({
            pagination: {
              ...state.pagination,
              page: 1,
            },
            competitors: [],
          }));
        },
      }),
      {
        name: "pricing-store",
        partialize: (state) => ({
          filters: state.filters,
          autoRefreshEnabled: state.autoRefreshEnabled,
        }),
      },
    ),
    {
      name: "pricing-store",
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === "true",
    },
  ),
);
