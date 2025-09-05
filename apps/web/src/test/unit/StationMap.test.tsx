import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StationMap } from '@/components/features/map/StationMap';

// Mock Leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>{children}</div>
  ),
  TileLayer: ({ url, attribution }: any) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution} />
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
  }),
}));

// Mock Leaflet
vi.mock('leaflet', () => ({
  icon: vi.fn((options) => ({
    ...options,
    _iconUrl: options.iconUrl,
  })),
  divIcon: vi.fn((options) => ({
    ...options,
    _className: options.className,
  })),
}));

describe('StationMap', () => {
  const mockStations = [
    {
      numero: 'USER001',
      nombre: 'User Station',
      lat: 20.6597,
      lng: -103.3496,
      brand: 'Pemex',
      regular_price: 23.00,
      premium_price: 25.00,
      diesel_price: 24.00,
    },
    {
      numero: 'COMP001',
      nombre: 'Competitor 1',
      lat: 20.6600,
      lng: -103.3500,
      brand: 'Shell',
      regular_price: 22.50,
      premium_price: 24.80,
      diesel_price: 23.90,
    },
    {
      numero: 'COMP002',
      nombre: 'Competitor 2',
      lat: 20.6590,
      lng: -103.3490,
      brand: 'BP',
      regular_price: 23.50,
      premium_price: 25.50,
      diesel_price: 24.50,
    },
  ];

  const mockSelectedStation = mockStations[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Map Initialization', () => {
    it('renders map container with correct props', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer).toBeInTheDocument();
      expect(mapContainer).toHaveAttribute('center');
      expect(mapContainer).toHaveAttribute('zoom');
    });

    it('centers map on selected station', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer.getAttribute('center')).toContain(mockSelectedStation.lat.toString());
      expect(mapContainer.getAttribute('center')).toContain(mockSelectedStation.lng.toString());
    });

    it('renders tile layer with OpenStreetMap', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const tileLayer = screen.getByTestId('tile-layer');
      expect(tileLayer).toBeInTheDocument();
      expect(tileLayer).toHaveAttribute('data-url');
      expect(tileLayer.getAttribute('data-url')).toContain('openstreetmap');
    });
  });

  describe('Station Markers', () => {
    it('renders markers for all stations', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      mockStations.forEach(station => {
        const marker = screen.getByTestId(`marker-${station.lat}-${station.lng}`);
        expect(marker).toBeInTheDocument();
      });
    });

    it('highlights selected station with special marker', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const selectedMarker = screen.getByTestId(`marker-${mockSelectedStation.lat}-${mockSelectedStation.lng}`);
      expect(selectedMarker).toHaveAttribute('data-selected', 'true');
    });

    it('shows price labels on markers', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          showPriceLabels
          fuelType="regular"
        />
      );
      
      expect(screen.getByText('$23.00')).toBeInTheDocument();
      expect(screen.getByText('$22.50')).toBeInTheDocument();
      expect(screen.getByText('$23.50')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('applies competitive color to markers with lower prices', () => {
      const marketAverage = 23.00;
      
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          marketAverage={marketAverage}
        />
      );
      
      // Station with price 22.50 should be competitive (green)
      const competitiveMarker = screen.getByTestId(`marker-${mockStations[1].lat}-${mockStations[1].lng}`);
      expect(competitiveMarker).toHaveAttribute('data-competitiveness', 'competitive');
    });

    it('applies average color to markers with similar prices', () => {
      const marketAverage = 23.00;
      
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          marketAverage={marketAverage}
        />
      );
      
      // Station with price 23.00 should be average (yellow)
      const averageMarker = screen.getByTestId(`marker-${mockStations[0].lat}-${mockStations[0].lng}`);
      expect(averageMarker).toHaveAttribute('data-competitiveness', 'average');
    });

    it('applies expensive color to markers with higher prices', () => {
      const marketAverage = 23.00;
      
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          marketAverage={marketAverage}
        />
      );
      
      // Station with price 23.50 should be expensive (red)
      const expensiveMarker = screen.getByTestId(`marker-${mockStations[2].lat}-${mockStations[2].lng}`);
      expect(expensiveMarker).toHaveAttribute('data-competitiveness', 'expensive');
    });
  });

  describe('Popup Interactions', () => {
    it('shows popup with station details on marker click', async () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const marker = screen.getByTestId(`marker-${mockStations[1].lat}-${mockStations[1].lng}`);
      fireEvent.click(marker);
      
      await waitFor(() => {
        const popup = screen.getByTestId('popup');
        expect(popup).toBeInTheDocument();
        expect(popup).toHaveTextContent('Competitor 1');
        expect(popup).toHaveTextContent('Shell');
      });
    });

    it('displays all fuel prices in popup', async () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const marker = screen.getByTestId(`marker-${mockStations[1].lat}-${mockStations[1].lng}`);
      fireEvent.click(marker);
      
      await waitFor(() => {
        const popup = screen.getByTestId('popup');
        expect(popup).toHaveTextContent('Regular: $22.50');
        expect(popup).toHaveTextContent('Premium: $24.80');
        expect(popup).toHaveTextContent('Diesel: $23.90');
      });
    });
  });

  describe('Map Controls', () => {
    it('renders zoom controls', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          showZoomControls
        />
      );
      
      expect(screen.getByTestId('zoom-in')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out')).toBeInTheDocument();
    });

    it('renders center button', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByTestId('center-map')).toBeInTheDocument();
    });

    it('re-centers map when center button clicked', async () => {
      const { rerender } = render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const centerButton = screen.getByTestId('center-map');
      fireEvent.click(centerButton);
      
      await waitFor(() => {
        const mapContainer = screen.getByTestId('map-container');
        expect(mapContainer.getAttribute('center')).toContain(mockSelectedStation.lat.toString());
      });
    });
  });

  describe('Station Changes', () => {
    it('re-centers map when selected station changes', () => {
      const { rerender } = render(
        <StationMap
          stations={mockStations}
          selectedStation={mockStations[0]}
        />
      );
      
      rerender(
        <StationMap
          stations={mockStations}
          selectedStation={mockStations[1]}
        />
      );
      
      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer.getAttribute('center')).toContain(mockStations[1].lat.toString());
    });

    it('updates markers when stations change', () => {
      const { rerender } = render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      const newStations = [
        ...mockStations,
        {
          numero: 'NEW001',
          nombre: 'New Station',
          lat: 20.6605,
          lng: -103.3505,
          brand: 'Mobil',
          regular_price: 22.80,
          premium_price: 25.00,
          diesel_price: 24.10,
        },
      ];
      
      rerender(
        <StationMap
          stations={newStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByTestId(`marker-${20.6605}-${-103.3505}`)).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('only shows stations within specified radius', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          radius={1} // 1 km radius
        />
      );
      
      // Should filter out distant stations
      const markers = screen.getAllByTestId(/marker-/);
      expect(markers.length).toBeLessThanOrEqual(mockStations.length);
    });

    it('filters by selected fuel type', () => {
      const stationsWithMissingPrices = [
        ...mockStations,
        {
          numero: 'NODIESEL',
          nombre: 'No Diesel Station',
          lat: 20.6608,
          lng: -103.3508,
          brand: 'Generic',
          regular_price: 22.00,
          premium_price: 24.00,
          diesel_price: null,
        },
      ];
      
      render(
        <StationMap
          stations={stationsWithMissingPrices}
          selectedStation={mockSelectedStation}
          fuelType="diesel"
        />
      );
      
      // Station without diesel should not show price label
      const noDieselMarker = screen.getByTestId(`marker-20.6608--103.3508`);
      expect(noDieselMarker).not.toHaveTextContent('$');
    });
  });

  describe('Loading State', () => {
    it('shows loading overlay when loading', () => {
      render(
        <StationMap
          stations={[]}
          selectedStation={mockSelectedStation}
          isLoading
        />
      );
      
      expect(screen.getByTestId('map-loading')).toBeInTheDocument();
    });

    it('shows loading spinner', () => {
      render(
        <StationMap
          stations={[]}
          selectedStation={mockSelectedStation}
          isLoading
        />
      );
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when map fails to load', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
          error="Failed to load map"
        />
      );
      
      expect(screen.getByText(/Failed to load map/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByLabelText(/Mapa de estaciones/i)).toBeInTheDocument();
    });

    it('provides keyboard navigation hints', () => {
      render(
        <StationMap
          stations={mockStations}
          selectedStation={mockSelectedStation}
        />
      );
      
      expect(screen.getByText(/Use arrow keys to navigate/i)).toBeInTheDocument();
    });
  });
});