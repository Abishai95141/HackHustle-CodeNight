import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';

export type MealSession = {
  id: string;
  meal_type: string;
  display_name: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
  claimed: number;
};

export function useMealSessions() {
  return useQuery({
    queryKey: ['admin', 'meals'],
    queryFn: async (): Promise<MealSession[]> => {
      const [sessionsRes, txRes] = await Promise.all([
        supabase.from('meal_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('meal_transactions').select('meal_type'),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (txRes.error) throw txRes.error;
      const counts = new Map<string, number>();
      for (const t of txRes.data ?? []) counts.set(t.meal_type, (counts.get(t.meal_type) ?? 0) + 1);
      return (sessionsRes.data ?? []).map((s) => ({ ...s, claimed: counts.get(s.meal_type) ?? 0 }));
    },
  });
}

export function useActiveMealSessions() {
  return useQuery({
    queryKey: ['meals', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_sessions')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** One row per participant for the given meal session — claimed_at is null
 *  if they haven't scanned yet. Drives the admin "who's claimed / who hasn't"
 *  drill-down. Live-updates on meal_transactions inserts. */

export type MealRosterRow = {
  id: string;
  name: string;
  email: string;
  team: { team_name: string; team_code: string; domain: TeamDomain | null } | null;
  claimed_at: string | null;
  scanned_by_id: string | null;
  scanned_by_name: string | null;
};

export function useMealRoster(mealType: string | null | undefined) {
  const qc = useQueryClient();
  const id = useId();

  // Realtime: when a volunteer scans (insert into meal_transactions), the
  // roster's "claimed" count and the per-row status need to refresh.
  useEffect(() => {
    if (!mealType) return;
    const channel = supabase
      .channel(`meal-roster-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_transactions' },
        () => qc.invalidateQueries({ queryKey: ['admin', 'meal-roster', mealType] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, mealType, qc]);

  return useQuery({
    queryKey: ['admin', 'meal-roster', mealType],
    enabled: !!mealType,
    queryFn: async (): Promise<MealRosterRow[]> => {
      if (!mealType) return [];

      // Pull every participant (role=participant, not absent) + a join on team.
      const [profilesRes, rolesRes, txRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, email, attendance_status, team:teams(team_name, team_code, domain)')
          .neq('attendance_status', 'absent')
          .order('name'),
        supabase.from('user_roles').select('user_id, role').eq('role', 'participant'),
        supabase
          .from('meal_transactions')
          .select('user_id, timestamp, scanned_by_staff_id')
          .eq('meal_type', mealType),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (txRes.error) throw txRes.error;

      const participantIds = new Set((rolesRes.data ?? []).map((r) => r.user_id));
      const claimByUser = new Map<string, { ts: string; by: string | null }>();
      for (const t of txRes.data ?? []) {
        claimByUser.set(t.user_id, { ts: t.timestamp ?? '', by: t.scanned_by_staff_id });
      }

      // Resolve scanner names in one shot (small set — only as many distinct
      // staff as actually scanned this session).
      const scannerIds = Array.from(
        new Set(Array.from(claimByUser.values()).map((v) => v.by).filter((v): v is string => !!v)),
      );
      let scannerNameById = new Map<string, string>();
      if (scannerIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', scannerIds);
        if (error) throw error;
        scannerNameById = new Map((data ?? []).map((p) => [p.id, p.name]));
      }

      return (profilesRes.data ?? [])
        .filter((p) => participantIds.has(p.id))
        .map((p) => {
          const claim = claimByUser.get(p.id) ?? null;
          return {
            id: p.id,
            name: p.name,
            email: p.email,
            team: (p.team as MealRosterRow['team']) ?? null,
            claimed_at: claim?.ts ?? null,
            scanned_by_id: claim?.by ?? null,
            scanned_by_name: claim?.by ? scannerNameById.get(claim.by) ?? null : null,
          };
        });
    },
  });
}
