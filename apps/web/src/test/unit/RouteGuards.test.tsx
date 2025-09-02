import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { RoleBasedRoute } from '@/components/auth/RoleBasedRoute';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockAuthStore = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  checkAuth: vi.fn(),
};

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

describe('Route Guards', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore);
    vi.clearAllMocks();
  });

  describe('ProtectedRoute', () => {
    const TestComponent = () => <div>Protected Content</div>;

    it('shows loading screen when auth is loading', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isLoading: true,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Verificando autenticación...')).toBeInTheDocument();
    });

    it('redirects to login when not authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
        isLoading: false,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      });
    });

    it('renders children when authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: mockUser,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('shows subscription required message for insufficient tier', async () => {
      const basicUser = { ...mockUser, subscription_tier: 'basic' };
      
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: basicUser,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requiredTier="premium">
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Suscripción Requerida')).toBeInTheDocument();
      });
    });

    it('shows station required message when station is needed but not assigned', async () => {
      const userWithoutStation = { ...mockUser, station: null };
      
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: userWithoutStation,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requiresStation={true}>
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Estación Requerida')).toBeInTheDocument();
      });
    });

    it('allows access with sufficient subscription tier', async () => {
      const enterpriseUser = { ...mockUser, subscription_tier: 'enterprise' };
      
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: enterpriseUser,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requiredTier="premium">
            <TestComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });

  describe('PublicRoute', () => {
    const TestComponent = () => <div>Public Content</div>;

    it('shows loading screen when auth is loading', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isLoading: true,
      });

      render(
        <MemoryRouter>
          <PublicRoute>
            <TestComponent />
          </PublicRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Verificando autenticación...')).toBeInTheDocument();
    });

    it('renders children when not authenticated', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
      });

      render(
        <MemoryRouter>
          <PublicRoute>
            <TestComponent />
          </PublicRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Public Content')).toBeInTheDocument();
    });

    it('redirects to dashboard when authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: mockUser,
      });

      render(
        <MemoryRouter>
          <PublicRoute>
            <TestComponent />
          </PublicRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
      });
    });

    it('redirects to custom path when provided', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: mockUser,
      });

      render(
        <MemoryRouter>
          <PublicRoute redirectTo="/custom">
            <TestComponent />
          </PublicRoute>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
      });
    });
  });

  describe('RoleBasedRoute', () => {
    const TestComponent = () => <div>Role-based Content</div>;

    it('renders children when user has allowed role', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: mockUser, // premium tier
      });

      render(
        <RoleBasedRoute allowedRoles={['premium', 'enterprise']}>
          <TestComponent />
        </RoleBasedRoute>
      );

      expect(screen.getByText('Role-based Content')).toBeInTheDocument();
    });

    it('shows not authorized when user lacks required role', () => {
      const basicUser = { ...mockUser, subscription_tier: 'basic' };
      
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: basicUser,
      });

      render(
        <RoleBasedRoute allowedRoles={['premium', 'enterprise']}>
          <TestComponent />
        </RoleBasedRoute>
      );

      expect(screen.getByText('Acceso Denegado')).toBeInTheDocument();
      expect(screen.queryByText('Role-based Content')).not.toBeInTheDocument();
    });

    it('renders children when no roles specified', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: mockUser,
      });

      render(
        <RoleBasedRoute>
          <TestComponent />
        </RoleBasedRoute>
      );

      expect(screen.getByText('Role-based Content')).toBeInTheDocument();
    });

    it('uses custom fallback component', () => {
      const basicUser = { ...mockUser, subscription_tier: 'basic' };
      const CustomFallback = () => <div>Custom Unauthorized</div>;
      
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: basicUser,
      });

      render(
        <RoleBasedRoute 
          allowedRoles={['premium']}
          fallback={<CustomFallback />}
        >
          <TestComponent />
        </RoleBasedRoute>
      );

      expect(screen.getByText('Custom Unauthorized')).toBeInTheDocument();
      expect(screen.queryByText('Acceso Denegado')).not.toBeInTheDocument();
    });
  });
});