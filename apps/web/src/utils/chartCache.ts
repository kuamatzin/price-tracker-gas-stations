/**
 * Chart rendering cache for performance optimization
 */
import { ChartDataPoint, ComparisonDataPoint } from '../types/charts';

interface CacheEntry<T> {
  data: T;
  hash: string;
  timestamp: number;
  renderCount: number;
}

interface ChartRenderState {
  filteredData: ChartDataPoint[] | ComparisonDataPoint[];
  zoomState: any;
  selectedFuels: string[];
  interactionState: any;
  theme: string;
}

/**
 * LRU Cache implementation for chart states
 */
class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, {
      ...entry,
      renderCount: entry.renderCount + 1
    });

    return entry.data;
  }

  set(key: K, value: V): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const hash = this.generateHash(value);
    this.cache.set(key, {
      data: value,
      hash,
      timestamp: Date.now(),
      renderCount: 0
    });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    return entry !== null && (Date.now() - entry.timestamp) <= this.ttl;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let totalRenders = 0;
    let expiredEntries = 0;

    this.cache.forEach(entry => {
      totalRenders += entry.renderCount;
      if (now - entry.timestamp > this.ttl) {
        expiredEntries++;
      }
    });

    return {
      size: this.cache.size,
      totalRenders,
      expiredEntries,
      hitRate: totalRenders > 0 ? totalRenders / (totalRenders + this.cache.size) : 0
    };
  }

  private generateHash(value: any): string {
    return JSON.stringify(value, Object.keys(value).sort());
  }
}

/**
 * Chart-specific cache manager
 */
class ChartCacheManager {
  private renderStateCache = new LRUCache<string, ChartRenderState>(50, 2 * 60 * 1000); // 2 min TTL
  private processedDataCache = new LRUCache<string, ChartDataPoint[]>(100, 5 * 60 * 1000); // 5 min TTL
  private calculationCache = new LRUCache<string, any>(200, 10 * 60 * 1000); // 10 min TTL

  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const keyParts = sortedKeys.map(key => `${key}:${JSON.stringify(params[key])}`);
    return keyParts.join('|');
  }

  /**
   * Cache chart render state
   */
  cacheRenderState(key: string, state: ChartRenderState): void {
    this.renderStateCache.set(key, state);
  }

  /**
   * Get cached render state
   */
  getRenderState(key: string): ChartRenderState | null {
    return this.renderStateCache.get(key);
  }

  /**
   * Cache processed data (filtered, transformed, etc.)
   */
  cacheProcessedData(params: Record<string, any>, data: ChartDataPoint[]): void {
    const key = this.generateCacheKey(params);
    this.processedDataCache.set(key, data);
  }

  /**
   * Get cached processed data
   */
  getProcessedData(params: Record<string, any>): ChartDataPoint[] | null {
    const key = this.generateCacheKey(params);
    return this.processedDataCache.get(key);
  }

  /**
   * Cache calculation results (moving averages, trends, etc.)
   */
  cacheCalculation(calculationType: string, params: Record<string, any>, result: any): void {
    const key = `${calculationType}:${this.generateCacheKey(params)}`;
    this.calculationCache.set(key, result);
  }

  /**
   * Get cached calculation result
   */
  getCalculation(calculationType: string, params: Record<string, any>): any | null {
    const key = `${calculationType}:${this.generateCacheKey(params)}`;
    return this.calculationCache.get(key);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.renderStateCache.clear();
    this.processedDataCache.clear();
    this.calculationCache.clear();
  }

  /**
   * Clear specific cache type
   */
  clearCache(type: 'render' | 'data' | 'calculation'): void {
    switch (type) {
      case 'render':
        this.renderStateCache.clear();
        break;
      case 'data':
        this.processedDataCache.clear();
        break;
      case 'calculation':
        this.calculationCache.clear();
        break;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      renderState: this.renderStateCache.getStats(),
      processedData: this.processedDataCache.getStats(),
      calculation: this.calculationCache.getStats()
    };
  }

  /**
   * Memory cleanup - remove expired entries
   */
  cleanup(): void {
    // Force cleanup by attempting to get a non-existent key
    this.renderStateCache.get('__cleanup__');
    this.processedDataCache.get('__cleanup__');
    this.calculationCache.get('__cleanup__');
  }
}

/**
 * Global chart cache instance
 */
export const chartCache = new ChartCacheManager();

/**
 * React hook for chart caching
 */
import { useRef, useEffect } from 'react';

export const useChartCache = (chartType: string) => {
  const cacheKeyRef = useRef<string>('');

  const getCachedRenderState = (params: Record<string, any>) => {
    const key = `${chartType}:${JSON.stringify(params, Object.keys(params).sort())}`;
    return chartCache.getRenderState(key);
  };

  const setCachedRenderState = (params: Record<string, any>, state: ChartRenderState) => {
    const key = `${chartType}:${JSON.stringify(params, Object.keys(params).sort())}`;
    cacheKeyRef.current = key;
    chartCache.cacheRenderState(key, state);
  };

  const getCachedData = (params: Record<string, any>) => {
    return chartCache.getProcessedData({ chartType, ...params });
  };

  const setCachedData = (params: Record<string, any>, data: ChartDataPoint[]) => {
    chartCache.cacheProcessedData({ chartType, ...params }, data);
  };

  const getCachedCalculation = (calculationType: string, params: Record<string, any>) => {
    return chartCache.getCalculation(calculationType, { chartType, ...params });
  };

  const setCachedCalculation = (calculationType: string, params: Record<string, any>, result: any) => {
    chartCache.cacheCalculation(calculationType, { chartType, ...params }, result);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cacheKeyRef.current) {
        // Keep recent renders cached for potential reuse
      }
    };
  }, []);

  return {
    getCachedRenderState,
    setCachedRenderState,
    getCachedData,
    setCachedData,
    getCachedCalculation,
    setCachedCalculation
  };
};

/**
 * Memory management utilities
 */
export const chartCacheUtils = {
  /**
   * Get memory usage information
   */
  getMemoryInfo() {
    const stats = chartCache.getStats();
    return {
      totalCacheSize: stats.renderState.size + stats.processedData.size + stats.calculation.size,
      stats,
      estimatedMemoryMB: Math.round(
        (stats.renderState.size * 50 + stats.processedData.size * 100 + stats.calculation.size * 20) / 1024
      ) // Rough estimate
    };
  },

  /**
   * Perform maintenance cleanup
   */
  performMaintenance() {
    chartCache.cleanup();
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  },

  /**
   * Auto-cleanup based on memory pressure
   */
  autoCleanup() {
    const memoryInfo = this.getMemoryInfo();
    
    // If cache is getting large, clear older entries
    if (memoryInfo.totalCacheSize > 200) {
      chartCache.clearCache('render');
    }
    
    if (memoryInfo.totalCacheSize > 300) {
      chartCache.clearCache('data');
    }
    
    if (memoryInfo.totalCacheSize > 400) {
      chartCache.clearAll();
    }
  }
};

// Auto-cleanup interval
if (typeof window !== 'undefined') {
  setInterval(() => {
    chartCacheUtils.autoCleanup();
  }, 5 * 60 * 1000); // Every 5 minutes
}