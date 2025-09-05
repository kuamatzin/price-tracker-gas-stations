import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriceFilters } from '@/components/features/filters/PriceFilters';
import { usePricingStore } from '@/stores/pricingStore';

// Mock the pricing store
vi.mock('@/stores/pricingStore');

describe('PriceFilters', () => {
  const mockSetFilter = vi.fn();
  const mockResetFilters = vi.fn();

  const defaultFilters = {
    fuelType: 'all' as const,
    radius: 10,
    brands: [] as string[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePricingStore as any).mockReturnValue({
      filters: defaultFilters,
      setFilter: mockSetFilter,
      resetFilters: mockResetFilters,
    });
  });

  describe('Fuel Type Filter', () => {
    it('renders fuel type options', () => {
      render(<PriceFilters />);
      
      fireEvent.click(screen.getByText(/Combustible/i));
      
      expect(screen.getByText('Todos')).toBeInTheDocument();
      expect(screen.getByText('Regular')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Diesel')).toBeInTheDocument();
    });

    it('calls setFilter when fuel type is changed', async () => {
      render(<PriceFilters />);
      
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Regular'));
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalledWith('fuelType', 'regular');
      });
    });

    it('displays current fuel type selection', () => {
      (usePricingStore as any).mockReturnValue({
        filters: { ...defaultFilters, fuelType: 'premium' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters />);
      expect(screen.getByText(/Premium/i)).toBeInTheDocument();
    });
  });

  describe('Distance Radius Filter', () => {
    it('renders radius slider', () => {
      render(<PriceFilters />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '50');
    });

    it('displays current radius value', () => {
      render(<PriceFilters />);
      expect(screen.getByText('10 km')).toBeInTheDocument();
    });

    it('updates radius on slider change', async () => {
      render(<PriceFilters />);
      
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '25' } });
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalledWith('radius', 25);
      });
    });

    it('shows correct radius labels', () => {
      render(<PriceFilters />);
      
      expect(screen.getByText('1 km')).toBeInTheDocument();
      expect(screen.getByText('50 km')).toBeInTheDocument();
    });
  });

  describe('Brand Filter', () => {
    const availableBrands = ['Pemex', 'Shell', 'BP', 'Mobil'];

    it('renders brand multi-select', () => {
      render(<PriceFilters availableBrands={availableBrands} />);
      
      fireEvent.click(screen.getByText(/Marcas/i));
      
      availableBrands.forEach(brand => {
        expect(screen.getByText(brand)).toBeInTheDocument();
      });
    });

    it('allows multiple brand selection', async () => {
      render(<PriceFilters availableBrands={availableBrands} />);
      
      fireEvent.click(screen.getByText(/Marcas/i));
      
      const pemexCheckbox = screen.getByRole('checkbox', { name: /Pemex/i });
      const shellCheckbox = screen.getByRole('checkbox', { name: /Shell/i });
      
      fireEvent.click(pemexCheckbox);
      fireEvent.click(shellCheckbox);
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalledWith('brands', ['Pemex']);
        expect(mockSetFilter).toHaveBeenCalledWith('brands', ['Shell']);
      });
    });

    it('displays selected brands count', () => {
      (usePricingStore as any).mockReturnValue({
        filters: { ...defaultFilters, brands: ['Pemex', 'Shell'] },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters availableBrands={availableBrands} />);
      expect(screen.getByText('2 seleccionadas')).toBeInTheDocument();
    });

    it('allows deselecting brands', async () => {
      (usePricingStore as any).mockReturnValue({
        filters: { ...defaultFilters, brands: ['Pemex'] },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters availableBrands={availableBrands} />);
      
      fireEvent.click(screen.getByText(/Marcas/i));
      
      const pemexCheckbox = screen.getByRole('checkbox', { name: /Pemex/i });
      expect(pemexCheckbox).toBeChecked();
      
      fireEvent.click(pemexCheckbox);
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalledWith('brands', []);
      });
    });
  });

  describe('Filter Reset', () => {
    it('shows reset button when filters are applied', () => {
      (usePricingStore as any).mockReturnValue({
        filters: { fuelType: 'regular', radius: 20, brands: ['Pemex'] },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters />);
      expect(screen.getByText(/Limpiar filtros/i)).toBeInTheDocument();
    });

    it('hides reset button when no filters applied', () => {
      render(<PriceFilters />);
      expect(screen.queryByText(/Limpiar filtros/i)).not.toBeInTheDocument();
    });

    it('calls resetFilters when reset button clicked', async () => {
      (usePricingStore as any).mockReturnValue({
        filters: { fuelType: 'regular', radius: 20, brands: ['Pemex'] },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters />);
      
      const resetButton = screen.getByText(/Limpiar filtros/i);
      fireEvent.click(resetButton);
      
      await waitFor(() => {
        expect(mockResetFilters).toHaveBeenCalled();
      });
    });
  });

  describe('Filter Count Indicator', () => {
    it('shows no count when no filters applied', () => {
      render(<PriceFilters />);
      expect(screen.queryByTestId('filter-count')).not.toBeInTheDocument();
    });

    it('shows correct count for single filter', () => {
      (usePricingStore as any).mockReturnValue({
        filters: { fuelType: 'regular', radius: 10, brands: [] },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters />);
      expect(screen.getByTestId('filter-count')).toHaveTextContent('1');
    });

    it('shows correct count for multiple filters', () => {
      (usePricingStore as any).mockReturnValue({
        filters: { fuelType: 'premium', radius: 25, brands: ['Pemex', 'Shell'] },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
      });
      
      render(<PriceFilters />);
      expect(screen.getByTestId('filter-count')).toHaveTextContent('3');
    });
  });

  describe('URL State Persistence', () => {
    it('reads filters from URL params on mount', () => {
      const originalLocation = window.location;
      
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: '?fuelType=diesel&radius=30&brands=Pemex,Shell',
      };
      
      render(<PriceFilters />);
      
      expect(mockSetFilter).toHaveBeenCalledWith('fuelType', 'diesel');
      expect(mockSetFilter).toHaveBeenCalledWith('radius', 30);
      expect(mockSetFilter).toHaveBeenCalledWith('brands', ['Pemex', 'Shell']);
      
      window.location = originalLocation;
    });

    it('updates URL when filters change', async () => {
      const pushState = vi.spyOn(window.history, 'pushState');
      
      render(<PriceFilters />);
      
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Regular'));
      
      await waitFor(() => {
        expect(pushState).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<PriceFilters />);
      
      expect(screen.getByLabelText(/Tipo de combustible/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Radio de búsqueda/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Marcas/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<PriceFilters />);
      
      const slider = screen.getByRole('slider');
      slider.focus();
      
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      
      await waitFor(() => {
        expect(mockSetFilter).toHaveBeenCalled();
      });
    });
  });
});