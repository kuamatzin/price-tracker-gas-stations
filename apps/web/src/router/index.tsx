import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { RoleBasedRoute } from '@/components/auth/RoleBasedRoute';
import { RouteTransition } from '@/components/auth/RouteTransition';
import LoadingScreen from '@/components/common/LoadingScreen';
import NotFound from '@/components/common/NotFound';

// Lazy load components for better performance
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Prices = lazy(() => import('@/pages/Prices'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const HistoricalTrends = lazy(() => import('@/pages/analytics/HistoricalTrends'));
const Settings = lazy(() => import('@/pages/Settings'));

// Wrapper for lazy loaded components with loading state and transitions
const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingScreen />}>
    <RouteTransition>
      {children}
    </RouteTransition>
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LazyWrapper>
          <Login />
        </LazyWrapper>
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <LazyWrapper>
          <Register />
        </LazyWrapper>
      </PublicRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <LazyWrapper>
            <Dashboard />
          </LazyWrapper>
        ),
      },
      {
        path: 'prices',
        children: [
          {
            index: true,
            element: (
              <ProtectedRoute requiresStation={true}>
                <LazyWrapper>
                  <Prices />
                </LazyWrapper>
              </ProtectedRoute>
            ),
          },
          {
            path: 'current',
            element: (
              <ProtectedRoute requiresStation={true}>
                <LazyWrapper>
                  <Prices />
                </LazyWrapper>
              </ProtectedRoute>
            ),
          },
          {
            path: 'history',
            element: (
              <ProtectedRoute requiresStation={true}>
                <LazyWrapper>
                  <Prices />
                </LazyWrapper>
              </ProtectedRoute>
            ),
          },
          {
            path: 'compare',
            element: (
              <ProtectedRoute requiresStation={true}>
                <LazyWrapper>
                  <Prices />
                </LazyWrapper>
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: 'analytics',
        children: [
          {
            index: true,
            element: (
              <RoleBasedRoute allowedRoles={['premium', 'enterprise']}>
                <LazyWrapper>
                  <Analytics />
                </LazyWrapper>
              </RoleBasedRoute>
            ),
          },
          {
            path: 'trends',
            element: (
              <RoleBasedRoute allowedRoles={['premium', 'enterprise']}>
                <LazyWrapper>
                  <HistoricalTrends />
                </LazyWrapper>
              </RoleBasedRoute>
            ),
          },
        ],
      },
      {
        path: 'settings',
        element: (
          <LazyWrapper>
            <Settings />
          </LazyWrapper>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);