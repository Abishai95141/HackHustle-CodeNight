import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/app/providers/AuthProvider';
import { homeFor } from '@/domain/auth/roles';

export function SignInPage() {
  const { signIn, user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={homeFor(role)} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-10">
        <header className="space-y-2 text-center">
          <div className="font-display text-2xl font-semibold tracking-tight">HackHustle</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">ERP · Sign in</div>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="password">
                Password
              </label>
              <Link
                to="/auth/forgot"
                className="text-2xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-2xs text-muted-foreground">
          Accounts are issued by event admins. Contact ops if you need access.
        </p>
      </div>
    </div>
  );
}
