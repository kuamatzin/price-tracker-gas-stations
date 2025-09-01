import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import ErrorBoundary from "./components/ErrorBoundary";
import { router } from '@/router';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
