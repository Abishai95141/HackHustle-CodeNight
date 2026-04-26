import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getPermission,
  isSupported,
  notify,
  requestPermission,
  type BrowserPermission,
} from '@/lib/browserNotifications';

const DISMISS_KEY = 'hh-erp:notify-banner-dismissed';

/**
 * Lets the participant turn on browser pushes and verify the OS path with
 * a one-click test. Shown until they've granted permission OR explicitly
 * dismissed; once granted, collapses into a slim "verified" state with a
 * Test button so they can re-check at any time.
 */
export function EnableNotificationsBanner() {
  const [permission, setPermission] = useState<BrowserPermission>(() => getPermission());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported()) return;
    const onFocus = () => setPermission(getPermission());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (!isSupported()) {
    return (
      <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-2xs text-amber-700 dark:text-amber-300">
        Browser notifications aren't supported here. On iPhone, add this site to your Home
        Screen first to enable them.
      </div>
    );
  }

  // Granted: keep a slim test button visible so the user can verify any time.
  if (permission === 'granted') {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-2xs">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <Bell className="h-3.5 w-3.5" />
          <span>Notifications are on for this device.</span>
        </div>
        <button
          type="button"
          onClick={sendTest}
          className="rounded-md border border-emerald-500/40 px-2 py-1 text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          Send a test
        </button>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-2xs text-rose-700 dark:text-rose-300">
        Notifications are blocked for this site. Click the lock icon in the address bar →
        Notifications → Allow, then reload this page.
      </div>
    );
  }

  if (dismissed) return null;

  async function enable() {
    setBusy(true);
    const result = await requestPermission();
    setPermission(result);
    setBusy(false);
    if (result === 'granted') {
      toast.success('Notifications enabled');
      sendTest();
    } else if (result === 'denied') {
      toast.message('Notifications blocked. Re-enable them in your browser settings.');
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium leading-snug">Get event updates instantly</div>
        <p className="text-2xs text-muted-foreground">
          Allow notifications to hear about meals, judging, and announcements even when this
          tab is in the background.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-2xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Asking…' : 'Enable notifications'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-2xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

async function sendTest() {
  const fired = await notify('Test notification', {
    body: 'If you see this in your notification centre, push is working.',
    tag: 'hh-erp-test',
  });
  if (!fired) {
    toast.message('Test notification', {
      description:
        'Browser refused to show the OS popup. Check Do-Not-Disturb / Focus / browser site settings.',
      duration: 8000,
    });
  } else {
    toast.success('Test sent — check your notification centre.');
  }
}
