import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';
import { v2Rubrics, type RubricKey } from '@/domain/scoring/rules';

const SCORE_COLS = v2Rubrics.map((r) => r.column).join(', ');

export type JudgeProfile = {
  id: string;
  name: string;
  email: string;
};

/** All users with the 'judge' role. Two-step lookup since user_roles is the source of truth. */
export function useJudges() {
  return useQuery({
    queryKey: ['admin', 'judges'],
    queryFn: async (): Promise<JudgeProfile[]> => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'judge');
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', ids);
      if (pErr) throw pErr;
      return profiles ?? [];
    },
  });
}

export type JudgeAssignment = {
  judge_id: string;
  team_id: string;
  round_name: string;
};

export function useJudgeAssignments() {
  return useQuery({
    queryKey: ['admin', 'judge-assignments'],
    queryFn: async (): Promise<JudgeAssignment[]> => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select('judge_id, team_id, round_name');
      if (error) throw error;
      return (data ?? []) as JudgeAssignment[];
    },
  });
}

export type ScoreRow = Partial<Record<`score_${RubricKey}`, number | null>> & {
  total_score: number | null;
  notes: string | null;
};

export type AssignedTeam = {
  id: string;
  team_name: string;
  team_code: string;
  table_number: string | null;
  domain: TeamDomain | null;
  round_name: string;
  score: ScoreRow | null;
};

export function useMyAssignedTeams(judgeId: string | undefined) {
  return useQuery({
    queryKey: ['judge', 'assignments', judgeId],
    enabled: !!judgeId,
    queryFn: async (): Promise<AssignedTeam[]> => {
      if (!judgeId) return [];
      const [aRes, sRes] = await Promise.all([
        supabase
          .from('judge_assignments')
          .select('round_name, team:teams(id, team_name, team_code, table_number, domain)')
          .eq('judge_id', judgeId),
        supabase
          .from('judge_scores')
          .select(`team_id, round_name, notes, total_score, ${SCORE_COLS}`)
          .eq('judge_id', judgeId),
      ]);
      if (aRes.error) throw aRes.error;
      if (sRes.error) throw sRes.error;

      const scores = new Map<string, ScoreRow>();
      // The dynamic SELECT (template-string column list) defeats PostgREST's
      // TypeScript inference, so we cast through unknown to a permissive shape
      // and read the columns the rubric tells us about.
      for (const s of (sRes.data ?? []) as unknown as Array<Record<string, unknown>>) {
        const key = `${s.team_id as string}:${s.round_name as string}`;
        const row: ScoreRow = {
          total_score: (s.total_score as number) ?? null,
          notes: (s.notes as string) ?? null,
        };
        for (const r of v2Rubrics) {
          (row as Record<string, unknown>)[r.column] = (s[r.column] as number | null) ?? null;
        }
        scores.set(key, row);
      }

      return (aRes.data ?? [])
        .filter((a) => a.team)
        .map((a) => {
          const team = a.team as unknown as {
            id: string;
            team_name: string;
            team_code: string;
            table_number: string | null;
            domain: TeamDomain | null;
          };
          return {
            ...team,
            round_name: a.round_name,
            score: scores.get(`${team.id}:${a.round_name}`) ?? null,
          };
        });
    },
  });
}

/** Per-domain leaderboard. Returns teams sorted by total_score desc, grouped by domain. */
export type RankingRow = {
  id: string;
  team_name: string;
  team_code: string;
  table_number: string | null;
  domain: TeamDomain | null;
  total_score: number;
};

export function useRankingsByDomain() {
  return useQuery({
    queryKey: ['admin', 'rankings'],
    queryFn: async (): Promise<RankingRow[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, team_code, table_number, domain, total_score')
        .order('total_score', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        team_name: t.team_name,
        team_code: t.team_code,
        table_number: t.table_number,
        domain: t.domain as TeamDomain | null,
        total_score: Number(t.total_score ?? 0),
      }));
    },
  });
}
