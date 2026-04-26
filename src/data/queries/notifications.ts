import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { Database } from '@/data/types.gen';
import type { AppRole } from '@/domain/auth/roles';

export type NotificationStatus = Database['public']['Enums']['notification_status'];
export type NotificationTarget = Database['public']['Enums']['notification_target'];
export type TeamDomain = Database['public']['Enums']['team_domain'];

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  status: NotificationStatus;
  target_type: NotificationTarget;
  target_team_ids: string[] | null;
  target_domains: TeamDomain[] | null;
  target_user_ids: string[] | null;
  target_role: AppRole | null;
  created_by: string | null;
  creator_role: AppRole;
  creator_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  'id, title, body, status, target_type, target_team_ids, target_domains, target_user_ids, target_role, created_by, creator_role, approved_by, approved_at, rejection_reason, published_at, created_at, updated_at';

async function hydrateCreators(rows: any[]): Promise<NotificationRow[]> {
  const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)));
  let nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data, error } = await supabase.from('profiles').select('id, name').in('id', ids);
    if (error) throw error;
    nameById = new Map((data ?? []).map((p) => [p.id, p.name]));
  }
  return rows.map((r) => ({ ...r, creator_name: r.created_by ? nameById.get(r.created_by) ?? null : null }));
}

function useNotificationsRealtime() {
  const qc = useQueryClient();
  // Unique channel name per hook instance — multiple components may mount this
  // hook (admin page, participant home, participant feed) and Supabase requires
  // a unique channel name per subscription to avoid silent dedupe.
  const id = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`notifications-stream-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          qc.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, id]);
}

/** Participant-facing feed. RLS handles the targeting filter. */
export function useMyNotifications() {
  useNotificationsRealtime();
  return useQuery({
    queryKey: ['notifications', 'me'],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select(SELECT_COLS)
        .eq('status', 'approved')
        .order('published_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return hydrateCreators(data ?? []);
    },
  });
}

/** Admin queue: notifications awaiting approval. */
export function usePendingNotifications() {
  useNotificationsRealtime();
  return useQuery({
    queryKey: ['notifications', 'pending'],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select(SELECT_COLS)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return hydrateCreators(data ?? []);
    },
  });
}

/** Admin "all" tab and history. */
export function useAllNotifications() {
  useNotificationsRealtime();
  return useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select(SELECT_COLS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return hydrateCreators(data ?? []);
    },
  });
}

/** Volunteer's own drafts (approved, pending, rejected). */
export function useMyDraftNotifications(userId: string | null | undefined) {
  useNotificationsRealtime();
  return useQuery({
    queryKey: ['notifications', 'drafts', userId],
    enabled: !!userId,
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select(SELECT_COLS)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return hydrateCreators(data ?? []);
    },
  });
}
