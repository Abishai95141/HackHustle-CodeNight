import { NavLink, Outlet } from 'react-router-dom';
import { Bell, FileText, HelpCircle, QrCode, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/cn';

const tabs = [
  { to: '/me', label: 'Me', icon: QrCode, end: true },
  { to: '/me/team', label: 'Team', icon: Users },
  { to: '/me/problems', label: 'Brief', icon: FileText },
  { to: '/me/board', label: 'Board', icon: Trophy },
  { to: '/me/notifications', label: 'Inbox', icon: Bell },
  { to: '/me/help', label: 'Help', icon: HelpCircle },
];

export function ParticipantShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-3 text-2xs transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
