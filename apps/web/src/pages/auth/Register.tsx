import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string[]>
  >({});
  const { register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({}); // Clear previous errors

    try {
      const result = await register(
        email,
        password,
        passwordConfirmation,
        name,
      );
      if (result.success) {
        navigate("/dashboard");
      } else if (result.validationErrors) {
        // Handle validation errors from API
        setValidationErrors(result.validationErrors);
      }
    } catch (error) {
      // General error is handled by the store
      console.error("Registration error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Create your FuelIntel account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="sr-only">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className={`relative block w-full px-3 py-2 border ${validationErrors.name ? "border-red-500" : "border-gray-300"} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500`}
              placeholder="Full name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors({ ...validationErrors, name: undefined });
                }
              }}
            />
            {validationErrors.name && (
              <div className="mt-1 text-red-600 text-sm">
                {validationErrors.name.join(", ")}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`relative block w-full px-3 py-2 border ${validationErrors.email ? "border-red-500" : "border-gray-300"} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500`}
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationErrors.email) {
                  setValidationErrors({
                    ...validationErrors,
                    email: undefined,
                  });
                }
              }}
            />
            {validationErrors.email && (
              <div className="mt-1 text-red-600 text-sm">
                {validationErrors.email.join(", ")}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className={`relative block w-full px-3 py-2 border ${validationErrors.password ? "border-red-500" : "border-gray-300"} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500`}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (validationErrors.password) {
                  setValidationErrors({
                    ...validationErrors,
                    password: undefined,
                  });
                }
              }}
            />
            {validationErrors.password && (
              <div className="mt-1 text-red-600 text-sm">
                {validationErrors.password.join(", ")}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="password_confirmation" className="sr-only">
              Confirm Password
            </label>
            <input
              id="password_confirmation"
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              required
              className={`relative block w-full px-3 py-2 border ${validationErrors.password_confirmation ? "border-red-500" : "border-gray-300"} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500`}
              placeholder="Confirm Password"
              value={passwordConfirmation}
              onChange={(e) => {
                setPasswordConfirmation(e.target.value);
                if (validationErrors.password_confirmation) {
                  setValidationErrors({
                    ...validationErrors,
                    password_confirmation: undefined,
                  });
                }
              }}
            />
            {validationErrors.password_confirmation && (
              <div className="mt-1 text-red-600 text-sm">
                {validationErrors.password_confirmation.join(", ")}
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
            >
              {isLoading ? "Creating account..." : "Sign up"}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="font-medium text-brand-600 hover:text-brand-500"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
