import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';

/**
 * Upserts a winner slot. The (domain, rank) pair is the natural key — the
 * row was pre-seeded by 0012, so this is effectively an UPDATE. We use upsert
 * defensively in case anyone ever rebuilds the table.
 */
export async function upsertWinner(input: {
  domain: TeamDomain;
  rank: 1 | 2;
  teamId: string | null;
  citation: string | null;
}) {
  const { error } = await supabase
    .from('winners')
    .upsert(
      {
        domain: input.domain,
        rank: input.rank,
        team_id: input.teamId,
        citation: input.citation,
      },
      { onConflict: 'domain,rank' },
    );
  if (error) throw error;
}

export async function clearWinner(domain: TeamDomain, rank: 1 | 2) {
  const { error } = await supabase
    .from('winners')
    .update({ team_id: null, citation: null })
    .eq('domain', domain)
    .eq('rank', rank);
  if (error) throw error;
}
