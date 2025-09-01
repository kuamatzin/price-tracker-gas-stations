import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Station {
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

interface PriceChange {
  id: string;
  stationId: string;
  fuelType: FuelType;
  oldPrice: number;
  newPrice: number;
  change: number;
  percentage: number;
  timestamp: string;
}

type FuelType = 'regular' | 'premium' | 'diesel';

interface PricingState {
  currentPrices: Record<FuelType, number>;
  competitors: Station[];
  history: PriceChange[];
  lastUpdated: string;
  isLoading: boolean;
  error: string | null;
  filters: {
    radius: number;
    fuelTypes: FuelType[];
    brands: string[];
    sortBy: 'price' | 'distance' | 'name';
    sortOrder: 'asc' | 'desc';
  };
}

interface PricingActions {
  fetchCurrentPrices: () => Promise<void>;
  fetchCompetitors: (radius?: number) => Promise<void>;
  fetchHistory: (days?: number) => Promise<void>;
  updatePrice: (fuelType: FuelType, price: number) => Promise<void>;
  setFilters: (filters: Partial<PricingState['filters']>) => void;
  clearError: () => void;
}

type PricingStore = PricingState & PricingActions;

const initialState: PricingState = {
  currentPrices: {
    regular: 0,
    premium: 0,
    diesel: 0,
  },
  competitors: [],
  history: [],
  lastUpdated: '',
  isLoading: false,
  error: null,
  filters: {
    radius: 5,
    fuelTypes: ['regular', 'premium', 'diesel'],
    brands: [],
    sortBy: 'distance',
    sortOrder: 'asc',
  },
};

export const usePricingStore = create<PricingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchCurrentPrices: async () => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual API call
          const response = await fetch('/api/prices/current');
          if (!response.ok) throw new Error('Failed to fetch current prices');
          
          const data = await response.json();
          set({
            currentPrices: data.prices,
            lastUpdated: data.lastUpdated,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch prices',
            isLoading: false,
          });
        }
      },

      fetchCompetitors: async (radius = 5) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual API call
          const response = await fetch(`/api/competitors?radius=${radius}`);
          if (!response.ok) throw new Error('Failed to fetch competitors');
          
          const data = await response.json();
          set({
            competitors: data.stations,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch competitors',
            isLoading: false,
          });
        }
      },

      fetchHistory: async (days = 30) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual API call
          const response = await fetch(`/api/prices/history?days=${days}`);
          if (!response.ok) throw new Error('Failed to fetch price history');
          
          const data = await response.json();
          set({
            history: data.changes,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch history',
            isLoading: false,
          });
        }
      },

      updatePrice: async (fuelType: FuelType, price: number) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual API call
          const response = await fetch('/api/prices/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fuelType, price }),
          });
          
          if (!response.ok) throw new Error('Failed to update price');
          
          set((state) => ({
            currentPrices: {
              ...state.currentPrices,
              [fuelType]: price,
            },
            lastUpdated: new Date().toISOString(),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update price',
            isLoading: false,
          });
        }
      },

      setFilters: (filters: Partial<PricingState['filters']>) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'pricing-store',
      enabled: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    }
  )
);