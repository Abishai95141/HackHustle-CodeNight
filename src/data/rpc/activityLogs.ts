import { supabase } from '@/data/client';

export type PurgeMode = 'all' | 'older_than_24h' | 'older_than_7d' | 'older_than_30d';

export async function purgeActivityLogs(mode: PurgeMode): Promise<{ deleted: number }> {
  // PostgREST DELETE requires a WHERE clause — for the all-rows variant we use
  // a tautology on the never-null id column.
  let q = supabase.from('activity_logs').delete({ count: 'exact' });

  if (mode === 'all') {
    q = q.not('id', 'is', null);
  } else {
    const ms = mode === 'older_than_24h'
      ? 24 * 60 * 60 * 1000
      : mode === 'older_than_7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
    const before = new Date(Date.now() - ms).toISOString();
    q = q.lt('occurred_at', before);
  }

  const { count, error } = await q;
  if (error) throw error;
  return { deleted: count ?? 0 };
}
