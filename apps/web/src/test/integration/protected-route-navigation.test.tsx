import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';

// Mock console.log to avoid noise
vi.spyOn(console, 'log').mockImplementation(() => {});

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

describe('Protected Route Navigation', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Reset auth store
    useAuthStore.getState().logout();
  });

  it('allows navigation to dashboard when authenticated', async () => {
    // Set authenticated state
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show dashboard content
    await waitFor(() => {
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to login', async () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should redirect to login
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });
  });

  it('blocks access to premium features for basic users', async () => {
    const basicUser = { ...mockUser, subscription_tier: 'basic' };
    
    const authStore = useAuthStore.getState();
    authStore.user = basicUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/analytics'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show access denied
    await waitFor(() => {
      expect(screen.getByText('Acceso Denegado')).toBeInTheDocument();
    });
  });

  it('allows premium users to access analytics', async () => {
    const premiumUser = { ...mockUser, subscription_tier: 'premium' };
    
    const authStore = useAuthStore.getState();
    authStore.user = premiumUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/analytics'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show analytics content
    await waitFor(() => {
      expect(screen.queryByText('Acceso Denegado')).not.toBeInTheDocument();
    });
  });

  it('requires station assignment for price pages', async () => {
    const userWithoutStation = { ...mockUser, station: null };
    
    const authStore = useAuthStore.getState();
    authStore.user = userWithoutStation;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/prices'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show station required message
    await waitFor(() => {
      expect(screen.getByText('Estación Requerida')).toBeInTheDocument();
    });
  });

  it('allows users with stations to access price pages', async () => {
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/prices'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show prices content (no station required error)
    await waitFor(() => {
      expect(screen.queryByText('Estación Requerida')).not.toBeInTheDocument();
    });
  });

  it('handles navigation between protected routes', async () => {
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show dashboard initially
    await waitFor(() => {
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    });

    // Navigate to settings
    const settingsLink = screen.getByText(/configuración/i);
    await user.click(settingsLink);

    // Should navigate to settings
    await waitFor(() => {
      // Settings page should load (specific assertions would depend on Settings component)
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });
  });

  it('shows loading state during authentication check', async () => {
    const authStore = useAuthStore.getState();
    authStore.isLoading = true;
    authStore.isAuthenticated = false;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should show loading screen
    expect(screen.getByText('Verificando autenticación...')).toBeInTheDocument();
  });

  it('handles route transitions with loading states', async () => {
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    });

    // Navigate to another route
    const pricesLink = screen.getByText(/precios/i);
    await user.click(pricesLink);

    // Route transition should work smoothly without errors
    await waitFor(() => {
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });
  });

  it('preserves route state during authentication', async () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/prices/history?date=2024-01-01'],
    });

    render(<RouterProvider router={testRouter} />);

    // Should redirect to login but preserve the original route
    await waitFor(() => {
      expect(screen.getByText(/Iniciar Sesión/)).toBeInTheDocument();
    });

    // After authentication, should return to original route with query params
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    // The URL should be preserved through the authentication process
    expect(testRouter.state.location.pathname).toContain('/prices');
  });

  it('handles concurrent route access attempts', async () => {
    const authStore = useAuthStore.getState();
    authStore.user = mockUser;
    authStore.token = 'test-token';
    authStore.isAuthenticated = true;

    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);

    // Wait for initial route to load
    await waitFor(() => {
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    });

    // Rapidly navigate between routes
    const settingsLink = screen.getByText(/configuración/i);
    const pricesLink = screen.getByText(/precios/i);
    
    await user.click(settingsLink);
    await user.click(pricesLink);
    await user.click(settingsLink);

    // Should handle rapid navigation without errors
    await waitFor(() => {
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });
  });
});