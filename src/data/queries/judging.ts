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

/** Per-team scoring completion for the active round. Drives the Status tab on
 *  AdminJudgingPage so the admin can see at a glance which teams still need
 *  judges to score them. */
export type JudgingStatus = 'unassigned' | 'not_started' | 'partial' | 'complete';

export type JudgingStatusRow = {
  team: { id: string; team_name: string; team_code: string; domain: TeamDomain | null };
  assignedJudges: { id: string; name: string; scored: boolean }[];
  status: JudgingStatus;
};

export function useJudgingStatus(roundName: string) {
  return useQuery({
    queryKey: ['admin', 'judging-status', roundName],
    queryFn: async (): Promise<{
      rows: JudgingStatusRow[];
      counts: Record<JudgingStatus, number>;
    }> => {
      // Pull what we need: every team, the assignment table for this round,
      // every judge row (so we can resolve names), and which (judge, team)
      // pairs have at least one score.
      const [teamsRes, assignsRes, scoresRes, judgeRolesRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id, team_name, team_code, domain')
          .order('team_name'),
        supabase
          .from('judge_assignments')
          .select('judge_id, team_id, round_name')
          .eq('round_name', roundName),
        supabase
          .from('judge_scores')
          .select('judge_id, team_id, round_name')
          .eq('round_name', roundName),
        supabase.from('user_roles').select('user_id, role').eq('role', 'judge'),
      ]);
      if (teamsRes.error) throw teamsRes.error;
      if (assignsRes.error) throw assignsRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (judgeRolesRes.error) throw judgeRolesRes.error;

      // Resolve judge names for every assigned judge.
      const judgeIds = Array.from(
        new Set([
          ...(assignsRes.data ?? []).map((a) => a.judge_id),
          ...(judgeRolesRes.data ?? []).map((r) => r.user_id),
        ]),
      );
      let nameById = new Map<string, string>();
      if (judgeIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', judgeIds);
        if (error) throw error;
        nameById = new Map((data ?? []).map((p) => [p.id, p.name]));
      }

      const scoredKey = new Set<string>();
      for (const s of scoresRes.data ?? []) scoredKey.add(`${s.judge_id}:${s.team_id}`);

      // Group assignments by team.
      const assignedByTeam = new Map<string, string[]>();
      for (const a of assignsRes.data ?? []) {
        const arr = assignedByTeam.get(a.team_id) ?? [];
        arr.push(a.judge_id);
        assignedByTeam.set(a.team_id, arr);
      }

      const counts: Record<JudgingStatus, number> = {
        unassigned: 0,
        not_started: 0,
        partial: 0,
        complete: 0,
      };

      const rows: JudgingStatusRow[] = (teamsRes.data ?? []).map((t) => {
        const judgeIdsForTeam = assignedByTeam.get(t.id) ?? [];
        const assignedJudges = judgeIdsForTeam.map((jid) => ({
          id: jid,
          name: nameById.get(jid) ?? '—',
          scored: scoredKey.has(`${jid}:${t.id}`),
        }));
        let status: JudgingStatus;
        if (assignedJudges.length === 0) status = 'unassigned';
        else {
          const scoredCount = assignedJudges.filter((j) => j.scored).length;
          if (scoredCount === 0) status = 'not_started';
          else if (scoredCount < assignedJudges.length) status = 'partial';
          else status = 'complete';
        }
        counts[status]++;
        return {
          team: {
            id: t.id,
            team_name: t.team_name,
            team_code: t.team_code,
            domain: t.domain as TeamDomain | null,
          },
          assignedJudges,
          status,
        };
      });

      return { rows, counts };
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
