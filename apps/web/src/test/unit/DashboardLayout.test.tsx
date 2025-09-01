import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// Mock the stores
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: null,
  }),
}));

vi.mock('@/stores/alertStore', () => ({
  useAlertStore: () => ({
    unreadCount: 0,
  }),
}));

// Mock child components
vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div data-testid="mobile-nav">MobileNav</div>,
}));

vi.mock('@/components/layout/BreadcrumbNav', () => ({
  BreadcrumbNav: () => <div data-testid="breadcrumb">Breadcrumbs</div>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

const renderDashboardLayout = () => {
  return render(
    <BrowserRouter>
      <DashboardLayout />
    </BrowserRouter>
  );
};

describe('DashboardLayout', () => {
  beforeEach(() => {
    // Mock window.innerWidth for responsive behavior
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders all layout components', () => {
    renderDashboardLayout();
    
    // Should have both desktop and mobile sidebars
    expect(screen.getAllByTestId('sidebar')).toHaveLength(2);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  test('has proper layout structure', () => {
    renderDashboardLayout();
    
    // Check for main content area
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass('flex-1');
  });

  test('includes outlet for child routes', () => {
    renderDashboardLayout();
    
    // The Outlet component doesn't render anything testable by itself,
    // but we can check that the main content area exists
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });

  test('applies responsive classes correctly', () => {
    renderDashboardLayout();
    
    // Check for responsive layout classes on the root container
    const layoutContainer = document.querySelector('.min-h-screen');
    expect(layoutContainer).toHaveClass('min-h-screen', 'bg-gray-50', 'dark:bg-gray-900');
  });

  test('has proper z-index hierarchy', () => {
    renderDashboardLayout();
    
    // Desktop sidebar should have z-30
    const desktopSidebar = document.querySelector('.hidden.lg\\:block');
    expect(desktopSidebar?.firstElementChild).toHaveClass('z-30');
  });
});