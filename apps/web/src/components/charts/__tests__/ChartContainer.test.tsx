import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChartContainer } from '../ChartContainer';

// Mock ResizeObserver
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

describe('ChartContainer', () => {
  let originalResizeObserver: any;
  let originalIntersectionObserver: any;
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Store original values
    originalResizeObserver = global.ResizeObserver;
    originalIntersectionObserver = global.IntersectionObserver;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;

    // Setup mocks
    global.ResizeObserver = mockResizeObserver;
    global.IntersectionObserver = mockIntersectionObserver;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    global.ResizeObserver = originalResizeObserver;
    global.IntersectionObserver = originalIntersectionObserver;
    
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  const MockChild = () => <div data-testid="chart-content">Chart Content</div>;

  describe('Basic Rendering', () => {
    it('should render children', () => {
      render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });

    it('should apply default height', () => {
      render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '400px' });
    });

    it('should apply custom height', () => {
      render(
        <ChartContainer height={500}>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '500px' });
    });

    it('should apply custom className', () => {
      render(
        <ChartContainer className="custom-chart-class">
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveClass('custom-chart-class');
    });
  });

  describe('Responsive Behavior', () => {
    const mockWindowSize = (width: number, height: number = 600) => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height,
      });
    };

    it('should use mobile height for small screens', () => {
      mockWindowSize(500);
      
      render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '300px' });
    });

    it('should use tablet height for medium screens', () => {
      mockWindowSize(800);
      
      render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '400px' });
    });

    it('should use desktop height for large screens', () => {
      mockWindowSize(1200);
      
      render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '500px' });
    });

    it('should handle custom breakpoints', () => {
      mockWindowSize(900);
      
      render(
        <ChartContainer 
          responsive
          breakpoints={{ mobile: 600, desktop: 1000 }}
          heights={{ mobile: 250, tablet: 350, desktop: 450 }}
        >
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '350px' }); // Tablet height
    });

    it('should override responsive when explicit height is provided', () => {
      mockWindowSize(500); // Mobile size
      
      render(
        <ChartContainer responsive height={600}>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '600px' }); // Explicit height wins
    });
  });

  describe('Resize Handling', () => {
    it('should observe container resize', () => {
      render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      expect(mockResizeObserver).toHaveBeenCalled();
    });

    it('should update dimensions on resize', async () => {
      const mockObserve = vi.fn();
      const mockDisconnect = vi.fn();
      
      mockResizeObserver.mockImplementation(() => ({
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: vi.fn(),
      }));

      const { unmount } = render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      expect(mockObserve).toHaveBeenCalled();
      
      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should handle window resize events', () => {
      mockWindowSize(800);
      
      render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      // Change window size
      mockWindowSize(1200);
      
      // Simulate window resize event
      window.dispatchEvent(new Event('resize'));
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toBeInTheDocument();
    });

    it('should debounce resize events', async () => {
      const { rerender } = render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      // Simulate multiple rapid resize events
      for (let i = 0; i < 5; i++) {
        mockWindowSize(800 + i * 10);
        window.dispatchEvent(new Event('resize'));
      }
      
      // Should handle debouncing internally
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state', () => {
      render(
        <ChartContainer loading>
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('should show loading skeleton', () => {
      render(
        <ChartContainer loading>
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/cargando gráfico/i)).toBeInTheDocument();
    });

    it('should hide loading when not loading', () => {
      render(
        <ChartContainer loading={false}>
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.queryByTestId('chart-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error state', () => {
      render(
        <ChartContainer error="Test error message">
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByText(/test error message/i)).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      const mockRetry = vi.fn();
      
      render(
        <ChartContainer error="Test error" onRetry={mockRetry}>
          <MockChild />
        </ChartContainer>
      );
      
      const retryButton = screen.getByRole('button', { name: /reintentar/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const mockRetry = vi.fn();
      
      render(
        <ChartContainer error="Test error" onRetry={mockRetry}>
          <MockChild />
        </ChartContainer>
      );
      
      const retryButton = screen.getByRole('button', { name: /reintentar/i });
      retryButton.click();
      
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should prioritize error over loading', () => {
      render(
        <ChartContainer loading error="Test error">
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByText(/test error/i)).toBeInTheDocument();
      expect(screen.queryByTestId('chart-loading')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveAttribute('aria-label', 'Chart container');
    });

    it('should announce loading state', () => {
      render(
        <ChartContainer loading>
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Loading chart');
    });

    it('should announce error state', () => {
      render(
        <ChartContainer error="Test error">
          <MockChild />
        </ChartContainer>
      );
      
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(/test error/i);
    });

    it('should support custom ARIA labels', () => {
      render(
        <ChartContainer ariaLabel="Custom chart label">
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByRole('region', { name: /custom chart label/i })).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('should use lazy rendering for large charts', async () => {
      render(
        <ChartContainer lazy>
          <MockChild />
        </ChartContainer>
      );
      
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('should render immediately when not lazy', () => {
      render(
        <ChartContainer lazy={false}>
          <MockChild />
        </ChartContainer>
      );
      
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
      expect(mockIntersectionObserver).not.toHaveBeenCalled();
    });

    it('should handle intersection observer for lazy loading', () => {
      const mockObserve = vi.fn();
      const mockDisconnect = vi.fn();
      
      mockIntersectionObserver.mockImplementation((callback) => {
        // Simulate intersection
        setTimeout(() => {
          callback([{ isIntersecting: true, target: {} }]);
        }, 0);
        
        return {
          observe: mockObserve,
          disconnect: mockDisconnect,
          unobserve: vi.fn(),
        };
      });

      render(
        <ChartContainer lazy>
          <MockChild />
        </ChartContainer>
      );
      
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  describe('Theme Support', () => {
    it('should apply theme classes', () => {
      render(
        <ChartContainer theme="dark">
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveClass('theme-dark');
    });

    it('should default to light theme', () => {
      render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveClass('theme-light');
    });

    it('should handle custom theme classes', () => {
      render(
        <ChartContainer theme="custom-theme">
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveClass('theme-custom-theme');
    });
  });

  describe('Animation Support', () => {
    it('should support animation configuration', () => {
      render(
        <ChartContainer animate={{ duration: 500, easing: 'ease-out' }}>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({
        transition: 'height 500ms ease-out',
      });
    });

    it('should disable animations when requested', () => {
      render(
        <ChartContainer animate={false}>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).not.toHaveStyle({ transition: expect.anything() });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero height', () => {
      render(
        <ChartContainer height={0}>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '0px' });
    });

    it('should handle very large heights', () => {
      render(
        <ChartContainer height={10000}>
          <MockChild />
        </ChartContainer>
      );
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toHaveStyle({ height: '10000px' });
    });

    it('should handle missing children gracefully', () => {
      render(<ChartContainer />);
      
      const container = screen.getByRole('region', { name: /chart container/i });
      expect(container).toBeInTheDocument();
    });

    it('should handle multiple children', () => {
      render(
        <ChartContainer>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </ChartContainer>
      );
      
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('should handle ResizeObserver not being available', () => {
      global.ResizeObserver = undefined as any;
      
      render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      // Should still render without crashing
      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup observers on unmount', () => {
      const mockDisconnect = vi.fn();
      
      mockResizeObserver.mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: mockDisconnect,
        unobserve: vi.fn(),
      }));

      const { unmount } = render(
        <ChartContainer>
          <MockChild />
        </ChartContainer>
      );
      
      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(
        <ChartContainer responsive>
          <MockChild />
        </ChartContainer>
      );
      
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });
});