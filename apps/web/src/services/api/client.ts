import axios, { 
  type AxiosInstance, 
  type AxiosRequestConfig, 
  type AxiosResponse, 
  AxiosError,
  type InternalAxiosRequestConfig
} from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: (error: AxiosError) => boolean;
}

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add authentication token
        const authStore = useAuthStore.getState();
        const token = authStore.token;
        
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        config.headers!['X-Request-ID'] = requestId;

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`🚀 API Request [${requestId}]:`, {
            method: config.method?.toUpperCase(),
            url: config.url,
            data: config.data,
          });
        }

        return config;
      },
      (error: AxiosError) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response in development
        if (import.meta.env.DEV) {
          const requestId = response.config.headers?.['X-Request-ID'];
          console.log(`✅ API Response [${requestId}]:`, {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
          });
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Log error in development
        if (import.meta.env.DEV) {
          const requestId = originalRequest?.headers?.['X-Request-ID'];
          console.error(`❌ API Error [${requestId}]:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message,
            data: error.response?.data,
          });
        }

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Handle retry logic for network errors
        if (this.shouldRetry(error) && !originalRequest._retry) {
          return this.retryRequest(originalRequest);
        }

        // Add user-friendly error notifications
        this.handleErrorNotification(error);

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const token = await this.refreshPromise;
      this.refreshPromise = null;
      return token;
    } catch (error) {
      this.refreshPromise = null;
      throw error;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const authStore = useAuthStore.getState();
    const currentToken = authStore.token;

    if (!currentToken) {
      throw new Error('No token available for refresh');
    }

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      const { token } = response.data;
      
      // Update the token in the auth store
      useAuthStore.setState({ token });
      
      return token;
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  }

  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors or 5xx server errors
    return (
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600) ||
      error.code === 'ECONNABORTED' ||
      error.code === 'NETWORK_ERROR'
    );
  }

  private async retryRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    config._retry = true;

    for (let i = 0; i < this.maxRetries; i++) {
      try {
        await this.delay(this.retryDelay * Math.pow(2, i)); // Exponential backoff
        return await this.client(config);
      } catch (error) {
        if (i === this.maxRetries - 1) {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleErrorNotification(error: AxiosError): void {
    const uiStore = useUIStore.getState();
    
    let message = 'An error occurred';
    
    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = 'Invalid request. Please check your data.';
          break;
        case 401:
          message = 'Authentication failed. Please log in again.';
          break;
        case 403:
          message = 'You don\'t have permission to perform this action.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 429:
          message = 'Too many requests. Please try again later.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        default:
          message = `Request failed with status ${error.response.status}`;
      }
    } else if (error.request) {
      message = 'Network error. Please check your connection.';
    }

    uiStore.addNotification({
      type: 'error',
      title: 'API Error',
      message,
    });
  }

  // Public methods
  public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  public post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  public put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  public patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  public delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  public getClient(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };

// Default export
export default apiClient;