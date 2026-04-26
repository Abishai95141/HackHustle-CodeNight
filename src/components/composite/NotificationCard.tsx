import { Bell, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { NotificationRow } from '@/data/queries/notifications';
import { labelForRole } from '@/domain/auth/roles';

function targetLabel(n: NotificationRow): string {
  switch (n.target_type) {
    case 'all':         return 'All participants';
    case 'teams':       return `${n.target_team_ids?.length ?? 0} team(s)`;
    case 'domains':     return `Domain: ${n.target_domains?.join(', ') ?? '—'}`;
    case 'individuals': return `${n.target_user_ids?.length ?? 0} individual(s)`;
    case 'role':        return `Role: ${labelForRole(n.target_role)}`;
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationCard({
  notification,
  showStatus = false,
  rightSlot,
}: {
  notification: NotificationRow;
  showStatus?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const n = notification;
  const Icon = n.creator_role === 'super_admin' ? ShieldCheck : Megaphone;
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="flex items-start gap-3">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          n.creator_role === 'super_admin'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
            : 'bg-primary/15 text-primary',
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{n.title}</h3>
            <Badge variant="outline" className="border-border">{labelForRole(n.creator_role)}</Badge>
            {showStatus ? <StatusBadge status={n.status} /> : null}
          </div>
          <div className="mt-0.5 text-2xs text-muted-foreground">
            {n.creator_name ? `from ${n.creator_name} · ` : ''}
            {timeAgo(n.published_at ?? n.created_at)}
            <span className="ml-2 inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {targetLabel(n)}
            </span>
          </div>
        </div>
        {rightSlot}
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{n.body}</p>
      {n.status === 'rejected' && n.rejection_reason ? (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-2xs text-rose-700 dark:text-rose-300">
          <strong>Rejected:</strong> {n.rejection_reason}
        </div>
      ) : null}
    </article>
  );
}

function StatusBadge({ status }: { status: NotificationRow['status'] }) {
  const map: Record<NotificationRow['status'], { label: string; className: string }> = {
    pending:  { label: 'Pending',  className: 'border-amber-500/40 text-amber-700 dark:text-amber-300' },
    approved: { label: 'Approved', className: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' },
    rejected: { label: 'Rejected', className: 'border-rose-500/40 text-rose-700 dark:text-rose-300' },
  };
  const c = map[status];
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]',
      c.className,
    )}>
      <Bell className="mr-1 h-2.5 w-2.5" />
      {c.label}
    </span>
  );
}
