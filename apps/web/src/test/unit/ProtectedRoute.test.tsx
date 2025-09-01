import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
const mockUseAuthStore = vi.fn();
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

// Mock LoadingScreen and Navigate
vi.mock('@/components/common/LoadingScreen', () => ({
  default: () => <div data-testid="loading-screen">Loading...</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to}>
        Redirecting to {to}
      </div>
    ),
    Outlet: () => <div data-testid="outlet">Protected Content</div>,
  };
});

const renderProtectedRoute = (children?: React.ReactNode) => {
  return render(
    <BrowserRouter>
      <ProtectedRoute>{children}</ProtectedRoute>
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading screen when authentication is loading', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    renderProtectedRoute();
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    renderProtectedRoute();
    
    const navigateElement = screen.getByTestId('navigate');
    expect(navigateElement).toBeInTheDocument();
    expect(navigateElement).toHaveAttribute('data-to', '/login');
  });

  it('renders children when user is authenticated and children provided', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    renderProtectedRoute(
      <div data-testid="protected-content">Protected Content</div>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('renders Outlet when user is authenticated and no children provided', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    renderProtectedRoute();

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('prioritizes authentication check over loading state', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: true, // Still loading but authenticated
    });

    renderProtectedRoute();

    // Should render content despite loading state if authenticated
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
  });

  it('handles edge case when both loading and not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    renderProtectedRoute();

    // Should prioritize showing loading screen
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });
});