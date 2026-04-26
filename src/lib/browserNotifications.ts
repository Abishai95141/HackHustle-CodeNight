// Thin wrapper around the Notification Web API.
//
// Mobile browsers (Android Chrome, iOS Safari PWA) require notifications to
// be fired via a service worker's showNotification() and refuse the direct
// `new Notification(...)` constructor. Desktop browsers accept either, but
// using the SW path everywhere keeps behavior consistent.

export type BrowserPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const SW_URL = '/sw.js';
let swRegistration: ServiceWorkerRegistration | null = null;
let swRegistering: Promise<ServiceWorkerRegistration | null> | null = null;

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
 * Registers the notification service worker (idempotent). Resolves to the
 * registration or null if SWs aren't available (e.g. http://, private mode).
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (swRegistration) return swRegistration;
  if (swRegistering) return swRegistering;
  swRegistering = navigator.serviceWorker
    .register(SW_URL)
    .then(async (reg) => {
      // Wait until it's actually active — showNotification() throws otherwise
      // if called milliseconds after register().
      if (reg.active) {
        swRegistration = reg;
        return reg;
      }
      await new Promise<void>((resolve) => {
        const w = reg.installing || reg.waiting;
        if (!w) return resolve();
        w.addEventListener('statechange', () => {
          if (w.state === 'activated') resolve();
        });
      });
      swRegistration = reg;
      return reg;
    })
    .catch((err) => {
      console.warn('[push] service worker registration failed', err);
      return null;
    });
  return swRegistering;
}

/**
 * Prompts the user. Must be called from a user gesture handler. Also kicks
 * off SW registration so the first notify() after grant doesn't race.
 */
export async function requestPermission(): Promise<BrowserPermission> {
  const N = api();
  if (!N) return 'unsupported';
  if (N.permission === 'granted') {
    void ensureServiceWorker();
    return 'granted';
  }
  if (N.permission === 'denied') return 'denied';
  try {
    const result = await N.requestPermission();
    if (result === 'granted') void ensureServiceWorker();
    return result;
  } catch {
    return N.permission;
  }
}

export type NotifyOptions = {
  body?: string;
  tag?: string;
  url?: string;
  icon?: string;
};

/**
 * Fires a notification. Resolves to true if shown (or queued), false if
 * permission is missing or both delivery paths failed. Tries the service
 * worker first (works on desktop AND mobile), then falls back to the direct
 * constructor for old browsers without SW support.
 */
export async function notify(title: string, opts: NotifyOptions = {}): Promise<boolean> {
  const N = api();
  if (!N || N.permission !== 'granted') return false;

  const payload: NotificationOptions = {
    body: opts.body,
    tag: opts.tag,
    icon: opts.icon ?? '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: opts.url ?? '/me/notifications' },
  };

  try {
    const reg = await ensureServiceWorker();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, payload);
      return true;
    }
  } catch (err) {
    console.warn('[push] sw showNotification failed, falling back', err);
  }

  // Desktop fallback when no SW is available.
  try {
    const n = new N(title, payload);
    if (opts.url) {
      n.onclick = () => {
        try {
          window.focus();
          window.location.href = opts.url!;
        } catch {
          // ignore
        }
        n.close();
      };
    }
    return true;
  } catch (err) {
    console.warn('[push] Notification constructor refused', err);
    return false;
  }
}
