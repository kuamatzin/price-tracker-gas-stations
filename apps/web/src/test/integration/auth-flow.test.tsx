import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import { useAuthStore } from '@/stores/authStore';
import * as authService from '@/services/api/auth.service';

// Mock the auth service
vi.mock('@/services/api/auth.service', () => ({
  login: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth store
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Login Flow', () => {
    it('should successfully login user and store token', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: {
          id: 'station-1',
          name: 'Test Station',
          location: { lat: 0, lng: 0 },
        },
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoRefresh: true,
          refreshInterval: 5,
        },
      };

      const mockResponse = {
        access_token: 'mock-jwt-token',
        refresh_token: 'mock-refresh-token',
        user: mockUser,
      };

      vi.mocked(authService.login).mockResolvedValue(mockResponse);

      render(<Login />, { wrapper: TestWrapper });

      // Fill login form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for API call and state updates
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Check if token is stored in localStorage
      await waitFor(() => {
        expect(localStorage.getItem('auth_token')).toBe('mock-jwt-token');
        expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token');
      });

      // Check if user is authenticated in store
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user).toEqual(mockUser);
        expect(state.token).toBe('mock-jwt-token');
      });
    });

    it('should handle login error gracefully', async () => {
      const user = userEvent.setup();
      
      vi.mocked(authService.login).mockRejectedValue(
        new Error('Invalid credentials')
      );

      render(<Login />, { wrapper: TestWrapper });

      // Fill login form
      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Check that user is not authenticated
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });

  describe('Registration Flow', () => {
    it('should successfully register user and auto-login', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: '2',
        email: 'newuser@example.com',
        name: 'New User',
        station: {
          id: 'station-2',
          name: 'New Station',
          location: { lat: 0, lng: 0 },
        },
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoRefresh: true,
          refreshInterval: 5,
        },
      };

      const mockResponse = {
        access_token: 'new-jwt-token',
        refresh_token: 'new-refresh-token',
        user: mockUser,
      };

      vi.mocked(authService.register).mockResolvedValue(mockResponse);

      render(<Register />, { wrapper: TestWrapper });

      // Fill registration form
      await user.type(screen.getByLabelText(/name/i), 'New User');
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Wait for API call
      await waitFor(() => {
        expect(authService.register).toHaveBeenCalledWith({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
          confirmPassword: 'password123',
        });
      });

      // Check if user is automatically logged in
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user).toEqual(mockUser);
        expect(state.token).toBe('new-jwt-token');
      });
    });

    it('should handle registration validation errors', async () => {
      const user = userEvent.setup();
      
      vi.mocked(authService.register).mockRejectedValue(
        new Error('Email already exists')
      );

      render(<Register />, { wrapper: TestWrapper });

      // Fill registration form with existing email
      await user.type(screen.getByLabelText(/name/i), 'Test User');
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });

      // Check that user is not authenticated
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Token Management', () => {
    it('should refresh token when expired', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: { id: 'station-1', name: 'Test Station', location: { lat: 0, lng: 0 } },
        preferences: { theme: 'light' as const, notifications: true, autoRefresh: true, refreshInterval: 5 },
      };

      // Set up initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        token: 'expired-token',
        refreshToken: 'valid-refresh-token',
        isAuthenticated: true,
        isLoading: false,
      });

      const newTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: mockUser,
      };

      vi.mocked(authService.refreshToken).mockResolvedValue(newTokenResponse);

      // Call refresh token function
      const { refreshToken } = useAuthStore.getState();
      await refreshToken();

      await waitFor(() => {
        expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
      });

      // Check if new tokens are stored
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.token).toBe('new-access-token');
        expect(state.refreshToken).toBe('new-refresh-token');
        expect(state.isAuthenticated).toBe(true);
      });
    });

    it('should logout user when refresh token is invalid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: { id: 'station-1', name: 'Test Station', location: { lat: 0, lng: 0 } },
        preferences: { theme: 'light' as const, notifications: true, autoRefresh: true, refreshInterval: 5 },
      };

      // Set up initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        token: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        isAuthenticated: true,
        isLoading: false,
      });

      vi.mocked(authService.refreshToken).mockRejectedValue(
        new Error('Invalid refresh token')
      );

      // Call refresh token function
      const { refreshToken } = useAuthStore.getState();
      await refreshToken();

      // Check if user is logged out
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });

      // Check localStorage is cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout user and clear data', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: { id: 'station-1', name: 'Test Station', location: { lat: 0, lng: 0 } },
        preferences: { theme: 'light' as const, notifications: true, autoRefresh: true, refreshInterval: 5 },
      };

      // Set up authenticated state
      useAuthStore.setState({
        user: mockUser,
        token: 'valid-token',
        refreshToken: 'valid-refresh-token',
        isAuthenticated: true,
      });

      localStorage.setItem('auth_token', 'valid-token');
      localStorage.setItem('refresh_token', 'valid-refresh-token');

      vi.mocked(authService.logout).mockResolvedValue(undefined);

      // Call logout
      const { logout } = useAuthStore.getState();
      await logout();

      await waitFor(() => {
        expect(authService.logout).toHaveBeenCalledWith('valid-token');
      });

      // Check state is cleared
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });

      // Check localStorage is cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('Session Persistence', () => {
    it('should restore session from localStorage on app load', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: { id: 'station-1', name: 'Test Station', location: { lat: 0, lng: 0 } },
        preferences: { theme: 'light' as const, notifications: true, autoRefresh: true, refreshInterval: 5 },
      };

      // Set up localStorage as if user was previously logged in
      localStorage.setItem('auth_token', 'stored-token');
      localStorage.setItem('refresh_token', 'stored-refresh-token');

      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

      // Initialize auth store (simulating app load)
      const { initializeAuth } = useAuthStore.getState();
      await initializeAuth();

      await waitFor(() => {
        expect(authService.getCurrentUser).toHaveBeenCalled();
      });

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.token).toBe('stored-token');
        expect(state.refreshToken).toBe('stored-refresh-token');
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
      });
    });

    it('should clear invalid stored tokens', async () => {
      // Set up localStorage with invalid tokens
      localStorage.setItem('auth_token', 'invalid-token');
      localStorage.setItem('refresh_token', 'invalid-refresh-token');

      vi.mocked(authService.getCurrentUser).mockRejectedValue(
        new Error('Token invalid')
      );

      // Initialize auth store
      const { initializeAuth } = useAuthStore.getState();
      await initializeAuth();

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });

      // Check localStorage is cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });
});