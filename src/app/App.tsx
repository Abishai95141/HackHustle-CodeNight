import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { LoggerProvider } from '@/app/providers/LoggerProvider';
import { AppRoutes } from '@/app/routes';
import { SUPABASE_ENV_OK } from '@/data/client';

export function App() {
  if (!SUPABASE_ENV_OK) return <EnvMissingScreen />;
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

/**
 * Rendered when the Supabase env vars weren't baked into the build. This
 * happens on Vercel when the env vars are added AFTER the initial deploy
 * (Vite reads import.meta.env at build time, not runtime — so a redeploy
 * is required to pick up newly-set vars).
 */
function EnvMissingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-lg space-y-5 rounded-lg border border-rose-500/40 bg-rose-500/5 p-6">
        <header className="space-y-1">
          <div className="text-2xs uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
            Configuration error
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Supabase environment variables not set
          </h1>
        </header>
        <p className="text-sm text-muted-foreground">
          The deployed bundle was built without <code>VITE_SUPABASE_URL</code> or{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. Vite reads these at build time, so adding
          them in your hosting dashboard requires a fresh deploy to take effect.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            In Vercel → Project Settings → Environment Variables, add{' '}
            <code className="rounded bg-secondary px-1">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-secondary px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> with
            the <strong>Production</strong> scope ticked.
          </li>
          <li>
            Open the Deployments tab and click <strong>Redeploy</strong> on the latest deployment.
            (Toggling env vars alone does not trigger a rebuild.)
          </li>
          <li>Once the new deployment finishes, refresh this page.</li>
        </ol>
        <p className="text-2xs text-muted-foreground">
          See <code>.env.example</code> in the repo for the full list.
        </p>
      </div>
    </main>
  );
}
