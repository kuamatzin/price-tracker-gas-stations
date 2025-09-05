import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { StationMap } from '@/components/features/map/StationMap';
import { CurrentPrices } from '@/pages/prices/CurrentPrices';
import { usePricingStore } from '@/stores/pricingStore';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

// Mock Leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, ...props }: any) => (
    <div 
      data-testid="map-container" 
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      {...props}
    >
      {children}
    </div>
  ),
  TileLayer: ({ url }: any) => (
    <div data-testid="tile-layer" data-url={url} />
  ),
  Marker: ({ position, children, ...props }: any) => (
    <div 
      data-testid={`marker-${position[0]}-${position[1]}`}
      data-lat={position[0]}
      data-lng={position[1]}
      {...props}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({
    setView: vi.fn(),
    flyTo: vi.fn(),
    invalidateSize: vi.fn(),
    getBounds: vi.fn(() => ({
      getNorthEast: () => ({ lat: 20.67, lng: -103.34 }),
      getSouthWest: () => ({ lat: 20.65, lng: -103.36 }),
    })),
  }),
}));

vi.mock('leaflet', () => ({
  icon: vi.fn((options) => options),
  divIcon: vi.fn((options) => options),
}));

// Mock data
const mockMapData = {
  user_station: {
    numero: 'USER001',
    nombre: 'My Station',
    brand: 'Pemex',
    lat: 20.6597,
    lng: -103.3496,
    regular_price: 23.00,
    premium_price: 25.00,
    diesel_price: 24.00,
  },
  competitors: [
    {
      numero: 'COMP001',
      nombre: 'Shell Station',
      brand: 'Shell',
      lat: 20.6600,
      lng: -103.3500,
      distance: 0.5,
      regular_price: 22.50,
      premium_price: 24.80,
      diesel_price: 23.90,
    },
    {
      numero: 'COMP002',
      nombre: 'BP Station',
      brand: 'BP',
      lat: 20.6590,
      lng: -103.3490,
      distance: 0.8,
      regular_price: 23.20,
      premium_price: 25.20,
      diesel_price: 24.10,
    },
    {
      numero: 'COMP003',
      nombre: 'Mobil Station',
      brand: 'Mobil',
      lat: 20.6610,
      lng: -103.3510,
      distance: 1.5,
      regular_price: 22.80,
      premium_price: 24.90,
      diesel_price: 24.00,
    },
  ],
  market_average: {
    regular: 22.90,
    premium: 24.98,
    diesel: 24.00,
  },
};

// Setup MSW server
const server = setupServer(
  rest.get('/api/v1/prices/map', (req, res, ctx) => {
    const bounds = req.url.searchParams.get('bounds');
    if (bounds) {
      return res(ctx.json({ data: mockMapData }));
    }
    return res(ctx.status(400), ctx.json({ message: 'Bounds required' }));
  }),
  
  rest.post('/api/v1/prices/nearby', async (req, res, ctx) => {
    const body = await req.json();
    if (body.lat && body.lng && body.radius) {
      return res(ctx.json({ 
        data: mockMapData.competitors,
        meta: { center: { lat: body.lat, lng: body.lng }, radius: body.radius }
      }));
    }
    return res(ctx.status(400), ctx.json({ message: 'Invalid request' }));
  }),
);

// Helper wrapper
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

describe('Map Data Loading Integration', () => {
  beforeEach(() => {
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

  describe('Initial Load', () => {
    it('loads map data when map tab is selected', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Switch to map view
      fireEvent.click(screen.getByText('Mapa'));
      
      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument();
      });
      
      // Map should be centered on user station
      const mapContainer = screen.getByTestId('map-container');
      const center = JSON.parse(mapContainer.getAttribute('data-center') || '[]');
      expect(center[0]).toBeCloseTo(20.6597, 4);
      expect(center[1]).toBeCloseTo(-103.3496, 4);
    });

    it('shows loading state while fetching map data', async () => {
      server.use(
        rest.get('/api/v1/prices/map', (req, res, ctx) => {
          return res(ctx.delay(100), ctx.json({ data: mockMapData }));
        })
      );
      
      render(
        <Wrapper>
          <StationMap
            stations={[]}
            selectedStation={mockMapData.user_station}
            isLoading
          />
        </Wrapper>
      );
      
      expect(screen.getByTestId('map-loading')).toBeInTheDocument();
    });

    it('renders all station markers after data loads', async () => {
      const allStations = [mockMapData.user_station, ...mockMapData.competitors];
      
      render(
        <Wrapper>
          <StationMap
            stations={allStations}
            selectedStation={mockMapData.user_station}
          />
        </Wrapper>
      );
      
      await waitFor(() => {
        // User station marker
        expect(screen.getByTestId('marker-20.6597--103.3496')).toBeInTheDocument();
        
        // Competitor markers
        expect(screen.getByTestId('marker-20.66--103.35')).toBeInTheDocument();
        expect(screen.getByTestId('marker-20.659--103.349')).toBeInTheDocument();
        expect(screen.getByTestId('marker-20.661--103.351')).toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Data Updates', () => {
    it('updates markers when bounds change', async () => {
      let requestCount = 0;
      server.use(
        rest.get('/api/v1/prices/map', (req, res, ctx) => {
          requestCount++;
          return res(ctx.json({ data: mockMapData }));
        })
      );
      
      const { rerender } = render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station]}
            selectedStation={mockMapData.user_station}
          />
        </Wrapper>
      );
      
      // Simulate map pan/zoom
      rerender(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station]}
            selectedStation={mockMapData.user_station}
            bounds={{ north: 20.68, south: 20.64, east: -103.33, west: -103.37 }}
          />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(requestCount).toBeGreaterThanOrEqual(1);
      });
    });

    it('updates markers when station selection changes', async () => {
      const { rerender } = render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
          />
        </Wrapper>
      );
      
      // Change selected station
      const newSelection = mockMapData.competitors[0];
      rerender(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={newSelection}
          />
        </Wrapper>
      );
      
      await waitFor(() => {
        // Map should re-center on new selection
        const mapContainer = screen.getByTestId('map-container');
        const center = JSON.parse(mapContainer.getAttribute('data-center') || '[]');
        expect(center[0]).toBeCloseTo(newSelection.lat, 4);
        expect(center[1]).toBeCloseTo(newSelection.lng, 4);
      });
    });
  });

  describe('Price Display on Map', () => {
    it('shows price labels on markers', () => {
      render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
            showPriceLabels
            fuelType="regular"
          />
        </Wrapper>
      );
      
      expect(screen.getByText('$23.00')).toBeInTheDocument(); // User station
      expect(screen.getByText('$22.50')).toBeInTheDocument(); // Competitor 1
      expect(screen.getByText('$23.20')).toBeInTheDocument(); // Competitor 2
      expect(screen.getByText('$22.80')).toBeInTheDocument(); // Competitor 3
    });

    it('updates price labels when fuel type changes', () => {
      const { rerender } = render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
            showPriceLabels
            fuelType="regular"
          />
        </Wrapper>
      );
      
      expect(screen.getByText('$23.00')).toBeInTheDocument();
      
      // Change to premium
      rerender(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
            showPriceLabels
            fuelType="premium"
          />
        </Wrapper>
      );
      
      expect(screen.getByText('$25.00')).toBeInTheDocument(); // User station premium
      expect(screen.getByText('$24.80')).toBeInTheDocument(); // Competitor 1 premium
    });
  });

  describe('Color Coding', () => {
    it('applies correct colors based on price competitiveness', () => {
      render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
            marketAverage={mockMapData.market_average.regular}
          />
        </Wrapper>
      );
      
      // Competitor 1 (22.50) is competitive vs average (22.90)
      const comp1Marker = screen.getByTestId('marker-20.66--103.35');
      expect(comp1Marker).toHaveAttribute('data-competitiveness', 'competitive');
      
      // Competitor 2 (23.20) is average vs average (22.90)
      const comp2Marker = screen.getByTestId('marker-20.659--103.349');
      expect(comp2Marker).toHaveAttribute('data-competitiveness', 'average');
    });
  });

  describe('Popup Interactions', () => {
    it('shows station details popup on marker click', async () => {
      render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
          />
        </Wrapper>
      );
      
      const marker = screen.getByTestId('marker-20.66--103.35');
      fireEvent.click(marker);
      
      await waitFor(() => {
        const popup = screen.getByTestId('popup');
        expect(popup).toHaveTextContent('Shell Station');
        expect(popup).toHaveTextContent('Regular: $22.50');
        expect(popup).toHaveTextContent('Premium: $24.80');
        expect(popup).toHaveTextContent('Diesel: $23.90');
        expect(popup).toHaveTextContent('0.5 km');
      });
    });
  });

  describe('Map Controls', () => {
    it('recenters map when center button clicked', async () => {
      render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
          />
        </Wrapper>
      );
      
      const centerButton = screen.getByTestId('center-map');
      fireEvent.click(centerButton);
      
      await waitFor(() => {
        const mapContainer = screen.getByTestId('map-container');
        const center = JSON.parse(mapContainer.getAttribute('data-center') || '[]');
        expect(center[0]).toBeCloseTo(20.6597, 4);
        expect(center[1]).toBeCloseTo(-103.3496, 4);
      });
    });

    it('handles zoom controls', async () => {
      render(
        <Wrapper>
          <StationMap
            stations={[mockMapData.user_station, ...mockMapData.competitors]}
            selectedStation={mockMapData.user_station}
            showZoomControls
          />
        </Wrapper>
      );
      
      const zoomIn = screen.getByTestId('zoom-in');
      const zoomOut = screen.getByTestId('zoom-out');
      
      expect(zoomIn).toBeInTheDocument();
      expect(zoomOut).toBeInTheDocument();
      
      fireEvent.click(zoomIn);
      
      await waitFor(() => {
        const mapContainer = screen.getByTestId('map-container');
        const zoom = mapContainer.getAttribute('data-zoom');
        expect(parseInt(zoom || '0')).toBeGreaterThan(13); // Default is 13
      });
    });
  });

  describe('Performance', () => {
    it('lazy loads map when tab is not active', () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Map should not be loaded initially
      expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
      
      // Switch to map tab
      fireEvent.click(screen.getByText('Mapa'));
      
      // Map should now be loaded
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('limits marker rendering for large datasets', () => {
      const largeDataset = Array.from({ length: 500 }, (_, i) => ({
        numero: `COMP${i}`,
        nombre: `Station ${i}`,
        brand: 'Test',
        lat: 20.6597 + (i * 0.0001),
        lng: -103.3496 + (i * 0.0001),
        regular_price: 22 + (i * 0.01),
        premium_price: 24 + (i * 0.01),
        diesel_price: 23 + (i * 0.01),
      }));
      
      render(
        <Wrapper>
          <StationMap
            stations={largeDataset}
            selectedStation={largeDataset[0]}
          />
        </Wrapper>
      );
      
      // Should use clustering or limit visible markers
      const markers = screen.getAllByTestId(/marker-/);
      expect(markers.length).toBeLessThanOrEqual(100); // Max visible markers
    });
  });

  describe('Error Handling', () => {
    it('shows error message when map fails to load', async () => {
      server.use(
        rest.get('/api/v1/prices/map', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Server error' }));
        })
      );
      
      render(
        <Wrapper>
          <StationMap
            stations={[]}
            selectedStation={mockMapData.user_station}
            error="Failed to load map data"
          />
        </Wrapper>
      );
      
      expect(screen.getByText(/Failed to load map data/i)).toBeInTheDocument();
    });

    it('handles missing location data gracefully', () => {
      const stationWithoutLocation = {
        ...mockMapData.user_station,
        lat: undefined,
        lng: undefined,
      };
      
      render(
        <Wrapper>
          <StationMap
            stations={[stationWithoutLocation as any]}
            selectedStation={stationWithoutLocation as any}
          />
        </Wrapper>
      );
      
      expect(screen.getByText(/Ubicación no disponible/i)).toBeInTheDocument();
    });
  });
});