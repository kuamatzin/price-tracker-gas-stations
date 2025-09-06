import { useEffect, useRef, useCallback } from 'react';

/**
 * Debounce hook for delaying function execution
 */
export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps?: React.DependencyList
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay, ...(deps || [])]
  );

  return debouncedCallback;
};

/**
 * Debounced value hook
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Fix import
import { useState } from 'react';

/**
 * Request debouncer for API calls
 */
export class RequestDebouncer {
  private timeouts = new Map<string, NodeJS.Timeout>();
  private abortControllers = new Map<string, AbortController>();

  debounce<T>(
    key: string,
    requestFn: (signal: AbortSignal) => Promise<T>,
    delay: number = 300
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Cancel previous request
      this.cancel(key);

      // Create new abort controller
      const abortController = new AbortController();
      this.abortControllers.set(key, abortController);

      // Set debounced timeout
      const timeout = setTimeout(async () => {
        try {
          const result = await requestFn(abortController.signal);
          
          // Clean up
          this.abortControllers.delete(key);
          this.timeouts.delete(key);
          
          resolve(result);
        } catch (error) {
          // Clean up
          this.abortControllers.delete(key);
          this.timeouts.delete(key);
          
          // Don't reject if request was aborted
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          
          reject(error);
        }
      }, delay);

      this.timeouts.set(key, timeout);
    });
  }

  cancel(key: string): void {
    // Cancel timeout
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }

    // Abort request
    const abortController = this.abortControllers.get(key);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(key);
    }
  }

  cancelAll(): void {
    // Cancel all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    // Abort all requests
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }
}

/**
 * Global request debouncer instance
 */
export const globalRequestDebouncer = new RequestDebouncer();

/**
 * Hook for debounced API requests
 */
export const useDebouncedRequest = <T>(
  requestFn: (signal: AbortSignal) => Promise<T>,
  delay: number = 300
) => {
  const debouncerRef = useRef(new RequestDebouncer());

  const debouncedRequest = useCallback(
    (key: string = 'default') => {
      return debouncerRef.current.debounce(key, requestFn, delay);
    },
    [requestFn, delay]
  );

  const cancelRequest = useCallback((key: string = 'default') => {
    debouncerRef.current.cancel(key);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncerRef.current.cancelAll();
    };
  }, []);

  return { debouncedRequest, cancelRequest };
};

/**
 * Debounced search hook
 */
export const useDebouncedSearch = <T>(
  searchFn: (query: string, signal: AbortSignal) => Promise<T[]>,
  delay: number = 300
) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { debouncedRequest, cancelRequest } = useDebouncedRequest(
    (signal: AbortSignal) => searchFn(query, signal),
    delay
  );

  const search = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      
      if (!searchQuery.trim()) {
        setResults([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await debouncedRequest('search');
        setResults(searchResults);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // Request was cancelled, ignore
        }
        
        setError(err instanceof Error ? err.message : 'Search error');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedRequest]
  );

  const clearSearch = useCallback(() => {
    cancelRequest('search');
    setQuery('');
    setResults([]);
    setIsLoading(false);
    setError(null);
  }, [cancelRequest]);

  return {
    query,
    results,
    isLoading,
    error,
    search,
    clearSearch
  };
};