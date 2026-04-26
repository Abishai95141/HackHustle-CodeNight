import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/data/client';

export function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();

    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <div className="font-display text-2xl font-semibold tracking-tight">Check your email</div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Reset link sent
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, you'll
            receive a password reset link in the next minute or two. Follow the link to set a new password.
          </p>
          <Link to="/auth/sign-in" className="text-sm underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-10">
        <header className="space-y-2 text-center">
          <div className="font-display text-2xl font-semibold tracking-tight">Reset password</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            We'll email you a link
          </div>
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

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className="text-center">
          <Link to="/auth/sign-in" className="text-2xs text-muted-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
