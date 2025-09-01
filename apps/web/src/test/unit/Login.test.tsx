import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Login from '@/pages/auth/Login';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore');

const mockLogin = vi.fn();
const mockUseAuthStore = vi.mocked(useAuthStore);

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      error: null,
      isLoading: false,
      user: null,
      token: null,
      isAuthenticated: false,
      logout: vi.fn(),
      refresh: vi.fn(),
      checkAuth: vi.fn(),
    });
    mockLogin.mockClear();
  });

  test('renders login form with all required fields', () => {
    renderLogin();
    
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Recordarme')).toBeInTheDocument();
    expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument();
  });

  test('does not call login with invalid email', async () => {
    renderLogin();
    
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña');
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' });
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'validpassword' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  test('does not call login with short password', async () => {
    renderLogin();
    
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña');
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  test('submits form with valid data', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña');
    const rememberMeCheckbox = screen.getByLabelText('Recordarme');
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(rememberMeCheckbox);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', true);
    });
  });

  test('displays loading state during submission', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
    renderLogin();
    
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña');
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Iniciando sesión...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  test('displays error message when login fails', () => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      error: 'Invalid credentials',
      isLoading: false,
      user: null,
      token: null,
      isAuthenticated: false,
      logout: vi.fn(),
      refresh: vi.fn(),
      checkAuth: vi.fn(),
    });
    
    renderLogin();
    
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  test('has forgot password link', () => {
    renderLogin();
    
    const forgotPasswordLink = screen.getByText('¿Olvidaste tu contraseña?');
    expect(forgotPasswordLink).toBeInTheDocument();
    expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  test('has register link', () => {
    renderLogin();
    
    const registerLink = screen.getByText('¿No tienes cuenta? Regístrate');
    expect(registerLink).toBeInTheDocument();
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register');
  });

  test('remember me checkbox works correctly', () => {
    renderLogin();
    
    const rememberMeCheckbox = screen.getByLabelText('Recordarme');
    expect(rememberMeCheckbox).not.toBeChecked();
    
    fireEvent.click(rememberMeCheckbox);
    expect(rememberMeCheckbox).toBeChecked();
  });
});