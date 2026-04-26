import { supabase } from '@/data/client';
import type { AppRole } from '@/domain/auth/roles';
import type { NotificationTarget, TeamDomain } from '@/data/queries/notifications';

export type CreateNotificationInput = {
  title: string;
  body: string;
  target_type: NotificationTarget;
  target_team_ids?: string[] | null;
  target_domains?: TeamDomain[] | null;
  target_user_ids?: string[] | null;
  target_role?: AppRole | null;
};

/**
 * Inserts a notification.
 *  - admins → status='approved' + published_at=now() (publishes immediately, per spec)
 *  - everyone else (volunteer) → status='pending'; admins must approve
 * The actual gating is enforced by RLS on the notifications table; this helper
 * just sets the right defaults so volunteers' RLS WITH CHECK clause passes.
 */
export async function createNotification(
  input: CreateNotificationInput,
  asRole: AppRole,
) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not signed in');

  const isAdmin = asRole === 'super_admin';
  const now = new Date().toISOString();

  const payload = {
    created_by: user.id,
    creator_role: asRole,
    title: input.title.trim(),
    body: input.body.trim(),
    target_type: input.target_type,
    target_team_ids: input.target_type === 'teams' ? input.target_team_ids ?? null : null,
    target_domains: input.target_type === 'domains' ? input.target_domains ?? null : null,
    target_user_ids: input.target_type === 'individuals' ? input.target_user_ids ?? null : null,
    target_role: input.target_type === 'role' ? input.target_role ?? null : null,
    status: isAdmin ? ('approved' as const) : ('pending' as const),
    approved_by: isAdmin ? user.id : null,
    approved_at: isAdmin ? now : null,
    published_at: isAdmin ? now : null,
  };

  const { data, error } = await supabase.from('notifications').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}

export async function approveNotification(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: now,
      published_at: now,
      rejection_reason: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectNotification(id: string, reason: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('notifications')
    .update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: reason.trim() || null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}
