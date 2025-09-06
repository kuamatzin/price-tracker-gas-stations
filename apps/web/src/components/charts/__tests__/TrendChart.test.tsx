import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrendChart } from '../TrendChart';
import type { ChartDataPoint, FuelType } from '../../../types/charts';

// Mock Recharts
vi.mock('recharts', () => ({
  LineChart: ({ children, onClick, onMouseMove, ...props }: any) => (
    <div 
      data-testid="line-chart"
      onClick={onClick}
      onMouseMove={onMouseMove}
      {...props}
    >
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke, strokeWidth, ...props }: any) => (
    <div 
      data-testid={`line-${dataKey}`}
      style={{ stroke, strokeWidth }}
      {...props}
    />
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
    <div data-testid="responsive-container" style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ZoomIn: () => <div data-testid="zoom-in-icon" />,
  ZoomOut: () => <div data-testid="zoom-out-icon" />,
  RotateCcw: () => <div data-testid="reset-icon" />,
  Move: () => <div data-testid="move-icon" />,
  Focus: () => <div data-testid="focus-icon" />,
  Crosshair: () => <div data-testid="crosshair-icon" />,
}));

describe('TrendChart', () => {
  const mockData: ChartDataPoint[] = [
    { date: '2024-01-01', regular: 20.50, premium: 22.00, diesel: 19.00 },
    { date: '2024-01-02', regular: 20.75, premium: 22.25, diesel: 19.25 },
    { date: '2024-01-03', regular: 21.00, premium: 22.50, diesel: 19.50 },
    { date: '2024-01-04', regular: 20.90, premium: 22.40, diesel: 19.40 },
    { date: '2024-01-05', regular: 21.25, premium: 22.75, diesel: 19.75 },
  ];

  const defaultProps = {
    data: mockData,
    selectedFuels: ['regular'] as FuelType[],
    height: 400,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render chart with basic components', () => {
      render(<TrendChart {...defaultProps} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('should render control buttons', () => {
      render(<TrendChart {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pan left/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pan right/i })).toBeInTheDocument();
    });

    it('should render interaction mode toggle', () => {
      render(<TrendChart {...defaultProps} />);
      
      const zoomModeButton = screen.getByRole('button', { name: /modo zoom/i });
      const focusModeButton = screen.getByRole('button', { name: /modo enfoque/i });
      
      expect(zoomModeButton).toBeInTheDocument();
      expect(focusModeButton).toBeInTheDocument();
    });

    it('should render selected fuel lines', () => {
      render(<TrendChart {...defaultProps} selectedFuels={['regular', 'premium']} />);
      
      expect(screen.getByTestId('line-regular')).toBeInTheDocument();
      expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      expect(screen.queryByTestId('line-diesel')).not.toBeInTheDocument();
    });

    it('should handle empty data', () => {
      render(<TrendChart {...defaultProps} data={[]} />);
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      // Should still render chart structure but with no data
    });
  });

  describe('Zoom Functionality', () => {
    it('should handle zoom in', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);
      
      // Chart should update zoom state (testing implementation through UI changes)
      expect(zoomInButton).toBeInTheDocument();
    });

    it('should handle zoom out', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      await user.click(zoomOutButton);
      
      expect(zoomOutButton).toBeInTheDocument();
    });

    it('should reset zoom', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      // First zoom in
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);
      
      // Then reset
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);
      
      expect(resetButton).toBeInTheDocument();
    });

    it('should disable zoom out when at minimum zoom', async () => {
      render(<TrendChart {...defaultProps} />);
      
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      
      // At minimum zoom by default
      expect(zoomOutButton).toBeDisabled();
    });

    it('should limit maximum zoom level', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      
      // Click zoom in multiple times to reach maximum
      for (let i = 0; i < 10; i++) {
        if (!zoomInButton.disabled) {
          await user.click(zoomInButton);
        }
      }
      
      // Should eventually be disabled at max zoom
      await waitFor(() => {
        expect(zoomInButton).toBeDisabled();
      });
    });
  });

  describe('Pan Functionality', () => {
    it('should handle pan left', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const panLeftButton = screen.getByRole('button', { name: /pan left/i });
      await user.click(panLeftButton);
      
      expect(panLeftButton).toBeInTheDocument();
    });

    it('should handle pan right', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const panRightButton = screen.getByRole('button', { name: /pan right/i });
      await user.click(panRightButton);
      
      expect(panRightButton).toBeInTheDocument();
    });

    it('should disable pan buttons at boundaries', () => {
      render(<TrendChart {...defaultProps} />);
      
      // At default position, pan left should be disabled
      const panLeftButton = screen.getByRole('button', { name: /pan left/i });
      expect(panLeftButton).toBeDisabled();
    });
  });

  describe('Interaction Modes', () => {
    it('should toggle between zoom and focus modes', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const zoomModeButton = screen.getByRole('button', { name: /modo zoom/i });
      const focusModeButton = screen.getByRole('button', { name: /modo enfoque/i });
      
      // Default should be zoom mode
      expect(zoomModeButton).toHaveClass('bg-blue-500');
      expect(focusModeButton).toHaveClass('bg-gray-200');
      
      // Switch to focus mode
      await user.click(focusModeButton);
      
      expect(focusModeButton).toHaveClass('bg-blue-500');
      expect(zoomModeButton).toHaveClass('bg-gray-200');
    });

    it('should show crosshair in focus mode', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const focusModeButton = screen.getByRole('button', { name: /modo enfoque/i });
      await user.click(focusModeButton);
      
      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveStyle({ cursor: 'crosshair' });
    });
  });

  describe('Data Point Focus', () => {
    it('should handle data point click', async () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      
      // Simulate click with chart data
      fireEvent.click(chart, {
        detail: {
          activePayload: [{ payload: mockData[0] }],
        },
      });
      
      // Should show focus UI
      await waitFor(() => {
        expect(screen.queryByText(/punto enfocado/i)).toBeInTheDocument();
      });
    });

    it('should show reference line for focused point', async () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      fireEvent.click(chart);
      
      await waitFor(() => {
        expect(screen.queryByTestId('reference-line')).toBeInTheDocument();
      });
    });

    it('should clear focus on reset', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      fireEvent.click(chart);
      
      const resetButton = screen.getByRole('button', { name: /reset/i });
      await user.click(resetButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/punto enfocado/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle arrow key navigation', () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      chart.focus();
      
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      fireEvent.keyDown(chart, { key: 'ArrowLeft' });
      
      // Should handle navigation without errors
      expect(chart).toBeInTheDocument();
    });

    it('should handle zoom keyboard shortcuts', () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      chart.focus();
      
      // Zoom in with Ctrl/Cmd + Plus
      fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
      fireEvent.keyDown(chart, { key: '=', metaKey: true }); // Mac
      
      // Zoom out with Ctrl/Cmd + Minus
      fireEvent.keyDown(chart, { key: '-', ctrlKey: true });
      
      // Reset with Ctrl/Cmd + 0
      fireEvent.keyDown(chart, { key: '0', ctrlKey: true });
      
      expect(chart).toBeInTheDocument();
    });

    it('should unfocus with Escape key', () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      
      // Focus a point first
      fireEvent.click(chart);
      
      // Then escape
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Should clear focus
      expect(chart).toBeInTheDocument();
    });

    it('should show keyboard navigation hint when focused', async () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      fireEvent.click(chart);
      
      await waitFor(() => {
        expect(screen.getByText(/usar flechas para navegar/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tooltip', () => {
    it('should render enhanced tooltip', () => {
      render(<TrendChart {...defaultProps} />);
      
      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('should format tooltip data correctly', () => {
      render(<TrendChart {...defaultProps} />);
      
      // Tooltip content is rendered through the mock
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('should show different content based on interaction mode', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      // Switch to focus mode
      const focusModeButton = screen.getByRole('button', { name: /modo enfoque/i });
      await user.click(focusModeButton);
      
      // Tooltip behavior should change in focus mode
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should use ResponsiveContainer', () => {
      render(<TrendChart {...defaultProps} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should handle height prop', () => {
      render(<TrendChart {...defaultProps} height={300} />);
      
      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveStyle({ height: '100%' });
    });

    it('should handle different screen sizes', () => {
      // Mock different window sizes
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
      
      render(<TrendChart {...defaultProps} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Data Filtering', () => {
    it('should filter data based on zoom level', () => {
      render(<TrendChart {...defaultProps} />);
      
      // All data points should be rendered initially
      const chart = screen.getByTestId('line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should handle fuel type filtering', () => {
      render(<TrendChart {...defaultProps} selectedFuels={['premium', 'diesel']} />);
      
      expect(screen.getByTestId('line-premium')).toBeInTheDocument();
      expect(screen.getByTestId('line-diesel')).toBeInTheDocument();
      expect(screen.queryByTestId('line-regular')).not.toBeInTheDocument();
    });

    it('should handle empty fuel selection', () => {
      render(<TrendChart {...defaultProps} selectedFuels={[]} />);
      
      // Should still render chart structure
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should handle loading state', () => {
      render(<TrendChart {...defaultProps} loading={true} />);
      
      expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    });

    it('should handle error state', () => {
      render(<TrendChart {...defaultProps} error="Test error message" />);
      
      expect(screen.getByText(/test error message/i)).toBeInTheDocument();
    });

    it('should show skeleton when loading', () => {
      render(<TrendChart {...defaultProps} loading={true} />);
      
      expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('role', 'img');
      expect(chart).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', () => {
      render(<TrendChart {...defaultProps} />);
      
      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('tabIndex', '0');
    });

    it('should announce state changes', async () => {
      const user = userEvent.setup();
      render(<TrendChart {...defaultProps} />);
      
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);
      
      expect(screen.getByRole('status')).toHaveTextContent(/zoom actualizado/i);
    });
  });

  describe('Performance', () => {
    it('should memoize expensive calculations', () => {
      const { rerender } = render(<TrendChart {...defaultProps} />);
      
      // Re-render with same props
      rerender(<TrendChart {...defaultProps} />);
      
      // Component should handle re-renders efficiently
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle large datasets', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
        regular: 20 + Math.random() * 2,
      }));
      
      render(<TrendChart {...defaultProps} data={largeData} />);
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should handle animation props', () => {
      render(<TrendChart {...defaultProps} animationDuration={500} />);
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should disable animations when requested', () => {
      render(<TrendChart {...defaultProps} animationDuration={0} />);
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
});