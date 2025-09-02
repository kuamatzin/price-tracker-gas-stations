import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { 
  ErrorFallback,
  ErrorMessage,
  NetworkError,
  ValidationError,
  NotAuthorizedError
} from '@/components/common';

describe('Error Components', () => {
  describe('ErrorFallback', () => {
    it('renders page error with retry button', () => {
      const mockReset = vi.fn();
      const error = new Error('Test error');
      
      render(<ErrorFallback error={error} resetError={mockReset} type="page" />);
      
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
      expect(screen.getByText('Recargar página')).toBeInTheDocument();
      expect(screen.getByText('Ir al inicio')).toBeInTheDocument();
    });

    it('renders component error', () => {
      const mockReset = vi.fn();
      const error = new Error('Component error');
      
      render(<ErrorFallback error={error} resetError={mockReset} type="component" />);
      
      expect(screen.getByText('Error en el componente')).toBeInTheDocument();
      expect(screen.getByText('Intentar de nuevo')).toBeInTheDocument();
    });

    it('renders critical error', () => {
      const error = new Error('Critical system error');
      
      render(<ErrorFallback error={error} type="critical" />);
      
      expect(screen.getByText('Error Crítico')).toBeInTheDocument();
      expect(screen.getByText('Recargar aplicación')).toBeInTheDocument();
    });

    it('calls resetError when retry button is clicked', () => {
      const mockReset = vi.fn();
      const error = new Error('Test error');
      
      render(<ErrorFallback error={error} resetError={mockReset} type="component" />);
      
      fireEvent.click(screen.getByText('Intentar de nuevo'));
      expect(mockReset).toHaveBeenCalledOnce();
    });
  });

  describe('ErrorMessage', () => {
    it('renders error message', () => {
      render(<ErrorMessage message="Something went wrong" type="error" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders different message types', () => {
      const { rerender } = render(<ErrorMessage message="Warning" type="warning" />);
      expect(screen.getByText('Warning')).toBeInTheDocument();

      rerender(<ErrorMessage message="Info" type="info" />);
      expect(screen.getByText('Info')).toBeInTheDocument();

      rerender(<ErrorMessage message="Success" type="success" />);
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('shows dismiss button when dismissible', () => {
      const mockDismiss = vi.fn();
      render(
        <ErrorMessage 
          message="Dismissible error" 
          dismissible={true}
          onDismiss={mockDismiss}
        />
      );
      
      const dismissButton = screen.getByLabelText('Cerrar');
      expect(dismissButton).toBeInTheDocument();
      
      fireEvent.click(dismissButton);
      expect(mockDismiss).toHaveBeenCalledOnce();
    });
  });

  describe('NetworkError', () => {
    it('renders network error message', () => {
      render(<NetworkError />);
      expect(screen.getByText('Error de conexión')).toBeInTheDocument();
      expect(screen.getByText('No se pudo conectar al servidor. Verifica tu conexión a internet.')).toBeInTheDocument();
    });

    it('shows retry button when onRetry is provided', () => {
      const mockRetry = vi.fn();
      render(<NetworkError onRetry={mockRetry} retryText="Try Again" />);
      
      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(mockRetry).toHaveBeenCalledOnce();
    });

    it('does not show retry button when onRetry is not provided', () => {
      render(<NetworkError />);
      expect(screen.queryByText('Reintentar')).not.toBeInTheDocument();
    });
  });

  describe('ValidationError', () => {
    it('renders multiple validation errors', () => {
      const errors = ['Email is required', 'Password must be at least 8 characters'];
      render(<ValidationError errors={errors} />);
      
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('renders empty when no errors provided', () => {
      render(<ValidationError errors={[]} />);
      const errorElements = document.querySelectorAll('[role="alert"]');
      expect(errorElements.length).toBe(0);
    });
  });

  describe('NotAuthorizedError', () => {
    it('renders unauthorized error', () => {
      render(<NotAuthorizedError />);
      expect(screen.getByText('Acceso Denegado')).toBeInTheDocument();
      expect(screen.getByText('No tienes permisos para acceder a este contenido.')).toBeInTheDocument();
    });

    it('has login button', () => {
      render(<NotAuthorizedError />);
      expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    });
  });
});