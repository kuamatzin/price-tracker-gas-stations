import { beforeEach, describe, expect, test, vi, afterEach } from 'vitest';
import { tokenManager, TokenManager } from '@/services/tokenManager';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore');

describe('TokenManager', () => {
  let mockAuthStore: any;
  let manager: TokenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockAuthStore = {
      token: 'test-token',
      expiresAt: null,
      isAuthenticated: false,
      refresh: vi.fn(),
      logout: vi.fn(),
    };

    (useAuthStore as any).getState = vi.fn(() => mockAuthStore);

    manager = new TokenManager();
  });

  afterEach(() => {
    manager.stopTokenManagement();
    vi.useRealTimers();
  });

  describe('startTokenManagement', () => {
    test('starts periodic token checks', () => {
      manager.startTokenManagement();
      
      // Fast-forward time to trigger a check
      vi.advanceTimersByTime(60 * 1000); // 1 minute
      
      // Should call getState to check token
      expect(useAuthStore.getState).toHaveBeenCalled();
    });

    test('clears existing timers before starting new ones', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      manager.startTokenManagement();
      manager.startTokenManagement(); // Start again
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('stopTokenManagement', () => {
    test('clears all timers', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      manager.startTokenManagement();
      manager.stopTokenManagement();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('token expiration checks', () => {
    test('does nothing when not authenticated', () => {
      mockAuthStore.isAuthenticated = false;
      
      manager.startTokenManagement();
      vi.advanceTimersByTime(60 * 1000);
      
      expect(mockAuthStore.logout).not.toHaveBeenCalled();
      expect(mockAuthStore.refresh).not.toHaveBeenCalled();
    });

    test('logs out when token is expired', () => {
      mockAuthStore.isAuthenticated = true;
      mockAuthStore.token = 'expired-token';
      mockAuthStore.expiresAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
      
      manager.startTokenManagement();
      vi.advanceTimersByTime(60 * 1000);
      
      expect(mockAuthStore.logout).toHaveBeenCalled();
    });

    test('schedules refresh when token expires soon', () => {
      mockAuthStore.isAuthenticated = true;
      mockAuthStore.token = 'soon-to-expire-token';
      mockAuthStore.expiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString(); // 4 minutes from now
      
      manager.startTokenManagement();
      vi.advanceTimersByTime(60 * 1000);
      
      // Should schedule a refresh
      expect(mockAuthStore.refresh).not.toHaveBeenCalledWith(); // Not called immediately
      
      // Fast-forward to when refresh should happen
      vi.advanceTimersByTime(3 * 60 * 1000); // 3 more minutes
      
      expect(mockAuthStore.refresh).toHaveBeenCalled();
    });

    test('does not refresh when token has plenty of time left', () => {
      mockAuthStore.isAuthenticated = true;
      mockAuthStore.token = 'fresh-token';
      mockAuthStore.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now
      
      manager.startTokenManagement();
      vi.advanceTimersByTime(60 * 1000);
      
      expect(mockAuthStore.refresh).not.toHaveBeenCalled();
    });
  });

  describe('forceRefresh', () => {
    test('calls auth store refresh method', async () => {
      mockAuthStore.refresh.mockResolvedValue(undefined);
      
      await manager.forceRefresh();
      
      expect(mockAuthStore.refresh).toHaveBeenCalled();
    });
  });

  describe('isTokenExpired', () => {
    test('returns true when token is expired', () => {
      mockAuthStore.expiresAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
      
      expect(manager.isTokenExpired()).toBe(true);
    });

    test('returns false when token is not expired', () => {
      mockAuthStore.expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 1 minute from now
      
      expect(manager.isTokenExpired()).toBe(false);
    });

    test('returns true when no expiration date', () => {
      mockAuthStore.expiresAt = null;
      
      expect(manager.isTokenExpired()).toBe(true);
    });
  });

  describe('getTimeUntilExpiry', () => {
    test('returns time until expiry in milliseconds', () => {
      const futureTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now
      mockAuthStore.expiresAt = new Date(futureTime).toISOString();
      
      const timeUntilExpiry = manager.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBeCloseTo(5 * 60 * 1000, -2); // Within 100ms
    });

    test('returns 0 for expired tokens', () => {
      mockAuthStore.expiresAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
      
      expect(manager.getTimeUntilExpiry()).toBe(0);
    });

    test('returns null when no expiration date', () => {
      mockAuthStore.expiresAt = null;
      
      expect(manager.getTimeUntilExpiry()).toBe(null);
    });
  });
});