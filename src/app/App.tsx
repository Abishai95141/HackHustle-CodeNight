import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { LoggerProvider } from '@/app/providers/LoggerProvider';
import { AppRoutes } from '@/app/routes';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <LoggerProvider>
              <AppRoutes />
              <Toaster
                position="top-center"
                theme="system"
                toastOptions={{
                  className: 'font-sans text-sm',
                  duration: 2400,
                }}
              />
            </LoggerProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
