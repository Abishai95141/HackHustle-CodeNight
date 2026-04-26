import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';

export type CreateProblemStatementInput = {
  domain: TeamDomain;
  title: string;
  body_md: string;
  display_order?: number;
  is_published?: boolean;
};

export async function createProblemStatement(input: CreateProblemStatementInput) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not signed in');
  const payload = {
    domain: input.domain,
    title: input.title.trim(),
    body_md: input.body_md,
    display_order: input.display_order ?? 1,
    is_published: input.is_published ?? false,
    created_by: user.id,
  };
  const { data, error } = await supabase
    .from('problem_statements')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export type UpdateProblemStatementPatch = Partial<{
  domain: TeamDomain;
  title: string;
  body_md: string;
  display_order: number;
  is_published: boolean;
}>;

export async function updateProblemStatement(id: string, patch: UpdateProblemStatementPatch) {
  const next: UpdateProblemStatementPatch = { ...patch };
  if (typeof patch.title === 'string') next.title = patch.title.trim();
  const { error } = await supabase.from('problem_statements').update(next).eq('id', id);
  if (error) throw error;
}

export async function togglePublishProblemStatement(id: string, value: boolean) {
  return updateProblemStatement(id, { is_published: value });
}

export async function deleteProblemStatement(id: string) {
  const { error } = await supabase.from('problem_statements').delete().eq('id', id);
  if (error) throw error;
}
