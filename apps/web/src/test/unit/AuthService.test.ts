import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService, type LoginRequest, type AuthResponse } from '@/services/api/auth.service';
import { apiClient } from '@/services/api/client';

// Mock the API client
vi.mock('@/services/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    const mockAuthResponse: AuthResponse = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        station: {
          numero: 'E12345',
          nombre: 'Test Station',
          municipio: 'Test City',
          entidad: 'Test State'
        },
        subscription_tier: 'premium'
      },
      token: 'test-token',
      expires_at: '2024-12-31T23:59:59Z'
    };

    it('successfully logs in user', async () => {
      const loginData: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        remember: true
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockAuthResponse });

      const result = await authService.login(loginData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/login', loginData);
      expect(result).toEqual(mockAuthResponse);
    });

    it('handles login errors', async () => {
      const loginData: LoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const errorResponse = {
        response: {
          status: 401,
          data: { message: 'Credenciales inválidas' }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(errorResponse);

      await expect(authService.login(loginData)).rejects.toThrow('Credenciales inválidas');
    });

    it('handles network errors', async () => {
      const loginData: LoginRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      const networkError = { code: 'NETWORK_ERROR' };
      vi.mocked(apiClient.post).mockRejectedValue(networkError);

      await expect(authService.login(loginData)).rejects.toThrow('Error de conexión. Verifica tu internet');
    });

    it('handles rate limiting', async () => {
      const loginData: LoginRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Too many requests' }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(rateLimitError);

      await expect(authService.login(loginData)).rejects.toThrow('Demasiados intentos. Intenta más tarde');
    });
  });

  describe('logout', () => {
    it('successfully logs out user', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({});

      await expect(authService.logout()).resolves.not.toThrow();
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/logout');
    });

    it('handles logout errors gracefully', async () => {
      const errorResponse = {
        response: {
          status: 500,
          data: { message: 'Server error' }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(errorResponse);

      // Logout should not throw even if API fails
      await expect(authService.logout()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('successfully refreshes token', async () => {
      const mockRefreshResponse = {
        token: 'new-token',
        expires_at: '2024-12-31T23:59:59Z'
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockRefreshResponse });

      const result = await authService.refreshToken();

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/refresh');
      expect(result).toEqual(mockRefreshResponse);
    });

    it('handles refresh token errors', async () => {
      const errorResponse = {
        response: {
          status: 401,
          data: { message: 'Token expired' }
        }
      };

      vi.mocked(apiClient.post).mockRejectedValue(errorResponse);

      await expect(authService.refreshToken()).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('forgotPassword', () => {
    it('successfully sends forgot password request', async () => {
      const mockResponse = { message: 'Reset email sent' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/forgot-password', {
        email: 'test@example.com'
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('resetPassword', () => {
    it('successfully resets password', async () => {
      const mockResponse = { message: 'Password reset successfully' };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const resetData = {
        token: 'reset-token',
        password: 'newpassword',
        password_confirmation: 'newpassword'
      };

      const result = await authService.resetPassword(resetData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/reset-password', resetData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCurrentUser', () => {
    it('successfully gets current user', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        station: {
          numero: 'E12345',
          nombre: 'Test Station',
          municipio: 'Test City',
          entidad: 'Test State'
        },
        subscription_tier: 'premium'
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockUser });

      const result = await authService.getCurrentUser();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/auth/me');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateProfile', () => {
    it('successfully updates user profile', async () => {
      const mockUpdatedUser = {
        id: '123',
        email: 'newemail@example.com',
        name: 'Updated Name',
        station: null,
        subscription_tier: 'basic'
      };

      vi.mocked(apiClient.put).mockResolvedValue({ data: mockUpdatedUser });

      const updateData = { name: 'Updated Name', email: 'newemail@example.com' };
      const result = await authService.updateProfile(updateData);

      expect(apiClient.put).toHaveBeenCalledWith('/api/v1/auth/profile', updateData);
      expect(result).toEqual(mockUpdatedUser);
    });
  });
});