import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { PricingService } from '@/services/pricing.service';
import { usePricingStore } from '@/stores/pricingStore';

// Mock API responses
const mockCurrentPrices = {
  data: [
    {
      numero: 'TEST001',
      nombre: 'Test Station 1',
      brand: 'Pemex',
      lat: 20.6597,
      lng: -103.3496,
      regular_price: 22.50,
      premium_price: 24.80,
      diesel_price: 23.90,
      last_updated: '2025-01-05T12:00:00Z',
    },
    {
      numero: 'TEST002',
      nombre: 'Test Station 2',
      brand: 'Shell',
      lat: 20.6600,
      lng: -103.3500,
      regular_price: 22.80,
      premium_price: 25.10,
      diesel_price: 24.20,
      last_updated: '2025-01-05T11:30:00Z',
    },
  ],
  meta: {
    total: 2,
    page: 1,
    per_page: 20,
  },
};

const mockStationPrices = {
  data: {
    numero: 'TEST001',
    nombre: 'Test Station 1',
    brand: 'Pemex',
    lat: 20.6597,
    lng: -103.3496,
    prices: {
      regular: {
        current: 22.50,
        previous: 22.00,
        change: 0.50,
        change_percentage: 2.27,
        trend: 'up',
      },
      premium: {
        current: 24.80,
        previous: 24.50,
        change: 0.30,
        change_percentage: 1.22,
        trend: 'up',
      },
      diesel: {
        current: 23.90,
        previous: 23.90,
        change: 0,
        change_percentage: 0,
        trend: 'stable',
      },
    },
    market_position: {
      regular: { percentile: 45, rank: 5 },
      premium: { percentile: 60, rank: 3 },
      diesel: { percentile: 50, rank: 4 },
    },
    last_updated: '2025-01-05T12:00:00Z',
  },
};

const mockNearbyCompetitors = {
  data: [
    {
      numero: 'COMP001',
      nombre: 'Competitor 1',
      brand: 'BP',
      lat: 20.6590,
      lng: -103.3490,
      distance: 0.5,
      regular_price: 22.30,
      premium_price: 24.60,
      diesel_price: 23.70,
      last_updated: '2025-01-05T11:00:00Z',
    },
    {
      numero: 'COMP002',
      nombre: 'Competitor 2',
      brand: 'Mobil',
      lat: 20.6610,
      lng: -103.3510,
      distance: 1.2,
      regular_price: 22.70,
      premium_price: 25.00,
      diesel_price: 24.10,
      last_updated: '2025-01-05T10:30:00Z',
    },
  ],
  meta: {
    center: { lat: 20.6597, lng: -103.3496 },
    radius: 5,
    total: 2,
  },
};

// Setup MSW server
const server = setupServer(
  rest.get('/api/v1/prices/current', (req, res, ctx) => {
    return res(ctx.json(mockCurrentPrices));
  }),
  
  rest.get('/api/v1/prices/station/:numero', (req, res, ctx) => {
    const { numero } = req.params;
    if (numero === 'TEST001') {
      return res(ctx.json(mockStationPrices));
    }
    return res(ctx.status(404), ctx.json({ message: 'Station not found' }));
  }),
  
  rest.post('/api/v1/prices/nearby', async (req, res, ctx) => {
    const body = await req.json();
    if (body.lat && body.lng && body.radius) {
      return res(ctx.json(mockNearbyCompetitors));
    }
    return res(ctx.status(400), ctx.json({ message: 'Invalid request' }));
  }),
  
  rest.get('/api/v1/competitors', (req, res, ctx) => {
    return res(ctx.json({
      data: {
        user_station: mockStationPrices.data,
        competitors: mockNearbyCompetitors.data,
      },
      meta: {
        radius: 5,
        mode: 'radius',
      },
    }));
  }),
);

// Start server before all tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Pricing API Integration', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    pricingService = new PricingService();
    vi.clearAllMocks();
  });

  describe('getCurrentPrices', () => {
    it('fetches current prices successfully', async () => {
      const result = await pricingService.getCurrentPrices('TEST001');
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].numero).toBe('TEST001');
      expect(result.data[0].regular_price).toBe(22.50);
    });

    it('handles API errors gracefully', async () => {
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Server error' }));
        })
      );
      
      await expect(pricingService.getCurrentPrices('TEST001')).rejects.toThrow();
    });

    it('includes station context in request', async () => {
      let capturedParams: any;
      
      server.use(
        rest.get('/api/v1/prices/current', (req, res, ctx) => {
          capturedParams = Object.fromEntries(req.url.searchParams);
          return res(ctx.json(mockCurrentPrices));
        })
      );
      
      await pricingService.getCurrentPrices('TEST001', {
        fuelType: 'regular',
        fresh: true,
      });
      
      expect(capturedParams).toMatchObject({
        station_numero: 'TEST001',
        fuel_type: 'regular',
        fresh: 'true',
      });
    });

    it('caches responses per station', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      
      // First call
      await pricingService.getCurrentPrices('TEST001');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      
      // Second call (should use cache)
      await pricingService.getCurrentPrices('TEST001');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      
      // Different station (should not use cache)
      await pricingService.getCurrentPrices('TEST002');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStationPrices', () => {
    it('fetches specific station prices', async () => {
      const result = await pricingService.getStationPrices('TEST001');
      
      expect(result.data.numero).toBe('TEST001');
      expect(result.data.prices.regular.current).toBe(22.50);
      expect(result.data.prices.regular.trend).toBe('up');
      expect(result.data.market_position.regular.percentile).toBe(45);
    });

    it('handles station not found', async () => {
      await expect(pricingService.getStationPrices('INVALID')).rejects.toThrow();
    });
  });

  describe('getNearbyCompetitors', () => {
    it('fetches nearby competitors with distance calculation', async () => {
      const result = await pricingService.getNearbyCompetitors('TEST001', {
        lat: 20.6597,
        lng: -103.3496,
        radius: 5,
      });
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].distance).toBe(0.5);
      expect(result.data[0].numero).toBe('COMP001');
    });

    it('sorts competitors by distance', async () => {
      const result = await pricingService.getNearbyCompetitors('TEST001', {
        lat: 20.6597,
        lng: -103.3496,
        radius: 5,
      });
      
      expect(result.data[0].distance).toBeLessThan(result.data[1].distance);
    });

    it('respects radius parameter', async () => {
      let capturedBody: any;
      
      server.use(
        rest.post('/api/v1/prices/nearby', async (req, res, ctx) => {
          capturedBody = await req.json();
          return res(ctx.json(mockNearbyCompetitors));
        })
      );
      
      await pricingService.getNearbyCompetitors('TEST001', {
        lat: 20.6597,
        lng: -103.3496,
        radius: 10,
      });
      
      expect(capturedBody.radius).toBe(10);
    });
  });

  describe('Request Cancellation', () => {
    it('cancels pending requests on station switch', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      
      // Start first request
      const promise1 = pricingService.getCurrentPrices('TEST001', {}, controller1.signal);
      
      // Cancel first request
      controller1.abort();
      
      // Start second request
      const promise2 = pricingService.getCurrentPrices('TEST002', {}, controller2.signal);
      
      await expect(promise1).rejects.toThrow('aborted');
      await expect(promise2).resolves.toBeTruthy();
    });
  });
});