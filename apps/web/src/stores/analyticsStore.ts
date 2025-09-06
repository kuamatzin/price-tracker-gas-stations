import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChartDataPoint, FuelType, ComparisonDataPoint } from '../types/charts';
import { analyticsService, type StationHistoryParams, type MarketTrendsParams } from '../services/api/analytics.service';
import { 
  performComprehensiveAnalysis,
  analyzeMarketComparison,
  detectSeasonalPatterns,
  analyzeMissingData,
  type TrendResult,
  type VolatilityResult,
  type MarketComparisonResult,
  type SeasonalPattern,
  type MissingDataInfo
} from '../utils/trendCalculations';

interface DateRange {
  start: Date;
  end: Date;
}

interface CacheEntry {
  data: ChartDataPoint[];
  timestamp: number;
  expiresAt: number;
}

interface DataCache {
  [key: string]: CacheEntry;
}

interface AggregatedData {
  daily: ChartDataPoint[];
  weekly: ChartDataPoint[];
  monthly: ChartDataPoint[];
}

interface AnalyticsState {
  // Historical price data
  historicalData: ChartDataPoint[];
  comparisonData: ComparisonDataPoint[];
  aggregatedData: AggregatedData;
  
  // Calculated analytics
  trendAnalysis: { [key in FuelType]?: ReturnType<typeof performComprehensiveAnalysis> };
  marketComparison: { [key in FuelType]?: MarketComparisonResult };
  seasonalPatterns: { [key in FuelType]?: SeasonalPattern[] };
  dataQuality: MissingDataInfo | null;
  
  // Selected filters
  selectedDateRange: DateRange;
  selectedFuels: FuelType[];
  
  // Cache management
  dataCache: DataCache;
  cacheExpiry: number; // in milliseconds
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setHistoricalData: (data: ChartDataPoint[]) => void;
  setComparisonData: (data: ComparisonDataPoint[]) => void;
  setDateRange: (range: DateRange) => void;
  setSelectedFuels: (fuels: FuelType[]) => void;
  toggleFuel: (fuel: FuelType) => void;
  selectAllFuels: () => void;
  deselectAllFuels: () => void;
  
  // Data fetching and caching
  fetchDataForRange: (range: DateRange) => Promise<ChartDataPoint[]>;
  fetchComparisonDataForRange: (range: DateRange) => Promise<ComparisonDataPoint[]>;
  getCachedData: (range: DateRange) => ChartDataPoint[] | null;
  setCachedData: (range: DateRange, data: ChartDataPoint[]) => void;
  clearCache: () => void;
  
  // Data aggregation
  aggregateData: (data: ChartDataPoint[], period: 'daily' | 'weekly' | 'monthly') => ChartDataPoint[];
  getFilteredData: () => ChartDataPoint[];
  
  // Trend calculations
  calculateTrendAnalysis: (fuelType?: FuelType) => void;
  calculateMarketComparison: (fuelType?: FuelType) => void;
  calculateSeasonalPatterns: (fuelType?: FuelType) => void;
  calculateDataQuality: () => void;
  performAllCalculations: () => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

const ALL_FUEL_TYPES: FuelType[] = ['regular', 'premium', 'diesel'];
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DATE_RANGE: DateRange = {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  end: new Date()
};

// Helper function to generate cache key
const generateCacheKey = (range: DateRange): string => {
  return `${range.start.getTime()}-${range.end.getTime()}`;
};

// Helper function to generate mock data
const generateMockDataForRange = (range: DateRange): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const current = new Date(range.start);
  const end = new Date(range.end);
  
  while (current <= end) {
    // Generate realistic fuel price variations
    const baseRegular = 95 + Math.sin(current.getTime() / (1000 * 60 * 60 * 24 * 7)) * 5;
    const basePremium = baseRegular + 8;
    const baseDiesel = baseRegular - 3;
    
    // Add some random variation
    const variation = (Math.random() - 0.5) * 4;
    
    data.push({
      date: current.toISOString().split('T')[0],
      regular: Number((baseRegular + variation).toFixed(2)),
      premium: Number((basePremium + variation).toFixed(2)),
      diesel: Number((baseDiesel + variation).toFixed(2)),
      timestamp: current.getTime()
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return data;
};

// Helper function to aggregate data by period
const aggregateByPeriod = (data: ChartDataPoint[], period: 'daily' | 'weekly' | 'monthly'): ChartDataPoint[] => {
  if (period === 'daily') return data;
  
  const grouped: { [key: string]: ChartDataPoint[] } = {};
  
  data.forEach(point => {
    const date = new Date(point.date);
    let key: string;
    
    if (period === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      // monthly
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(point);
  });
  
  return Object.entries(grouped).map(([date, points]) => ({
    date,
    regular: Number((points.reduce((sum, p) => sum + p.regular, 0) / points.length).toFixed(2)),
    premium: Number((points.reduce((sum, p) => sum + p.premium, 0) / points.length).toFixed(2)),
    diesel: Number((points.reduce((sum, p) => sum + p.diesel, 0) / points.length).toFixed(2)),
    timestamp: new Date(date).getTime()
  })).sort((a, b) => a.timestamp - b.timestamp);
};

export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      historicalData: [],
      comparisonData: [],
      aggregatedData: {
        daily: [],
        weekly: [],
        monthly: []
      },
      
      // Calculated analytics
      trendAnalysis: {},
      marketComparison: {},
      seasonalPatterns: {},
      dataQuality: null,
      
      selectedDateRange: DEFAULT_DATE_RANGE,
      selectedFuels: ALL_FUEL_TYPES,
      dataCache: {},
      cacheExpiry: CACHE_EXPIRY_MS,
      isLoading: false,
      error: null,
      
      // Data setters
      setHistoricalData: (data) => {
        const daily = data;
        const weekly = aggregateByPeriod(data, 'weekly');
        const monthly = aggregateByPeriod(data, 'monthly');
        
        set({
          historicalData: data,
          aggregatedData: { daily, weekly, monthly }
        });
        
        // Automatically perform calculations when new data is loaded
        const state = get();
        setTimeout(() => {
          state.performAllCalculations();
        }, 0);
      },
      
      setComparisonData: (data) => {
        set({ comparisonData: data });
        
        // Automatically calculate market comparison when new comparison data is loaded
        const state = get();
        setTimeout(() => {
          state.calculateMarketComparison();
        }, 0);
      },
      
      // Filter setters
      setDateRange: (range) => set({ selectedDateRange: range }),
      setSelectedFuels: (fuels) => set({ selectedFuels: fuels }),
      
      toggleFuel: (fuel) => {
        const { selectedFuels } = get();
        const newFuels = selectedFuels.includes(fuel)
          ? selectedFuels.filter(f => f !== fuel)
          : [...selectedFuels, fuel];
        set({ selectedFuels: newFuels });
      },
      
      selectAllFuels: () => set({ selectedFuels: ALL_FUEL_TYPES }),
      deselectAllFuels: () => set({ selectedFuels: [] }),
      
      // Cache management
      getCachedData: (range) => {
        const { dataCache } = get();
        const key = generateCacheKey(range);
        const entry = dataCache[key];
        
        if (!entry || Date.now() > entry.expiresAt) {
          return null;
        }
        
        return entry.data;
      },
      
      setCachedData: (range, data) => {
        const { dataCache } = get();
        const key = generateCacheKey(range);
        
        set({
          dataCache: {
            ...dataCache,
            [key]: {
              data,
              timestamp: Date.now(),
              expiresAt: Date.now() + get().cacheExpiry
            }
          }
        });
      },
      
      clearCache: () => set({ dataCache: {} }),
      
      // Data fetching
      fetchDataForRange: async (range) => {
        const state = get();
        
        // Check cache first
        const cachedData = state.getCachedData(range);
        if (cachedData) {
          return cachedData;
        }
        
        try {
          state.setLoading(true);
          state.setError(null);
          
          // Use real analytics service for data fetching
          // For now, use a default station ID - this should come from user context
          const stationId = 'default-station'; // TODO: Get from user context/auth
          
          const params: StationHistoryParams = {
            stationId,
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0]
          };
          
          let data: ChartDataPoint[];
          
          try {
            // Try to fetch from API first
            data = await analyticsService.getStationHistory(params);
          } catch (apiError) {
            console.warn('API call failed, falling back to mock data:', apiError);
            // Fallback to mock data if API fails
            data = generateMockDataForRange(range);
          }
          
          // Cache the data
          state.setCachedData(range, data);
          
          // Update store with new data
          state.setHistoricalData(data);
          
          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
          state.setError(errorMessage);
          throw error;
        } finally {
          state.setLoading(false);
        }
      },
      
      // Fetch comparison data for market trends
      fetchComparisonDataForRange: async (range) => {
        const state = get();
        
        try {
          state.setLoading(true);
          state.setError(null);
          
          // Use real analytics service for market trends
          const params: MarketTrendsParams = {
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0],
            grouping: 'daily'
          };
          
          let data: ComparisonDataPoint[];
          
          try {
            // Try to fetch from API first
            data = await analyticsService.getMarketTrends(params);
          } catch (apiError) {
            console.warn('API call for market trends failed, falling back to mock data:', apiError);
            // Fallback to mock data based on historical data
            const historicalData = state.historicalData;
            data = historicalData.map(point => ({
              ...point,
              marketAverage: {
                regular: point.regular ? point.regular * (0.95 + Math.random() * 0.1) : undefined,
                premium: point.premium ? point.premium * (0.95 + Math.random() * 0.1) : undefined,
                diesel: point.diesel ? point.diesel * (0.95 + Math.random() * 0.1) : undefined,
              }
            }));
          }
          
          // Update store with new comparison data
          state.setComparisonData(data);
          
          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch comparison data';
          state.setError(errorMessage);
          throw error;
        } finally {
          state.setLoading(false);
        }
      },
      
      // Data aggregation
      aggregateData: (data, period) => {
        return aggregateByPeriod(data, period);
      },
      
      getFilteredData: () => {
        const { historicalData, selectedFuels, selectedDateRange } = get();
        
        return historicalData.filter(point => {
          const pointDate = new Date(point.date);
          return pointDate >= selectedDateRange.start && pointDate <= selectedDateRange.end;
        }).map(point => {
          const filtered: any = { date: point.date, timestamp: point.timestamp };
          selectedFuels.forEach(fuel => {
            filtered[fuel] = point[fuel];
          });
          return filtered as ChartDataPoint;
        });
      },
      
      // Trend calculation methods
      calculateTrendAnalysis: (fuelType) => {
        const state = get();
        const data = state.historicalData;
        
        if (!data.length) return;
        
        const fuelsToAnalyze = fuelType ? [fuelType] : ALL_FUEL_TYPES;
        const newTrendAnalysis = { ...state.trendAnalysis };
        
        fuelsToAnalyze.forEach(fuel => {
          newTrendAnalysis[fuel] = performComprehensiveAnalysis(
            data, 
            fuel, 
            state.selectedDateRange
          );
        });
        
        set({ trendAnalysis: newTrendAnalysis });
      },
      
      calculateMarketComparison: (fuelType) => {
        const state = get();
        const data = state.comparisonData;
        
        if (!data.length) return;
        
        const fuelsToAnalyze = fuelType ? [fuelType] : ALL_FUEL_TYPES;
        const newMarketComparison = { ...state.marketComparison };
        
        fuelsToAnalyze.forEach(fuel => {
          newMarketComparison[fuel] = analyzeMarketComparison(data, fuel);
        });
        
        set({ marketComparison: newMarketComparison });
      },
      
      calculateSeasonalPatterns: (fuelType) => {
        const state = get();
        const data = state.historicalData;
        
        if (!data.length) return;
        
        const fuelsToAnalyze = fuelType ? [fuelType] : ALL_FUEL_TYPES;
        const newSeasonalPatterns = { ...state.seasonalPatterns };
        
        fuelsToAnalyze.forEach(fuel => {
          newSeasonalPatterns[fuel] = detectSeasonalPatterns(data, fuel);
        });
        
        set({ seasonalPatterns: newSeasonalPatterns });
      },
      
      calculateDataQuality: () => {
        const state = get();
        const data = state.historicalData;
        
        if (!data.length) {
          set({ dataQuality: null });
          return;
        }
        
        const dataQuality = analyzeMissingData(data, state.selectedDateRange);
        set({ dataQuality });
      },
      
      performAllCalculations: () => {
        const state = get();
        
        // Perform all calculations for all fuel types
        state.calculateTrendAnalysis();
        state.calculateSeasonalPatterns();
        state.calculateDataQuality();
        
        // Only calculate market comparison if we have comparison data
        if (state.comparisonData.length) {
          state.calculateMarketComparison();
        }
      },
      
      // State management
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      resetState: () => set({
        historicalData: [],
        comparisonData: [],
        aggregatedData: { daily: [], weekly: [], monthly: [] },
        trendAnalysis: {},
        marketComparison: {},
        seasonalPatterns: {},
        dataQuality: null,
        selectedDateRange: DEFAULT_DATE_RANGE,
        selectedFuels: ALL_FUEL_TYPES,
        dataCache: {},
        isLoading: false,
        error: null
      })
    }),
    { name: 'analytics-store' }
  )
);

export type { DateRange, AggregatedData, AnalyticsState };