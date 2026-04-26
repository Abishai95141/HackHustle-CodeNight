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
 * Shown to participants the first time they land while the browser permission
 * is in `default` state. Hidden after the user grants, denies, or dismisses.
 * Sits inline above the QR card on the home page so it follows the natural
 * top-down reading flow.
 */
export function EnableNotificationsBanner() {
  const [permission, setPermission] = useState<BrowserPermission>(() => getPermission());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });
  const [busy, setBusy] = useState(false);

  // If permission flips while the page is open (e.g. user changes site
  // settings in another tab), reflect the new state without a refresh.
  useEffect(() => {
    if (!isSupported()) return;
    const onFocus = () => setPermission(getPermission());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (!isSupported()) return null;
  if (permission !== 'default') return null;
  if (dismissed) return null;

  async function enable() {
    setBusy(true);
    const result = await requestPermission();
    setPermission(result);
    setBusy(false);
    if (result === 'granted') {
      toast.success('Notifications enabled');
      // Fire a confirmation OS popup so the user sees proof their device
      // will actually surface them — useful for spotting browser/OS quirks
      // (focus-assist, do-not-disturb) before the first real notification.
      notify('Notifications enabled', {
        body: 'You’ll see event updates here even when this tab is in the background.',
        tag: 'hh-erp-test',
      });
    } else if (result === 'denied') {
      toast.message('Notifications blocked. You can re-enable them in your browser settings.');
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore quota / privacy-mode failures
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
          Allow notifications to hear about meals, judging, and announcements even when this tab
          is in the background.
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
