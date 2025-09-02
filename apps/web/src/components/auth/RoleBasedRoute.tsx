import { useAuthStore } from '@/stores/authStore';
import { NotAuthorizedError } from '@/components/common/ErrorMessages';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
}

export const RoleBasedRoute = ({
  children,
  allowedRoles = [],
  requiredPermissions = [],
  fallback
}: RoleBasedRouteProps) => {
  const { user } = useAuthStore();

  // For now, we'll use subscription tier as role
  const userRole = user?.subscription_tier || 'basic';

  // Check if user has required role
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return fallback || <NotAuthorizedError />;
  }

  // Check if user has required permissions (placeholder for future implementation)
  if (requiredPermissions.length > 0) {
    // This would check against user permissions in a real implementation
    // For now, we'll allow all authenticated users
    console.warn('Permission-based routing not yet implemented');
  }

  return <>{children}</>;
};