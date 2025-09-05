import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompetitorTable } from '@/components/features/competitors/CompetitorTable';

describe('CompetitorTable', () => {
  const mockCompetitors = [
    {
      numero: 'COMP001',
      nombre: 'Competitor 1',
      brand: 'Pemex',
      lat: 20.6597,
      lng: -103.3496,
      regular_price: 22.50,
      premium_price: 24.80,
      diesel_price: 23.90,
      last_updated: '2025-01-05T12:00:00Z',
    },
    {
      numero: 'COMP002',
      nombre: 'Competitor 2',
      brand: 'Shell',
      lat: 20.6600,
      lng: -103.3500,
      regular_price: 22.80,
      premium_price: 25.10,
      diesel_price: 24.20,
      last_updated: '2025-01-05T11:30:00Z',
    },
    {
      numero: 'COMP003',
      nombre: 'Competitor 3',
      brand: 'BP',
      lat: 20.6590,
      lng: -103.3490,
      regular_price: 22.30,
      premium_price: 24.60,
      diesel_price: 23.70,
      last_updated: '2025-01-05T11:00:00Z',
    },
  ];

  const mockSelectedStation = {
    lat: 20.6597,
    lng: -103.3496,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Table Rendering', () => {
    it('renders table headers correctly', () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByText('Estación')).toBeInTheDocument();
      expect(screen.getByText('Marca')).toBeInTheDocument();
      expect(screen.getByText('Distancia')).toBeInTheDocument();
      expect(screen.getByText('Regular')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Diesel')).toBeInTheDocument();
    });

    it('renders all competitor rows', () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByText('Competitor 1')).toBeInTheDocument();
      expect(screen.getByText('Competitor 2')).toBeInTheDocument();
      expect(screen.getByText('Competitor 3')).toBeInTheDocument();
    });

    it('displays prices with currency format', () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByText('$22.50')).toBeInTheDocument();
      expect(screen.getByText('$24.80')).toBeInTheDocument();
      expect(screen.getByText('$23.90')).toBeInTheDocument();
    });
  });

  describe('Distance Calculation', () => {
    it('calculates distances correctly using Haversine formula', () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      const distances = screen.getAllByTestId(/distance-/);
      expect(distances).toHaveLength(3);
      
      // First competitor should have 0 km (same location)
      expect(distances[0].textContent).toContain('0.0 km');
      
      // Others should have calculated distances
      expect(distances[1].textContent).toMatch(/\d+\.\d+ km/);
      expect(distances[2].textContent).toMatch(/\d+\.\d+ km/);
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts by distance ascending by default', () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(4); // 1 header + 3 data rows
    });

    it('sorts by price when price column is clicked', async () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      const regularHeader = screen.getByText('Regular');
      fireEvent.click(regularHeader);
      
      await waitFor(() => {
        const rows = screen.getAllByTestId(/competitor-row-/);
        expect(rows[0]).toHaveTextContent('Competitor 3'); // Lowest price
      });
    });

    it('reverses sort order on second click', async () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      const brandHeader = screen.getByText('Marca');
      
      // First click - ascending
      fireEvent.click(brandHeader);
      await waitFor(() => {
        const rows = screen.getAllByTestId(/competitor-row-/);
        expect(rows[0]).toHaveTextContent('BP');
      });
      
      // Second click - descending
      fireEvent.click(brandHeader);
      await waitFor(() => {
        const rows = screen.getAllByTestId(/competitor-row-/);
        expect(rows[0]).toHaveTextContent('Shell');
      });
    });
  });

  describe('Price Comparison Indicators', () => {
    it('shows competitive indicator for lower prices', () => {
      const userStation = { ...mockSelectedStation, regular_price: 23.00 };
      
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={userStation}
        />
      );
      
      const priceElements = screen.getAllByTestId(/price-indicator-/);
      expect(priceElements.length).toBeGreaterThan(0);
      
      // Competitor 3 has lowest price (22.30)
      const lowestPriceIndicator = priceElements.find(el => 
        el.textContent?.includes('22.30')
      );
      expect(lowestPriceIndicator).toHaveClass('text-green-500');
    });

    it('shows expensive indicator for higher prices', () => {
      const userStation = { ...mockSelectedStation, regular_price: 22.00 };
      
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={userStation}
        />
      );
      
      const priceElements = screen.getAllByTestId(/price-indicator-/);
      const highestPriceIndicator = priceElements.find(el => 
        el.textContent?.includes('22.80')
      );
      expect(highestPriceIndicator).toHaveClass('text-red-500');
    });
  });

  describe('Responsive Design', () => {
    it('shows table view on desktop', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('shows card view on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
          isMobile
        />
      );
      
      const cards = screen.getAllByTestId(/competitor-card-/);
      expect(cards).toHaveLength(3);
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when loading', () => {
      render(
        <CompetitorTable
          competitors={[]}
          selectedStation={mockSelectedStation}
          isLoading
        />
      );
      
      expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no competitors', () => {
      render(
        <CompetitorTable
          competitors={[]}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByText(/No se encontraron competidores/i)).toBeInTheDocument();
    });
  });

  describe('Row Interactions', () => {
    it('highlights row on hover', async () => {
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
        />
      );
      
      const row = screen.getByTestId('competitor-row-0');
      fireEvent.mouseEnter(row);
      
      await waitFor(() => {
        expect(row).toHaveClass('hover:bg-gray-50');
      });
    });

    it('calls onRowClick when row is clicked', () => {
      const onRowClick = vi.fn();
      
      render(
        <CompetitorTable
          competitors={mockCompetitors}
          selectedStation={mockSelectedStation}
          onRowClick={onRowClick}
        />
      );
      
      const row = screen.getByTestId('competitor-row-0');
      fireEvent.click(row);
      
      expect(onRowClick).toHaveBeenCalledWith(mockCompetitors[0]);
    });
  });
});