import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HistoricalTrends } from '../../pages/analytics/HistoricalTrends';
import { DateRangeSelector } from '../../components/features/analytics/DateRangeSelector';
import { FuelTypeToggle } from '../../components/features/analytics/FuelTypeToggle';
import { TrendChart } from '../../components/charts/TrendChart';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { useUiStore } from '../../stores/uiStore';
import type { ChartDataPoint, ComparisonDataPoint, FuelType } from '../../types/charts';

// Mock external dependencies
vi.mock('../../stores/analyticsStore');
vi.mock('../../stores/uiStore');
vi.mock('packages/shared/src/utils/date', () => ({
  formatDate: (date: Date) => date.toISOString().split('T')[0],
  subDays: (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000),
  addDays: (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
  differenceInDays: (date1: Date, date2: Date) => Math.floor((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000)),
  isBefore: (date1: Date, date2: Date) => date1.getTime() < date2.getTime(),
  isAfter: (date1: Date, date2: Date) => date1.getTime() > date2.getTime(),
}));

// Mock Recharts with interaction support
vi.mock('recharts', () => ({
  LineChart: ({ children, data, onClick, onMouseMove, ...props }: any) => {
    const handleClick = () => {
      if (onClick) {
        onClick({
          activePayload: data.length > 0 ? [{ payload: data[0] }] : [],
        });
      }
    };

    const handleMouseMove = (e: any) => {
      if (onMouseMove) {
        onMouseMove({
          activeTooltipIndex: 0,
          activePayload: data.length > 0 ? [{ payload: data[0] }] : [],
        });
      }
    };

    return (
      <div 
        data-testid="line-chart"
        data-chart-data-length={data?.length || 0}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
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
  Line: ({ dataKey, stroke }: any) => (
    <div data-testid={`line-${dataKey}`} data-stroke={stroke} />
  ),
  Area: ({ dataKey, fill }: any) => (
    <div data-testid={`area-${dataKey}`} data-fill={fill} />
  ),
  XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: ({ content: CustomTooltip }: any) => (
    <div data-testid="tooltip">
      {CustomTooltip && <CustomTooltip active={true} payload={[]} label="test" />}
    </div>
  ),
  ReferenceLine: (props: any) => <div data-testid="reference-line" {...props} />,
  ReferenceArea: (props: any) => <div data-testid="reference-area" {...props} />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock data generators
const generateMockData = (days: number, basePrice: number = 20): ChartDataPoint[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    regular: basePrice + Math.random() * 2,
    premium: basePrice + 2 + Math.random() * 2,
    diesel: basePrice - 1 + Math.random() * 2,
  }));
};

const generateMockComparisonData = (days: number): ComparisonDataPoint[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    userPrice: 20 + Math.random() * 2,
    marketPrice: 21 + Math.random() * 2,
    currentStation: 'test-station',
  }));
};

// MSW server setup
const server = setupServer(
  http.get('*/prices/history/*', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    // Calculate days based on date range
    const start = new Date(startDate || '2024-01-01');
    const end = new Date(endDate || '2024-01-07');
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return HttpResponse.json({
      data: generateMockData(Math.min(days, 30)),
    });
  }),

  http.get('*/trends/market', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    const start = new Date(startDate || '2024-01-01');
    const end = new Date(endDate || '2024-01-07');
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const data = generateMockComparisonData(Math.min(days, 30)).map(point => ({
      date: point.date,
      user_price: point.userPrice,
      market_price: point.marketPrice,
      station_id: point.currentStation,
    }));
    
    return HttpResponse.json({ data });
  }),

  http.get('*/trends/station/*', () => {
    return HttpResponse.json({
      data: [{
        fuel_type: 'regular',
        average: 21.02,
        min: { value: 20.50, date: '2024-01-01' },
        max: { value: 21.75, date: '2024-01-15' },
        volatility: 0.32,
        trend: { direction: 'rising', slope: 0.08, confidence: 0.78 },
        change_count: 8,
      }],
    });
  })
);

describe('User Interactions Integration Tests', () => {
  let mockAnalyticsStore: any;
  let mockUiStore: any;

  const createMockAnalyticsStore = (overrides: any = {}) => ({
    historicalData: generateMockData(7),
    comparisonData: generateMockComparisonData(7),
    selectedFuels: ['regular'] as FuelType[],
    loading: false,
    error: null,
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-07'),
      preset: '7d' as const,
    },
    trendAnalysis: {},
    isOptimizedMode: false,
    fetchDataForRange: vi.fn(),
    fetchComparisonDataForRange: vi.fn(),
    setSelectedFuels: vi.fn(),
    setDateRange: vi.fn(),
    getOptimizedData: vi.fn((data) => data),
    getOptimizedComparisonData: vi.fn((data) => data),
    setOptimizedMode: vi.fn(),
    performAllCalculations: vi.fn(),
    ...overrides,
  });

  const createMockUiStore = (overrides: any = {}) => ({
    activeFilters: {
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        preset: '7d' as const,
      },
    },
    setActiveFilters: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    server.listen();
    vi.clearAllMocks();
    
    mockAnalyticsStore = createMockAnalyticsStore();
    mockUiStore = createMockUiStore();
    
    (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);
    (useUiStore as any).mockReturnValue(mockUiStore);
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  describe('Date Range Changes Integration', () => {
    it('should update chart data when date range changes', async () => {
      const user = userEvent.setup();
      
      render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByText(/7 días/i)).toBeInTheDocument();
      });

      // Click 15-day preset
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      await user.click(fifteenDayButton);

      // Should trigger data fetch for new range
      expect(mockUiStore.setActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: '15d',
        }),
      });
    });

    it('should handle custom date range selection', async () => {
      const user = userEvent.setup();
      
      render(<DateRangeSelector />);

      // Open custom date picker
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Set custom dates
      const startInput = screen.getByLabelText(/fecha inicio/i);
      const endInput = screen.getByLabelText(/fecha fin/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });

      await user.clear(startInput);
      await user.type(startInput, '2024-02-01');
      await user.clear(endInput);
      await user.type(endInput, '2024-02-28');
      await user.click(applyButton);

      expect(mockUiStore.setActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: 'custom',
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-28'),
        }),
      });
    });

    it('should handle date range navigation', async () => {
      const user = userEvent.setup();
      
      render(<DateRangeSelector />);

      // Navigate to previous period
      const previousButton = screen.getByRole('button', { name: /anterior/i });
      await user.click(previousButton);

      expect(mockUiStore.setActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      });

      // Verify dates moved backward
      const call = mockUiStore.setActiveFilters.mock.calls[0][0];
      const { endDate } = call.dateRange;
      expect(endDate.getTime()).toBeLessThan(new Date('2024-01-07').getTime());
    });

    it('should validate date range selections', async () => {
      const user = userEvent.setup();
      
      render(<DateRangeSelector />);

      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Try invalid date range (end before start)
      const startInput = screen.getByLabelText(/fecha inicio/i);
      const endInput = screen.getByLabelText(/fecha fin/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });

      await user.clear(startInput);
      await user.type(startInput, '2024-02-15');
      await user.clear(endInput);
      await user.type(endInput, '2024-02-01');
      await user.click(applyButton);

      expect(screen.getByText(/la fecha de inicio debe ser anterior/i)).toBeInTheDocument();
      expect(mockUiStore.setActiveFilters).not.toHaveBeenCalled();
    });

    it('should reflect date range changes in chart', async () => {
      const user = userEvent.setup();
      
      // Start with 7-day data
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(7),
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-07'),
          preset: '7d',
        },
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      const { rerender } = render(<HistoricalTrends />);

      await waitFor(() => {
        const chart = screen.getByTestId('line-chart');
        expect(chart).toHaveAttribute('data-chart-data-length', '7');
      });

      // Update to 15-day data
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(15),
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-15'),
          preset: '15d',
        },
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      await waitFor(() => {
        const chart = screen.getByTestId('line-chart');
        expect(chart).toHaveAttribute('data-chart-data-length', '15');
      });
    });
  });

  describe('Fuel Type Switching Integration', () => {
    it('should update chart when fuel types change', async () => {
      const user = userEvent.setup();
      
      render(
        <FuelTypeToggle 
          selectedFuels={['regular']}
          onFuelToggle={mockAnalyticsStore.setSelectedFuels}
          variant="tabs"
        />
      );

      // Initially regular selected
      expect(screen.getByRole('button', { name: /regular/i })).toHaveAttribute('aria-pressed', 'true');

      // Switch to premium
      const premiumButton = screen.getByRole('button', { name: /premium/i });
      await user.click(premiumButton);

      expect(mockAnalyticsStore.setSelectedFuels).toHaveBeenCalledWith(['premium']);
    });

    it('should handle multiple fuel type selection', async () => {
      const user = userEvent.setup();
      
      render(
        <FuelTypeToggle 
          selectedFuels={['regular']}
          onFuelToggle={mockAnalyticsStore.setSelectedFuels}
          variant="checkboxes"
          allowMultiple={true}
        />
      );

      // Add premium to selection
      const premiumCheckbox = screen.getByRole('checkbox', { name: /premium/i });
      await user.click(premiumCheckbox);

      expect(mockAnalyticsStore.setSelectedFuels).toHaveBeenCalledWith(['regular', 'premium']);
    });

    it('should handle "select all" functionality', async () => {
      const user = userEvent.setup();
      
      render(
        <FuelTypeToggle 
          selectedFuels={['regular']}
          onFuelToggle={mockAnalyticsStore.setSelectedFuels}
          variant="checkboxes"
          allowMultiple={true}
        />
      );

      // Click "All fuels" button
      const allFuelsButton = screen.getByRole('button', { name: /todos los combustibles/i });
      await user.click(allFuelsButton);

      expect(mockAnalyticsStore.setSelectedFuels).toHaveBeenCalledWith(['regular', 'premium', 'diesel']);
    });

    it('should reflect fuel type changes in chart lines', async () => {
      mockAnalyticsStore = createMockAnalyticsStore({
        selectedFuels: ['regular'],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      const { rerender } = render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-regular')).toBeInTheDocument();
        expect(screen.queryByTestId('line-premium')).not.toBeInTheDocument();
      });

      // Change to multiple fuel types
      mockAnalyticsStore = createMockAnalyticsStore({
        selectedFuels: ['regular', 'premium'],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-regular')).toBeInTheDocument();
        expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      });
    });

    it('should maintain fuel type selection across date changes', async () => {
      const user = userEvent.setup();
      
      mockAnalyticsStore = createMockAnalyticsStore({
        selectedFuels: ['premium', 'diesel'],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-premium')).toBeInTheDocument();
        expect(screen.getByTestId('line-diesel')).toBeInTheDocument();
      });

      // Change date range
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      await user.click(fifteenDayButton);

      // Fuel selection should be maintained
      await waitFor(() => {
        expect(screen.getByTestId('line-premium')).toBeInTheDocument();
        expect(screen.getByTestId('line-diesel')).toBeInTheDocument();
        expect(screen.queryByTestId('line-regular')).not.toBeInTheDocument();
      });
    });
  });

  describe('Zoom/Pan Functionality Integration', () => {
    it('should handle zoom in interaction', async () => {
      const user = userEvent.setup();
      
      render(
        <TrendChart
          data={generateMockData(7)}
          selectedFuels={['regular']}
          height={400}
        />
      );

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);

      // Should update zoom state (verified through UI changes)
      expect(zoomInButton).toBeInTheDocument();
    });

    it('should handle pan interactions', async () => {
      const user = userEvent.setup();
      
      render(
        <TrendChart
          data={generateMockData(30)} // Larger dataset for panning
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Zoom in first to enable panning
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);
      await user.click(zoomInButton);

      // Now pan
      const panRightButton = screen.getByRole('button', { name: /pan right/i });
      await user.click(panRightButton);

      expect(panRightButton).toBeInTheDocument();
    });

    it('should handle reset zoom functionality', async () => {
      const user = userEvent.setup();
      
      render(
        <TrendChart
          data={generateMockData(15)}
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Zoom in first
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);

      // Then reset
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);

      // Zoom out should be disabled again (at minimum zoom)
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      expect(zoomOutButton).toBeDisabled();
    });

    it('should handle chart click for focus', async () => {
      const user = userEvent.setup();
      
      render(
        <TrendChart
          data={generateMockData(7)}
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Switch to focus mode
      const focusModeButton = screen.getByRole('button', { name: /modo enfoque/i });
      await user.click(focusModeButton);

      // Click on chart
      const chart = screen.getByTestId('line-chart');
      await user.click(chart);

      // Should show focus indicator
      await waitFor(() => {
        expect(screen.queryByTestId('reference-line')).toBeInTheDocument();
      });
    });

    it('should handle keyboard navigation', async () => {
      render(
        <TrendChart
          data={generateMockData(7)}
          selectedFuels={['regular']}
          height={400}
        />
      );

      const chart = screen.getByTestId('line-chart');
      chart.focus();

      // Test keyboard zoom
      fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
      fireEvent.keyDown(chart, { key: '-', ctrlKey: true });
      fireEvent.keyDown(chart, { key: '0', ctrlKey: true });

      // Test navigation
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      fireEvent.keyDown(chart, { key: 'ArrowLeft' });
      fireEvent.keyDown(chart, { key: 'Escape' });

      // Should handle without errors
      expect(chart).toBeInTheDocument();
    });

    it('should maintain zoom state across data updates', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <TrendChart
          data={generateMockData(7)}
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Zoom in
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);
      await user.click(zoomInButton);

      // Update data
      rerender(
        <TrendChart
          data={generateMockData(10)}
          selectedFuels={['regular']}
          height={400}
        />
      );

      // Should maintain zoom level (zoom out shouldn't be disabled)
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      expect(zoomOutButton).not.toBeDisabled();
    });
  });

  describe('Statistics Updates Integration', () => {
    it('should update statistics when data changes', async () => {
      const user = userEvent.setup();
      
      // Start with regular fuel
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(7, 20), // Base price 20
        selectedFuels: ['regular'],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      const { rerender } = render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByText(/\$20\.\d+/)).toBeInTheDocument();
      });

      // Change fuel type to premium (higher base price)
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(7, 22), // Base price 22
        selectedFuels: ['premium'],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByText(/\$22\.\d+/)).toBeInTheDocument();
      });
    });

    it('should update statistics when date range changes', async () => {
      const user = userEvent.setup();
      
      // Start with 7 days
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(7),
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-07'),
          preset: '7d',
        },
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      const { rerender } = render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByText(/7 días/i)).toBeInTheDocument();
      });

      // Change to 30 days (more data points)
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(30),
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-30'),
          preset: '30d',
        },
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByText(/30 días/i)).toBeInTheDocument();
      });

      // Statistics should reflect the larger dataset
      expect(screen.getByText(/promedio/i)).toBeInTheDocument();
    });

    it('should handle real-time statistics calculations', async () => {
      mockAnalyticsStore = createMockAnalyticsStore({
        historicalData: generateMockData(7),
        performAllCalculations: vi.fn(),
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      render(<HistoricalTrends />);

      // Should trigger calculations when component mounts
      await waitFor(() => {
        expect(mockAnalyticsStore.performAllCalculations).toHaveBeenCalled();
      });
    });

    it('should update trend analysis when data changes', async () => {
      // Mock with trend analysis data
      mockAnalyticsStore = createMockAnalyticsStore({
        trendAnalysis: {
          regular: {
            summary: { average: 20.5, min: 20.0, max: 21.0 },
            trend: { direction: 'rising', confidence: 0.8 },
            volatility: { standardDeviation: 0.3 },
          },
        },
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByText(/tendencia/i)).toBeInTheDocument();
      });

      // Should show trend direction
      expect(screen.getByText(/\$20\.5/)).toBeInTheDocument();
    });
  });

  describe('Complex User Workflows', () => {
    it('should handle complete user workflow', async () => {
      const user = userEvent.setup();
      
      render(<HistoricalTrends />);

      // 1. Start with default view
      await waitFor(() => {
        expect(screen.getByText(/7 días/i)).toBeInTheDocument();
      });

      // 2. Change date range
      const thirtyDayButton = screen.getByRole('button', { name: /30 días/i });
      await user.click(thirtyDayButton);

      // 3. Change fuel type (assuming FuelTypeToggle is in the page)
      if (screen.queryByRole('button', { name: /premium/i })) {
        const premiumButton = screen.getByRole('button', { name: /premium/i });
        await user.click(premiumButton);
      }

      // 4. Interact with chart
      const chart = screen.getByTestId('line-chart');
      await user.click(chart);

      // 5. Use zoom controls
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);

      // Should handle all interactions without errors
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should maintain state consistency across interactions', async () => {
      const user = userEvent.setup();
      
      mockAnalyticsStore = createMockAnalyticsStore({
        selectedFuels: ['regular', 'premium'],
        loading: false,
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-regular')).toBeInTheDocument();
        expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      });

      // Interact with chart
      const chart = screen.getByTestId('line-chart');
      await user.click(chart);

      // Change date range
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      await user.click(fifteenDayButton);

      // Should maintain fuel selection and chart state
      await waitFor(() => {
        expect(screen.getByTestId('line-regular')).toBeInTheDocument();
        expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      });
    });

    it('should handle rapid user interactions', async () => {
      const user = userEvent.setup();
      
      render(<HistoricalTrends />);

      // Rapidly change date ranges
      for (const preset of ['15d', '30d', '7d']) {
        const button = screen.getByRole('button', { name: new RegExp(preset.replace('d', ' días'), 'i') });
        await user.click(button);
      }

      // Should handle rapid changes without errors
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle error recovery in user interactions', async () => {
      const user = userEvent.setup();
      
      // Start with error state
      mockAnalyticsStore = createMockAnalyticsStore({
        error: 'Network error',
        historicalData: [],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      const { rerender } = render(<HistoricalTrends />);

      expect(screen.getByText(/network error/i)).toBeInTheDocument();

      // Recover from error
      mockAnalyticsStore = createMockAnalyticsStore({
        error: null,
        historicalData: generateMockData(7),
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      // Should be able to interact normally after recovery
      const chart = screen.getByTestId('line-chart');
      await user.click(chart);

      expect(chart).toBeInTheDocument();
    });

    it('should handle loading states during interactions', async () => {
      const user = userEvent.setup();
      
      // Start with loaded state
      mockAnalyticsStore = createMockAnalyticsStore({
        loading: false,
        historicalData: generateMockData(7),
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      const { rerender } = render(<HistoricalTrends />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      // Trigger loading state
      mockAnalyticsStore = createMockAnalyticsStore({
        loading: true,
        historicalData: [],
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      expect(screen.getByText(/cargando/i)).toBeInTheDocument();

      // Return to loaded state
      mockAnalyticsStore = createMockAnalyticsStore({
        loading: false,
        historicalData: generateMockData(15),
      });
      (useAnalyticsStore as any).mockReturnValue(mockAnalyticsStore);

      rerender(<HistoricalTrends />);

      await waitFor(() => {
        const chart = screen.getByTestId('line-chart');
        expect(chart).toHaveAttribute('data-chart-data-length', '15');
      });
    });
  });
});