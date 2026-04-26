import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { NotificationCard } from '@/components/composite/NotificationCard';
import { NotificationComposer } from '@/components/composite/NotificationComposer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/cn';
import {
  useAllNotifications,
  usePendingNotifications,
  type NotificationRow,
} from '@/data/queries/notifications';
import {
  approveNotification,
  deleteNotification,
  rejectNotification,
} from '@/data/rpc/notifications';

type Tab = 'pending' | 'all';

export function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [composing, setComposing] = useState(false);
  const [rejecting, setRejecting] = useState<NotificationRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState<NotificationRow | null>(null);

  const pending = usePendingNotifications();
  const all = useAllNotifications();
  const qc = useQueryClient();

  const list = useMemo(() => (tab === 'pending' ? pending.data ?? [] : all.data ?? []), [tab, pending.data, all.data]);
  const queryError = (tab === 'pending' ? pending.error : all.error) as Error | null;

  const approve = useMutation({
    mutationFn: (id: string) => approveNotification(id),
    onSuccess: () => {
      toast.success('Notification published');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to approve'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectNotification(id, reason),
    onSuccess: () => {
      toast.success('Notification rejected');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setRejecting(null);
      setRejectReason('');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to reject'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      toast.success('Notification deleted');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete'),
  });

  return (
    <div className="space-y-8">
      {queryError ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
          <strong>Couldn't load notifications.</strong> {queryError.message}
          {/relation|does not exist|schema|notifications/i.test(queryError.message ?? '') ? (
            <div className="mt-1 text-2xs">
              The notifications table is missing — apply migration
              <code className="mx-1 font-mono">0003_rsvp_domains_notifications.sql</code>
              against your Supabase project.
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Notifications"
          subtitle="Approve volunteer drafts or post your own announcements."
        />
        <Dialog open={composing} onOpenChange={setComposing}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Compose notification</DialogTitle>
              <DialogDescription>Posts immediately — no approval needed for admins.</DialogDescription>
            </DialogHeader>
            <NotificationComposer asRole="super_admin" onSubmitted={() => setComposing(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="inline-flex rounded-md border border-border p-0.5">
        <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending
          {(pending.data?.length ?? 0) > 0 ? (
            <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              {pending.data?.length}
            </span>
          ) : null}
        </TabBtn>
        <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
          All
        </TabBtn>
      </div>

      <div className="space-y-3">
        {(tab === 'pending' ? pending.isLoading : all.isLoading) ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState
            title={tab === 'pending' ? 'Inbox zero' : 'No notifications yet'}
            body={tab === 'pending' ? 'No pending volunteer drafts.' : 'Nothing has been sent.'}
          />
        ) : (
          list.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              showStatus={tab === 'all'}
              rightSlot={
                <div className="flex shrink-0 gap-1">
                  {n.status === 'pending' ? (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                        title="Approve & publish"
                        onClick={() => approve.mutate(n.id)}
                        disabled={approve.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                        title="Reject"
                        onClick={() => setRejecting(n)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete"
                      onClick={() => setDeleting(n)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              }
            />
          ))
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject notification</DialogTitle>
            <DialogDescription>
              Optionally include a reason. Visible to the volunteer who drafted it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Wording isn't appropriate; please rephrase."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={reject.isPending}
              onClick={() => rejecting && reject.mutate({ id: rejecting.id, reason: rejectReason })}
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notification</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove this notification. Participants who already saw it won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}
