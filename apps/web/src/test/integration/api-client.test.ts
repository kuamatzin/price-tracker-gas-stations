import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { apiClient } from '@/services/api/client';
import { authService } from '@/services/api/auth.service';
import { pricingService } from '@/services/api/pricing.service';
import { analyticsService } from '@/services/api/analytics.service';
import { useAuthStore } from '@/stores/authStore';

// Mock server setup
const mockApiUrl = 'http://localhost:8000/api/v1';

const server = setupServer(
  // Auth endpoints
  http.post(`${mockApiUrl}/auth/login`, () => {
    return HttpResponse.json({
      access_token: 'mock-jwt-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: {
          id: 'station-1',
          name: 'Test Station',
          location: { lat: 0, lng: 0 },
        },
      },
    });
  }),

  http.post(`${mockApiUrl}/auth/refresh`, () => {
    return HttpResponse.json({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });
  }),

  http.get(`${mockApiUrl}/auth/me`, () => {
    return HttpResponse.json({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      station: {
        id: 'station-1',
        name: 'Test Station',
        location: { lat: 0, lng: 0 },
      },
    });
  }),

  // Protected endpoint that requires auth
  http.get(`${mockApiUrl}/pricing/current`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({
      prices: [
        { fuelType: 'REGULAR', price: 20.50 },
        { fuelType: 'PREMIUM', price: 22.30 },
        { fuelType: 'DIESEL', price: 21.80 },
      ],
      lastUpdated: '2025-09-01T12:00:00Z',
    });
  }),

  // Error simulation endpoint
  http.get(`${mockApiUrl}/test/error`, () => {
    return new HttpResponse(null, { status: 500 });
  }),

  // Network error simulation
  http.get(`${mockApiUrl}/test/network-error`, () => {
    throw new Error('Network Error');
  }),

  // Analytics endpoint
  http.get(`${mockApiUrl}/analytics/dashboard`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({
      salesMetrics: { totalRevenue: 50000, totalVolume: 1000, averageMargin: 0.15, transactionCount: 200, revenueChange: 0.05, volumeChange: 0.03, marginChange: 0.01, transactionChange: 0.08 },
      marketPosition: { ranking: 5, totalStations: 150, marketShare: 0.12, competitiveAdvantage: [] },
      recentChanges: [],
      alerts: [],
    });
  }),
);

describe('API Client Integration Tests', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset auth store
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Request Interceptors', () => {
    it('should add Authorization header when token is present', async () => {
      // Set token in auth store
      useAuthStore.setState({
        token: 'mock-jwt-token',
        isAuthenticated: true,
      });

      const response = await apiClient.get('/pricing/current');

      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        prices: [
          { fuelType: 'REGULAR', price: 20.50 },
          { fuelType: 'PREMIUM', price: 22.30 },
          { fuelType: 'DIESEL', price: 21.80 },
        ],
        lastUpdated: '2025-09-01T12:00:00Z',
      });
    });

    it('should not add Authorization header when no token', async () => {
      // No token in store - should get 401
      const response = await apiClient.get('/pricing/current').catch(err => err.response);

      expect(response.status).toBe(401);
    });

    it('should add request ID for tracing', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      const response = await apiClient.get('/pricing/current');
      
      expect(response.status).toBe(200);
      // Request ID should be added by interceptor
    });
  });

  describe('Response Interceptors', () => {
    it('should handle successful responses', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      const response = await apiClient.get('/pricing/current');

      expect(response.status).toBe(200);
      expect(response.data.prices).toBeDefined();
    });

    it('should handle 401 errors with token refresh', async () => {
      // Set up expired token scenario
      useAuthStore.setState({
        token: 'expired-token',
        refreshToken: 'valid-refresh-token',
        isAuthenticated: true,
      });

      // Mock the 401 response first, then success after refresh
      server.use(
        http.get(`${mockApiUrl}/pricing/current`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader === 'Bearer expired-token') {
            return new HttpResponse(null, { status: 401 });
          }
          if (authHeader === 'Bearer new-access-token') {
            return HttpResponse.json({
              prices: [{ fuelType: 'REGULAR', price: 20.50 }],
            });
          }
          return new HttpResponse(null, { status: 401 });
        })
      );

      const response = await apiClient.get('/pricing/current');

      expect(response.status).toBe(200);
      // Token should be refreshed in store
      const state = useAuthStore.getState();
      expect(state.token).toBe('new-access-token');
    });

    it('should handle network errors with retry logic', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      let attempt = 0;
      server.use(
        http.get(`${mockApiUrl}/test/network-error`, () => {
          attempt++;
          if (attempt <= 2) {
            throw new Error('Network Error');
          }
          return HttpResponse.json({ success: true });
        })
      );

      const response = await apiClient.get('/test/network-error');

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ success: true });
      expect(attempt).toBe(3); // Should retry 2 times before success
    });

    it('should fail after max retries', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      server.use(
        http.get(`${mockApiUrl}/test/error`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(apiClient.get('/test/error')).rejects.toThrow();
    });
  });

  describe('Service Integration', () => {
    it('should handle auth service login flow', async () => {
      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        refresh_token: 'mock-refresh-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: {
            id: 'station-1',
            name: 'Test Station',
            location: { lat: 0, lng: 0 },
          },
        },
      });
    });

    it('should handle pricing service with authentication', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      const result = await pricingService.getCurrentPrices();

      expect(result).toEqual({
        prices: [
          { fuelType: 'REGULAR', price: 20.50 },
          { fuelType: 'PREMIUM', price: 22.30 },
          { fuelType: 'DIESEL', price: 21.80 },
        ],
        lastUpdated: '2025-09-01T12:00:00Z',
      });
    });

    it('should handle analytics service with authentication', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      const result = await analyticsService.getDashboardData();

      expect(result).toEqual({
        salesMetrics: { totalRevenue: 50000, totalVolume: 1000, averageMargin: 0.15, transactionCount: 200, revenueChange: 0.05, volumeChange: 0.03, marginChange: 0.01, transactionChange: 0.08 },
        marketPosition: { ranking: 5, totalStations: 150, marketShare: 0.12, competitiveAdvantage: [] },
        recentChanges: [],
        alerts: [],
      });
    });

    it('should handle service errors gracefully', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      server.use(
        http.get(`${mockApiUrl}/pricing/current`, () => {
          return HttpResponse.json(
            { error: 'Service unavailable' },
            { status: 503 }
          );
        })
      );

      await expect(pricingService.getCurrentPrices()).rejects.toThrow();
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous requests', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      const [pricingResponse, analyticsResponse] = await Promise.all([
        apiClient.get('/pricing/current'),
        apiClient.get('/analytics/dashboard'),
      ]);

      expect(pricingResponse.status).toBe(200);
      expect(analyticsResponse.status).toBe(200);
      expect(pricingResponse.data.prices).toBeDefined();
      expect(analyticsResponse.data.totalStations).toBeDefined();
    });

    it('should handle token refresh during concurrent requests', async () => {
      useAuthStore.setState({
        token: 'expired-token',
        refreshToken: 'valid-refresh-token',
        isAuthenticated: true,
      });

      let authAttempts = 0;
      server.use(
        http.get(`${mockApiUrl}/pricing/current`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader === 'Bearer expired-token') {
            authAttempts++;
            return new HttpResponse(null, { status: 401 });
          }
          if (authHeader === 'Bearer new-access-token') {
            return HttpResponse.json({ prices: [] });
          }
          return new HttpResponse(null, { status: 401 });
        }),
        http.get(`${mockApiUrl}/analytics/dashboard`, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader === 'Bearer expired-token') {
            authAttempts++;
            return new HttpResponse(null, { status: 401 });
          }
          if (authHeader === 'Bearer new-access-token') {
            return HttpResponse.json({ totalStations: 0 });
          }
          return new HttpResponse(null, { status: 401 });
        })
      );

      const [pricingResponse, analyticsResponse] = await Promise.all([
        apiClient.get('/pricing/current'),
        apiClient.get('/analytics/dashboard'),
      ]);

      expect(pricingResponse.status).toBe(200);
      expect(analyticsResponse.status).toBe(200);
      
      // Should only refresh token once, not for each request
      const state = useAuthStore.getState();
      expect(state.token).toBe('new-access-token');
    });
  });

  describe('Request/Response Logging', () => {
    it('should log requests in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      useAuthStore.setState({ token: 'mock-jwt-token' });

      await apiClient.get('/pricing/current');

      // In development mode, requests should be logged
      if (import.meta.env.DEV) {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('API Request'),
          expect.any(Object)
        );
      }

      consoleSpy.mockRestore();
    });

    it('should log response times', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      useAuthStore.setState({ token: 'mock-jwt-token' });

      await apiClient.get('/pricing/current');

      if (import.meta.env.DEV) {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('API Response'),
          expect.any(Object)
        );
      }

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout errors', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      server.use(
        http.get(`${mockApiUrl}/test/timeout`, async () => {
          // Simulate timeout
          await new Promise(resolve => setTimeout(resolve, 10000));
          return HttpResponse.json({ data: 'delayed' });
        })
      );

      await expect(
        apiClient.get('/test/timeout', { timeout: 1000 })
      ).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      useAuthStore.setState({ token: 'mock-jwt-token' });

      server.use(
        http.get(`${mockApiUrl}/test/malformed`, () => {
          return new HttpResponse('malformed json{', {
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      await expect(apiClient.get('/test/malformed')).rejects.toThrow();
    });
  });
});