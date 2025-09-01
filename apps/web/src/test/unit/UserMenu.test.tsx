import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { UserMenu } from '@/components/layout/UserMenu';
import { useAuthStore } from '@/stores/authStore';

// Mock the stores
const mockLogout = vi.fn();
const mockUser = {
  id: '1',
  name: 'Juan Carlos Pérez',
  email: 'juan.perez@example.com',
  station: {
    numero: 'E12345',
    nombre: 'Pemex Centro',
    municipio: 'Guadalajara',
    entidad: 'Jalisco',
  },
  subscription_tier: 'premium',
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: mockUser,
    logout: mockLogout,
  })),
}));

const renderUserMenu = () => {
  return render(
    <BrowserRouter>
      <UserMenu />
    </BrowserRouter>
  );
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default user state
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
  });

  test('renders user avatar with initials', () => {
    renderUserMenu();
    
    const avatarButton = screen.getByLabelText('User menu');
    expect(avatarButton).toBeInTheDocument();
    
    // Should show user initials (JC for Juan Carlos)
    expect(screen.getByText('JC')).toBeInTheDocument();
  });

  test('displays user name and email on desktop', () => {
    renderUserMenu();
    
    expect(screen.getByText('Juan Carlos Pérez')).toBeInTheDocument();
    expect(screen.getByText('juan.perez@example.com')).toBeInTheDocument();
  });

  test('opens dropdown when clicked', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      // Should show expanded user info
      expect(screen.getAllByText('Juan Carlos Pérez')).toHaveLength(2); // One in button, one in dropdown
      expect(screen.getAllByText('juan.perez@example.com')).toHaveLength(2);
      
      // Should show subscription tier
      expect(screen.getByText('premium')).toBeInTheDocument();
      
      // Should show menu items
      expect(screen.getByText('Perfil')).toBeInTheDocument();
      expect(screen.getByText('Configuración')).toBeInTheDocument();
      expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument();
    });
  });

  test('displays station information when available', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      expect(screen.getByText('Pemex Centro')).toBeInTheDocument();
      expect(screen.getByText('Guadalajara, Jalisco')).toBeInTheDocument();
      expect(screen.getByText('E12345')).toBeInTheDocument();
    });
  });

  test('applies correct subscription tier colors', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      const tierBadge = screen.getByText('premium');
      expect(tierBadge).toHaveClass('bg-amber-100', 'text-amber-800');
    });
  });

  test('closes dropdown when clicking outside', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      expect(screen.getByText('Perfil')).toBeInTheDocument();
    });
    
    // Click outside
    fireEvent.mouseDown(document.body);
    
    await waitFor(() => {
      expect(screen.queryByText('Perfil')).not.toBeInTheDocument();
    });
  });

  test('closes dropdown when escape key is pressed', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      expect(screen.getByText('Perfil')).toBeInTheDocument();
    });
    
    // Press escape
    fireEvent.keyDown(document, { key: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByText('Perfil')).not.toBeInTheDocument();
    });
  });

  test('navigates to profile when profile link is clicked', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      const profileLink = screen.getByText('Perfil');
      expect(profileLink.closest('a')).toHaveAttribute('href', '/profile');
    });
  });

  test('navigates to settings when settings link is clicked', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      const settingsLink = screen.getByText('Configuración');
      expect(settingsLink.closest('a')).toHaveAttribute('href', '/settings');
    });
  });

  test('calls logout when logout button is clicked', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument();
    });
    
    const logoutButton = screen.getByText('Cerrar Sesión');
    fireEvent.click(logoutButton);
    
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  test('closes menu after logout', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument();
    });
    
    const logoutButton = screen.getByText('Cerrar Sesión');
    fireEvent.click(logoutButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Perfil')).not.toBeInTheDocument();
    });
  });

  test('handles user initials correctly for single name', () => {
    const singleNameUser = { ...mockUser, name: 'Carlos' };
    
    vi.mocked(useAuthStore).mockReturnValue({
      user: singleNameUser,
      logout: mockLogout,
    });
    
    renderUserMenu();
    
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  test('handles user initials correctly for multiple names', () => {
    const multipleNameUser = { ...mockUser, name: 'Juan Carlos Eduardo Pérez López' };
    
    vi.mocked(useAuthStore).mockReturnValue({
      user: multipleNameUser,
      logout: mockLogout,
    });
    
    renderUserMenu();
    
    // Should show first two initials
    expect(screen.getByText('JC')).toBeInTheDocument();
  });

  test('shows different colors for different subscription tiers', async () => {
    // Test basic tier
    const basicUser = { ...mockUser, subscription_tier: 'basic' };
    
    vi.mocked(useAuthStore).mockReturnValue({
      user: basicUser,
      logout: mockLogout,
    });
    
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      const tierBadge = screen.getByText('basic');
      expect(tierBadge).toHaveClass('bg-gray-100', 'text-gray-800');
    });
  });

  test('returns null when user is not available', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      logout: mockLogout,
    });
    
    const { container } = renderUserMenu();
    expect(container.firstChild).toBeNull();
  });

  test('shows loading state properly', () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    expect(userButton).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(userButton);
    
    expect(userButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('handles missing station information gracefully', async () => {
    const userWithoutStation = { ...mockUser, station: null };
    
    vi.mocked(useAuthStore).mockReturnValue({
      user: userWithoutStation,
      logout: mockLogout,
    });
    
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    
    await waitFor(() => {
      // Should not show station information
      expect(screen.queryByText('Pemex Centro')).not.toBeInTheDocument();
    });
  });

  test('chevron icon rotates when menu is open', async () => {
    renderUserMenu();
    
    const userButton = screen.getByLabelText('User menu');
    const chevron = userButton.querySelector('svg[class*="rotate"]') || 
                   userButton.querySelector('svg');
    
    // Initially should not be rotated
    expect(chevron).not.toHaveClass('rotate-180');
    
    fireEvent.click(userButton);
    
    await waitFor(() => {
      expect(chevron).toHaveClass('rotate-180');
    });
  });
});