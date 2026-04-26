import { NavLink, Outlet } from 'react-router-dom';
import { LogOut as LogOutIcon, MessageSquarePlus, ScanLine } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const items = [
  { to: '/scan', label: 'Scanner', icon: ScanLine, end: true },
  { to: '/scan/notify', label: 'Notify', icon: MessageSquarePlus },
];

export function ScanShell() {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
          Scanner
        </span>
        <span className="text-2xs text-muted-foreground">· {profile?.name}</span>
        <nav className="ml-auto flex items-center gap-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOutIcon className="h-4 w-4" />
          </Button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
