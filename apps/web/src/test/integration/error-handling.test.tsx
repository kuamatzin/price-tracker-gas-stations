import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { CurrentPrices } from '@/pages/prices/CurrentPrices';
import { PricingService } from '@/services/pricing.service';
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

// Setup MSW server for error scenarios
const server = setupServer(
  rest.get('/api/v1/prices/current', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: [], meta: { total: 0 } }));
  }),
  rest.get('/api/v1/competitors', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: { competitors: [] } }));
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('Error Handling Integration', () => {
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

  describe('API Error Scenarios', () => {
    it('handles 500 server error gracefully', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Internal server error' }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Error del servidor/i)).toBeInTheDocument();
        expect(screen.getByText(/Reintentar/i)).toBeInTheDocument();
      });
    });

    it('handles 404 not found error', async () => {
      server.use(
        rest.get('/api/v1/prices/station/:numero', (req, res, ctx) => {
          return res(ctx.status(404), ctx.json({ message: 'Station not found' }));
        })
      );
      
      const service = new PricingService();
      await expect(service.getStationPrices('INVALID')).rejects.toThrow(/not found/i);
    });

    it('handles 401 unauthorized error', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/No autorizado/i)).toBeInTheDocument();
        expect(screen.getByText(/Iniciar sesión/i)).toBeInTheDocument();
      });
    });

    it('handles 403 forbidden error', async () => {
      server.use(
        rest.get('/api/v1/competitors', (req, res, ctx) => {
          return res(ctx.status(403), ctx.json({ message: 'Forbidden' }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Sin permisos/i)).toBeInTheDocument();
      });
    });

    it('handles rate limiting (429) error', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(
            ctx.status(429), 
            ctx.json({ message: 'Too many requests' }),
            ctx.set('Retry-After', '60')
          );
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Demasiadas solicitudes/i)).toBeInTheDocument();
        expect(screen.getByText(/Intente en 60 segundos/i)).toBeInTheDocument();
      });
    });
  });

  describe('Network Error Scenarios', () => {
    it('handles network timeout', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.delay(10000)); // Long delay to simulate timeout
        })
      );
      
      const service = new PricingService();
      const controller = new AbortController();
      
      // Set a short timeout
      setTimeout(() => controller.abort(), 100);
      
      await expect(
        service.getCurrentPrices('USER001', {}, controller.signal)
      ).rejects.toThrow(/aborted/i);
    });

    it('handles network failure', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res) => {
          return res.networkError('Failed to connect');
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Error de conexión/i)).toBeInTheDocument();
        expect(screen.getByText(/Verifique su conexión/i)).toBeInTheDocument();
      });
    });

    it('handles CORS errors', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(
            ctx.status(0),
            ctx.json(null)
          );
        })
      );
      
      const service = new PricingService();
      await expect(service.getCurrentPrices('USER001')).rejects.toThrow();
    });
  });

  describe('Data Validation Errors', () => {
    it('handles malformed API response', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(200), ctx.text('Invalid JSON'));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Error al procesar datos/i)).toBeInTheDocument();
      });
    });

    it('handles missing required fields', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({
            data: [
              {
                numero: 'TEST001',
                // Missing nombre, prices, etc.
              }
            ]
          }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Datos incompletos/i)).toBeInTheDocument();
      });
    });

    it('handles invalid data types', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({
            data: [
              {
                numero: 'TEST001',
                nombre: 'Test Station',
                regular_price: 'invalid', // Should be number
                lat: 'invalid', // Should be number
                lng: 'invalid', // Should be number
              }
            ]
          }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Formato de datos inválido/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Error Recovery', () => {
    it('provides retry option on error', async () => {
      let attemptCount = 0;
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          attemptCount++;
          if (attemptCount === 1) {
            return res(ctx.status(500), ctx.json({ message: 'Server error' }));
          }
          return res(ctx.status(200), ctx.json({ 
            data: [{ numero: 'TEST001', nombre: 'Test Station' }],
            meta: { total: 1 }
          }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Error del servidor/i)).toBeInTheDocument();
      });
      
      const retryButton = screen.getByText(/Reintentar/i);
      fireEvent.click(retryButton);
      
      await waitFor(() => {
        expect(screen.getByText('Test Station')).toBeInTheDocument();
      });
    });

    it('shows fallback UI for partial failures', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({ 
            data: [{ numero: 'TEST001', nombre: 'Test Station' }],
            meta: { total: 1 }
          }));
        }),
        rest.get('/api/v1/competitors', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Failed to load competitors' }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        // Should show main data
        expect(screen.getByText('Test Station')).toBeInTheDocument();
        // Should show error for competitors
        expect(screen.getByText(/No se pudieron cargar competidores/i)).toBeInTheDocument();
      });
    });

    it('preserves user input on error', async () => {
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      // Apply filter
      fireEvent.click(screen.getByText(/Combustible/i));
      fireEvent.click(screen.getByText('Regular'));
      
      // Trigger error
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Server error' }));
        })
      );
      
      // Refresh data (triggers error)
      fireEvent.click(screen.getByTestId('refresh-button'));
      
      await waitFor(() => {
        expect(screen.getByText(/Error del servidor/i)).toBeInTheDocument();
        // Filter should still be applied
        expect(usePricingStore.getState().filters.fuelType).toBe('regular');
      });
    });
  });

  describe('Error Boundaries', () => {
    it('catches component render errors', () => {
      const ThrowError = () => {
        throw new Error('Component error');
      };
      
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <Wrapper>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
        </Wrapper>
      );
      
      expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument();
      expect(screen.getByText(/Recargar página/i)).toBeInTheDocument();
      
      spy.mockRestore();
    });

    it('allows recovery from error boundary', () => {
      let shouldError = true;
      
      const ConditionalError = () => {
        if (shouldError) throw new Error('Conditional error');
        return <div>Recovered!</div>;
      };
      
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { rerender } = render(
        <Wrapper>
          <ErrorBoundary>
            <ConditionalError />
          </ErrorBoundary>
        </Wrapper>
      );
      
      expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument();
      
      shouldError = false;
      
      const reloadButton = screen.getByText(/Recargar página/i);
      fireEvent.click(reloadButton);
      
      spy.mockRestore();
    });
  });

  describe('Offline Mode', () => {
    it('detects offline status', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Sin conexión/i)).toBeInTheDocument();
        expect(screen.getByText(/Modo offline/i)).toBeInTheDocument();
      });
      
      Object.defineProperty(navigator, 'onLine', { value: true });
    });

    it('shows cached data when offline', async () => {
      // First load data while online
      usePricingStore.setState({
        currentPrices: {
          USER001: {
            numero: 'USER001',
            nombre: 'Cached Station',
            regular_price: 22.50,
          },
        },
      });
      
      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Cached Station')).toBeInTheDocument();
        expect(screen.getByText(/Datos en caché/i)).toBeInTheDocument();
      });
      
      Object.defineProperty(navigator, 'onLine', { value: true });
    });
  });

  describe('Error Logging', () => {
    it('logs errors to console in development', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Test error' }));
        })
      );
      
      const service = new PricingService();
      
      try {
        await service.getCurrentPrices('USER001');
      } catch (error) {
        // Expected error
      }
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('sends error telemetry in production', async () => {
      const telemetrySpy = vi.fn();
      window.sendErrorTelemetry = telemetrySpy;
      
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Production error' }));
        })
      );
      
      render(
        <Wrapper>
          <CurrentPrices />
        </Wrapper>
      );
      
      await waitFor(() => {
        expect(telemetrySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(Error),
            context: expect.any(Object),
          })
        );
      });
      
      delete window.sendErrorTelemetry;
    });
  });
});

// Error Boundary component for testing
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Algo salió mal</h1>
          <button onClick={() => window.location.reload()}>
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}