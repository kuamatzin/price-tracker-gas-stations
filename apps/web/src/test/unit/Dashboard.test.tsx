import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '@/pages/Dashboard';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  DollarSign: () => <div>DollarSign Icon</div>,
  TrendingUp: () => <div>TrendingUp Icon</div>,
  TrendingDown: () => <div>TrendingDown Icon</div>,
  Bell: () => <div>Bell Icon</div>,
  Eye: () => <div>Eye Icon</div>,
  Settings: () => <div>Settings Icon</div>,
  Calendar: () => <div>Calendar Icon</div>,
  MapPin: () => <div>MapPin Icon</div>,
  Activity: () => <div>Activity Icon</div>,
  AlertTriangle: () => <div>AlertTriangle Icon</div>,
}));

const mockUser = {
  id: '123',
  email: 'test@example.com',
  name: 'John Doe',
  station: {
    numero: 'E12345',
    nombre: 'Estación Centro',
    municipio: 'Guadalajara',
    entidad: 'Jalisco'
  },
  subscription_tier: 'premium'
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      token: 'test-token',
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });
  });

  it('renders welcome message with user name', () => {
    render(<Dashboard />);
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('displays station information', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Estación Centro - Guadalajara, Jalisco/)).toBeInTheDocument();
  });

  it('shows subscription tier badge', () => {
    render(<Dashboard />);
    expect(screen.getByText('premium')).toBeInTheDocument();
  });

  it('displays price summary cards', () => {
    render(<Dashboard />);
    expect(screen.getByText('Magna')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Diesel')).toBeInTheDocument();
  });

  it('shows price values correctly formatted', () => {
    render(<Dashboard />);
    expect(screen.getByText('$22.85')).toBeInTheDocument();
    expect(screen.getByText('$24.50')).toBeInTheDocument();
    expect(screen.getByText('$23.20')).toBeInTheDocument();
  });

  it('displays quick action cards', () => {
    render(<Dashboard />);
    expect(screen.getByText('Actualizar Precios')).toBeInTheDocument();
    expect(screen.getByText('Ver Análisis')).toBeInTheDocument();
    expect(screen.getByText('Competencia')).toBeInTheDocument();
    expect(screen.getByText('Configurar Alertas')).toBeInTheDocument();
  });

  it('shows recent activity section', () => {
    render(<Dashboard />);
    expect(screen.getByText('Actividad Reciente')).toBeInTheDocument();
    expect(screen.getByText('Precio actualizado')).toBeInTheDocument();
    expect(screen.getByText('Competencia detectada')).toBeInTheDocument();
    expect(screen.getByText('Alerta activada')).toBeInTheDocument();
  });

  it('displays notification alert when there are notifications', () => {
    render(<Dashboard />);
    expect(screen.getByText(/3 notificaciones pendientes/)).toBeInTheDocument();
    expect(screen.getByText('Ver todas')).toBeInTheDocument();
  });

  it('shows correct greeting based on time of day', () => {
    // Mock date to morning
    const mockDate = new Date();
    mockDate.setHours(10); // 10 AM
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

    render(<Dashboard />);
    expect(screen.getByText(/Buenos días/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('handles user without station', () => {
    const userWithoutStation = { ...mockUser, station: null };
    vi.mocked(useAuthStore).mockReturnValue({
      user: userWithoutStation,
      isAuthenticated: true,
      isLoading: false,
      token: 'test-token',
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });

    render(<Dashboard />);
    expect(screen.getByText('Sin estación asignada')).toBeInTheDocument();
  });

  it('handles user without subscription tier', () => {
    const userWithoutTier = { ...mockUser, subscription_tier: undefined };
    vi.mocked(useAuthStore).mockReturnValue({
      user: userWithoutTier,
      isAuthenticated: true,
      isLoading: false,
      token: 'test-token',
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });

    render(<Dashboard />);
    expect(screen.getByText('básico')).toBeInTheDocument();
  });

  it('displays trend indicators for prices', () => {
    render(<Dashboard />);
    
    // Check for price change indicators
    expect(screen.getByText('$0.15')).toBeInTheDocument(); // Magna down
    expect(screen.getByText('$0.05')).toBeInTheDocument(); // Premium up
    expect(screen.getByText('Sin cambio')).toBeInTheDocument(); // Diesel stable
  });
});