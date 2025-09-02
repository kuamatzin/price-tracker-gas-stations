import { useAuthStore } from '@/stores/authStore';

class TokenManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 1000; // Check every minute
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh if less than 5 minutes remaining

  public startTokenManagement(): void {
    // Clear any existing intervals
    this.stopTokenManagement();

    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.checkTokenExpiration();
    }, this.CHECK_INTERVAL);

    // Initial check
    this.checkTokenExpiration();
  }

  public stopTokenManagement(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private checkTokenExpiration(): void {
    const authStore = useAuthStore.getState();
    const { token, expiresAt, isAuthenticated } = authStore;

    // Skip if not authenticated or no token
    if (!isAuthenticated || !token || !expiresAt) {
      return;
    }

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;

    if (timeUntilExpiry <= 0) {
      // Token has expired, logout
      console.warn('Token has expired, logging out...');
      authStore.logout();
      return;
    }

    if (timeUntilExpiry <= this.REFRESH_THRESHOLD) {
      // Token is about to expire, refresh it
      console.log('Token expiring soon, refreshing...');
      this.scheduleRefresh();
    }
  }

  private scheduleRefresh(): void {
    // Prevent multiple refresh attempts
    if (this.refreshTimer) {
      return;
    }

    const authStore = useAuthStore.getState();
    const { expiresAt } = authStore;

    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;

    // Schedule refresh for when there's 2 minutes left (or immediately if less than 2 minutes)
    const refreshIn = Math.max(0, timeUntilExpiry - (2 * 60 * 1000));

    this.refreshTimer = setTimeout(async () => {
      try {
        await authStore.refresh();
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Token refresh failed:', error);
        // The auth store's refresh method will handle logout on failure
      } finally {
        this.refreshTimer = null;
      }
    }, refreshIn);
  }

  public forceRefresh(): Promise<void> {
    const authStore = useAuthStore.getState();
    return authStore.refresh();
  }

  public isTokenExpired(): boolean {
    const authStore = useAuthStore.getState();
    const { expiresAt } = authStore;

    if (!expiresAt) return true;

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();

    return currentTime >= expiryTime;
  }

  public getTimeUntilExpiry(): number | null {
    const authStore = useAuthStore.getState();
    const { expiresAt } = authStore;

    if (!expiresAt) return null;

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();

    return Math.max(0, expiryTime - currentTime);
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Export class for testing
export { TokenManager };

// Default export
export default tokenManager;