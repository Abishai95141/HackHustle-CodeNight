import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/data/client';

export function UpdatePasswordPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [recoveryEvent, setRecoveryEvent] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryEvent(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    toast.success('Password updated. Sign in with your new password.');
    await signOut();
    setBusy(false);
    navigate('/auth/sign-in', { replace: true });
  }

  // While auth is initializing, render a quiet placeholder
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // No session and no recovery event => arrived here without a valid link
  if (!user && !recoveryEvent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="font-display text-2xl font-semibold tracking-tight">Link expired</div>
          <p className="text-sm text-muted-foreground">
            This password reset link is invalid or has expired. Request a new one.
          </p>
          <Link to="/auth/forgot" className="text-sm underline underline-offset-4">
            Send another reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-10">
        <header className="space-y-2 text-center">
          <div className="font-display text-2xl font-semibold tracking-tight">Set new password</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            8 characters minimum
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
