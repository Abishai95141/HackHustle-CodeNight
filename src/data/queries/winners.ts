import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';

export type WinnerRow = {
  id: string;
  domain: TeamDomain;
  rank: number; // 1 or 2
  team_id: string | null;
  citation: string | null;
  team: {
    id: string;
    team_name: string;
    team_code: string;
    table_number: string | null;
  } | null;
  updated_at: string;
};

const COLS =
  'id, domain, rank, team_id, citation, updated_at, team:teams(id, team_name, team_code, table_number)';

function useWinnersRealtime(invalidate: () => void) {
  const id = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`winners-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'winners' },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, invalidate]);
}

/** Fetches every winner slot (admin sees all 6 rows; non-admins only see them
 *  when winners_announced is true — RLS handles that gate server-side). */
export function useWinners() {
  const qc = useQueryClient();
  useWinnersRealtime(() => {
    qc.invalidateQueries({ queryKey: ['winners'] });
  });
  return useQuery({
    queryKey: ['winners'],
    queryFn: async (): Promise<WinnerRow[]> => {
      const { data, error } = await supabase
        .from('winners')
        .select(COLS)
        .order('domain', { ascending: true })
        .order('rank', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WinnerRow[];
    },
  });
}
