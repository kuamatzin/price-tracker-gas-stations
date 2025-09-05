import { useEffect, useRef, useState, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;

      const touch = e.touches[0];
      if (touch) {
        startYRef.current = touch.clientY;
      }
    },
    [disabled, isRefreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing || startYRef.current === null) return;

      const touch = e.touches[0];
      if (!touch) return;

      const currentY = touch.clientY;
      const diff = currentY - startYRef.current;

      // Only trigger pull when scrolled to top
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > 0) return;

      if (diff > 0) {
        e.preventDefault();
        setIsPulling(true);
        setPullDistance(Math.min(diff / resistance, threshold * 1.5));
      }
    },
    [disabled, isRefreshing, resistance, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;

    startYRef.current = null;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    if (disabled) return;

    const container = containerRef.current || document.body;

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const getTransformStyle = () => {
    if (!isPulling && !isRefreshing) return {};

    return {
      transform: `translateY(${pullDistance}px)`,
      transition: isPulling ? "none" : "transform 0.3s ease",
    };
  };

  const getIndicatorStyle = () => {
    const opacity = Math.min(pullDistance / threshold, 1);
    const rotation = (pullDistance / threshold) * 360;

    return {
      opacity,
      transform: `rotate(${rotation}deg)`,
      transition: isPulling ? "none" : "all 0.3s ease",
    };
  };

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
    getTransformStyle,
    getIndicatorStyle,
  };
};
