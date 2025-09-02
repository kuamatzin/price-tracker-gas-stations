import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import LoadingScreen from '@/components/common/LoadingScreen';
import { ErrorFallback } from '@/components/common/ErrorFallback';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredTier?: 'basic' | 'premium' | 'enterprise';
  fallbackPath?: string;
  requiresStation?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requiredTier,
  fallbackPath = '/login',
  requiresStation = false
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        if (!isAuthenticated && !isLoading) {
          await checkAuth();
        }
        setAuthChecked(true);
      } catch (error) {
        console.error('Auth verification failed:', error);
        setAuthError('Error verificando autenticación');
        setAuthChecked(true);
      }
    };

    verifyAuth();
  }, [isAuthenticated, isLoading, checkAuth]);

  // Show loading while verifying authentication
  if (isLoading || !authChecked) {
    return <LoadingScreen message="Verificando autenticación..." />;
  }

  // Handle auth errors
  if (authError) {
    return (
      <ErrorFallback 
        error={new Error(authError)}
        type="page"
        resetError={() => {
          setAuthError(null);
          setAuthChecked(false);
        }}
      />
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    const redirectTo = `${fallbackPath}?redirect=${encodeURIComponent(
      location.pathname + location.search
    )}`;
    return <Navigate to={redirectTo} replace />;
  }

  // Check if user has required subscription tier
  if (requiredTier && user?.subscription_tier) {
    const tierHierarchy = { basic: 1, premium: 2, enterprise: 3 };
    const userTierLevel = tierHierarchy[user.subscription_tier as keyof typeof tierHierarchy] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier];

    if (userTierLevel < requiredTierLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Suscripción Requerida
            </h2>
            <p className="text-gray-600 mb-6">
              Esta funcionalidad requiere una suscripción {requiredTier}. 
              Tu plan actual es {user.subscription_tier}.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.href = '/settings/billing'}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Actualizar Plan
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Check if station is required but not assigned
  if (requiresStation && !user?.station) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Estación Requerida
          </h2>
          <p className="text-gray-600 mb-6">
            Para acceder a esta funcionalidad necesitas tener una estación asignada.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.href = '/settings/station'}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Configurar Estación
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};