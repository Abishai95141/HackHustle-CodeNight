import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { InlineLoader } from '@/components/composite/InlineLoader';
import { NotificationCard } from '@/components/composite/NotificationCard';
import { NotificationComposer } from '@/components/composite/NotificationComposer';
import { useMyDraftNotifications } from '@/data/queries/notifications';

export function VolunteerNotifyPage() {
  const { profile } = useAuth();
  const drafts = useMyDraftNotifications(profile?.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Send a notification"
        subtitle="Drafts go to admin for approval before participants see them."
      />

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <NotificationComposer asRole="volunteer" />
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Your drafts
        </h2>
        {drafts.isLoading ? (
          <InlineLoader />
        ) : (drafts.data ?? []).length === 0 ? (
          <EmptyState title="No drafts yet" body="Submitted notifications will appear here with their approval status." />
        ) : (
          (drafts.data ?? []).map((n) => (
            <NotificationCard key={n.id} notification={n} showStatus />
          ))
        )}
      </section>
    </div>
  );
}
