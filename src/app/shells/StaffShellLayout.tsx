import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';

export type ShellNavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

type Props = {
  /** Brand mark — usually "ERP". */
  badge: string;
  items: ShellNavItem[];
  /** Constrains the main column width on large screens. */
  contentMaxWidth?: 'narrow' | 'wide';
};

/**
 * Shared chrome for staff shells (Admin / RSVP / QueryTeam).
 *  - Mobile (<md): top bar with burger menu opening a left-slide Sheet
 *  - Desktop (md+): persistent 240px sidebar on the left
 *
 * The nav item list and the Outlet are passed in by the consumer so each role
 * keeps its own routes. The same NavSection is rendered in both layouts so
 * NavLink active-state styling is consistent across breakpoints.
 */
export function StaffShellLayout({ badge, items, contentMaxWidth = 'wide' }: Props) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Auto-close the drawer when navigating between routes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background md:h-screen md:flex-row md:overflow-hidden">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation"
              className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">App sections and sign out.</SheetDescription>
            <BrandHeader badge={badge} />
            <NavSection items={items} onNavigate={() => setMobileOpen(false)} />
            <UserFooter
              name={profile?.name ?? null}
              email={profile?.email ?? null}
              onSignOut={async () => {
                setMobileOpen(false);
                await signOut();
              }}
            />
            <SheetClose className="hidden" />
          </SheetContent>
        </Sheet>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base font-semibold tracking-tight">HackHustle</span>
          <span className="text-2xs uppercase tracking-widest text-muted-foreground">{badge}</span>
        </div>
        <span className="w-10" />{/* spacer to keep title centred */}
      </header>

      {/* Desktop sidebar — fixed height, scrolls independently of main */}
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-card md:flex md:h-screen md:overflow-hidden">
        <BrandHeader badge={badge} />
        {/* Nav scrolls inside the sidebar if it ever overflows; the brand
            and user footer stay pinned. */}
        <NavSection items={items} />
        <UserFooter
          name={profile?.name ?? null}
          email={profile?.email ?? null}
          onSignOut={signOut}
        />
      </aside>

      {/* Content — the only thing that scrolls vertically on md+ */}
      <main className="min-w-0 flex-1 overflow-y-auto md:h-screen">
        <div
          className={cn(
            'mx-auto px-4 py-6 sm:px-6 md:px-8 md:py-10',
            contentMaxWidth === 'narrow' ? 'max-w-3xl' : 'max-w-6xl',
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function BrandHeader({ badge }: { badge: string }) {
  return (
    <div className="flex h-16 shrink-0 items-center border-b border-border px-6">
      <span className="font-display text-base font-semibold tracking-tight">HackHustle</span>
      <span className="ml-2 text-2xs uppercase tracking-widest text-muted-foreground">{badge}</span>
    </div>
  );
}

function NavSection({
  items,
  onNavigate,
}: {
  items: ShellNavItem[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function UserFooter({
  name,
  email,
  onSignOut,
}: {
  name: string | null;
  email: string | null;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div className="border-t border-border p-3">
      <div className="mb-2 px-2 text-xs">
        <div className="truncate font-medium text-foreground">{name ?? '—'}</div>
        <div className="truncate text-muted-foreground">{email ?? ''}</div>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
