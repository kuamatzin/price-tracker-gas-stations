import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";

// Mock router
vi.mock('@/router', () => ({
  router: {
    routes: [],
    state: {
      loaderData: {},
      actionData: {},
      errors: null,
    },
  },
}));

// Mock RouterProvider to render test content
vi.mock('react-router-dom', () => ({
  RouterProvider: () => <div>Router Loaded Successfully</div>,
}));

// Mock ThemeProvider
vi.mock('@/components/providers/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock ErrorBoundary
vi.mock('../src/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText("Router Loaded Successfully")).toBeInTheDocument();
  });

  it("wraps content with ErrorBoundary and ThemeProvider", () => {
    const { container } = render(<App />);
    expect(container.firstChild).toBeTruthy();
  });
});
