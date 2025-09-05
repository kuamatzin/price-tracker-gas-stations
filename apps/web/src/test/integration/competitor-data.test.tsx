import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { CurrentPrices } from '@/pages/prices/CurrentPrices';
import { usePricingStore } from '@/stores/pricingStore';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { BrowserRouter } from 'react-router-dom';

// Mock competitor data
const mockCompetitorData = {
  data: {
    user_station: {
      numero: 'USER001',
      nombre: 'My Station',
      brand: 'Pemex',
      lat: 20.6597,
      lng: -103.3496,
      prices: {
        regular: { current: 23.00, previous: 22.80, trend: 'up' },
        premium: { current: 25.00, previous: 24.90, trend: 'up' },
        diesel: { current: 24.00, previous: 24.00, trend: 'stable' },
      },
    },
    competitors: [
      {
        numero: 'COMP001',
        nombre: 'Competitor Station 1',
        brand: 'Shell',
        lat: 20.6600,
        lng: -103.3500,
        distance: 0.5,
        regular_price: 22.50,
        premium_price: 24.80,
        diesel_price: 23.90,
        price_difference: {
          regular: -0.50,
          premium: -0.20,
          diesel: -0.10,
        },
      },
      {
        numero: 'COMP002',
        nombre: 'Competitor Station 2',
        brand: 'BP',
        lat: 20.6590,
        lng: -103.3490,
        distance: 0.8,
        regular_price: 23.20,
        premium_price: 25.20,
        diesel_price: 24.10,
        price_difference: {
          regular: 0.20,
          premium: 0.20,
          diesel: 0.10,
        },
      },
    ],
  },
  meta: {
    radius: 5,
    mode: 'radius',
    market_average: {
      regular: 22.90,
      premium: 25.00,
      diesel: 24.00,
    },
  },
};

// Setup MSW server
const server = setupServer(
  rest.get('/api/v1/competitors', (req, res, ctx) => {
    const radius = req.url.searchParams.get('radius');
    const mode = req.url.searchParams.get('mode');
    
    if (radius && mode) {
      return res(ctx.json(mockCompetitorData));
    }
    return res(ctx.status(400), ctx.json({ message: 'Invalid parameters' }));
  }),
  
  rest.get('/api/v1/prices/current', (req, res, ctx) => {
    return res(ctx.json({
      data: [mockCompetitorData.data.user_station],
      meta: { total: 1, page: 1, per_page: 20 },
    }));
  }),
);

// Helper wrapper component
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('Competitor Data Integration', () => {
  beforeEach(() => {
    // Reset store state
    usePricingStore.setState({
      selectedStation: 'USER001',
      currentPrices: {},
      competitors: [],
      filters: {
        fuelType: 'all',
        radius: 5,
        brands: [],
      },
      isLoading: false,
      error: null,
    });
  });

  describe('Data Fetching Flow', () => {
    it('loads competitor data on component mount', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
        expect(screen.getByText('Competitor Station 1')).toBeInTheDocument();
        expect(screen.getByText('Competitor Station 2')).toBeInTheDocument();
      });
    });

    it('displays loading state while fetching', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      server.use(
        rest.get('/api/v1/competitors', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Server error' }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Error al cargar/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Updates on Filter Changes', () => {
    it('refetches data when radius filter changes', async () => {
      let requestCount = 0;
      server.use(
        rest.get('/api/v1/competitors', (req, res, ctx) => {
          requestCount++;
          return res(ctx.json(mockCompetitorData));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
      });
      
      // Change radius filter
      const radiusSlider = screen.getByRole('slider');
      fireEvent.change(radiusSlider, { target: { value: '10' } });
      
      await waitFor(() => {
        expect(requestCount).toBe(2);
      });
    });

    it('filters displayed competitors by brand', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Competitor Station 1')).toBeInTheDocument();
        expect(screen.getByText('Competitor Station 2')).toBeInTheDocument();
      });
      
      // Apply brand filter
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByText('Shell'));
      
      await waitFor(() => {
        expect(screen.getByText('Competitor Station 1')).toBeInTheDocument();
        expect(screen.queryByText('Competitor Station 2')).not.toBeInTheDocument();
      });
    });

    it('filters by fuel type availability', async () => {
      const dataWithMissingFuel = {
        ...mockCompetitorData,
        data: {
          ...mockCompetitorData.data,
          competitors: [
            ...mockCompetitorData.data.competitors,
            {
              numero: 'COMP003',
              nombre: 'No Diesel Station',
              brand: 'Generic',
              lat: 20.6585,
              lng: -103.3485,
              distance: 1.0,
              regular_price: 22.00,
              premium_price: 24.00,
              diesel_price: null, // No diesel
            },
          ],
        },
      };
      
      server.use(
        rest.get('/api/v1/competitors', (req, res, ctx) => {
          return res(ctx.json(dataWithMissingFuel));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('No Diesel Station')).toBeInTheDocument();
      });
      
      // Filter by diesel
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Diesel'));
      
      await waitFor(() => {
        expect(screen.queryByText('No Diesel Station')).not.toBeInTheDocument();
        expect(screen.getByText('Competitor Station 1')).toBeInTheDocument();
      });
    });
  });

  describe('Price Comparison Display', () => {
    it('shows price differences relative to user station', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        // Competitor 1 has lower price (-0.50)
        const comp1Row = screen.getByTestId('competitor-row-COMP001');
        expect(comp1Row).toHaveTextContent('-$0.50');
        expect(comp1Row.querySelector('.text-green-500')).toBeInTheDocument();
        
        // Competitor 2 has higher price (+0.20)
        const comp2Row = screen.getByTestId('competitor-row-COMP002');
        expect(comp2Row).toHaveTextContent('+$0.20');
        expect(comp2Row.querySelector('.text-red-500')).toBeInTheDocument();
      });
    });

    it('updates comparison when switching fuel types', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
      });
      
      // Switch to premium
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Premium'));
      
      await waitFor(() => {
        // Premium price comparisons should now be displayed
        const comp1Row = screen.getByTestId('competitor-row-COMP001');
        expect(comp1Row).toHaveTextContent('$24.80'); // Premium price
      });
    });
  });

  describe('Map Integration', () => {
    it('displays competitors on map with correct positions', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
      });
      
      // Switch to map view
      fireEvent.click(screen.getByText('Mapa'));
      
      await waitFor(() => {
        const mapContainer = screen.getByTestId('map-container');
        expect(mapContainer).toBeInTheDocument();
        
        // Check for station markers
        expect(screen.getByTestId('marker-20.6597--103.3496')).toBeInTheDocument(); // User station
        expect(screen.getByTestId('marker-20.66--103.35')).toBeInTheDocument(); // Competitor 1
        expect(screen.getByTestId('marker-20.659--103.349')).toBeInTheDocument(); // Competitor 2
      });
    });

    it('centers map on user station', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
      });
      
      // Switch to map view
      fireEvent.click(screen.getByText('Mapa'));
      
      await waitFor(() => {
        const mapContainer = screen.getByTestId('map-container');
        expect(mapContainer.getAttribute('center')).toContain('20.6597');
        expect(mapContainer.getAttribute('center')).toContain('-103.3496');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('polls for updates at configured interval', async () => {
      vi.useFakeTimers();
      let requestCount = 0;
      
      server.use(
        rest.get('/api/v1/competitors', (req, res, ctx) => {
          requestCount++;
          return res(ctx.json(mockCompetitorData));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
      });
      
      expect(requestCount).toBe(1);
      
      // Fast-forward 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      await waitFor(() => {
        expect(requestCount).toBe(2);
      });
      
      vi.useRealTimers();
    });

    it('shows stale data warning after threshold', async () => {
      vi.useFakeTimers();
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('My Station')).toBeInTheDocument();
      });
      
      // Fast-forward past stale threshold (15 minutes)
      vi.advanceTimersByTime(16 * 60 * 1000);
      
      await waitFor(() => {
        expect(screen.getByText(/Datos desactualizados/i)).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });
});