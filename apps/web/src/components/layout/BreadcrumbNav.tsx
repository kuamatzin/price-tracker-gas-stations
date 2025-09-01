import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

interface BreadcrumbItem {
  name: string;
  href: string;
  current: boolean;
}

const getBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Dashboard as home
  breadcrumbs.push({
    name: 'Home',
    href: '/dashboard',
    current: pathname === '/dashboard',
  });

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return breadcrumbs;
  }

  // Build breadcrumbs from path segments
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    let name = segment.charAt(0).toUpperCase() + segment.slice(1);
    
    // Custom naming for specific routes
    switch (segment) {
      case 'prices':
        name = 'Prices';
        break;
      case 'current':
        name = 'Current Prices';
        break;
      case 'history':
        name = 'Price History';
        break;
      case 'compare':
        name = 'Comparison';
        break;
      case 'analytics':
        name = 'Analytics';
        break;
      case 'settings':
        name = 'Settings';
        break;
      default:
        // If it's a UUID or ID, show it as is
        if (/^[a-f0-9-]{36}$/.test(segment) || /^\d+$/.test(segment)) {
          name = `#${segment.substring(0, 8)}...`;
        }
    }

    breadcrumbs.push({
      name,
      href: currentPath,
      current: isLast,
    });
  });

  return breadcrumbs;
};

export const BreadcrumbNav = () => {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="hidden sm:flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((item, index) => (
          <li key={item.href}>
            <div className="flex items-center">
              {index > 0 && (
                <ChevronRightIcon className="h-3 w-3 text-gray-400 dark:text-gray-500 mx-2" />
              )}
              {item.current ? (
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className={cn(
                    'text-xs font-medium transition-colors',
                    index === 0
                      ? 'text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {item.name}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};