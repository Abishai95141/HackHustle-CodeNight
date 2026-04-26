import { Bell } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { NotificationCard } from '@/components/composite/NotificationCard';
import { useMyNotifications } from '@/data/queries/notifications';

export function ParticipantNotificationsPage() {
  const { data = [], isLoading } = useMyNotifications();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="Notifications"
        subtitle="Updates from organizers and volunteers, in real time."
      />

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            body="No notifications yet — anything organizers send will land here."
            action={
              <div className="inline-flex items-center gap-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
                <Bell className="h-4 w-4" /> Live updates enabled
              </div>
            }
          />
        ) : (
          data.map((n) => <NotificationCard key={n.id} notification={n} />)
        )}
      </div>
    </div>
  );
}
