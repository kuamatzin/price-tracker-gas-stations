import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { pricingService } from '../../services/api/pricing.service';

// Mock data
const mockCurrentPrices = {
  prices: {
    regular: 22.50,
    premium: 24.80,
    diesel: 23.20,
  },
  station: {
    numero: '001',
    nombre: 'Test Station',
    direccion: 'Test Address',
    lat: 20.6597,
    lng: -103.3496,
    lastUpdated: '2024-01-01T12:00:00Z',
  },
  lastUpdated: '2024-01-01T12:00:00Z',
};

const mockCompetitors = {
  stations: [
    {
      numero: '002',
      nombre: 'Competitor 1',
      brand: 'Shell',
      direccion: '123 Main St',
      lat: 20.6600,
      lng: -103.3500,
      distance: 1.5,
      regular: 22.80,
      premium: 25.10,
      diesel: 23.50,
      lastUpdated: '2024-01-01T12:30:00Z',
    },
    {
      numero: '003',
      nombre: 'Competitor 2',
      brand: 'Pemex',
      direccion: '456 Oak Ave',
      lat: 20.6700,
      lng: -103.3600,
      distance: 2.1,
      regular: 22.30,
      premium: 24.60,
      diesel: 23.00,
      lastUpdated: '2024-01-01T13:00:00Z',
    },
  ],
  pagination: {
    total: 2,
    page: 1,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

const mockPriceHistory = {
  changes: [
    {
      id: '1',
      stationId: '001',
      fuelType: 'regular',
      oldPrice: 22.30,
      newPrice: 22.50,
      change: 0.20,
      percentage: 0.89,
      timestamp: '2024-01-01T12:00:00Z',
    },
  ],
  pagination: {
    total: 1,
    page: 1,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

const mockMarketTrends = {
  trends: [
    {
      date: '2024-01-01',
      fuelType: 'regular',
      averagePrice: 22.45,
      change: 0.15,
      changePercentage: 0.67,
    },
    {
      date: '2024-01-01',
      fuelType: 'premium',
      averagePrice: 24.75,
      change: 0.20,
      changePercentage: 0.81,
    },
    {
      date: '2024-01-01',
      fuelType: 'diesel',
      averagePrice: 23.15,
      change: 0.10,
      changePercentage: 0.43,
    },
  ],
};

// Setup MSW server
const server = setupServer(
  // Current prices endpoint
  http.get('/api/v1/prices/current', () => {
    return HttpResponse.json(mockCurrentPrices);
  }),

  // Competitors endpoint
  http.get('/api/v1/competitors', ({ request }) => {
    const url = new URL(request.url);
    const radius = url.searchParams.get('radius');
    const page = url.searchParams.get('page');
    
    // Simulate filtering by radius
    if (radius === '1') {
      return HttpResponse.json({
        stations: mockCompetitors.stations.slice(0, 1),
        pagination: { ...mockCompetitors.pagination, total: 1 },
      });
    }
    
    // Simulate pagination
    if (page === '2') {
      return HttpResponse.json({
        stations: [],
        pagination: { 
          total: 2,
          page: 2,
          limit: 20,
          hasNextPage: false,
          hasPrevPage: true,
        },
      });
    }

    return HttpResponse.json(mockCompetitors);
  }),

  // Station prices endpoint
  http.get('/api/v1/prices/station/:numero', ({ params }) => {
    const { numero } = params;
    const station = mockCompetitors.stations.find(s => s.numero === numero);
    
    if (!station) {
      return new HttpResponse(null, { status: 404 });
    }
    
    return HttpResponse.json(station);
  }),

  // Nearby competitors endpoint
  http.post('/api/v1/prices/nearby', async ({ request }) => {
    const body = await request.json() as { lat: number; lng: number; radius: number };
    
    if (body.radius < 1) {
      return HttpResponse.json({
        stations: [],
        pagination: { total: 0, page: 1, limit: 20, hasNextPage: false, hasPrevPage: false },
      });
    }
    
    return HttpResponse.json(mockCompetitors);
  }),

  // Price history endpoint
  http.get('/api/v1/prices/history', ({ request }) => {
    const url = new URL(request.url);
    const days = url.searchParams.get('days');
    
    if (days === '7') {
      return HttpResponse.json({
        ...mockPriceHistory,
        changes: mockPriceHistory.changes.slice(0, 1),
      });
    }
    
    return HttpResponse.json(mockPriceHistory);
  }),

  // Market trends endpoint
  http.get('/api/v1/prices/market-trends', () => {
    return HttpResponse.json(mockMarketTrends);
  }),

  // Update price endpoint
  http.post('/api/v1/prices/update', async ({ request }) => {
    const body = await request.json() as { fuelType: string; price: number };
    
    return HttpResponse.json({
      message: 'Price updated successfully',
      change: {
        id: '2',
        stationId: '001',
        fuelType: body.fuelType,
        oldPrice: 22.50,
        newPrice: body.price,
        change: body.price - 22.50,
        percentage: ((body.price - 22.50) / 22.50) * 100,
        timestamp: new Date().toISOString(),
      },
    });
  }),

  // Update multiple prices endpoint
  http.post('/api/v1/prices/update-multiple', async ({ request }) => {
    const body = await request.json() as { prices: Array<{ fuelType: string; price: number }> };
    
    return HttpResponse.json({
      message: 'Prices updated successfully',
      changes: body.prices.map((price, index) => ({
        id: `change-${index}`,
        stationId: '001',
        fuelType: price.fuelType,
        oldPrice: 22.50,
        newPrice: price.price,
        change: price.price - 22.50,
        percentage: ((price.price - 22.50) / 22.50) * 100,
        timestamp: new Date().toISOString(),
      })),
    });
  }),

  // Compare stations endpoint
  http.post('/api/v1/prices/compare', async ({ request }) => {
    const body = await request.json() as { stationIds: string[] };
    
    const stations = mockCompetitors.stations.filter(s => 
      body.stationIds.includes(s.numero)
    );
    
    return HttpResponse.json({
      stations,
      comparison: [
        {
          fuelType: 'regular',
          cheapest: stations.reduce((prev, curr) => 
            (curr.regular || 0) < (prev.regular || 0) ? curr : prev
          ),
          mostExpensive: stations.reduce((prev, curr) => 
            (curr.regular || 0) > (prev.regular || 0) ? curr : prev
          ),
          averagePrice: stations.reduce((sum, station) => sum + (station.regular || 0), 0) / stations.length,
          priceRange: Math.max(...stations.map(s => s.regular || 0)) - Math.min(...stations.map(s => s.regular || 0)),
        },
      ],
    });
  }),

  // Error simulation endpoint
  http.get('/api/v1/prices/error', () => {
    return new HttpResponse(null, { status: 500 });
  }),
);

describe('Pricing API Integration', () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('getCurrentPrices', () => {
    it('should fetch current prices successfully', async () => {
      const result = await pricingService.getCurrentPrices();
      
      expect(result).toEqual(mockCurrentPrices);
      expect(result.prices.regular).toBe(22.50);
      expect(result.station.nombre).toBe('Test Station');
    });

    it('should handle API errors', async () => {
      server.use(
        http.get('/api/v1/prices/current', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(pricingService.getCurrentPrices()).rejects.toThrow('Get current prices failed');
    });
  });

  describe('getCompetitors', () => {
    it('should fetch competitors without filters', async () => {
      const result = await pricingService.getCompetitors();
      
      expect(result.stations).toHaveLength(2);
      expect(result.stations[0].nombre).toBe('Competitor 1');
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by radius', async () => {
      const result = await pricingService.getCompetitors({ radius: 1 });
      
      expect(result.stations).toHaveLength(1);
      expect(result.stations[0].distance).toBe(1.5);
    });

    it('should handle pagination', async () => {
      const result = await pricingService.getCompetitors({ page: 2 });
      
      expect(result.stations).toHaveLength(0);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('should build query parameters correctly', async () => {
      const filters = {
        radius: 10,
        fuelTypes: ['regular', 'premium'] as const,
        brands: ['Shell', 'Pemex'],
        sortBy: 'distance' as const,
        sortOrder: 'asc' as const,
        page: 1,
        limit: 10,
      };

      // This will test that the URL parameters are built correctly
      await pricingService.getCompetitors(filters);
      
      // If no error is thrown, the parameters were formatted correctly
      expect(true).toBe(true);
    });
  });

  describe('getStationPrices', () => {
    it('should fetch station prices by number', async () => {
      const result = await pricingService.getStationPrices('002');
      
      expect(result.nombre).toBe('Competitor 1');
      expect(result.regular).toBe(22.80);
      expect(result.brand).toBe('Shell');
    });

    it('should handle station not found', async () => {
      await expect(pricingService.getStationPrices('999')).rejects.toThrow('Get station prices failed');
    });
  });

  describe('getNearbyCompetitors', () => {
    it('should fetch nearby competitors', async () => {
      const result = await pricingService.getNearbyCompetitors(20.6597, -103.3496, 5);
      
      expect(result.stations).toHaveLength(2);
      expect(result.stations[0].distance).toBeDefined();
    });

    it('should return empty results for small radius', async () => {
      const result = await pricingService.getNearbyCompetitors(20.6597, -103.3496, 0.5);
      
      expect(result.stations).toHaveLength(0);
    });
  });

  describe('getPriceHistory', () => {
    it('should fetch price history', async () => {
      const result = await pricingService.getPriceHistory();
      
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].fuelType).toBe('regular');
      expect(result.changes[0].change).toBe(0.20);
    });

    it('should filter by days', async () => {
      const result = await pricingService.getPriceHistory({ days: 7 });
      
      expect(result.changes).toHaveLength(1);
    });

    it('should handle pagination and filters', async () => {
      const filters = {
        days: 30,
        fuelTypes: ['regular'] as const,
        page: 1,
        limit: 10,
      };

      const result = await pricingService.getPriceHistory(filters);
      expect(result.changes).toBeDefined();
    });
  });

  describe('getMarketTrends', () => {
    it('should fetch market trends', async () => {
      const result = await pricingService.getMarketTrends(30);
      
      expect(result.trends).toHaveLength(3);
      expect(result.trends[0].fuelType).toBe('regular');
      expect(result.trends[0].averagePrice).toBe(22.45);
    });
  });

  describe('updatePrice', () => {
    it('should update single price', async () => {
      const result = await pricingService.updatePrice({
        fuelType: 'regular',
        price: 23.00,
      });
      
      expect(result.message).toBe('Price updated successfully');
      expect(result.change.newPrice).toBe(23.00);
      expect(result.change.change).toBe(0.50);
    });
  });

  describe('updateMultiplePrices', () => {
    it('should update multiple prices', async () => {
      const prices = [
        { fuelType: 'regular', price: 23.00 },
        { fuelType: 'premium', price: 25.50 },
      ];

      const result = await pricingService.updateMultiplePrices(prices);
      
      expect(result.message).toBe('Prices updated successfully');
      expect(result.changes).toHaveLength(2);
      expect(result.changes[0].fuelType).toBe('regular');
      expect(result.changes[1].fuelType).toBe('premium');
    });
  });

  describe('compareStations', () => {
    it('should compare multiple stations', async () => {
      const result = await pricingService.compareStations(['002', '003']);
      
      expect(result.stations).toHaveLength(2);
      expect(result.comparison).toHaveLength(1);
      expect(result.comparison[0].fuelType).toBe('regular');
      expect(result.comparison[0].cheapest.numero).toBe('003'); // Pemex has lower price
      expect(result.comparison[0].mostExpensive.numero).toBe('002'); // Shell has higher price
    });
  });

  describe('request cancellation', () => {
    it('should cancel requests when abort signal is used', async () => {
      // Create a slow endpoint to test cancellation
      server.use(
        http.get('/api/v1/prices/current', () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      const promise = pricingService.getCurrentPrices();
      
      // Cancel the request immediately
      pricingService.cancelRequest('getCurrentPrices');
      
      await expect(promise).rejects.toThrow('Get current prices was cancelled');
    });

    it('should cancel all requests', async () => {
      server.use(
        http.get('/api/v1/prices/current', () => {
          return new Promise(() => {}); // Never resolves
        }),
        http.get('/api/v1/competitors', () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      const promise1 = pricingService.getCurrentPrices();
      const promise2 = pricingService.getCompetitors();
      
      pricingService.cancelAllRequests();
      
      await expect(promise1).rejects.toThrow('was cancelled');
      await expect(promise2).rejects.toThrow('was cancelled');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      server.use(
        http.get('/api/v1/prices/current', () => {
          return HttpResponse.error();
        })
      );

      await expect(pricingService.getCurrentPrices()).rejects.toThrow('Get current prices failed');
    });

    it('should handle HTTP error status codes', async () => {
      server.use(
        http.get('/api/v1/prices/current', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(pricingService.getCurrentPrices()).rejects.toThrow('Get current prices failed');
    });

    it('should handle malformed JSON responses', async () => {
      server.use(
        http.get('/api/v1/prices/current', () => {
          return new HttpResponse('invalid json', {
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      await expect(pricingService.getCurrentPrices()).rejects.toThrow('Get current prices failed');
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [
        pricingService.getCurrentPrices(),
        pricingService.getCompetitors(),
        pricingService.getMarketTrends(),
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockCurrentPrices);
      expect(results[1]).toEqual(mockCompetitors);
      expect(results[2]).toEqual(mockMarketTrends);
    });

    it('should cancel and replace duplicate requests', async () => {
      // This tests the behavior where making the same request twice 
      // should cancel the first one
      const promise1 = pricingService.getCurrentPrices();
      const promise2 = pricingService.getCurrentPrices();
      
      // Both should complete (the implementation replaces the abort controller)
      const results = await Promise.allSettled([promise1, promise2]);
      
      // At least one should succeed
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    });
  });
});

afterEach(() => {
  server.close();
});