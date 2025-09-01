import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import LoadingScreen from '@/components/common/LoadingScreen';
import NotFound from '@/components/common/NotFound';

// Lazy load components for better performance
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Prices = lazy(() => import('@/pages/Prices'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Settings = lazy(() => import('@/pages/Settings'));

// Wrapper for lazy loaded components with loading state
const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingScreen />}>
    {children}
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
      <LazyWrapper>
        <Login />
      </LazyWrapper>
    ),
  },
  {
    path: '/register',
    element: (
      <LazyWrapper>
        <Register />
      </LazyWrapper>
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
              <LazyWrapper>
                <Prices />
              </LazyWrapper>
            ),
          },
          {
            path: 'current',
            element: (
              <LazyWrapper>
                <Prices />
              </LazyWrapper>
            ),
          },
          {
            path: 'history',
            element: (
              <LazyWrapper>
                <Prices />
              </LazyWrapper>
            ),
          },
          {
            path: 'compare',
            element: (
              <LazyWrapper>
                <Prices />
              </LazyWrapper>
            ),
          },
        ],
      },
      {
        path: 'analytics',
        element: (
          <LazyWrapper>
            <Analytics />
          </LazyWrapper>
        ),
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