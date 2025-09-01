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
      isAuthenticated: false,
      isLoading: false,
      error: null,
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
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockUser = {
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

      const mockResponse = {
        user: mockUser,
        token: 'mock-token',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { login } = useAuthStore.getState();
      await login('test@example.com', 'password');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('mock-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle login failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { login } = useAuthStore.getState();
      await login('test@example.com', 'wrong-password');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Login failed');
    });

    it('should set loading state during login', async () => {
      let resolvePromise: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      (fetch as any).mockReturnValueOnce(loginPromise);

      const { login } = useAuthStore.getState();
      const loginCall = login('test@example.com', 'password');

      // Check loading state
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ user: {}, token: 'token' }),
      });

      await loginCall;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should clear user data on logout', () => {
      // Set some initial state
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', name: 'Test' } as any,
        token: 'token',
        isAuthenticated: true,
        error: 'some error',
      });

      const { logout } = useAuthStore.getState();
      logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
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
      await register('new@example.com', 'password', 'New User');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('new-token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle registration failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const { register } = useAuthStore.getState();
      await register('invalid@example.com', 'password', 'User');

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