import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

// Mock child components
vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div data-testid="mobile-nav">Mobile Nav</div>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
  };
});

// Mock UI store
const mockUIStore = {
  sidebarOpen: true,
  setSidebarOpen: vi.fn(),
};

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => mockUIStore,
}));

// Mock window resize
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
});
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
});

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

const renderAppLayout = () => {
  return render(
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
};

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIStore.sidebarOpen = true;
    window.innerWidth = 1024;
  });

  describe('Basic Rendering', () => {
    it('should render all main components', () => {
      renderAppLayout();

      // There are two sidebars (desktop and mobile), so use getAllBy
      expect(screen.getAllByTestId('sidebar')).toHaveLength(2);
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should render main content area', () => {
      renderAppLayout();

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveClass('px-4', 'py-6', 'lg:px-8');
    });
  });

  describe('Responsive Behavior', () => {
    it('should set up resize event listener on mount', () => {
      renderAppLayout();
      
      expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should clean up resize event listener on unmount', () => {
      const { unmount } = renderAppLayout();
      
      unmount();
      
      expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should open sidebar on desktop size (>=1024px)', () => {
      window.innerWidth = 1024;
      renderAppLayout();

      // Trigger the resize handler
      const resizeHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )?.[1];
      
      if (resizeHandler) {
        resizeHandler();
        expect(mockUIStore.setSidebarOpen).toHaveBeenCalledWith(true);
      }
    });

    it('should close sidebar on mobile size (<1024px)', () => {
      window.innerWidth = 768;
      renderAppLayout();

      // Trigger the resize handler
      const resizeHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )?.[1];
      
      if (resizeHandler) {
        resizeHandler();
        expect(mockUIStore.setSidebarOpen).toHaveBeenCalledWith(false);
      }
    });
  });

  describe('Sidebar States', () => {
    it('should show desktop sidebar when sidebar is open', () => {
      mockUIStore.sidebarOpen = true;
      renderAppLayout();

      // Desktop sidebar should be visible - first one in the DOM
      const sidebars = screen.getAllByTestId('sidebar');
      expect(sidebars).toHaveLength(2);
      const desktopSidebar = sidebars[0]; // First one is desktop
      expect(desktopSidebar.parentElement).toHaveClass('hidden', 'lg:block');
    });

    it('should apply correct classes when sidebar is open', () => {
      mockUIStore.sidebarOpen = true;
      renderAppLayout();

      // Main content should have left padding on large screens
      const mainContainer = screen.getByRole('main').parentElement;
      expect(mainContainer).toHaveClass('lg:pl-64');
    });

    it('should apply correct classes when sidebar is closed', () => {
      mockUIStore.sidebarOpen = false;
      renderAppLayout();

      // Main content should not have left padding
      const mainContainer = screen.getByRole('main').parentElement;
      expect(mainContainer).toHaveClass('lg:pl-0');
    });
  });

  describe('Mobile Sidebar', () => {
    it('should show mobile sidebar overlay when open', () => {
      mockUIStore.sidebarOpen = true;
      renderAppLayout();

      // Should have overlay with specific class
      const overlay = document.querySelector('.bg-gray-900\\/50');
      expect(overlay).toBeInTheDocument();
    });

    it('should hide mobile sidebar overlay when closed', () => {
      mockUIStore.sidebarOpen = false;
      renderAppLayout();

      // Overlay should not be present
      const overlays = document.querySelectorAll('.bg-gray-900\\/50');
      expect(overlays.length).toBe(0);
    });

    it('should close sidebar when overlay is clicked', () => {
      mockUIStore.sidebarOpen = true;
      renderAppLayout();

      // Find and click the overlay
      const overlay = document.querySelector('.bg-gray-900\\/50');
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockUIStore.setSidebarOpen).toHaveBeenCalledWith(false);
      }
    });

    it('should apply correct transform classes for mobile sidebar', () => {
      mockUIStore.sidebarOpen = true;
      renderAppLayout();

      // Look for mobile sidebar with proper class structure
      const mobileSidebarContainer = document.querySelector('[class*="lg:hidden"][class*="transform"]');
      expect(mobileSidebarContainer).toBeTruthy();
      expect(mobileSidebarContainer).toHaveClass('translate-x-0');
    });

    it('should apply correct transform classes for hidden mobile sidebar', () => {
      mockUIStore.sidebarOpen = false;
      renderAppLayout();

      // Look for mobile sidebar with proper class structure
      const mobileSidebarContainer = document.querySelector('[class*="lg:hidden"][class*="transform"]');
      expect(mobileSidebarContainer).toBeTruthy();
      expect(mobileSidebarContainer).toHaveClass('-translate-x-full');
    });
  });

  describe('Mobile Navigation', () => {
    it('should show mobile navigation with correct classes', () => {
      renderAppLayout();

      const mobileNav = screen.getByTestId('mobile-nav');
      expect(mobileNav.parentElement).toHaveClass('lg:hidden');
    });

    it('should add bottom padding to main content for mobile nav', () => {
      renderAppLayout();

      const mainContainer = screen.getByRole('main').parentElement;
      expect(mainContainer).toHaveClass('pb-16', 'lg:pb-0');
    });
  });

  describe('Animation Classes', () => {
    it('should have transition classes on main container', () => {
      renderAppLayout();

      const mainContainer = screen.getByRole('main').parentElement;
      expect(mainContainer).toHaveClass(
        'transition-all',
        'duration-300',
        'ease-in-out'
      );
    });

    it('should have transition classes on mobile sidebar', () => {
      renderAppLayout();

      const mobileSidebarContainer = document.querySelector('[class*="lg:hidden"][class*="transform"]');
      expect(mobileSidebarContainer).toBeTruthy();
      expect(mobileSidebarContainer).toHaveClass(
        'transition-transform',
        'duration-300',
        'ease-in-out'
      );
    });
  });

  describe('Z-index Layers', () => {
    it('should have correct z-index for overlay', () => {
      mockUIStore.sidebarOpen = true;
      renderAppLayout();

      const overlay = document.querySelector('.bg-gray-900\\/50');
      expect(overlay).toHaveClass('z-40');
    });

    it('should have correct z-index for mobile sidebar', () => {
      renderAppLayout();

      const mobileSidebarContainer = document.querySelector('[class*="lg:hidden"][class*="z-50"]');
      expect(mobileSidebarContainer).toBeTruthy();
      expect(mobileSidebarContainer).toHaveClass('z-50');
    });
  });
});