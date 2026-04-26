import { Outlet } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';

export function JudgeShell() {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base font-semibold">Judging</span>
          <span className="text-2xs uppercase tracking-widest text-muted-foreground">Round 1</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{profile?.name}</span>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
