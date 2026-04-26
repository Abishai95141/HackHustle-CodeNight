import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { AppRole } from '@/domain/auth/roles';

export type LogCategory = 'auth' | 'route' | 'click' | 'mutation' | 'error' | 'system';
export type LogStatus = 'ok' | 'error' | 'warn';

export type ActivityLogRow = {
  id: string;
  occurred_at: string;
  user_id: string | null;
  user_role: AppRole | null;
  user_email: string | null;
  user_name: string | null;
  category: LogCategory;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: LogStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
  device_type: string | null;
  session_id: string | null;
};

export type ActivityLogFilters = {
  from?: Date | null;
  to?: Date | null;
  categories?: LogCategory[];
  status?: LogStatus | 'all';
  userId?: string | null;
  search?: string;            // matches action and metadata
  pageSize?: number;          // default 200, capped at 1000
};

const COLS =
  'id, occurred_at, user_id, user_role, user_email, user_name, category, action, resource_type, resource_id, status, error_message, metadata, user_agent, device_type, session_id';

export function useActivityLogs(filters: ActivityLogFilters) {
  const pageSize = Math.min(filters.pageSize ?? 200, 1000);
  return useQuery({
    queryKey: [
      'admin', 'logs',
      filters.from?.toISOString() ?? null,
      filters.to?.toISOString() ?? null,
      [...(filters.categories ?? [])].sort().join(','),
      filters.status ?? 'all',
      filters.userId ?? '',
      filters.search ?? '',
      pageSize,
    ],
    queryFn: async (): Promise<ActivityLogRow[]> => {
      let q = supabase
        .from('activity_logs')
        .select(COLS)
        .order('occurred_at', { ascending: false })
        .limit(pageSize);

      if (filters.from) q = q.gte('occurred_at', filters.from.toISOString());
      if (filters.to) q = q.lte('occurred_at', filters.to.toISOString());
      if (filters.categories && filters.categories.length > 0) {
        q = q.in('category', filters.categories);
      }
      if (filters.status && filters.status !== 'all') {
        q = q.eq('status', filters.status);
      }
      if (filters.userId) q = q.eq('user_id', filters.userId);
      if (filters.search) {
        // Match the action verbatim or a substring; also a JSON contains check
        // against metadata keys via PostgREST's `or`.
        q = q.or(`action.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ActivityLogRow[];
    },
  });
}

/** Aggregate counts by category for the page's stat strip. */
export function useActivityLogStats(filters: Pick<ActivityLogFilters, 'from' | 'to'>) {
  return useQuery({
    queryKey: ['admin', 'logs-stats', filters.from?.toISOString() ?? null, filters.to?.toISOString() ?? null],
    queryFn: async () => {
      // Pull only the `category` + `status` columns within window — the heaviest
      // category here (clicks) is bounded by the client batching; the dashboard
      // doesn't need a server-side aggregation function for this scale.
      let q = supabase
        .from('activity_logs')
        .select('category, status')
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (filters.from) q = q.gte('occurred_at', filters.from.toISOString());
      if (filters.to) q = q.lte('occurred_at', filters.to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      const counts = { auth: 0, route: 0, click: 0, mutation: 0, error: 0, system: 0 } as Record<LogCategory, number>;
      let errors = 0;
      for (const row of data ?? []) {
        counts[row.category as LogCategory]++;
        if (row.status !== 'ok') errors++;
      }
      return { counts, total: (data ?? []).length, errors };
    },
  });
}
