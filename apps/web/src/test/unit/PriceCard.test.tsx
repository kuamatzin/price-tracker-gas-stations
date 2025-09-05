import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceCard } from '@/components/features/pricing/PriceCard';

describe('PriceCard', () => {
  const mockData = {
    station_numero: 'TEST001',
    station_name: 'Test Station',
    fuel_type: 'regular' as const,
    current_price: 23.45,
    previous_price: 22.90,
    last_updated: '2025-01-05T12:00:00Z',
    market_average: 23.00,
    percentile: 65,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Price Display', () => {
    it('displays current price correctly', () => {
      render(<PriceCard {...mockData} />);
      expect(screen.getByText('$23.45')).toBeInTheDocument();
    });

    it('displays station name and numero', () => {
      render(<PriceCard {...mockData} />);
      expect(screen.getByText('Test Station')).toBeInTheDocument();
      expect(screen.getByText('TEST001')).toBeInTheDocument();
    });

    it('displays fuel type label', () => {
      render(<PriceCard {...mockData} />);
      expect(screen.getByText('Regular')).toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('shows upward trend arrow for price increase', () => {
      render(<PriceCard {...mockData} />);
      const trendElement = screen.getByTestId('trend-indicator');
      expect(trendElement).toHaveClass('text-red-500');
      expect(trendElement.textContent).toContain('↑');
    });

    it('shows downward trend arrow for price decrease', () => {
      render(<PriceCard {...mockData} previous_price={24.00} />);
      const trendElement = screen.getByTestId('trend-indicator');
      expect(trendElement).toHaveClass('text-green-500');
      expect(trendElement.textContent).toContain('↓');
    });

    it('shows neutral indicator for no change', () => {
      render(<PriceCard {...mockData} previous_price={23.45} />);
      const trendElement = screen.getByTestId('trend-indicator');
      expect(trendElement).toHaveClass('text-gray-500');
      expect(trendElement.textContent).toContain('→');
    });

    it('calculates percentage change correctly', () => {
      render(<PriceCard {...mockData} />);
      expect(screen.getByText(/2\.40%/)).toBeInTheDocument();
    });
  });

  describe('Color Coding Logic', () => {
    it('applies competitive color when below market average by more than 2%', () => {
      render(<PriceCard {...mockData} current_price={22.00} market_average={23.00} />);
      const card = screen.getByTestId('price-card');
      expect(card).toHaveClass('border-green-500');
    });

    it('applies average color when within 2% of market average', () => {
      render(<PriceCard {...mockData} current_price={23.20} market_average={23.00} />);
      const card = screen.getByTestId('price-card');
      expect(card).toHaveClass('border-yellow-500');
    });

    it('applies expensive color when above market average by more than 2%', () => {
      render(<PriceCard {...mockData} current_price={24.00} market_average={23.00} />);
      const card = screen.getByTestId('price-card');
      expect(card).toHaveClass('border-red-500');
    });
  });

  describe('Market Position', () => {
    it('displays percentile ranking', () => {
      render(<PriceCard {...mockData} percentile={75} />);
      expect(screen.getByText(/75° percentil/i)).toBeInTheDocument();
    });

    it('shows best price indicator when percentile > 90', () => {
      render(<PriceCard {...mockData} percentile={95} />);
      expect(screen.getByText(/Mejor precio/i)).toBeInTheDocument();
    });

    it('shows worst price indicator when percentile < 10', () => {
      render(<PriceCard {...mockData} percentile={5} />);
      expect(screen.getByText(/Precio alto/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows skeleton when loading', () => {
      render(<PriceCard {...mockData} isLoading />);
      expect(screen.getByTestId('price-card-skeleton')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('handles missing data gracefully', () => {
      const incompleteData = {
        station_numero: 'TEST001',
        station_name: 'Test Station',
        fuel_type: 'regular' as const,
      };
      render(<PriceCard {...incompleteData} />);
      expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });
  });

  describe('Timestamp Display', () => {
    it('shows last updated time', () => {
      render(<PriceCard {...mockData} />);
      expect(screen.getByText(/Actualizado:/i)).toBeInTheDocument();
    });

    it('formats timestamp correctly', () => {
      const date = new Date('2025-01-05T12:00:00Z');
      render(<PriceCard {...mockData} last_updated={date.toISOString()} />);
      const formattedTime = screen.getByTestId('update-time');
      expect(formattedTime).toBeInTheDocument();
    });
  });
});