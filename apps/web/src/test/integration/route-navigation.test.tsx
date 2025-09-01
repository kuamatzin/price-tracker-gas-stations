import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';
import { createMemoryHistory, MemoryHistory } from 'history';
import App from '@/App';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

// Mock the stores
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockAuthStore = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
  updateUser: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  setLoading: vi.fn(),
  initializeAuth: vi.fn(),
};

const TestRouter = ({ 
  children, 
  history 
}: { 
  children: React.ReactNode; 
  history: MemoryHistory;
}) => (
  <Router location={history.location} navigator={history}>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </Router>
);

describe('Route Navigation Integration Tests', () => {
  let history: MemoryHistory;

  beforeEach(() => {
    history = createMemoryHistory();
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Routes', () => {
    it('should navigate to login page when not authenticated', () => {
      history.push('/login');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/login');
    });

    it('should navigate to register page', () => {
      history.push('/register');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/create account/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/register');
    });

    it('should redirect root to login when not authenticated', () => {
      history.push('/');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      waitFor(() => {
        expect(history.location.pathname).toBe('/login');
      });
    });

    it('should navigate between login and register pages', async () => {
      const user = userEvent.setup();
      history.push('/login');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      // Click on register link
      const registerLink = screen.getByText(/create account/i);
      await user.click(registerLink);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/register');
      });

      // Click on login link
      const loginLink = screen.getByText(/sign in/i);
      await user.click(loginLink);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/login');
      });
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
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
        },
        token: 'valid-token',
      });
    });

    it('should access dashboard when authenticated', () => {
      history.push('/dashboard');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/dashboard');
    });

    it('should access prices page when authenticated', () => {
      history.push('/prices');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/price management/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/prices');
    });

    it('should access analytics page when authenticated', () => {
      history.push('/analytics');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/analytics/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/analytics');
    });

    it('should access settings page when authenticated', () => {
      history.push('/settings');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/settings/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/settings');
    });

    it('should redirect root to dashboard when authenticated', () => {
      history.push('/');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      waitFor(() => {
        expect(history.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('Route Protection', () => {
    it('should redirect to login when accessing protected route without authentication', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
      });

      history.push('/dashboard');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      waitFor(() => {
        expect(history.location.pathname).toBe('/login');
      });
    });

    it('should show loading screen while authentication is loading', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
        isLoading: true,
      });

      history.push('/dashboard');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should redirect authenticated users away from auth pages', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
      });

      history.push('/login');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      waitFor(() => {
        expect(history.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('Navigation Menu', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
      });
    });

    it('should navigate using sidebar menu items', async () => {
      const user = userEvent.setup();
      history.push('/dashboard');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      // Click on prices menu item
      const pricesLink = screen.getByRole('link', { name: /prices/i });
      await user.click(pricesLink);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/prices');
      });

      // Click on analytics menu item
      const analyticsLink = screen.getByRole('link', { name: /analytics/i });
      await user.click(analyticsLink);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/analytics');
      });
    });

    it('should highlight active menu item', () => {
      history.push('/prices');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      const pricesLink = screen.getByRole('link', { name: /prices/i });
      expect(pricesLink).toHaveClass('active'); // or whatever class indicates active state
    });

    it('should navigate using mobile bottom navigation', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });
      
      const user = userEvent.setup();
      history.push('/dashboard');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      // Should show mobile navigation
      const mobileNav = screen.getByTestId('mobile-navigation');
      expect(mobileNav).toBeInTheDocument();

      // Navigate using mobile nav
      const mobilePricesButton = screen.getByTestId('mobile-prices-nav');
      await user.click(mobilePricesButton);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/prices');
      });
    });
  });

  describe('Breadcrumb Navigation', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
      });
    });

    it('should show breadcrumb navigation on nested routes', () => {
      history.push('/prices/current');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Prices')).toBeInTheDocument();
      expect(screen.getByText('Current Prices')).toBeInTheDocument();
    });

    it('should navigate using breadcrumb links', async () => {
      const user = userEvent.setup();
      history.push('/prices/history');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      // Click on Prices breadcrumb
      const pricesBreadcrumb = screen.getByRole('link', { name: 'Prices' });
      await user.click(pricesBreadcrumb);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/prices');
      });
    });
  });

  describe('404 Error Handling', () => {
    it('should show 404 page for invalid routes', () => {
      history.push('/invalid-route');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/page not found/i)).toBeInTheDocument();
      expect(screen.getByText(/404/)).toBeInTheDocument();
    });

    it('should provide navigation back to home from 404 page', async () => {
      const user = userEvent.setup();
      history.push('/invalid-route');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      const homeLink = screen.getByRole('link', { name: /go home/i });
      await user.click(homeLink);
      
      await waitFor(() => {
        expect(history.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('Deep Linking', () => {
    it('should handle direct navigation to protected routes', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
      });

      history.push('/analytics');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(screen.getByText(/analytics/i)).toBeInTheDocument();
      expect(history.location.pathname).toBe('/analytics');
    });

    it('should preserve intended route after login', async () => {
      const user = userEvent.setup();
      
      // Start unauthenticated
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
      });

      // Try to access protected route
      history.push('/analytics');
      
      const { rerender } = render(<App />, { 
        wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> 
      });
      
      // Should redirect to login
      await waitFor(() => {
        expect(history.location.pathname).toBe('/login');
      });

      // Simulate successful login
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
      });

      rerender(<App />);

      // Should redirect to originally intended route
      await waitFor(() => {
        expect(history.location.pathname).toBe('/analytics');
      });
    });
  });

  describe('Query Parameters and State', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
      });
    });

    it('should preserve query parameters during navigation', () => {
      history.push('/prices?tab=current&filter=premium');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      expect(history.location.search).toBe('?tab=current&filter=premium');
      expect(screen.getByText(/price management/i)).toBeInTheDocument();
    });

    it('should update URL when changing tabs or filters', async () => {
      const user = userEvent.setup();
      history.push('/prices');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      // Change tab
      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);
      
      await waitFor(() => {
        expect(history.location.search).toContain('tab=history');
      });
    });

    it('should maintain scroll position on navigation', async () => {
      const user = userEvent.setup();
      history.push('/analytics');
      
      render(<App />, { wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> });
      
      // Simulate scrolling
      window.scrollTo(0, 500);
      
      // Navigate to another page
      const settingsLink = screen.getByRole('link', { name: /settings/i });
      await user.click(settingsLink);
      
      // Navigate back
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);
      
      await waitFor(() => {
        expect(window.scrollY).toBe(500);
      });
    });
  });

  describe('Logout Navigation', () => {
    it('should redirect to login after logout', async () => {
      const user = userEvent.setup();
      
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          station: { id: 'station-1', name: 'Station', location: { lat: 0, lng: 0 } },
          preferences: { theme: 'light', notifications: true, autoRefresh: true, refreshInterval: 5 },
        },
        logout: vi.fn(),
      });

      history.push('/dashboard');
      
      const { rerender } = render(<App />, { 
        wrapper: ({ children }) => <TestRouter history={history}>{children}</TestRouter> 
      });
      
      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);
      
      // Simulate logout completion
      vi.mocked(useAuthStore).mockReturnValue({
        ...mockAuthStore,
        isAuthenticated: false,
        user: null,
      });

      rerender(<App />);

      await waitFor(() => {
        expect(history.location.pathname).toBe('/login');
      });
    });
  });
});