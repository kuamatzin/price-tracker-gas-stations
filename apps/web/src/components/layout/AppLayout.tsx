import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Toaster } from '@/components/ui/toaster';
import { useUIStore } from '@/stores/uiStore';
import { useEffect } from 'react';

export const AppLayout = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  // Close sidebar on mobile when route changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar for desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-gray-900/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className={`
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}
        pb-16 lg:pb-0
      `}>
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="px-4 py-6 lg:px-8">
          <Outlet />
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