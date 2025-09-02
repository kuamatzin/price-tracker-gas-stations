import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/api/auth.service';

// Mock the auth service
vi.mock('@/services/api/auth.service', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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

const mockAuthResponse = {
  user: mockUser,
  token: 'test-token',
  expires_at: '2024-12-31T23:59:59Z'
};

describe('Complete Authentication Flow', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Reset auth store state
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('complete login flow from start to dashboard', async () => {
    // Mock successful login
    vi.mocked(authService.login).mockResolvedValue(mockAuthResponse);

    // Start at login page
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);

    // Verify we're on login page
    expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();

    // Fill in login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Wait for login to complete and redirect to dashboard
    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        remember: false
      });
    });

    // Should redirect to dashboard after successful login
    await waitFor(() => {
      expect(screen.queryByText(/Iniciar Sesión/)).not.toBeInTheDocument();
    });
  });

  it('handles login errors correctly', async () => {
    // Mock failed login
    vi.mocked(authService.login).mockRejectedValue(
      new Error('Credenciales inválidas')
    );

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);

    // Fill in login form with wrong credentials
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Credenciales inválidas/)).toBeInTheDocument();
    });

    // Should still be on login page
    expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
  });

  it('remembers user with remember me option', async () => {
    vi.mocked(authService.login).mockResolvedValue(mockAuthResponse);

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);

    // Fill in login form and check remember me
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const rememberCheckbox = screen.getByLabelText(/recordar/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(rememberCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        remember: true
      });
    });
  });

  it('logout flow clears auth state and redirects', async () => {
    // Start with authenticated state
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    vi.mocked(authService.logout).mockResolvedValue();

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Find and click logout button
    const userMenuButton = screen.getByText(mockUser.name);
    await user.click(userMenuButton);

    const logoutButton = screen.getByText(/cerrar sesión/i);
    await user.click(logoutButton);

    // Wait for logout to complete
    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalled();
    });

    // Should redirect to login page
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });
  });

  it('token refresh works automatically', async () => {
    // Mock token that expires soon
    const soonExpiringToken = {
      user: mockUser,
      token: 'expiring-token',
      expires_at: new Date(Date.now() + 4 * 60 * 1000).toISOString() // 4 minutes from now
    };

    const refreshedToken = {
      token: 'new-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    };

    vi.mocked(authService.refreshToken).mockResolvedValue(refreshedToken);

    // Set up auth state with soon-expiring token
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'expiring-token';
    authStore.expiresAt = soonExpiringToken.expires_at;
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Wait for automatic token refresh
    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalled();
    }, { timeout: 5000 });

    // User should still be authenticated
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
  });

  it('handles deep linking with auth redirect', async () => {
    // Try to access protected route while not authenticated
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/analytics'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should redirect to login with redirect parameter
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });

    // After login, should redirect to originally requested page
    vi.mocked(authService.login).mockResolvedValue(mockAuthResponse);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Should redirect to analytics page after login
    await waitFor(() => {
      expect(screen.queryByText(/Iniciar Sesión/)).not.toBeInTheDocument();
    });
  });

  it('handles session expiration gracefully', async () => {
    // Start with authenticated state
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'expired-token';
    authStore.isAuthenticated = true;

    // Mock refresh token failure (session expired)
    vi.mocked(authService.refreshToken).mockRejectedValue(
      new Error('Session expired')
    );

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should automatically attempt refresh and fail
    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalled();
    });

    // Should redirect to login after session expires
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });
  });
});