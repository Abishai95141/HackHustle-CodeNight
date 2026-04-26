import { supabase } from '@/data/client';
import type { Database } from '@/data/types.gen';
import type { ScoreSheet } from '@/domain/scoring/rules';
import { v2Rubrics } from '@/domain/scoring/rules';

type JudgeScoreInsert = Database['public']['Tables']['judge_scores']['Insert'];

export async function upsertScore(input: {
  judgeId: string;
  teamId: string;
  roundName: string;
  sheet: ScoreSheet;
  notes?: string | null;
}) {
  // We assemble columns dynamically from the rubric, then cast back to the
  // typed Insert via unknown — PostgREST's generic types can't follow a
  // computed key set but the column names match the schema 1:1.
  const dyn: Record<string, unknown> = {
    judge_id: input.judgeId,
    team_id: input.teamId,
    round_name: input.roundName,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  for (const r of v2Rubrics) {
    dyn[r.column] = input.sheet[r.key] ?? null;
  }
  const payload = dyn as unknown as JudgeScoreInsert;
  const { error } = await supabase
    .from('judge_scores')
    .upsert(payload, { onConflict: 'judge_id,team_id,round_name' });
  if (error) throw error;
}

/** Add multiple team→judge assignments at once (idempotent thanks to UNIQUE). */
export async function assignTeamsToJudge(input: {
  judgeId: string;
  teamIds: string[];
  roundName: string;
}) {
  if (input.teamIds.length === 0) return { inserted: 0 };
  const rows = input.teamIds.map((tid) => ({
    judge_id: input.judgeId,
    team_id: tid,
    round_name: input.roundName,
  }));
  // upsert with ignoreDuplicates=true so re-assigning is a no-op (no error toast spam).
  const { error, count } = await supabase
    .from('judge_assignments')
    .upsert(rows, { onConflict: 'judge_id,team_id,round_name', ignoreDuplicates: true, count: 'exact' });
  if (error) throw error;
  return { inserted: count ?? 0 };
}

export async function unassignTeamFromJudge(input: {
  judgeId: string;
  teamId: string;
  roundName: string;
}) {
  const { error } = await supabase
    .from('judge_assignments')
    .delete()
    .eq('judge_id', input.judgeId)
    .eq('team_id', input.teamId)
    .eq('round_name', input.roundName);
  if (error) throw error;
}
