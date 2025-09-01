import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { BreadcrumbNav } from './BreadcrumbNav';
import { Toaster } from '@/components/ui/toaster';
import { useUIStore } from '@/stores/uiStore';

export const DashboardLayout = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      if (mobile) {
        setSidebarOpen(false); // Close sidebar on mobile
      } else {
        setSidebarOpen(true); // Open sidebar on desktop by default
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar - Persistent */}
      <div className="hidden lg:block">
        <div className={`
          fixed inset-y-0 left-0 z-30 w-64 
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-64'}
        `}>
          <Sidebar />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 
        transform transition-transform duration-300 ease-in-out lg:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className={`
        min-h-screen transition-all duration-300 ease-in-out
        ${sidebarOpen && !isMobile ? 'lg:pl-64' : 'lg:pl-0'}
        pb-16 lg:pb-0
      `}>
        {/* Header */}
        <Header />

        {/* Breadcrumb Navigation */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 lg:px-8">
            <BreadcrumbNav />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          {/* Content area with proper spacing */}
          <div className="px-4 py-6 lg:px-8">
            <div className="mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
};

export default DashboardLayout;