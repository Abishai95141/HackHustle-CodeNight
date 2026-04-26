import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';

export type SubmissionRow = {
  id: string;
  team_id: string;
  github_url: string | null;
  deck_path: string | null;
  deck_filename: string | null;
  deck_mime: string | null;
  deck_size_bytes: number | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const COLS =
  'id, team_id, github_url, deck_path, deck_filename, deck_mime, deck_size_bytes, updated_by, created_at, updated_at';

function useSubmissionRealtime(invalidate: () => void) {
  const id = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`submissions-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, invalidate]);
}

/** The participant's own team submission (RLS limits to user_team_id). */
export function useTeamSubmission(teamId: string | null | undefined) {
  const qc = useQueryClient();
  useSubmissionRealtime(() => {
    qc.invalidateQueries({ queryKey: ['submission', teamId] });
  });
  return useQuery({
    queryKey: ['submission', teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<SubmissionRow | null> => {
      if (!teamId) return null;
      const { data, error } = await supabase
        .from('submissions')
        .select(COLS)
        .eq('team_id', teamId)
        .maybeSingle();
      if (error) throw error;
      return (data as SubmissionRow | null) ?? null;
    },
  });
}

/** Admin-side: every team's submission (joined with team meta). */
export type SubmissionWithTeam = SubmissionRow & {
  team: { id: string; team_name: string; team_code: string; domain: string | null };
};

export function useAllSubmissions() {
  const qc = useQueryClient();
  useSubmissionRealtime(() => {
    qc.invalidateQueries({ queryKey: ['admin', 'submissions'] });
  });
  return useQuery({
    queryKey: ['admin', 'submissions'],
    queryFn: async (): Promise<SubmissionWithTeam[]> => {
      const { data, error } = await supabase
        .from('submissions')
        .select(`${COLS}, team:teams(id, team_name, team_code, domain)`)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SubmissionWithTeam[];
    },
  });
}
