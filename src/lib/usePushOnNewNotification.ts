import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useMyNotifications } from '@/data/queries/notifications';
import { notify, getPermission } from '@/lib/browserNotifications';

const SEEN_KEY = 'hh-erp:notify-seen-ids';
const MAX_AGE_MS = 5 * 60_000;

function loadSeen(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>) {
  try {
    // Cap to last 200 ids so this can't grow forever.
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/**
 * Watches the participant's in-app notification feed (which already has
 * working realtime via useMyNotifications) and fires an OS-level push for
 * any newly-published row. Falls back to an in-app toast when the OS
 * notification can't be shown.
 *
 * Piggybacking on the existing query avoids a second realtime channel and
 * the auth/RLS race conditions that come with it.
 */
export function usePushOnNewNotification(userId: string | undefined) {
  const { data } = useMyNotifications();
  const seenRef = useRef<Set<string> | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (!data) return;

    // First load just records the existing ids so we don't spam the user
    // with a popup for every historical notification on every page load.
    if (!primedRef.current) {
      seenRef.current = loadSeen();
      for (const n of data) seenRef.current.add(n.id);
      saveSeen(seenRef.current);
      primedRef.current = true;
      return;
    }

    const seen = seenRef.current!;
    const fresh = data.filter((n) => {
      if (seen.has(n.id)) return false;
      if (!n.published_at) return false;
      const age = Date.now() - new Date(n.published_at).getTime();
      return age <= MAX_AGE_MS;
    });
    if (fresh.length === 0) return;

    for (const n of fresh) {
      seen.add(n.id);
      const fired = notify(n.title, {
        body: n.body,
        tag: n.id,
        url: '/me/notifications',
      });
      if (!fired || getPermission() !== 'granted') {
        toast.message(n.title, {
          description: n.body,
          duration: 8000,
          action: {
            label: 'Open',
            onClick: () => {
              window.location.href = '/me/notifications';
            },
          },
        });
      }
    }
    saveSeen(seen);
  }, [data, userId]);
}
