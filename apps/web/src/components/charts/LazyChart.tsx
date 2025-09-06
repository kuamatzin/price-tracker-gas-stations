import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { ChartProps } from '../../types/charts';

// Lazy load chart components
const TrendChart = lazy(() => 
  import('./TrendChart').then(module => ({ default: module.TrendChart }))
);

const ComparisonChart = lazy(() => 
  import('./ComparisonChart').then(module => ({ default: module.ComparisonChart }))
);

interface LazyChartProps {
  chartType: 'trend' | 'comparison';
  chartProps: any;
  fallback?: React.ReactNode;
  threshold?: number; // Distance from viewport to start loading
}

/**
 * Intersection Observer hook for lazy loading
 */
const useIntersectionObserver = (
  threshold = 100,
  rootMargin = '0px'
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);
        
        // Once it has intersected, keep it loaded
        if (isVisible) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0,
        rootMargin: `${threshold}px`
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return { isIntersecting, hasIntersected, targetRef };
};

/**
 * Chart loading skeleton
 */
const ChartSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="flex space-x-4">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
    </div>
  </div>
);

/**
 * Error boundary for chart loading errors
 */
class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Chart loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">
              Error al cargar gráfico
            </h3>
            <p className="text-red-600 dark:text-red-300 text-sm">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            >
              Recargar página
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Lazy chart component with intersection observer
 */
export const LazyChart: React.FC<LazyChartProps> = ({
  chartType,
  chartProps,
  fallback,
  threshold = 200
}) => {
  const { hasIntersected, targetRef } = useIntersectionObserver(threshold);

  const defaultFallback = fallback || <ChartSkeleton />;

  return (
    <div ref={targetRef} className="min-h-[300px]">
      {hasIntersected ? (
        <ChartErrorBoundary fallback={defaultFallback}>
          <Suspense fallback={defaultFallback}>
            {chartType === 'trend' ? (
              <TrendChart {...chartProps} />
            ) : (
              <ComparisonChart {...chartProps} />
            )}
          </Suspense>
        </ChartErrorBoundary>
      ) : (
        defaultFallback
      )}
    </div>
  );
};

/**
 * Preload chart components for better UX
 */
export const preloadCharts = () => {
  // Preload components when user is likely to need them
  import('./TrendChart');
  import('./ComparisonChart');
};

/**
 * Hook to preload charts on user interaction
 */
export const useChartPreloader = () => {
  useEffect(() => {
    const handleUserInteraction = () => {
      preloadCharts();
      // Remove listeners after first interaction
      document.removeEventListener('mousemove', handleUserInteraction);
      document.removeEventListener('scroll', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    // Preload on user interaction
    document.addEventListener('mousemove', handleUserInteraction, { once: true });
    document.addEventListener('scroll', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleUserInteraction);
      document.removeEventListener('scroll', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);
};

/**
 * Progressive chart loader with priority system
 */
interface ProgressiveChartProps extends LazyChartProps {
  priority?: 'high' | 'normal' | 'low';
  defer?: number; // Delay in ms for low priority charts
}

export const ProgressiveChart: React.FC<ProgressiveChartProps> = ({
  priority = 'normal',
  defer = 0,
  ...props
}) => {
  const [shouldRender, setShouldRender] = useState(priority === 'high');

  useEffect(() => {
    if (priority === 'high') return;

    const timer = setTimeout(() => {
      setShouldRender(true);
    }, defer);

    return () => clearTimeout(timer);
  }, [priority, defer]);

  if (!shouldRender) {
    return props.fallback || <ChartSkeleton />;
  }

  return <LazyChart {...props} />;
};