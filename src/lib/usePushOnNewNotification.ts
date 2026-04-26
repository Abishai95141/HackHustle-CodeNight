import { useEffect, useId, useRef } from 'react';
import { supabase } from '@/data/client';
import { notify, getPermission } from '@/lib/browserNotifications';

/**
 * Listens for newly-published notifications and fires a desktop popup when
 * one targets the current user. RLS still gates which rows are visible, so we
 * trust whatever the realtime stream gives us.
 *
 * Mounted once at the participant shell so it runs everywhere they navigate.
 */
export function usePushOnNewNotification(userId: string | undefined) {
  const id = useId();
  // Avoid firing the same notification twice if realtime delivers duplicate
  // events (e.g. INSERT + UPDATE-to-approved on the same row).
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    if (getPermission() !== 'granted') return;

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
          // Don't replay history — only notify for things that were just
          // published (within the last 2 minutes).
          const age = Date.now() - new Date(row.published_at).getTime();
          if (age > 2 * 60_000) return;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);
          notify(row.title, {
            body: row.body,
            tag: row.id,
            url: '/me/notifications',
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, id]);
}
