import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';

export type ProblemStatementRow = {
  id: string;
  domain: TeamDomain;
  title: string;
  body_md: string;
  is_published: boolean;
  display_order: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLS =
  'id, domain, title, body_md, is_published, display_order, created_by, created_at, updated_at';

function useProblemStatementsRealtime(invalidate: () => void) {
  const id = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`problem-statements-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'problem_statements' },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, invalidate]);
}

/** Admin/staff: every row. Sorted (domain, display_order, created_at). */
export function useProblemStatements() {
  const qc = useQueryClient();
  useProblemStatementsRealtime(() => {
    qc.invalidateQueries({ queryKey: ['problem-statements'] });
  });
  return useQuery({
    queryKey: ['problem-statements', 'all'],
    queryFn: async (): Promise<ProblemStatementRow[]> => {
      const { data, error } = await supabase
        .from('problem_statements')
        .select(SELECT_COLS)
        .order('domain', { ascending: true })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProblemStatementRow[];
    },
  });
}

/**
 * Participant feed. RLS limits the rows to (is_published AND domain = team's domain),
 * so we don't need to filter client-side. Realtime invalidates on any change so
 * unlock/lock and edits propagate within ~1s.
 */
export function useMyProblemStatements() {
  const qc = useQueryClient();
  useProblemStatementsRealtime(() => {
    qc.invalidateQueries({ queryKey: ['problem-statements', 'me'] });
  });
  return useQuery({
    queryKey: ['problem-statements', 'me'],
    queryFn: async (): Promise<ProblemStatementRow[]> => {
      const { data, error } = await supabase
        .from('problem_statements')
        .select(SELECT_COLS)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProblemStatementRow[];
    },
  });
}
