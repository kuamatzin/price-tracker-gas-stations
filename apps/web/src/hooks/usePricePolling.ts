import { useEffect, useRef, useCallback, useState } from "react";
import { usePricingStore } from "@/stores/pricingStore";
import { pricingService } from "@/services/pricing.service";
import { isPriceStale } from "@/utils/priceComparison";

interface UsePricePollingOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  staleThreshold?: number; // in minutes
  onUpdate?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for polling price updates
 */
export const usePricePolling = (
  stationNumero: string | null,
  options: UsePricePollingOptions = {},
) => {
  const {
    enabled = true,
    interval = 5 * 60 * 1000, // 5 minutes default
    staleThreshold = 10, // 10 minutes
    onUpdate,
    onError,
  } = options;

  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [updateIndicator, setUpdateIndicator] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const manualRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { getStationPrices } = usePricingStore();

  const checkAndUpdate = useCallback(async () => {
    if (!stationNumero || !enabled || isUpdating) return;

    const currentPrices = getStationPrices(stationNumero);
    const lastUpdated = currentPrices?.[0]?.detected_at;

    // Check if data is stale
    if (lastUpdated && !isPriceStale(lastUpdated, staleThreshold)) {
      return; // Data is fresh enough, skip update
    }

    setIsUpdating(true);
    setUpdateIndicator(true);

    try {
      await pricingService.getCurrentPrices(stationNumero);
      await pricingService.getNearbyCompetitors(stationNumero);

      setLastUpdateTime(new Date());
      onUpdate?.();

      // Flash update indicator
      setTimeout(() => setUpdateIndicator(false), 2000);
    } catch (error) {
      console.error("Failed to update prices:", error);
      onError?.(error as Error);
    } finally {
      setIsUpdating(false);
    }
  }, [
    stationNumero,
    enabled,
    isUpdating,
    getStationPrices,
    staleThreshold,
    onUpdate,
    onError,
  ]);

  // Manual refresh function
  const manualRefresh = useCallback(async () => {
    if (!stationNumero || isUpdating) return;

    // Clear any existing timeout
    if (manualRefreshTimeoutRef.current) {
      clearTimeout(manualRefreshTimeoutRef.current);
    }

    setIsUpdating(true);
    setUpdateIndicator(true);

    try {
      await pricingService.refreshStationData(stationNumero);
      setLastUpdateTime(new Date());
      onUpdate?.();

      // Flash update indicator
      setTimeout(() => setUpdateIndicator(false), 2000);

      // Reset the interval timer after manual refresh
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (enabled) {
        intervalRef.current = setInterval(checkAndUpdate, interval);
      }
    } catch (error) {
      console.error("Failed to manually refresh prices:", error);
      onError?.(error as Error);
    } finally {
      setIsUpdating(false);
    }
  }, [
    stationNumero,
    isUpdating,
    enabled,
    interval,
    checkAndUpdate,
    onUpdate,
    onError,
  ]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !stationNumero) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkAndUpdate();

    // Set up interval
    intervalRef.current = setInterval(checkAndUpdate, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (manualRefreshTimeoutRef.current) {
        clearTimeout(manualRefreshTimeoutRef.current);
        manualRefreshTimeoutRef.current = null;
      }
    };
  }, [enabled, stationNumero, interval, checkAndUpdate]);

  // Handle visibility change - refresh when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabled && stationNumero) {
        checkAndUpdate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, stationNumero, checkAndUpdate]);

  return {
    isUpdating,
    lastUpdateTime,
    updateIndicator,
    manualRefresh,
  };
};

/**
 * Hook for showing stale data warning
 */
export const useStaleDataWarning = (
  lastUpdated: string | Date | undefined,
  thresholdMinutes: number = 60, // 1 hour default
) => {
  const [isStale, setIsStale] = useState(false);
  const [staleMessage, setStaleMessage] = useState("");

  useEffect(() => {
    if (!lastUpdated) {
      setIsStale(false);
      return;
    }

    const checkStaleness = () => {
      const stale = isPriceStale(lastUpdated, thresholdMinutes);
      setIsStale(stale);

      if (stale) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const currentTime = new Date().getTime();
        const hoursAgo = Math.floor(
          (currentTime - lastUpdateTime) / (1000 * 60 * 60),
        );

        if (hoursAgo >= 24) {
          const daysAgo = Math.floor(hoursAgo / 24);
          setStaleMessage(
            `Datos actualizados hace ${daysAgo} día${daysAgo > 1 ? "s" : ""}`,
          );
        } else if (hoursAgo >= 1) {
          setStaleMessage(
            `Datos actualizados hace ${hoursAgo} hora${hoursAgo > 1 ? "s" : ""}`,
          );
        } else {
          const minutesAgo = Math.floor(
            (currentTime - lastUpdateTime) / (1000 * 60),
          );
          setStaleMessage(
            `Datos actualizados hace ${minutesAgo} minuto${minutesAgo > 1 ? "s" : ""}`,
          );
        }
      }
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastUpdated, thresholdMinutes]);

  return {
    isStale,
    staleMessage,
  };
};

/**
 * Hook for optimistic updates
 */
export const useOptimisticUpdate = () => {
  const { setCurrentPrices, getStationPrices } = usePricingStore();

  const optimisticUpdate = useCallback(
    (stationNumero: string, fuelType: string, newPrice: number) => {
      const currentPrices = getStationPrices(stationNumero) || [];
      const updatedPrices = currentPrices.map((price) => {
        if (price.fuel_type === fuelType) {
          return {
            ...price,
            previousPrice: price.price,
            price: newPrice,
            changed_at: new Date().toISOString(),
            detected_at: new Date().toISOString(),
          };
        }
        return price;
      });

      // Optimistically update the store
      setCurrentPrices(stationNumero, updatedPrices);

      // Return a rollback function
      return () => {
        setCurrentPrices(stationNumero, currentPrices);
      };
    },
    [setCurrentPrices, getStationPrices],
  );

  return { optimisticUpdate };
};
