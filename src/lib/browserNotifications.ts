// Thin wrapper around the Notification Web API.
// The browser already enforces user gesture + per-origin permission state, so
// this module only deals with feature-detection and a few small ergonomics:
//   - never throw on unsupported browsers (Safari iOS pre-16.4, in-app webviews)
//   - remember the last permission so callers can branch without prompting
//   - de-dupe notifications by tag so realtime bursts don't stack 5 popups

export type BrowserPermission = 'granted' | 'denied' | 'default' | 'unsupported';

function api(): typeof Notification | null {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  return window.Notification;
}

export function isSupported(): boolean {
  return api() !== null;
}

export function getPermission(): BrowserPermission {
  const N = api();
  if (!N) return 'unsupported';
  return N.permission;
}

/**
 * Prompts the user. Must be called from inside a user gesture handler — modern
 * browsers reject silent prompts. Resolves to the resulting permission.
 */
export async function requestPermission(): Promise<BrowserPermission> {
  const N = api();
  if (!N) return 'unsupported';
  if (N.permission === 'granted' || N.permission === 'denied') return N.permission;
  try {
    const result = await N.requestPermission();
    return result;
  } catch {
    return N.permission;
  }
}

export type NotifyOptions = {
  body?: string;
  tag?: string;
  /** href to navigate to when the user clicks the notification. */
  url?: string;
  icon?: string;
};

/**
 * Fires a desktop notification if permission is already granted. No-op
 * otherwise — callers should not rely on the return value to drive UI state,
 * the in-app inbox is still the source of truth.
 */
export function notify(title: string, opts: NotifyOptions = {}): Notification | null {
  const N = api();
  if (!N || N.permission !== 'granted') return null;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    // Tab is foregrounded — the in-app toast/feed is enough; skip the OS popup
    // so users aren't doubly notified.
    return null;
  }
  try {
    const n = new N(title, {
      body: opts.body,
      tag: opts.tag,
      icon: opts.icon ?? '/favicon.ico',
      badge: '/favicon.ico',
    });
    if (opts.url) {
      n.onclick = () => {
        try {
          window.focus();
          window.location.href = opts.url!;
        } catch {
          // ignore — popup blockers can intercept
        }
        n.close();
      };
    }
    return n;
  } catch {
    return null;
  }
}
