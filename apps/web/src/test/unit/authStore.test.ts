import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      expiresAt: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      rememberMe: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.rememberMe).toBe(false);
    });
  });

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: {
          numero: 'E12345',
          nombre: 'Test Station',
          municipio: 'Test City',
          entidad: 'Test State',
        },
        subscription_tier: 'premium',
      };

      const mockResponse = {
        user: mockUser,
        token: 'mock-token',
        expires_at: '2024-12-31T23:59:59Z',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { login } = useAuthStore.getState();
      await login('test@example.com', 'password', true);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('mock-token');
      expect(state.expiresAt).toBe('2024-12-31T23:59:59Z');
      expect(state.isAuthenticated).toBe(true);
      expect(state.rememberMe).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Check localStorage calls
      expect(localStorageMock.setItem).toHaveBeenCalledWith('fuelintel_token', 'mock-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('fuelintel_token_expiry', '2024-12-31T23:59:59Z');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('fuelintel_user', JSON.stringify(mockUser));
    });

    it('should handle login failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const { login } = useAuthStore.getState();
      
      await expect(login('test@example.com', 'wrong-password', false)).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('should set loading state during login', async () => {
      let resolvePromise: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      (fetch as any).mockReturnValueOnce(loginPromise);

      const { login } = useAuthStore.getState();
      const loginCall = login('test@example.com', 'password', false);

      // Check loading state
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ user: {}, token: 'token', expires_at: '2024-12-31T23:59:59Z' }),
      });

      await loginCall;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should clear user data on logout', async () => {
      // Mock fetch for logout API call
      (fetch as any).mockResolvedValueOnce({ ok: true });
      
      // Set some initial state
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', name: 'Test' } as any,
        token: 'token',
        expiresAt: '2024-12-31T23:59:59Z',
        isAuthenticated: true,
        rememberMe: true,
        error: 'some error',
      });

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.rememberMe).toBe(false);
      expect(state.error).toBeNull();
      
      // Check localStorage cleanup
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('fuelintel_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('fuelintel_token_expiry');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('fuelintel_user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth-storage');
    });
  });

  describe('Register', () => {
    it('should handle successful registration', async () => {
      const mockUser = {
        id: '1',
        email: 'new@example.com',
        name: 'New User',
        station: null,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoRefresh: true,
          refreshInterval: 5,
        },
      };

      const mockResponse = {
        user: mockUser,
        token: 'new-token',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { register } = useAuthStore.getState();
      const result = await register('new@example.com', 'password', 'password', 'New User');
      
      expect(result.success).toBe(true);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('new-token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle registration failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { detail: 'Registration failed' } }),
      });

      const { register } = useAuthStore.getState();
      const result = await register('invalid@example.com', 'password', 'password', 'User');

      expect(result.success).toBe(false);
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Registration failed');
    });
  });

  describe('Error Handling', () => {
    it('should set error message', () => {
      const { setError } = useAuthStore.getState();
      setError('Test error');

      expect(useAuthStore.getState().error).toBe('Test error');
    });

    it('should clear error message', () => {
      useAuthStore.setState({ error: 'Test error' });
      
      const { clearError } = useAuthStore.getState();
      clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('Loading State', () => {
    it('should set loading state', () => {
      const { setLoading } = useAuthStore.getState();
      setLoading(true);

      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('Update User', () => {
    it('should update user when user exists', () => {
      const initialUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        station: null,
        preferences: {
          theme: 'light' as const,
          notifications: true,
          autoRefresh: true,
          refreshInterval: 5,
        },
      };

      useAuthStore.setState({ user: initialUser });

      const { updateUser } = useAuthStore.getState();
      updateUser({ name: 'Updated User' });

      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Updated User');
      expect(state.user?.email).toBe('test@example.com'); // Should preserve other fields
    });

    it('should not update when user is null', () => {
      const { updateUser } = useAuthStore.getState();
      updateUser({ name: 'Updated User' });

      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});