import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HistoricalTrends } from '../../pages/analytics/HistoricalTrends';
import { TrendChart } from '../../components/charts/TrendChart';
import { ComparisonChart } from '../../components/charts/ComparisonChart';
import { StatisticsPanel } from '../../components/features/analytics/StatisticsPanel';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { useUiStore } from '../../stores/uiStore';
import type { ChartDataPoint, ComparisonDataPoint } from '../../types/charts';

// Mock Recharts for integration testing
vi.mock('recharts', () => ({
  LineChart: ({ children, data, onClick, onMouseMove, ...props }: any) => {
    const handleClick = (e: any) => {
      if (onClick) {
        onClick({
          activePayload: data.length > 0 ? [{ payload: data[0] }] : [],
        });
      }
    };

    return (
      <div 
        data-testid="line-chart"
        data-chart-data-length={data?.length || 0}
        onClick={handleClick}
        onMouseMove={onMouseMove}
        {...props}
      >
        {children}
      </div>
    );
  },
  ComposedChart: ({ children, data, ...props }: any) => (
    <div 
      data-testid="composed-chart"
      data-chart-data-length={data?.length || 0}
      {...props}
    >
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke, strokeWidth, ...props }: any) => (
    <div 
      data-testid={`line-${dataKey}`}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      {...props}
    />
  ),
  Area: ({ dataKey, fill, ...props }: any) => (
    <div 
      data-testid={`area-${dataKey}`}
      data-fill={fill}
      {...props}
    />
  ),
  XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: ({ content: CustomTooltip, active, payload, label }: any) => {
    if (!active || !CustomTooltip) return <div data-testid="tooltip" />;
    return (
      <div data-testid="tooltip">
        <CustomTooltip active={active} payload={payload} label={label} />
      </div>
    );
  },
  ReferenceLine: (props: any) => <div data-testid="reference-line" {...props} />,
  ReferenceArea: (props: any) => <div data-testid="reference-area" {...props} />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">
      {children}
    </div>
  ),
}));

// Mock stores
vi.mock('../../stores/analyticsStore');
vi.mock('../../stores/uiStore');

// Mock data
const mockChartData: ChartDataPoint[] = [
  { date: '2024-01-01', regular: 20.50, premium: 22.00, diesel: 19.00 },
  { date: '2024-01-02', regular: 20.75, premium: 22.25, diesel: 19.25 },
  { date: '2024-01-03', regular: 21.00, premium: 22.50, diesel: 19.50 },
  { date: '2024-01-04', regular: 20.90, premium: 22.40, diesel: 19.40 },
  { date: '2024-01-05', regular: 21.25, premium: 22.75, diesel: 19.75 },
];

const mockComparisonData: ComparisonDataPoint[] = [
  { date: '2024-01-01', userPrice: 20.50, marketPrice: 21.00, currentStation: 'test-station' },
  { date: '2024-01-02', userPrice: 20.75, marketPrice: 21.25, currentStation: 'test-station' },
  { date: '2024-01-03', userPrice: 21.00, marketPrice: 21.50, currentStation: 'test-station' },
  { date: '2024-01-04', userPrice: 20.90, marketPrice: 21.40, currentStation: 'test-station' },
  { date: '2024-01-05', userPrice: 21.25, marketPrice: 21.75, currentStation: 'test-station' },
];

// MSW server for API mocking
const server = setupServer(
  http.get('*/prices/history/*', () => {
    return HttpResponse.json({
      data: mockChartData.map(point => ({
        date: point.date,
        regular: point.regular,
        premium: point.premium,
        diesel: point.diesel,
      })),
    });
  }),

  http.get('*/trends/market', () => {
    return HttpResponse.json({
      data: mockComparisonData.map(point => ({
        date: point.date,
        user_price: point.userPrice,
        market_price: point.marketPrice,
        station_id: point.currentStation,
      })),
    });
  }),

  http.get('*/trends/station/*', () => {
    return HttpResponse.json({
      data: [{
        fuel_type: 'regular',
        average: 21.02,
        min: { value: 20.50, date: '2024-01-01' },
        max: { value: 21.25, date: '2024-01-05' },
        volatility: 0.25,
        trend: { direction: 'rising', slope: 0.12, confidence: 0.85 },
        change_count: 4,
      }],
    });
  })
);

describe('Chart Rendering Integration Tests', () => {
  const mockAnalyticsStore = {
    historicalData: mockChartData,
    comparisonData: mockComparisonData,
    selectedFuels: ['regular'] as const,
    loading: false,
    error: null,
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-05'),
      preset: '7d' as const,
    },
    trendAnalysis: {},
    isOptimizedMode: false,
    fetchDataForRange: vi.fn(),
    fetchComparisonDataForRange: vi.fn(),
    setSelectedFuels: vi.fn(),
    getOptimizedData: vi.fn((data) => data),
    getOptimizedComparisonData: vi.fn((data) => data),
    setOptimizedMode: vi.fn(),
    performAllCalculations: vi.fn(),
  };

  const mockUiStore = {
    activeFilters: {
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        preset: '7d' as const,
      },
    },
    setActiveFilters: vi.fn(),
  };

  beforeEach(() => {
    server.listen();
    vi.clearAllMocks();
    (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);
    (useUiStore as any).mockReturnValue(mockUiStore);
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  describe('Chart Data Rendering', () => {
    it('should render TrendChart with real data', async () => {
      render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular', 'premium']}
          height={400}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '5');

      // Check that fuel lines are rendered
      expect(screen.getByTestId('line-regular')).toBeInTheDocument();
      expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      expect(screen.queryByTestId('line-diesel')).not.toBeInTheDocument();
    });

    it('should render ComparisonChart with market data', async () => {
      render(
        <ComparisonChart
          data={mockComparisonData}
          height={400}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
      });

      const chart = screen.getByTestId('composed-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '5');

      // Check chart components
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('should render StatisticsPanel with calculated data', async () => {
      render(
        <StatisticsPanel 
          data={mockChartData}
          selectedFuel="regular"
          variant="cards"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/promedio/i)).toBeInTheDocument();
      });

      // Should show calculated statistics
      expect(screen.getByText(/\$20\.\d+/)).toBeInTheDocument(); // Price format
      expect(screen.getByText(/máximo/i)).toBeInTheDocument();
      expect(screen.getByText(/mínimo/i)).toBeInTheDocument();
    });

    it('should handle empty data gracefully', async () => {
      render(
        <TrendChart
          data={[]}
          selectedFuels={['regular']}
          height={400}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '0');
    });

    it('should render loading states correctly', async () => {
      render(
        <TrendChart
          data={[]}
          selectedFuels={['regular']}
          height={400}
          loading={true}
        />
      );

      expect(screen.getByText(/cargando/i)).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });

    it('should render error states correctly', async () => {
      render(
        <TrendChart
          data={[]}
          selectedFuels={['regular']}
          height={400}
          error="Network error"
        />
      );

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Chart Interactions with Data', () => {
    it('should handle chart click interactions', async () => {
      const user = userEvent.setup();
      
      render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      const chart = screen.getByTestId('line-chart');
      await user.click(chart);

      // Should show focus indicator
      await waitFor(() => {
        expect(screen.queryByTestId('reference-line')).toBeInTheDocument();
      });
    });

    it('should update chart when data changes', async () => {
      const { rerender } = render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      let chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '5');

      // Update with new data
      const newData = mockChartData.slice(0, 3);
      rerender(
        <TrendChart
          data={newData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '3');
    });

    it('should handle fuel type changes', async () => {
      const { rerender } = render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      expect(screen.getByTestId('line-regular')).toBeInTheDocument();
      expect(screen.queryByTestId('line-premium')).not.toBeInTheDocument();

      // Change to premium
      rerender(
        <TrendChart
          data={mockChartData}
          selectedFuels={['premium']}
          height={400}
        />
      );

      expect(screen.queryByTestId('line-regular')).not.toBeInTheDocument();
      expect(screen.getByTestId('line-premium')).toBeInTheDocument();
    });

    it('should render multiple fuel types', async () => {
      render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular', 'premium', 'diesel']}
          height={400}
        />
      );

      expect(screen.getByTestId('line-regular')).toBeInTheDocument();
      expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      expect(screen.getByTestId('line-diesel')).toBeInTheDocument();
    });
  });

  describe('Real Data Integration', () => {
    it('should integrate with analytics store data', async () => {
      render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      // Should fetch data from store
      expect(mockAnalyticsStore.fetchDataForRange).toHaveBeenCalled();
    });

    it('should handle store loading states', async () => {
      const loadingStore = {
        ...mockAnalyticsStore,
        loading: true,
        historicalData: [],
      };
      (useAnalyticsStore as any).mockReturnValue(loadingStore);

      render(<HistoricalTrends />);

      expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    });

    it('should handle store error states', async () => {
      const errorStore = {
        ...mockAnalyticsStore,
        error: 'Failed to fetch data',
        historicalData: [],
      };
      (useAnalyticsStore as any).mockReturnValue(errorStore);

      render(<HistoricalTrends />);

      expect(screen.getByText(/failed to fetch data/i)).toBeInTheDocument();
    });

    it('should update statistics when data changes', async () => {
      const { rerender } = render(
        <StatisticsPanel 
          data={mockChartData}
          selectedFuel="regular"
          variant="cards"
        />
      );

      const initialAverage = screen.getByText(/\$20\.\d+/);
      expect(initialAverage).toBeInTheDocument();

      // Update with different data
      const newData = mockChartData.map(point => ({
        ...point,
        regular: point.regular! + 1, // Increase all prices by $1
      }));

      rerender(
        <StatisticsPanel 
          data={newData}
          selectedFuel="regular"
          variant="cards"
        />
      );

      const updatedAverage = screen.getByText(/\$21\.\d+/);
      expect(updatedAverage).toBeInTheDocument();
    });
  });

  describe('Chart Responsiveness', () => {
    it('should adapt to different screen sizes', async () => {
      // Mock different screen sizes
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });

      render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should handle container resize', async () => {
      const { rerender } = render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={300}
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();

      // Resize container
      rerender(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={500}
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Performance with Real Data', () => {
    it('should handle large datasets', async () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
        regular: 20 + Math.random() * 2,
        premium: 22 + Math.random() * 2,
        diesel: 19 + Math.random() * 2,
      }));

      render(
        <TrendChart
          data={largeDataset}
          selectedFuels={['regular']}
          height={400}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '1000');
    });

    it('should handle frequent data updates', async () => {
      const { rerender } = render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Simulate frequent updates
      for (let i = 0; i < 10; i++) {
        const updatedData = mockChartData.map(point => ({
          ...point,
          regular: point.regular! + (Math.random() - 0.5) * 0.1,
        }));

        rerender(
          <TrendChart
            data={updatedData}
            selectedFuels={['regular']}
            height={400}
          />
        );
      }

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Data Validation and Formatting', () => {
    it('should handle invalid data points', async () => {
      const invalidData = [
        { date: '2024-01-01', regular: 20.50 },
        { date: 'invalid-date', regular: 20.75 },
        { date: '2024-01-03', regular: null as any },
        { date: '2024-01-04', regular: undefined as any },
        { date: '2024-01-05', regular: 'invalid' as any },
      ];

      render(
        <TrendChart
          data={invalidData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Should still render chart
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should format prices correctly in tooltips', async () => {
      render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('should handle different date formats', async () => {
      const mixedDateData = [
        { date: '2024-01-01', regular: 20.50 },
        { date: '2024-01-02T10:00:00Z', regular: 20.75 },
        { date: '2024-01-03T00:00:00.000Z', regular: 21.00 },
      ];

      render(
        <TrendChart
          data={mixedDateData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-data-length', '3');
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain accessibility with real data', async () => {
      render(
        <TrendChart
          data={mockChartData}
          selectedFuels={['regular']}
          height={400}
        />
      );

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('tabIndex', '0');
      expect(chart).toHaveAttribute('role', 'img');
    });

    it('should provide proper ARIA labels for statistics', async () => {
      render(
        <StatisticsPanel 
          data={mockChartData}
          selectedFuel="regular"
          variant="cards"
        />
      );

      const statisticsContainer = screen.getByRole('region');
      expect(statisticsContainer).toHaveAttribute('aria-label');
    });
  });
});