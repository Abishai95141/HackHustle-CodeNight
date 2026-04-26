import { useEffect, useId, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/data/client';
import { notify, getPermission } from '@/lib/browserNotifications';

/**
 * Listens for newly-published notifications targeting the current user.
 * Always subscribes (so granting permission later still works without a
 * refresh) — checks permission inside the handler. Falls back to an in-app
 * toast when the OS-level popup can't fire (no permission, or unsupported).
 */
export function usePushOnNewNotification(userId: string | undefined) {
  const id = useId();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`push-notify-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | {
                id: string;
                title: string;
                body: string;
                status: string;
                published_at: string | null;
              }
            | null;
          if (!row || row.status !== 'approved') return;
          if (!row.published_at) return;
          const age = Date.now() - new Date(row.published_at).getTime();
          if (age > 2 * 60_000) return;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);

          const fired = notify(row.title, {
            body: row.body,
            tag: row.id,
            url: '/me/notifications',
          });
          // If we couldn't fire the OS-level popup (no permission, iOS
          // Safari outside a PWA, etc.), surface an in-app toast so the
          // user still gets immediate feedback.
          if (!fired || getPermission() !== 'granted') {
            toast.message(row.title, {
              description: row.body,
              action: {
                label: 'Open',
                onClick: () => {
                  window.location.href = '/me/notifications';
                },
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, id]);
}
