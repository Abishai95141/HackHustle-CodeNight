import { NavLink, Outlet } from 'react-router-dom';
import { Award, Bell, FileText, HelpCircle, QrCode, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppSettingsValue } from '@/data/queries/appSettings';

type Tab = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

const baseTabs: Tab[] = [
  { to: '/me', label: 'Me', icon: QrCode, end: true },
  { to: '/me/team', label: 'Team', icon: Users },
  { to: '/me/problems', label: 'Brief', icon: FileText },
  { to: '/me/board', label: 'Board', icon: Trophy },
  { to: '/me/notifications', label: 'Inbox', icon: Bell },
  { to: '/me/help', label: 'Help', icon: HelpCircle },
];

const winnersTab: Tab = { to: '/me/winners', label: 'Winners', icon: Award };

export function ParticipantShell() {
  const { winners_announced } = useAppSettingsValue();

  // When winners are announced, replace "Help" with "Winners" so the
  // celebratory page is one tap away. Help is still reachable by URL and
  // from the home page if needed.
  const tabs = winners_announced
    ? baseTabs.map((t) => (t.to === '/me/help' ? winnersTab : t))
    : baseTabs;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-h-[56px] flex-col items-center justify-center gap-1 text-2xs transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
