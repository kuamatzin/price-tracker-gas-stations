import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    station: {
      numero: string;
      nombre: string;
      municipio: string;
      entidad: string;
    } | null;
    subscription_tier: string;
  };
  token: string;
  expires_at: string;
}

export interface RefreshTokenResponse {
  token: string;
  expires_at: string;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  password_confirmation: string;
}

class AuthService {
  private readonly baseUrl = '/api/v1/auth';

  private logRequest(endpoint: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuthService] ${endpoint}`, data ? { ...data, password: '***' } : '');
    }
  }

  private logResponse(endpoint: string, success: boolean, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuthService] ${endpoint} ${success ? 'SUCCESS' : 'ERROR'}`, data);
    }
  }

  private handleAuthError(error: any): never {
    if (error.response?.data) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          throw new Error(data.message || 'Credenciales inválidas');
        case 422:
          throw new Error(data.message || 'Datos de entrada inválidos');
        case 423:
          throw new Error('Cuenta bloqueada por demasiados intentos fallidos');
        case 429:
          throw new Error('Demasiados intentos. Intenta más tarde');
        case 500:
          throw new Error('Error del servidor. Intenta más tarde');
        default:
          throw new Error(data.message || 'Error de autenticación');
      }
    }
    
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      throw new Error('Error de conexión. Verifica tu internet');
    }
    
    throw new Error('Error inesperado durante la autenticación');
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      this.logRequest('POST /login', credentials);
      
      const response = await apiClient.post<AuthResponse>(
        `${this.baseUrl}/login`,
        credentials
      );
      
      this.logResponse('POST /login', true, { 
        user: response.data.user.email,
        expires_at: response.data.expires_at
      });
      
      return response.data;
    } catch (error) {
      this.logResponse('POST /login', false, error);
      this.handleAuthError(error);
    }
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      this.logRequest('POST /register', userData);
      
      const response = await apiClient.post<AuthResponse>(
        `${this.baseUrl}/register`,
        userData
      );
      
      this.logResponse('POST /register', true, { 
        user: response.data.user.email 
      });
      
      return response.data;
    } catch (error) {
      this.logResponse('POST /register', false, error);
      this.handleAuthError(error);
    }
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      this.logRequest('POST /refresh');
      
      const response = await apiClient.post<RefreshTokenResponse>(
        `${this.baseUrl}/refresh`
      );
      
      this.logResponse('POST /refresh', true, { 
        expires_at: response.data.expires_at 
      });
      
      return response.data;
    } catch (error) {
      this.logResponse('POST /refresh', false, error);
      this.handleAuthError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      this.logRequest('POST /logout');
      
      await apiClient.post(`${this.baseUrl}/logout`);
      
      this.logResponse('POST /logout', true);
    } catch (error) {
      this.logResponse('POST /logout', false, error);
      // Don't throw on logout errors - still clear local state
      console.warn('Logout API call failed, but continuing with local cleanup', error);
    }
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<{ message: string }> {
    try {
      this.logRequest('POST /forgot-password', request);
      
      const response = await apiClient.post<{ message: string }>(
        `${this.baseUrl}/forgot-password`,
        request
      );
      
      this.logResponse('POST /forgot-password', true);
      return response.data;
    } catch (error) {
      this.logResponse('POST /forgot-password', false, error);
      this.handleAuthError(error);
    }
  }

  async resetPassword(request: ResetPasswordRequest): Promise<{ message: string }> {
    try {
      this.logRequest('POST /reset-password', request);
      
      const response = await apiClient.post<{ message: string }>(
        `${this.baseUrl}/reset-password`,
        request
      );
      
      this.logResponse('POST /reset-password', true);
      return response.data;
    } catch (error) {
      this.logResponse('POST /reset-password', false, error);
      this.handleAuthError(error);
    }
  }

  async getCurrentUser(): Promise<AuthResponse['user']> {
    try {
      this.logRequest('GET /me');
      
      const response = await apiClient.get<AuthResponse['user']>(
        `${this.baseUrl}/me`
      );
      
      this.logResponse('GET /me', true, { 
        user: response.data.email 
      });
      
      return response.data;
    } catch (error) {
      this.logResponse('GET /me', false, error);
      this.handleAuthError(error);
    }
  }

  async updateProfile(userData: Partial<{ name: string; email: string }>): Promise<AuthResponse['user']> {
    try {
      this.logRequest('PUT /profile', userData);
      
      const response = await apiClient.put<AuthResponse['user']>(
        `${this.baseUrl}/profile`,
        userData
      );
      
      this.logResponse('PUT /profile', true, { 
        user: response.data.email 
      });
      
      return response.data;
    } catch (error) {
      this.logResponse('PUT /profile', false, error);
      this.handleAuthError(error);
    }
  }
}

export const authService = new AuthService();
export default authService;