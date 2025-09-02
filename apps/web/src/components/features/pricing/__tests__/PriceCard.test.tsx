import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PriceCard, { PriceCardSkeleton } from '../PriceCard';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  TrendingUp: () => <div data-testid="trending-up">↗</div>,
  TrendingDown: () => <div data-testid="trending-down">↘</div>,
  Minus: () => <div data-testid="minus">→</div>,
  Clock: () => <div data-testid="clock">🕐</div>,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={className} data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

describe('PriceCard', () => {
  const defaultProps = {
    fuelType: 'regular' as const,
    currentPrice: 22.50,
    lastUpdated: '2024-01-01T12:00:00Z',
  };

  it('should render price card with basic information', () => {
    render(<PriceCard {...defaultProps} />);
    
    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getByText('$22.50')).toBeInTheDocument();
    expect(screen.getByTestId('clock')).toBeInTheDocument();
  });

  it('should display different fuel types correctly', () => {
    const { rerender } = render(<PriceCard {...defaultProps} fuelType="premium" />);
    expect(screen.getByText('Premium')).toBeInTheDocument();

    rerender(<PriceCard {...defaultProps} fuelType="diesel" />);
    expect(screen.getByText('Diesel')).toBeInTheDocument();
  });

  it('should show competitive pricing badge and styling', () => {
    render(
      <PriceCard
        {...defaultProps}
        currentPrice={20.00}
        marketAverage={22.50}
      />
    );
    
    expect(screen.getByText('Competitivo')).toBeInTheDocument();
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-green-50');
  });

  it('should show expensive pricing badge and styling', () => {
    render(
      <PriceCard
        {...defaultProps}
        currentPrice={25.00}
        marketAverage={22.50}
      />
    );
    
    expect(screen.getByText('Elevado')).toBeInTheDocument();
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-red-50');
  });

  it('should show average pricing badge and styling', () => {
    render(
      <PriceCard
        {...defaultProps}
        currentPrice={22.75}
        marketAverage={22.50}
      />
    );
    
    expect(screen.getByText('Promedio')).toBeInTheDocument();
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-yellow-50');
  });

  it('should display price trend arrows correctly', () => {
    // Test upward trend
    const { rerender } = render(
      <PriceCard
        {...defaultProps}
        currentPrice={23.00}
        previousPrice={22.00}
      />
    );
    expect(screen.getByTestId('trending-up')).toBeInTheDocument();
    expect(screen.getByText('+$1.00')).toBeInTheDocument();
    expect(screen.getByText('(4.5%)')).toBeInTheDocument();

    // Test downward trend
    rerender(
      <PriceCard
        {...defaultProps}
        currentPrice={21.00}
        previousPrice={22.00}
      />
    );
    expect(screen.getByTestId('trending-down')).toBeInTheDocument();
    expect(screen.getByText('-$1.00')).toBeInTheDocument();

    // Test stable trend
    rerender(
      <PriceCard
        {...defaultProps}
        currentPrice={22.00}
        previousPrice={22.05}
      />
    );
    expect(screen.getByTestId('minus')).toBeInTheDocument();
  });

  it('should show market comparison when available', () => {
    render(
      <PriceCard
        {...defaultProps}
        currentPrice={21.50}
        marketAverage={22.50}
      />
    );
    
    expect(screen.getByText('Promedio de mercado:')).toBeInTheDocument();
    expect(screen.getByText('$22.50')).toBeInTheDocument();
    expect(screen.getByText('Diferencia:')).toBeInTheDocument();
    expect(screen.getByText('-$1.00')).toBeInTheDocument();
  });

  it('should format timestamps correctly', () => {
    // Mock Date.now to control relative time calculation
    const mockNow = new Date('2024-01-01T12:30:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());
    vi.spyOn(global, 'Date').mockImplementation((...args) => 
      args.length ? new (Date as any)(...args) : mockNow
    );

    render(
      <PriceCard
        {...defaultProps}
        lastUpdated="2024-01-01T12:00:00Z"
      />
    );
    
    expect(screen.getByText(/Hace 30 min/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('should handle different time periods in timestamp', () => {
    const mockNow = new Date('2024-01-01T14:00:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());
    vi.spyOn(global, 'Date').mockImplementation((...args) => 
      args.length ? new (Date as any)(...args) : mockNow
    );

    // Test hours
    const { rerender } = render(
      <PriceCard
        {...defaultProps}
        lastUpdated="2024-01-01T12:00:00Z"
      />
    );
    expect(screen.getByText(/Hace 2 h/)).toBeInTheDocument();

    // Test recent (less than 1 minute)
    rerender(
      <PriceCard
        {...defaultProps}
        lastUpdated="2024-01-01T13:59:30Z"
      />
    );
    expect(screen.getByText(/Hace un momento/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('should handle invalid timestamps gracefully', () => {
    render(
      <PriceCard
        {...defaultProps}
        lastUpdated="invalid-date"
      />
    );
    
    expect(screen.getByText(/invalid-date/)).toBeInTheDocument();
  });

  it('should format currency correctly', () => {
    render(
      <PriceCard
        {...defaultProps}
        currentPrice={1234.56}
      />
    );
    
    // Should use Mexican peso formatting
    expect(screen.getByText(/1,234.56/)).toBeInTheDocument();
  });

  it('should show no trend when no previous price', () => {
    render(<PriceCard {...defaultProps} />);
    
    expect(screen.getByTestId('minus')).toBeInTheDocument();
    expect(screen.queryByText(/\+|\-/)).not.toBeInTheDocument();
  });

  it('should not show market comparison when not available', () => {
    render(<PriceCard {...defaultProps} />);
    
    expect(screen.queryByText('Promedio de mercado:')).not.toBeInTheDocument();
  });
});

describe('PriceCardSkeleton', () => {
  it('should render skeleton loading state', () => {
    render(<PriceCardSkeleton />);
    
    const card = screen.getByTestId('card');
    expect(card).toBeInTheDocument();
    
    // Should have multiple animated skeleton elements
    const animatedElements = card.querySelectorAll('.animate-pulse');
    expect(animatedElements.length).toBeGreaterThan(5);
  });

  it('should have correct skeleton structure', () => {
    render(<PriceCardSkeleton />);
    
    // Should have skeleton placeholders for different sections
    const skeletonElements = screen.getAllByRole('generic').filter(el => 
      el.className.includes('bg-gray-200') || el.className.includes('bg-gray-700')
    );
    
    expect(skeletonElements.length).toBeGreaterThan(0);
  });
});