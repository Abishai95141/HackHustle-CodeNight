import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logClick, logError, logRoute } from '@/lib/logger';

/**
 * Wraps the app with the side-effect installation needed to feed the logger:
 *  - route change observer
 *  - global click capture (only on actionable elements; deduped)
 *  - window error + unhandledrejection handlers
 *
 * Mounted inside <BrowserRouter> so useLocation works.
 */
export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  // Route changes
  useEffect(() => {
    const next = location.pathname + (location.search ?? '');
    if (lastPath.current !== next) {
      logRoute(next, lastPath.current);
      lastPath.current = next;
    }
  }, [location.pathname, location.search]);

  // Global click capture
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Only fire for actionable elements — buttons, links, anything ARIA-labelled
      // as a button, or anything explicitly tagged with data-log. Random clicks
      // on plain text/divs are noise.
      const el = t.closest(
        'button, a[href], [role="button"], [data-log]',
      ) as HTMLElement | null;
      if (!el) return;

      // Pull a human label in priority order: data-log > aria-label > inner text > tag.
      const tag = el.tagName.toLowerCase();
      const label =
        el.getAttribute('data-log') ??
        el.getAttribute('aria-label') ??
        (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) ??
        tag;

      const meta: Record<string, unknown> = {
        tag,
        path: window.location.pathname,
      };
      if (el instanceof HTMLAnchorElement && el.href) meta.href = el.href;
      if (el.id) meta.id = el.id;

      logClick(`${tag}:${label || 'unknown'}`, meta);
    }
    // capture: true so we see clicks even on stopPropagation handlers.
    window.addEventListener('click', onClick, { capture: true });
    return () => window.removeEventListener('click', onClick, { capture: true });
  }, []);

  // Unhandled errors
  useEffect(() => {
    function onError(e: ErrorEvent) {
      logError('window.error', e.message ?? 'unknown', {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    }
    function onRejection(e: PromiseRejectionEvent) {
      const r = e.reason;
      const message = (r && typeof r === 'object' && 'message' in r ? String(r.message) : String(r)) || 'unknown';
      logError('unhandledrejection', message);
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return <>{children}</>;
}
