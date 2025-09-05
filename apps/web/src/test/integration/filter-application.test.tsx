import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CurrentPrices } from '@/pages/prices/CurrentPrices';
import { usePricingStore } from '@/stores/pricingStore';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

// Helper wrapper
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

// Mock data
const mockStations = [
  {
    numero: 'USER001',
    nombre: 'My Station',
    brand: 'Pemex',
    lat: 20.6597,
    lng: -103.3496,
    distance: 0,
    regular_price: 23.00,
    premium_price: 25.00,
    diesel_price: 24.00,
  },
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
    nombre: 'Pemex Station 2',
    brand: 'Pemex',
    lat: 20.6610,
    lng: -103.3510,
    distance: 1.5,
    regular_price: 22.80,
    premium_price: 24.90,
    diesel_price: null, // No diesel
  },
  {
    numero: 'COMP004',
    nombre: 'Mobil Station',
    brand: 'Mobil',
    lat: 20.6700,
    lng: -103.3600,
    distance: 2.5,
    regular_price: 23.50,
    premium_price: 25.50,
    diesel_price: 24.50,
  },
];

describe('Filter Application Integration', () => {
  beforeEach(() => {
    // Initialize store with mock data
    usePricingStore.setState({
      selectedStation: 'USER001',
      currentPrices: mockStations.reduce((acc, station) => ({
        ...acc,
        [station.numero]: station,
      }), {}),
      competitors: mockStations.slice(1), // All except user station
      filters: {
        fuelType: 'all',
        radius: 5,
        brands: [],
      },
      isLoading: false,
      error: null,
    });
  });

  describe('Fuel Type Filter', () => {
    it('filters stations by selected fuel type', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // All stations should be visible initially
      expect(screen.getByText('Shell Station')).toBeInTheDocument();
      expect(screen.getByText('BP Station')).toBeInTheDocument();
      expect(screen.getByText('Pemex Station 2')).toBeInTheDocument();
      expect(screen.getByText('Mobil Station')).toBeInTheDocument();
      
      // Apply diesel filter
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Diesel'));
      
      await waitFor(() => {
        // Station without diesel should be filtered out
        expect(screen.queryByText('Pemex Station 2')).not.toBeInTheDocument();
        // Others should remain
        expect(screen.getByText('Shell Station')).toBeInTheDocument();
        expect(screen.getByText('BP Station')).toBeInTheDocument();
        expect(screen.getByText('Mobil Station')).toBeInTheDocument();
      });
    });

    it('displays correct prices for selected fuel type', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Select premium fuel
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Premium'));
      
      await waitFor(() => {
        // Should show premium prices
        expect(screen.getByText('$24.80')).toBeInTheDocument(); // Shell premium
        expect(screen.getByText('$25.20')).toBeInTheDocument(); // BP premium
      });
    });
  });

  describe('Distance Radius Filter', () => {
    it('filters stations within selected radius', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // All stations visible initially (5km radius)
      expect(screen.getByText('Mobil Station')).toBeInTheDocument();
      
      // Reduce radius to 1km
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '1' } });
      
      await waitFor(() => {
        // Only stations within 1km should be visible
        expect(screen.getByText('Shell Station')).toBeInTheDocument(); // 0.5km
        expect(screen.getByText('BP Station')).toBeInTheDocument(); // 0.8km
        expect(screen.queryByText('Pemex Station 2')).not.toBeInTheDocument(); // 1.5km
        expect(screen.queryByText('Mobil Station')).not.toBeInTheDocument(); // 2.5km
      });
    });

    it('updates distance display correctly', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('0.5 km')).toBeInTheDocument();
        expect(screen.getByText('0.8 km')).toBeInTheDocument();
        expect(screen.getByText('1.5 km')).toBeInTheDocument();
        expect(screen.getByText('2.5 km')).toBeInTheDocument();
      });
    });
  });

  describe('Brand Filter', () => {
    it('filters by single brand', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Apply Shell brand filter
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByRole('checkbox', { name: /Shell/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Shell Station')).toBeInTheDocument();
        expect(screen.queryByText('BP Station')).not.toBeInTheDocument();
        expect(screen.queryByText('Pemex Station 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Mobil Station')).not.toBeInTheDocument();
      });
    });

    it('filters by multiple brands', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Select Shell and BP
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByRole('checkbox', { name: /Shell/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /BP/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Shell Station')).toBeInTheDocument();
        expect(screen.getByText('BP Station')).toBeInTheDocument();
        expect(screen.queryByText('Pemex Station 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Mobil Station')).not.toBeInTheDocument();
      });
    });

    it('shows brand count in filter', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Select multiple brands
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByRole('checkbox', { name: /Shell/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /BP/i }));
      
      await waitFor(() => {
        expect(screen.getByText('2 seleccionadas')).toBeInTheDocument();
      });
    });
  });

  describe('Combined Filters', () => {
    it('applies multiple filters together', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Apply diesel filter
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Diesel'));
      
      // Apply 1km radius
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '1' } });
      
      // Apply Shell brand
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByRole('checkbox', { name: /Shell/i }));
      
      await waitFor(() => {
        // Only Shell station within 1km with diesel should show
        expect(screen.getByText('Shell Station')).toBeInTheDocument();
        expect(screen.queryByText('BP Station')).not.toBeInTheDocument(); // Different brand
        expect(screen.queryByText('Pemex Station 2')).not.toBeInTheDocument(); // No diesel
        expect(screen.queryByText('Mobil Station')).not.toBeInTheDocument(); // Too far
      });
    });

    it('shows correct filter count', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Apply multiple filters
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Regular'));
      
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '2' } });
      
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByRole('checkbox', { name: /Shell/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('filter-count')).toHaveTextContent('3');
      });
    });
  });

  describe('Filter Reset', () => {
    it('clears all filters when reset button clicked', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Apply filters
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Diesel'));
      
      fireEvent.click(screen.getByText(/Marcas/i));
      fireEvent.click(screen.getByRole('checkbox', { name: /Shell/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/Limpiar filtros/i)).toBeInTheDocument();
      });
      
      // Reset filters
      fireEvent.click(screen.getByText(/Limpiar filtros/i));
      
      await waitFor(() => {
        // All stations should be visible again
        expect(screen.getByText('Shell Station')).toBeInTheDocument();
        expect(screen.getByText('BP Station')).toBeInTheDocument();
        expect(screen.getByText('Pemex Station 2')).toBeInTheDocument();
        expect(screen.getByText('Mobil Station')).toBeInTheDocument();
        
        // Reset button should disappear
        expect(screen.queryByText(/Limpiar filtros/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('URL State Persistence', () => {
    it('saves filter state to URL', async () => {
      const pushState = vi.spyOn(window.history, 'pushState');
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Apply filters
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Regular'));
      
      await waitFor(() => {
        expect(pushState).toHaveBeenCalled();
        const url = new URL(window.location.href);
        expect(url.searchParams.get('fuelType')).toBe('regular');
      });
    });

    it('restores filter state from URL on mount', () => {
      const originalLocation = window.location;
      
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: '?fuelType=diesel&radius=3&brands=Shell,BP',
      };
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Filters should be applied from URL
      expect(usePricingStore.getState().filters.fuelType).toBe('diesel');
      expect(usePricingStore.getState().filters.radius).toBe(3);
      expect(usePricingStore.getState().filters.brands).toEqual(['Shell', 'BP']);
      
      window.location = originalLocation;
    });
  });

  describe('Performance', () => {
    it('debounces filter changes', async () => {
      vi.useFakeTimers();
      const fetchSpy = vi.fn();
      
      render(
        <Wrapper>
          <CurrentPrices onFilterChange={fetchSpy} />
        </Wrapper>
      );
      
      const slider = screen.getByRole('slider');
      
      // Rapid filter changes
      fireEvent.change(slider, { target: { value: '1' } });
      fireEvent.change(slider, { target: { value: '2' } });
      fireEvent.change(slider, { target: { value: '3' } });
      
      expect(fetchSpy).not.toHaveBeenCalled();
      
      // Fast-forward past debounce delay
      vi.advanceTimersByTime(300);
      
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({
        radius: 3,
      }));
      
      vi.useRealTimers();
    });

    it('handles large datasets efficiently', () => {
      // Create 100 stations
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        numero: `COMP${i.toString().padStart(3, '0')}`,
        nombre: `Station ${i}`,
        brand: ['Shell', 'BP', 'Pemex', 'Mobil'][i % 4],
        lat: 20.6597 + (i * 0.001),
        lng: -103.3496 + (i * 0.001),
        distance: i * 0.1,
        regular_price: 22 + (i * 0.01),
        premium_price: 24 + (i * 0.01),
        diesel_price: 23 + (i * 0.01),
      }));
      
      usePricingStore.setState({
        competitors: largeDataset,
      });
      
      const startTime = performance.now();
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      const renderTime = performance.now() - startTime;
      
      // Should render in reasonable time
      expect(renderTime).toBeLessThan(1000);
      
      // Should show virtualized list indicator
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });
});