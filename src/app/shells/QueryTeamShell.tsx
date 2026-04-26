import { NavLink, Outlet } from 'react-router-dom';
import { HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { cn } from '@/lib/cn';

const items = [{ to: '/queries', label: 'Queries', icon: HelpCircle, end: true }];

export function QueryTeamShell() {
  const { profile, signOut } = useAuth();

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-background">
      <aside className="flex flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center border-b border-border px-6">
          <span className="font-display text-base font-semibold tracking-tight">HackHustle</span>
          <span className="ml-2 text-2xs uppercase tracking-widest text-muted-foreground">Queries</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 px-2 text-xs">
            <div className="truncate font-medium text-foreground">{profile?.name ?? '—'}</div>
            <div className="truncate text-muted-foreground">{profile?.email ?? ''}</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
