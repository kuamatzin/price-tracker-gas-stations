import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { BreadcrumbNav } from './BreadcrumbNav';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';

// Simple icons
const MenuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const SunIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);

const getPageTitle = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean);
  
  switch (segments[0]) {
    case 'dashboard':
      return 'Dashboard';
    case 'prices':
      if (segments[1] === 'current') return 'Current Prices';
      if (segments[1] === 'history') return 'Price History';
      if (segments[1] === 'compare') return 'Price Comparison';
      return 'Prices';
    case 'analytics':
      return 'Analytics';
    case 'settings':
      return 'Settings';
    default:
      return 'Dashboard';
  }
};

export const Header = () => {
  const location = useLocation();
  const { toggleSidebar, theme, setTheme } = useUIStore();
  const { user } = useAuthStore();
  const { unreadCount } = useAlertStore();

  const pageTitle = getPageTitle(location.pathname);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>

            {/* Page title and breadcrumbs */}
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {pageTitle}
              </h1>
              <BreadcrumbNav />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {/* Station info (if available) */}
            {user?.station && (
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.station.nombre}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.station.municipio}, {user.station.entidad}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {user.station.numero}
                </p>
              </div>
            )}

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="relative"
            >
              {theme === 'dark' ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </Button>

            {/* Notifications */}
            <NotificationBell count={unreadCount} />

            {/* User menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
};