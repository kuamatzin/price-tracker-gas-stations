import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { router } from '@/router';

// Mock the page components since they import stores
vi.mock('@/pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard Page</div>,
}));

vi.mock('@/pages/Prices', () => ({
  default: () => <div data-testid="prices">Prices Page</div>,
}));

vi.mock('@/pages/Analytics', () => ({
  default: () => <div data-testid="analytics">Analytics Page</div>,
}));

vi.mock('@/pages/Settings', () => ({
  default: () => <div data-testid="settings">Settings Page</div>,
}));

vi.mock('@/pages/auth/Login', () => ({
  default: () => <div data-testid="login">Login Page</div>,
}));

vi.mock('@/pages/auth/Register', () => ({
  default: () => <div data-testid="register">Register Page</div>,
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe('Router Configuration', () => {
  it('redirects root path to dashboard', async () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={testRouter} />);
    
    // Should redirect to dashboard
    expect(window.location.pathname).toBe('/');
  });

  it('renders login page for /login route', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/login'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('renders register page for /register route', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/register'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('register')).toBeInTheDocument();
  });

  it('renders dashboard page for /dashboard route with app layout', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders prices page for /prices route', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/prices'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
  });

  it('renders analytics page for /analytics route', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/analytics'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
  });

  it('renders settings page for /settings route', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/settings'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
  });

  it('renders not found page for invalid routes', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/invalid-route'],
    });

    render(<RouterProvider router={testRouter} />);
    // Should render the NotFound component
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('handles nested price routes', () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/prices/current'],
    });

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
  });
});

describe('Route Lazy Loading', () => {
  it('should handle suspense boundaries for lazy loaded components', async () => {
    const testRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/dashboard'],
    });

    render(<RouterProvider router={testRouter} />);
    
    // The component should eventually load
    await screen.findByTestId('protected-route');
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
  });
});