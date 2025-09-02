import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import ErrorBoundary from "./components/ErrorBoundary";
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { tokenManager } from '@/services/tokenManager';

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize authentication on app start
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Start token management when authenticated
    if (isAuthenticated) {
      tokenManager.startTokenManagement();
    } else {
      tokenManager.stopTokenManagement();
    }

    // Cleanup on unmount
    return () => {
      tokenManager.stopTokenManagement();
    };
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
