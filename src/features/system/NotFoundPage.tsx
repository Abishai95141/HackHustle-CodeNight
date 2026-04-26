import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <div className="font-display text-3xl font-semibold tracking-tight">404</div>
      <div className="text-sm text-muted-foreground">This page doesn't exist.</div>
      <Link to="/" className="text-sm underline underline-offset-4">
        Go home
      </Link>
    </div>
  );
}
