import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { FuelType } from "@fuelintel/shared";

interface Station {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  lat: number;
  lng: number;
  entidad_id: number;
  municipio_id: number;
  is_active: boolean;
}

interface PriceData {
  station_numero: string;
  fuel_type: FuelType;
  price: number;
  previousPrice?: number;
  changed_at: string;
  detected_at: string;
}

interface CompetitorData extends Station {
  prices: {
    [key in FuelType]?: number;
  };
  distance?: number;
  lastUpdated?: string;
}

interface PriceFilters {
  fuelType?: "all" | FuelType;
  radius: number;
  brands: string[];
}

interface PriceCacheEntry {
  data: PriceData[];
  timestamp: number;
}

interface PricingState {
  // Current station context
  selectedStationNumero: string | null;
  selectedStation: Station | null;

  // Price data
  currentPrices: Map<string, PriceData[]>;
  competitors: CompetitorData[];

  // Filters
  filters: PriceFilters;

  // Loading states
  isLoadingPrices: boolean;
  isLoadingCompetitors: boolean;

  // Error states
  pricesError: string | null;
  competitorsError: string | null;

  // Cache
  priceCache: Map<string, PriceCacheEntry>;
}

interface PricingActions {
  // Actions
  setSelectedStation: (station: Station) => void;
  setCurrentPrices: (stationNumero: string, prices: PriceData[]) => void;
  setCompetitors: (competitors: CompetitorData[]) => void;
  setFilter: <K extends keyof PriceFilters>(
    key: K,
    value: PriceFilters[K],
  ) => void;
  resetFilters: () => void;
  setLoadingPrices: (loading: boolean) => void;
  setLoadingCompetitors: (loading: boolean) => void;
  setPricesError: (error: string | null) => void;
  setCompetitorsError: (error: string | null) => void;
  clearCacheForStation: (stationNumero: string) => void;
  clearAllCache: () => void;

  // Computed getters
  getStationPrices: (stationNumero: string) => PriceData[] | undefined;
  getFilteredCompetitors: () => CompetitorData[];
  isCacheValid: (stationNumero: string) => boolean;
}

type PricingStore = PricingState & PricingActions;

const DEFAULT_FILTERS: PriceFilters = {
  fuelType: "all",
  radius: 10,
  brands: [],
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const initialState: PricingState = {
  selectedStationNumero: null,
  selectedStation: null,
  currentPrices: new Map(),
  competitors: [],
  filters: DEFAULT_FILTERS,
  isLoadingPrices: false,
  isLoadingCompetitors: false,
  pricesError: null,
  competitorsError: null,
  priceCache: new Map(),
};

export const usePricingStore = create<PricingStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setSelectedStation: (station) => {
          set((state) => {
            // Clear cache if switching stations
            if (state.selectedStationNumero !== station.numero) {
              state.clearCacheForStation(state.selectedStationNumero || "");
            }
            return {
              selectedStationNumero: station.numero,
              selectedStation: station,
              competitors: [], // Reset competitors when switching stations
            };
          });
        },

        setCurrentPrices: (stationNumero, prices) => {
          set((state) => {
            const newPrices = new Map(state.currentPrices);
            newPrices.set(stationNumero, prices);

            // Update cache
            const newCache = new Map(state.priceCache);
            newCache.set(stationNumero, {
              data: prices,
              timestamp: Date.now(),
            });

            return {
              currentPrices: newPrices,
              priceCache: newCache,
              isLoadingPrices: false,
              pricesError: null,
            };
          });
        },

        setCompetitors: (competitors) => {
          set({
            competitors,
            isLoadingCompetitors: false,
            competitorsError: null,
          });
        },

        setFilter: (key, value) => {
          set((state) => ({
            filters: {
              ...state.filters,
              [key]: value,
            },
          }));
        },

        resetFilters: () => {
          set({ filters: DEFAULT_FILTERS });
        },

        setLoadingPrices: (loading) => {
          set({ isLoadingPrices: loading });
        },

        setLoadingCompetitors: (loading) => {
          set({ isLoadingCompetitors: loading });
        },

        setPricesError: (error) => {
          set({ pricesError: error, isLoadingPrices: false });
        },

        setCompetitorsError: (error) => {
          set({ competitorsError: error, isLoadingCompetitors: false });
        },

        clearCacheForStation: (stationNumero) => {
          set((state) => {
            const newCache = new Map(state.priceCache);
            newCache.delete(stationNumero);

            const newPrices = new Map(state.currentPrices);
            newPrices.delete(stationNumero);

            return {
              priceCache: newCache,
              currentPrices: newPrices,
            };
          });
        },

        clearAllCache: () => {
          set({
            priceCache: new Map(),
            currentPrices: new Map(),
            competitors: [],
          });
        },

        getStationPrices: (stationNumero) => {
          const state = get();
          return state.currentPrices.get(stationNumero);
        },

        getFilteredCompetitors: () => {
          const state = get();
          const { filters, competitors } = state;

          let filtered = [...competitors];

          // Filter by radius
          if (filters.radius) {
            filtered = filtered.filter(
              (c) => (c.distance || 0) <= filters.radius,
            );
          }

          // Filter by brands
          if (filters.brands.length > 0) {
            filtered = filtered.filter(
              (c) => c.brand && filters.brands.includes(c.brand),
            );
          }

          // Filter by fuel type
          if (filters.fuelType && filters.fuelType !== "all") {
            filtered = filtered.filter(
              (c) => c.prices[filters.fuelType as FuelType] !== undefined,
            );
          }

          return filtered;
        },

        isCacheValid: (stationNumero) => {
          const state = get();
          const cacheEntry = state.priceCache.get(stationNumero);

          if (!cacheEntry) return false;

          const now = Date.now();
          return now - cacheEntry.timestamp < CACHE_TTL;
        },
      }),
      {
        name: "pricing-store",
        partialize: (state) => ({
          selectedStationNumero: state.selectedStationNumero,
          selectedStation: state.selectedStation,
          filters: state.filters,
        }),
      },
    ),
    { name: "PricingStore" },
  ),
);
