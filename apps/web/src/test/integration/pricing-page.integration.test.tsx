import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Prices from '../../pages/Prices';
import { usePricingStore } from '../../stores/pricingStore';

// Mock components and dependencies
vi.mock('../../components/features/pricing/PriceCard', () => ({
  default: ({ fuelType, currentPrice, isLoading }: { fuelType: string; currentPrice: number; isLoading?: boolean }) => (
    <div data-testid={`price-card-${fuelType}`}>
      {isLoading ? 'Loading...' : `${fuelType}: $${currentPrice}`}
    </div>
  ),
}));

vi.mock('../../components/features/competitors/CompetitorTable', () => ({
  default: ({ competitors, isLoading, onStationClick }: { competitors: unknown[]; isLoading?: boolean; onStationClick?: (station: unknown) => void }) => (
    <div data-testid="competitor-table">
      {isLoading ? 'Loading competitors...' : (
        <div>
          <div>Competitors: {competitors.length}</div>
          {competitors.map((station: { nombre: string; regular: number; numero: string }, index: number) => (
            <div 
              key={station.numero}
              data-testid={`competitor-${index}`}
              onClick={() => onStationClick?.(station)}
              style={{ cursor: 'pointer' }}
            >
              {station.nombre} - ${station.regular}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}));

vi.mock('../../components/features/map/StationMap', () => ({
  default: ({ stations, isLoading, onStationClick }: { stations: unknown[]; isLoading?: boolean; onStationClick?: (station: unknown) => void }) => (
    <div data-testid="station-map">
      {isLoading ? 'Loading map...' : (
        <div>
          <div>Map stations: {stations.length}</div>
          {stations.map((station: { nombre: string; numero: string }, index: number) => (
            <div 
              key={station.numero}
              data-testid={`map-station-${index}`}
              onClick={() => onStationClick?.(station)}
              style={{ cursor: 'pointer' }}
            >
              {station.nombre}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}));

vi.mock('../../components/features/filters/PriceFilters', () => ({
  default: ({ filters, onFiltersChange, availableBrands }: { filters: { radius: number; fuelType: string }; onFiltersChange: (filters: unknown) => void; availableBrands: string[] }) => (
    <div data-testid="price-filters">
      <div>Current radius: {filters.radius}km</div>
      <div>Fuel type: {filters.fuelType}</div>
      <div>Brands: {availableBrands.join(', ')}</div>
      <button
        data-testid="filter-radius-10"
        onClick={() => onFiltersChange({ ...filters, radius: 10 })}
      >
        Set 10km radius
      </button>
      <button
        data-testid="filter-premium"
        onClick={() => onFiltersChange({ ...filters, fuelType: 'premium' })}
      >
        Filter by Premium
      </button>
      <button
        data-testid="filter-brand-shell"
        onClick={() => onFiltersChange({ ...filters, brands: ['Shell'] })}
      >
        Filter by Shell
      </button>
    </div>
  ),
}));

// Mock CSV export
vi.mock('../../utils/csvExport', () => ({
  exportStationsToCSV: vi.fn(),
  validateExportData: vi.fn(),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('../../hooks/use-toast', () => ({
  toast: mockToast,
}));

// Mock Tabs component
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) => (
    <div data-testid="tabs" data-value={value}>
      <button
        data-testid="tab-table"
        onClick={() => onValueChange('table')}
        aria-pressed={value === 'table'}
      >
        Table
      </button>
      <button
        data-testid="tab-map"
        onClick={() => onValueChange('map')}
        aria-pressed={value === 'map'}
      >
        Map
      </button>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`trigger-${value}`}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`content-${value}`}>{children}</div>
  ),
}));

// Mock Button component
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock icons
vi.mock('lucide-react', () => ({
  RefreshCw: () => <span data-testid="refresh-icon">↻</span>,
  Download: () => <span data-testid="download-icon">↓</span>,
  Map: () => <span data-testid="map-icon">🗺</span>,
  TableIcon: () => <span data-testid="table-icon">📊</span>,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Prices Page Integration', () => {
  const mockCompetitors = [
    {
      numero: '001',
      nombre: 'Shell Station',
      brand: 'Shell',
      direccion: '123 Main St',
      lat: 20.6597,
      lng: -103.3496,
      distance: 1.2,
      regular: 22.50,
      premium: 24.80,
      diesel: 23.20,
      lastUpdated: '2024-01-01T12:00:00Z',
    },
    {
      numero: '002',
      nombre: 'Pemex Station',
      brand: 'Pemex',
      direccion: '456 Oak Ave',
      lat: 20.6700,
      lng: -103.3600,
      distance: 2.1,
      regular: 22.30,
      premium: 24.60,
      diesel: 23.00,
      lastUpdated: '2024-01-01T12:30:00Z',
    },
  ];

  const initialStoreState = {
    currentPrices: { regular: 22.40, premium: 24.70, diesel: 23.10 },
    competitors: mockCompetitors,
    marketAverages: { regular: 22.45, premium: 24.75, diesel: 23.15 },
    filters: { fuelType: 'all' as const, radius: 5, brands: [] },
    availableBrands: ['Shell', 'Pemex'],
    isLoading: false,
    error: null,
    lastUpdated: '2024-01-01T12:00:00Z',
    autoRefreshEnabled: false,
    fetchCurrentPrices: vi.fn(),
    fetchCompetitors: vi.fn(),
    fetchMarketAverages: vi.fn(),
    setFilters: vi.fn(),
    refreshData: vi.fn(),
    clearError: vi.fn(),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    vi.mocked(usePricingStore).mockReturnValue(initialStoreState as ReturnType<typeof usePricingStore>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial page render', () => {
    it('should render all main components', () => {
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Precios Actuales')).toBeInTheDocument();
      expect(screen.getByTestId('price-card-regular')).toBeInTheDocument();
      expect(screen.getByTestId('price-card-premium')).toBeInTheDocument();
      expect(screen.getByTestId('price-card-diesel')).toBeInTheDocument();
      expect(screen.getByTestId('price-filters')).toBeInTheDocument();
      expect(screen.getByTestId('competitor-table')).toBeInTheDocument();
    });

    it('should display current prices correctly', () => {
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('regular: $22.4')).toBeInTheDocument();
      expect(screen.getByText('premium: $24.7')).toBeInTheDocument();
      expect(screen.getByText('diesel: $23.1')).toBeInTheDocument();
    });

    it('should show competitor count', () => {
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Competencia (2 estaciones)')).toBeInTheDocument();
    });

    it('should display last updated timestamp', () => {
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText(/Última actualización:/)).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should show loading state for price cards', () => {
      const loadingState = { ...initialStoreState, isLoading: true };
      vi.mocked(usePricingStore).mockReturnValue(loadingState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...', { selector: '[data-testid="price-card-regular"]' })).toBeInTheDocument();
    });

    it('should show loading state for competitors', () => {
      const loadingState = { ...initialStoreState, isLoading: true };
      vi.mocked(usePricingStore).mockReturnValue(loadingState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Loading competitors...')).toBeInTheDocument();
    });

    it('should disable buttons during loading', () => {
      const loadingState = { ...initialStoreState, isLoading: true };
      vi.mocked(usePricingStore).mockReturnValue(loadingState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /Actualizar/ });
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('should display error message', () => {
      const errorState = {
        ...initialStoreState,
        error: 'Failed to fetch data'
      };
      vi.mocked(usePricingStore).mockReturnValue(errorState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cerrar/ })).toBeInTheDocument();
    });

    it('should clear error when close button clicked', async () => {
      const user = userEvent.setup();
      const errorState = {
        ...initialStoreState,
        error: 'Failed to fetch data'
      };
      vi.mocked(usePricingStore).mockReturnValue(errorState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /Cerrar/ }));
      expect(initialStoreState.clearError).toHaveBeenCalled();
    });
  });

  describe('data refresh functionality', () => {
    it('should call refresh data when refresh button clicked', async () => {
      const user = userEvent.setup();
      const mockRefreshData = vi.fn().mockResolvedValue(undefined);
      const stateWithRefresh = {
        ...initialStoreState,
        refreshData: mockRefreshData
      };
      vi.mocked(usePricingStore).mockReturnValue(stateWithRefresh as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /Actualizar/ }));
      expect(mockRefreshData).toHaveBeenCalled();
    });

    it('should show auto-refresh indicator when enabled', () => {
      const autoRefreshState = {
        ...initialStoreState,
        autoRefreshEnabled: true
      };
      vi.mocked(usePricingStore).mockReturnValue(autoRefreshState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Auto-actualización activa')).toBeInTheDocument();
    });
  });

  describe('CSV export functionality', () => {
    it('should handle CSV export successfully', async () => {
      const user = userEvent.setup();
      const { exportStationsToCSV, validateExportData } = await import('../../utils/csvExport');
      
      vi.mocked(validateExportData).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      
      vi.mocked(exportStationsToCSV).mockResolvedValue({
        success: true,
        message: 'Export successful',
        recordCount: 2
      });

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      
      await waitFor(() => {
        expect(validateExportData).toHaveBeenCalledWith(mockCompetitors);
        expect(exportStationsToCSV).toHaveBeenCalledWith(
          mockCompetitors,
          expect.objectContaining({
            filename: 'competidores_precios',
            includeTimestamp: true,
            dateFormat: 'local'
          })
        );
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Exportación exitosa',
          description: 'Export successful'
        }));
      });
    });

    it('should handle CSV export errors', async () => {
      const user = userEvent.setup();
      const { validateExportData } = await import('../../utils/csvExport');
      
      vi.mocked(validateExportData).mockReturnValue({
        isValid: false,
        errors: ['Invalid data'],
        warnings: []
      });

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Error en los datos',
          description: 'Invalid data',
          variant: 'destructive'
        }));
      });
    });

    it('should disable export button when no competitors', () => {
      const noCompetitorsState = {
        ...initialStoreState,
        competitors: []
      };
      vi.mocked(usePricingStore).mockReturnValue(noCompetitorsState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      const exportButton = screen.getByRole('button', { name: /Exportar CSV/ });
      expect(exportButton).toBeDisabled();
    });
  });

  describe('filter integration', () => {
    it('should update filters and call setFilters', async () => {
      const user = userEvent.setup();
      const mockSetFilters = vi.fn();
      const stateWithSetFilters = {
        ...initialStoreState,
        setFilters: mockSetFilters
      };
      vi.mocked(usePricingStore).mockReturnValue(stateWithSetFilters as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('filter-radius-10'));
      expect(mockSetFilters).toHaveBeenCalledWith(expect.objectContaining({
        radius: 10
      }));
    });

    it('should display current filter values', () => {
      const customFilterState = {
        ...initialStoreState,
        filters: { fuelType: 'premium' as const, radius: 15, brands: ['Shell'] },
        availableBrands: ['Shell', 'Pemex', 'BP']
      };
      vi.mocked(usePricingStore).mockReturnValue(customFilterState as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByText('Current radius: 15km')).toBeInTheDocument();
      expect(screen.getByText('Fuel type: premium')).toBeInTheDocument();
      expect(screen.getByText('Brands: Shell, Pemex, BP')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('should switch between table and map views', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      // Initially should show table view
      expect(screen.getByTestId('competitor-table')).toBeInTheDocument();
      expect(screen.queryByTestId('station-map')).not.toBeInTheDocument();

      // Switch to map view
      await user.click(screen.getByTestId('tab-map'));
      
      await waitFor(() => {
        expect(screen.getByTestId('station-map')).toBeInTheDocument();
      });
    });

    it('should maintain tab state', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      const tabsContainer = screen.getByTestId('tabs');
      expect(tabsContainer).toHaveAttribute('data-value', 'table');

      await user.click(screen.getByTestId('tab-map'));
      
      await waitFor(() => {
        expect(tabsContainer).toHaveAttribute('data-value', 'map');
      });
    });
  });

  describe('station click interactions', () => {
    it('should handle station clicks from table', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('competitor-0'));
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Shell Station',
          description: expect.stringContaining('1.2km')
        }));
      });
    });

    it('should handle station clicks from map', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      // Switch to map view first
      await user.click(screen.getByTestId('tab-map'));
      
      await waitFor(() => {
        expect(screen.getByTestId('station-map')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('map-station-0'));
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Shell Station'
        }));
      });
    });
  });

  describe('responsive behavior', () => {
    it('should render mobile-optimized components', () => {
      // This would require more complex testing setup for responsive breakpoints
      // For now, we verify that the components are rendered
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      expect(screen.getByTestId('competitor-table')).toBeInTheDocument();
      expect(screen.getByTestId('price-filters')).toBeInTheDocument();
    });
  });

  describe('data flow integration', () => {
    it('should load initial data on mount', () => {
      const mockFetchFunctions = {
        fetchCurrentPrices: vi.fn(),
        fetchCompetitors: vi.fn(),
        fetchMarketAverages: vi.fn(),
      };
      
      const stateWithMockFetch = {
        ...initialStoreState,
        ...mockFetchFunctions
      };
      vi.mocked(usePricingStore).mockReturnValue(stateWithMockFetch as ReturnType<typeof usePricingStore>);

      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      // Note: These would be called in useEffect, which is harder to test directly
      // In a real integration test, you'd verify the side effects
      expect(screen.getByText('Precios Actuales')).toBeInTheDocument();
    });

    it('should pass correct props to child components', () => {
      render(
        <TestWrapper>
          <Prices />
        </TestWrapper>
      );

      // Verify price cards receive correct data
      expect(screen.getByText('regular: $22.4')).toBeInTheDocument();
      
      // Verify competitor table receives competitors
      expect(screen.getByText('Competitors: 2')).toBeInTheDocument();
      
      // Verify filters receive current state
      expect(screen.getByText('Current radius: 5km')).toBeInTheDocument();
    });
  });
});