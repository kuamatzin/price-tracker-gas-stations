import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
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
      id: string;
      name: string;
      location: {
        lat: number;
        lng: number;
      };
    } | null;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
      autoRefresh: boolean;
      refreshInterval: number;
    };
  };
  token: string;
  expiresAt: string;
}

export interface RefreshTokenResponse {
  token: string;
  expiresAt: string;
}

class AuthService {
  private readonly baseUrl = '/auth';

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      `${this.baseUrl}/login`,
      credentials
    );
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      `${this.baseUrl}/register`,
      userData
    );
    return response.data;
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    const response = await apiClient.post<RefreshTokenResponse>(
      `${this.baseUrl}/refresh`
    );
    return response.data;
  }

  async logout(): Promise<void> {
    await apiClient.post(`${this.baseUrl}/logout`);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `${this.baseUrl}/forgot-password`,
      { email }
    );
    return response.data;
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `${this.baseUrl}/reset-password`,
      { token, password }
    );
    return response.data;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `${this.baseUrl}/verify-email`,
      { token }
    );
    return response.data;
  }

  async resendVerificationEmail(): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `${this.baseUrl}/resend-verification`
    );
    return response.data;
  }
}

export const authService = new AuthService();
export default authService;