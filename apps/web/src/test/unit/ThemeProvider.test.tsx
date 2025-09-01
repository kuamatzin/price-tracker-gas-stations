import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/components/providers/ThemeProvider';

// Test component to access theme context
const ThemeConsumer = () => {
  const { theme, setTheme } = useTheme();
  
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light  
      </button>
      <button onClick={() => setTheme('system')} data-testid="set-system">
        Set System
      </button>
    </div>
  );
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock document
const mockDocumentElement = {
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
};
Object.defineProperty(document, 'documentElement', {
  value: mockDocumentElement,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('should provide default theme value', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
  });

  it('should use theme from localStorage if available', () => {
    localStorageMock.getItem.mockReturnValue('dark');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
  });

  it('should use custom default theme', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
  });

  it('should apply dark theme to document', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-dark'));

    expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('light', 'dark');
    expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('vite-ui-theme', 'dark');
  });

  it('should apply light theme to document', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-light'));

    expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('light', 'dark');
    expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('vite-ui-theme', 'light');
  });

  it('should handle system theme with dark preference', () => {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)' ? true : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-system'));

    expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('light', 'dark');
    expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
  });

  it('should handle system theme with light preference', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-system'));

    expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('light', 'dark');
    expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('light');
  });

  it('should use custom storage key', () => {
    render(
      <ThemeProvider storageKey="custom-theme">
        <ThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-dark'));

    expect(localStorageMock.setItem).toHaveBeenCalledWith('custom-theme', 'dark');
  });

  it('should update theme state when setTheme is called', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('system');

    fireEvent.click(screen.getByTestId('set-dark'));
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');

    fireEvent.click(screen.getByTestId('set-light'));
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

    fireEvent.click(screen.getByTestId('set-system'));
    expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
  });

  it('should throw error when useTheme is used outside provider', () => {
    // Mock console.error to suppress error output in tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<ThemeConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});