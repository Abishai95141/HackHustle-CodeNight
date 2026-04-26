import { supabase } from '@/data/client';
import type { Database } from '@/data/types.gen';

type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];

export type LogCategory = 'auth' | 'route' | 'click' | 'mutation' | 'error' | 'system';
export type LogStatus = 'ok' | 'error' | 'warn';

export type LogEvent = {
  category: LogCategory;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
  status?: LogStatus;
  error_message?: string | null;
};

// Tunables. Conservative numbers — the table is unindexed on metadata so
// we'd rather batch lots of small inserts than send big ones.
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_MAX   = 50;
const DEDUPE_WINDOW_MS  = 500;
const MAX_BUFFER        = 500;     // hard cap so a runaway page can't OOM
const SESSION_KEY       = 'hh-erp-session-id';

function detectDeviceType(ua: string): string {
  // Conservative detection — good enough for filtering. Don't pull a heavy lib.
  if (/iPad|tablet|Tablet/.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod/.test(ua)) return 'mobile';
  return 'desktop';
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'no-window';
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

class Logger {
  private buffer: LogEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private userAgent: string;
  private deviceType: string;
  private lastKey = '';
  private lastAt = 0;
  private flushing = false;
  private enabled = true;

  constructor() {
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.deviceType = detectDeviceType(this.userAgent);
    this.sessionId = getOrCreateSessionId();
    if (typeof window !== 'undefined') {
      this.startTimer();
      // Flush on tab hide (most reliable on mobile) and beforeunload (desktop).
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.flush();
      });
      window.addEventListener('beforeunload', () => {
        // Fire-and-forget — the request will be in-flight when the page tears down.
        void this.flush();
      });
    }
  }

  private startTimer() {
    if (this.timer != null) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Disable logging entirely (e.g. for tests). */
  setEnabled(v: boolean) {
    this.enabled = v;
  }

  log(event: LogEvent) {
    if (!this.enabled) return;
    if (typeof window === 'undefined') return;

    // Identical-event dedupe — kills the burst from rage-clicks or scroll
    // event spam without losing user-meaningful sequences.
    const key = `${event.category}:${event.action}:${event.resource_id ?? ''}`;
    const now = Date.now();
    if (key === this.lastKey && now - this.lastAt < DEDUPE_WINDOW_MS) return;
    this.lastKey = key;
    this.lastAt = now;

    this.buffer.push(event);
    if (this.buffer.length >= MAX_BUFFER) {
      // Hard cap: drop oldest to keep memory bounded.
      this.buffer = this.buffer.slice(-MAX_BUFFER);
    }
    if (this.buffer.length >= FLUSH_BATCH_MAX) void this.flush();
  }

  async flush() {
    if (!this.enabled) return;
    if (this.flushing) return;
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, FLUSH_BATCH_MAX);
    this.flushing = true;
    try {
      // Cast through `unknown` because Supabase's generated `Json` type is a
      // recursive union that doesn't accept `Record<string, unknown>` directly,
      // even though Postgres' jsonb column happily takes any object.
      const rows = batch.map((e) => ({
        category: e.category,
        action: e.action.slice(0, 200),
        resource_type: e.resource_type ?? null,
        resource_id: e.resource_id ?? null,
        metadata: (e.metadata ?? {}) as unknown,
        status: e.status ?? 'ok',
        error_message: e.error_message ?? null,
        user_agent: this.userAgent || null,
        device_type: this.deviceType,
        session_id: this.sessionId,
      })) as unknown as ActivityLogInsert[];
      const { error } = await supabase.from('activity_logs').insert(rows);
      if (error) {
        // Don't re-buffer on error — would create a runaway loop if the table
        // is unreachable. Log to console for dev visibility.
        console.warn('[logger] flush failed:', error.message);
      }
    } catch (err) {
      console.warn('[logger] flush threw:', err);
    } finally {
      this.flushing = false;
    }
  }
}

export const logger = new Logger();

// Convenience wrappers — keep call sites short.
export const logAuth     = (action: string, metadata?: Record<string, unknown>) =>
  logger.log({ category: 'auth', action, metadata });
export const logRoute    = (path: string, from: string | null) =>
  logger.log({ category: 'route', action: 'route_change', metadata: { from, to: path } });
export const logClick    = (action: string, metadata?: Record<string, unknown>) =>
  logger.log({ category: 'click', action, metadata });
export const logMutation = (action: string, opts?: {
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  status?: LogStatus;
  error_message?: string;
}) =>
  logger.log({ category: 'mutation', action, ...opts });
export const logError    = (action: string, message: string, metadata?: Record<string, unknown>) =>
  logger.log({ category: 'error', action, status: 'error', error_message: message, metadata });
