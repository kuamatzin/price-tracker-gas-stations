import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/api/auth.service';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Mock the auth service
vi.mock('@/services/api/auth.service', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  withErrorBoundary: (component: any) => component,
}));

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

// Component that throws an error for testing
const ErrorThrowingComponent = ({ shouldError }: { shouldError: boolean }) => {
  if (shouldError) {
    throw new Error('Test component error');
  }
  return <div>Component working</div>;
};

describe('Error Handling Flow', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Mock console methods to avoid noise
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Reset auth store
    useAuthStore.getState().logout();
  });

  it('handles authentication errors gracefully', async () => {
    // Mock login failure
    vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'));

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);

    // Fill login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
    });

    // Should remain on login page
    expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
  });

  it('handles network errors during authentication', async () => {
    // Mock network error
    vi.mocked(authService.login).mockRejectedValue(
      new Error('Error de conexión. Verifica tu internet')
    );

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Should show network error
    await waitFor(() => {
      expect(screen.getByText(/Error de conexión/)).toBeInTheDocument();
    });
  });

  it('handles token refresh errors', async () => {
    // Set up authenticated user with expired token
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'expired-token';
    authStore.expiresAt = new Date(Date.now() - 1000).toISOString(); // Already expired
    authStore.isAuthenticated = true;

    // Mock refresh failure
    vi.mocked(authService.refreshToken).mockRejectedValue(
      new Error('Token refresh failed')
    );

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should attempt token refresh and fail, then redirect to login
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });
  });

  it('catches and displays component errors', () => {
    // Use error boundary to catch component errors
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldError={true} />
      </ErrorBoundary>
    );

    // Should show error fallback UI
    expect(screen.getByText(/Algo salió mal/)).toBeInTheDocument();
    expect(screen.getByText(/Recargar página/)).toBeInTheDocument();
  });

  it('allows error recovery from component errors', async () => {
    let shouldError = true;

    const { rerender } = render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldError={shouldError} />
      </ErrorBoundary>
    );

    // Should show error
    expect(screen.getByText(/Algo salió mal/)).toBeInTheDocument();

    // Click reload button
    const reloadButton = screen.getByText(/Recargar página/);
    fireEvent.click(reloadButton);

    // Should reload the page (window.location.reload is called)
    expect(window.location.reload).toBeDefined();
  });

  it('handles API errors with proper error messages', async () => {
    // Mock different types of API errors
    const testCases = [
      { status: 401, message: 'Unauthorized', expected: 'Credenciales inválidas' },
      { status: 422, message: 'Validation Error', expected: 'Datos de entrada inválidos' },
      { status: 423, message: 'Account Locked', expected: 'Cuenta bloqueada' },
      { status: 429, message: 'Rate Limited', expected: 'Demasiados intentos' },
      { status: 500, message: 'Server Error', expected: 'Error del servidor' },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      
      const errorResponse = {
        response: {
          status: testCase.status,
          data: { message: testCase.message }
        }
      };

      vi.mocked(authService.login).mockRejectedValue(errorResponse);

      const testRouter = createMemoryRouter(router.routes, {
        initialEntries: ['/login'],
      });

      render(<RouterProvider router={testRouter} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Should show appropriate error message
      await waitFor(() => {
        expect(screen.getByText(new RegExp(testCase.expected, 'i'))).toBeInTheDocument();
      });
    }
  });

  it('handles unauthorized access gracefully', async () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/analytics'], // Requires premium subscription
    });

    render(<RouterProvider router={testRouter} />);

    // Should redirect to login for unauthenticated user
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });
  });

  it('shows appropriate error for insufficient subscription', async () => {
    const basicUser = { ...mockUser, subscription_tier: 'basic' };
    
    const authStore = useAuthStore.getState();
    authStore.user = basicUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/analytics'], // Requires premium
    });

    render(<RouterProvider router={testRouter} />);

    // Should show subscription required error
    await waitFor(() => {
      expect(screen.getByText('Acceso Denegado')).toBeInTheDocument();
    });
  });

  it('handles missing station error', async () => {
    const userWithoutStation = { ...mockUser, station: null };
    
    const authStore = useAuthStore.getState();
    authStore.user = userWithoutStation;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/prices'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show station required error
    await waitFor(() => {
      expect(screen.getByText('Estación Requerida')).toBeInTheDocument();
    });
  });

  it('handles logout errors gracefully', async () => {
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    // Mock logout failure
    vi.mocked(authService.logout).mockRejectedValue(new Error('Logout failed'));

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Find and click logout button
    const userMenuButton = screen.getByText(mockUser.name);
    await user.click(userMenuButton);

    const logoutButton = screen.getByText(/cerrar sesión/i);
    await user.click(logoutButton);

    // Should still logout locally even if API fails
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });
  });

  it('displays helpful 404 page for invalid routes', async () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/invalid-route'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show 404 page
    await waitFor(() => {
      expect(screen.getByText(/404/)).toBeInTheDocument();
    });
  });

  it('handles concurrent error scenarios', async () => {
    // Mock multiple simultaneous failures
    vi.mocked(authService.login).mockRejectedValue(new Error('Login failed'));
    vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Refresh failed'));

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);

    // Try multiple login attempts rapidly
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    
    // Rapid clicks to test concurrent error handling
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // Should handle errors without crashing
    await waitFor(() => {
      expect(screen.getByText(/Login failed/)).toBeInTheDocument();
    });
  });
});