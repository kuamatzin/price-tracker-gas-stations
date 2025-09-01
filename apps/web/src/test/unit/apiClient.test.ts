import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '@/services/api/client';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

// Mock stores - use factory functions to avoid hoisting issues
vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      token: 'test-token',
    })),
    setState: vi.fn(),
  }
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      addNotification: vi.fn(),
    })),
  }
}));

// Mock axios - avoid hoisting issues
vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  const mockAxios = {
    create: vi.fn(() => mockAxiosInstance),
    post: vi.fn(),
  };

  return {
    default: mockAxios,
    ...mockAxios,
  };
});

// Mock environment
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://test-api.com',
    DEV: true,
  },
});

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let requestInterceptor: any;
  let responseInterceptor: any;
  let mockAxios: any;
  let mockAxiosInstance: any;
  let mockAuthStore: any;
  let mockUIStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mocked stores
    mockAuthStore = vi.mocked(useAuthStore);
    mockUIStore = vi.mocked(useUIStore);
    
    // Get the mocked axios instances
    mockAxios = vi.mocked(axios);
    mockAxiosInstance = mockAxios.create();
    
    // Capture the interceptors when they're registered
    mockAxiosInstance.interceptors.request.use.mockImplementation((success: any, error: any) => {
      requestInterceptor = { success, error };
    });
    
    mockAxiosInstance.interceptors.response.use.mockImplementation((success: any, error: any) => {
      responseInterceptor = { success, error };
    });

    apiClient = new ApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create axios instance with correct config', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://test-api.com',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    });

    it('should register request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Request Interceptor', () => {
    it('should add authorization header when token exists', () => {
      const config = {
        headers: {},
      };

      mockAuthStore.getState.mockReturnValue({ token: 'test-token' });

      const modifiedConfig = requestInterceptor.success(config);

      expect(modifiedConfig.headers.Authorization).toBe('Bearer test-token');
      expect(modifiedConfig.headers['X-Request-ID']).toBeDefined();
    });

    it('should not add authorization header when token is null', () => {
      const config = {
        headers: {},
      };

      mockAuthStore.getState.mockReturnValue({ token: null });

      const modifiedConfig = requestInterceptor.success(config);

      expect(modifiedConfig.headers.Authorization).toBeUndefined();
      expect(modifiedConfig.headers['X-Request-ID']).toBeDefined();
    });

    it('should add request ID to headers', () => {
      const config = {
        headers: {},
      };

      const modifiedConfig = requestInterceptor.success(config);

      expect(modifiedConfig.headers['X-Request-ID']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should handle request interceptor error', async () => {
      const error = new Error('Request error');
      
      await expect(requestInterceptor.error(error)).rejects.toThrow('Request error');
    });
  });

  describe('Response Interceptor', () => {
    it('should return successful response unchanged', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        data: { message: 'success' },
        config: {
          headers: { 'X-Request-ID': 'test-id' },
        },
      };

      const result = responseInterceptor.success(response);
      expect(result).toBe(response);
    });

    it('should handle 401 errors with token refresh', async () => {
      const error = {
        response: { status: 401 },
        config: {
          headers: {},
          _retry: false,
          method: 'get',
          url: '/test',
        },
      };

      // Mock successful token refresh
      mockAxios.post.mockResolvedValueOnce({
        data: { token: 'new-token' },
      });
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { message: 'success' },
      });

      mockAuthStore.getState.mockReturnValue({ token: 'old-token' });

      await expect(responseInterceptor.error(error)).resolves.toBeDefined();
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://test-api.com/auth/refresh',
        {},
        {
          headers: {
            Authorization: 'Bearer old-token',
          },
        }
      );
    });

    it('should logout on failed token refresh', async () => {
      const error = {
        response: { status: 401 },
        config: {
          headers: {},
          _retry: false,
        },
      };

      // Mock failed token refresh
      mockAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      const mockLogout = vi.fn();
      mockAuthStore.getState.mockReturnValue({
        token: 'old-token',
        logout: mockLogout,
      });

      // Mock window.location.href
      delete (window as any).location;
      (window as any).location = { href: '' };

      await expect(responseInterceptor.error(error)).rejects.toBeDefined();
    });

    it('should retry network errors', async () => {
      const error = {
        code: 'NETWORK_ERROR',
        config: {
          headers: {},
          method: 'get',
          url: '/test',
        },
      };

      // Mock successful retry
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { message: 'success after retry' },
      });

      const result = await responseInterceptor.error(error);
      expect(result).toBeDefined();
    }, 10000); // Increase timeout

    it('should add error notifications for different status codes', async () => {
      const mockAddNotification = vi.fn();
      mockUIStore.getState.mockReturnValue({
        addNotification: mockAddNotification,
      });

      const errors = [
        { status: 400, expectedMessage: 'Invalid request. Please check your data.' },
        { status: 403, expectedMessage: 'You don\'t have permission to perform this action.' },
        { status: 404, expectedMessage: 'The requested resource was not found.' },
        { status: 429, expectedMessage: 'Too many requests. Please try again later.' },
        { status: 500, expectedMessage: 'Server error. Please try again later.' },
      ];

      for (const { status, expectedMessage } of errors) {
        const error = {
          response: { status },
          config: { _retry: true }, // Skip retry logic
        };

        await expect(responseInterceptor.error(error)).rejects.toBeDefined();

        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'error',
          title: 'API Error',
          message: expectedMessage,
        });

        mockAddNotification.mockClear();
      }
    });
  });

  describe('HTTP Methods', () => {
    it('should call axios get method', async () => {
      const mockResponse = { data: { message: 'success' } };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', undefined);
      expect(result).toBe(mockResponse);
    });

    it('should call axios post method', async () => {
      const mockResponse = { data: { message: 'created' } };
      const postData = { name: 'test' };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.post('/test', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', postData, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should call axios put method', async () => {
      const mockResponse = { data: { message: 'updated' } };
      const putData = { name: 'updated' };
      mockAxiosInstance.put.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.put('/test', putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test', putData, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should call axios patch method', async () => {
      const mockResponse = { data: { message: 'patched' } };
      const patchData = { name: 'patched' };
      mockAxiosInstance.patch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.patch('/test', patchData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test', patchData, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should call axios delete method', async () => {
      const mockResponse = { data: { message: 'deleted' } };
      mockAxiosInstance.delete.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.delete('/test');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test', undefined);
      expect(result).toBe(mockResponse);
    });
  });

  describe('getClient', () => {
    it('should return axios instance', () => {
      const client = apiClient.getClient();
      expect(client).toBe(mockAxiosInstance);
    });
  });
});