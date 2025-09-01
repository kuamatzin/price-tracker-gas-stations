import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Register from "@/pages/auth/Register";
import { useAuthStore } from "@/stores/authStore";

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Register Component - Validation Error Handling", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useAuthStore.getState().clearError();
  });

  it("should display validation errors when API returns 422", async () => {
    // Mock the register function to return validation errors
    const mockRegister = vi.fn().mockResolvedValue({
      success: false,
      validationErrors: {
        email: ["Este correo electrónico ya está registrado."],
        password: ["Las contraseñas no coinciden."],
      },
    });

    useAuthStore.setState({ register: mockRegister });

    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>,
    );

    // Fill in the form
    const nameInput = screen.getByPlaceholderText("Full name");
    const emailInput = screen.getByPlaceholderText("Email address");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "DifferentPassword" },
    });

    // Submit the form
    fireEvent.click(submitButton);

    // Wait for validation errors to appear
    await waitFor(() => {
      expect(
        screen.getByText("Este correo electrónico ya está registrado."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Las contraseñas no coinciden."),
      ).toBeInTheDocument();
    });

    // Verify that navigation did not occur
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should clear validation errors when user types", async () => {
    // Mock the register function to return validation errors
    const mockRegister = vi.fn().mockResolvedValue({
      success: false,
      validationErrors: {
        email: ["Este correo electrónico ya está registrado."],
      },
    });

    useAuthStore.setState({ register: mockRegister });

    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>,
    );

    // Fill and submit form to trigger validation errors
    const emailInput = screen.getByPlaceholderText("Email address");
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.click(submitButton);

    // Wait for validation error to appear
    await waitFor(() => {
      expect(
        screen.getByText("Este correo electrónico ya está registrado."),
      ).toBeInTheDocument();
    });

    // Type in the email field to clear the error
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });

    // Error should be cleared
    await waitFor(() => {
      expect(
        screen.queryByText("Este correo electrónico ya está registrado."),
      ).not.toBeInTheDocument();
    });
  });

  it("should navigate to dashboard on successful registration", async () => {
    // Mock successful registration
    const mockRegister = vi.fn().mockResolvedValue({
      success: true,
    });

    useAuthStore.setState({ register: mockRegister });

    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>,
    );

    // Fill in the form
    const nameInput = screen.getByPlaceholderText("Full name");
    const emailInput = screen.getByPlaceholderText("Email address");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "Password123!" },
    });

    // Submit the form
    fireEvent.click(submitButton);

    // Wait for navigation to occur
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("should include password_confirmation field in API request", async () => {
    const mockRegister = vi.fn().mockResolvedValue({
      success: true,
    });

    useAuthStore.setState({ register: mockRegister });

    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>,
    );

    // Fill in the form
    const nameInput = screen.getByPlaceholderText("Full name");
    const emailInput = screen.getByPlaceholderText("Email address");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123!" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "Password123!" },
    });

    // Submit the form
    fireEvent.click(submitButton);

    // Verify the register function was called with all parameters
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        "test@example.com",
        "Password123!",
        "Password123!", // password_confirmation
        "Test User",
      );
    });
  });
});
