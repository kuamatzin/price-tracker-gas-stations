import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeSelector } from '../DateRangeSelector';
import { useUiStore } from '../../../../stores/uiStore';

// Mock the UI store
vi.mock('../../../../stores/uiStore');

// Mock date utilities
vi.mock('packages/shared/src/utils/date', () => ({
  formatDate: (date: Date) => date.toISOString().split('T')[0],
  isValidDate: (date: Date) => date instanceof Date && !isNaN(date.getTime()),
  parseDate: (dateStr: string) => new Date(dateStr),
  subDays: (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000),
  addDays: (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
  isBefore: (date1: Date, date2: Date) => date1.getTime() < date2.getTime(),
  isAfter: (date1: Date, date2: Date) => date1.getTime() > date2.getTime(),
  differenceInDays: (date1: Date, date2: Date) => Math.floor((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000)),
}));

describe('DateRangeSelector', () => {
  const mockSetActiveFilters = vi.fn();
  const mockUiStore = {
    activeFilters: {
      dateRange: {
        preset: '7d' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      },
    },
    setActiveFilters: mockSetActiveFilters,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useUiStore as any).mockReturnValue(mockUiStore);
  });

  describe('Rendering', () => {
    it('should render preset buttons correctly', () => {
      render(<DateRangeSelector />);
      
      expect(screen.getByRole('button', { name: /7 días/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /15 días/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 días/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /personalizado/i })).toBeInTheDocument();
    });

    it('should render navigation controls', () => {
      render(<DateRangeSelector />);
      
      expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
    });

    it('should highlight active preset', () => {
      render(<DateRangeSelector />);
      
      const activeButton = screen.getByRole('button', { name: /7 días/i });
      expect(activeButton).toHaveClass('bg-blue-500'); // Or whatever active class is used
    });

    it('should display current date range', () => {
      render(<DateRangeSelector />);
      
      expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
      expect(screen.getByText(/2024-01-07/)).toBeInTheDocument();
    });
  });

  describe('Preset Selection', () => {
    it('should handle 7-day preset selection', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const sevenDayButton = screen.getByRole('button', { name: /7 días/i });
      await user.click(sevenDayButton);
      
      expect(mockSetActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: '7d',
        }),
      });
    });

    it('should handle 15-day preset selection', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      await user.click(fifteenDayButton);
      
      expect(mockSetActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: '15d',
        }),
      });
    });

    it('should handle 30-day preset selection', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const thirtyDayButton = screen.getByRole('button', { name: /30 días/i });
      await user.click(thirtyDayButton);
      
      expect(mockSetActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: '30d',
        }),
      });
    });

    it('should calculate correct date ranges for presets', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      await user.click(fifteenDayButton);
      
      const call = mockSetActiveFilters.mock.calls[0][0];
      const { startDate, endDate } = call.dateRange;
      
      const daysDifference = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      expect(daysDifference).toBe(14); // 15 days means 14 days difference
    });
  });

  describe('Navigation Controls', () => {
    it('should handle previous period navigation', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const previousButton = screen.getByRole('button', { name: /anterior/i });
      await user.click(previousButton);
      
      expect(mockSetActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      });
      
      // Verify dates moved backwards
      const call = mockSetActiveFilters.mock.calls[0][0];
      const { endDate } = call.dateRange;
      expect(endDate.getTime()).toBeLessThan(mockUiStore.activeFilters.dateRange.endDate.getTime());
    });

    it('should handle next period navigation', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const nextButton = screen.getByRole('button', { name: /siguiente/i });
      await user.click(nextButton);
      
      expect(mockSetActiveFilters).toHaveBeenCalled();
      
      // Verify dates moved forward
      const call = mockSetActiveFilters.mock.calls[0][0];
      const { startDate } = call.dateRange;
      expect(startDate.getTime()).toBeGreaterThan(mockUiStore.activeFilters.dateRange.startDate.getTime());
    });

    it('should disable next button when at current date', () => {
      const todayMock = {
        ...mockUiStore,
        activeFilters: {
          dateRange: {
            preset: '7d' as const,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(),
          },
        },
      };
      (useUiStore as any).mockReturnValue(todayMock);
      
      render(<DateRangeSelector />);
      
      const nextButton = screen.getByRole('button', { name: /siguiente/i });
      expect(nextButton).toBeDisabled();
    });

    it('should preserve preset during navigation', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const previousButton = screen.getByRole('button', { name: /anterior/i });
      await user.click(previousButton);
      
      const call = mockSetActiveFilters.mock.calls[0][0];
      expect(call.dateRange.preset).toBe('7d');
    });
  });

  describe('Custom Date Picker', () => {
    it('should open custom date picker modal', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/seleccionar rango personalizado/i)).toBeInTheDocument();
    });

    it('should render date inputs in modal', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      expect(screen.getByLabelText(/fecha inicio/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fecha fin/i)).toBeInTheDocument();
    });

    it('should handle custom date selection', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const startDateInput = screen.getByLabelText(/fecha inicio/i);
      const endDateInput = screen.getByLabelText(/fecha fin/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });
      
      await user.clear(startDateInput);
      await user.type(startDateInput, '2024-02-01');
      await user.clear(endDateInput);
      await user.type(endDateInput, '2024-02-15');
      await user.click(applyButton);
      
      expect(mockSetActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: 'custom',
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-15'),
        }),
      });
    });

    it('should close modal on cancel', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const cancelButton = screen.getByRole('button', { name: /cancelar/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close modal on backdrop click', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Date Validation', () => {
    it('should validate start date before end date', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const startDateInput = screen.getByLabelText(/fecha inicio/i);
      const endDateInput = screen.getByLabelText(/fecha fin/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });
      
      await user.clear(startDateInput);
      await user.type(startDateInput, '2024-02-15');
      await user.clear(endDateInput);
      await user.type(endDateInput, '2024-02-01');
      await user.click(applyButton);
      
      expect(screen.getByText(/la fecha de inicio debe ser anterior/i)).toBeInTheDocument();
      expect(mockSetActiveFilters).not.toHaveBeenCalled();
    });

    it('should prevent future dates', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const endDateInput = screen.getByLabelText(/fecha fin/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      await user.clear(endDateInput);
      await user.type(endDateInput, futureDateStr);
      await user.click(applyButton);
      
      expect(screen.getByText(/no se pueden seleccionar fechas futuras/i)).toBeInTheDocument();
      expect(mockSetActiveFilters).not.toHaveBeenCalled();
    });

    it('should enforce maximum range limit', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const startDateInput = screen.getByLabelText(/fecha inicio/i);
      const endDateInput = screen.getByLabelText(/fecha fin/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });
      
      await user.clear(startDateInput);
      await user.type(startDateInput, '2023-01-01');
      await user.clear(endDateInput);
      await user.type(endDateInput, '2024-01-01'); // More than 365 days
      await user.click(applyButton);
      
      expect(screen.getByText(/el rango máximo permitido es de 365 días/i)).toBeInTheDocument();
      expect(mockSetActiveFilters).not.toHaveBeenCalled();
    });

    it('should validate date format', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      const startDateInput = screen.getByLabelText(/fecha inicio/i);
      const applyButton = screen.getByRole('button', { name: /aplicar/i });
      
      await user.clear(startDateInput);
      await user.type(startDateInput, 'invalid-date');
      await user.click(applyButton);
      
      expect(screen.getByText(/formato de fecha inválido/i)).toBeInTheDocument();
      expect(mockSetActiveFilters).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle keyboard navigation between presets', async () => {
      render(<DateRangeSelector />);
      
      const firstButton = screen.getByRole('button', { name: /7 días/i });
      firstButton.focus();
      
      fireEvent.keyDown(firstButton, { key: 'ArrowRight' });
      expect(screen.getByRole('button', { name: /15 días/i })).toHaveFocus();
      
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      expect(screen.getByRole('button', { name: /30 días/i })).toHaveFocus();
    });

    it('should handle Enter key for preset selection', async () => {
      render(<DateRangeSelector />);
      
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      fifteenDayButton.focus();
      
      fireEvent.keyDown(fifteenDayButton, { key: 'Enter' });
      
      expect(mockSetActiveFilters).toHaveBeenCalledWith({
        dateRange: expect.objectContaining({
          preset: '15d',
        }),
      });
    });

    it('should close modal with Escape key', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const customButton = screen.getByRole('button', { name: /personalizado/i });
      await user.click(customButton);
      
      fireEvent.keyDown(document.body, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle store errors gracefully', () => {
      (useUiStore as any).mockReturnValue({
        activeFilters: null,
        setActiveFilters: vi.fn(() => { throw new Error('Store error'); }),
      });
      
      render(<DateRangeSelector />);
      
      // Should render without crashing
      expect(screen.getByRole('button', { name: /7 días/i })).toBeInTheDocument();
    });

    it('should handle invalid date range in store', () => {
      const invalidStore = {
        ...mockUiStore,
        activeFilters: {
          dateRange: {
            preset: '7d' as const,
            startDate: new Date('invalid'),
            endDate: new Date('invalid'),
          },
        },
      };
      (useUiStore as any).mockReturnValue(invalidStore);
      
      render(<DateRangeSelector />);
      
      // Should fallback to default date range
      expect(screen.getByRole('button', { name: /7 días/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<DateRangeSelector />);
      
      expect(screen.getByRole('group', { name: /seleccionar rango de fechas/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /anterior periodo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /siguiente periodo/i })).toBeInTheDocument();
    });

    it('should support screen readers', () => {
      render(<DateRangeSelector />);
      
      const activeButton = screen.getByRole('button', { name: /7 días/i });
      expect(activeButton).toHaveAttribute('aria-pressed', 'true');
      
      const inactiveButton = screen.getByRole('button', { name: /15 días/i });
      expect(inactiveButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should announce date range changes', async () => {
      const user = userEvent.setup();
      render(<DateRangeSelector />);
      
      const fifteenDayButton = screen.getByRole('button', { name: /15 días/i });
      await user.click(fifteenDayButton);
      
      expect(screen.getByRole('status')).toHaveTextContent(/rango actualizado/i);
    });
  });
});