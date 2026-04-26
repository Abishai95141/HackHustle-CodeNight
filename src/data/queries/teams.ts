import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { Database } from '@/data/types.gen';
import type { AttendanceStatus } from '@/data/queries/users';

export type TeamDomain = Database['public']['Enums']['team_domain'];
export const TEAM_DOMAINS: TeamDomain[] = ['Fintech', 'Healthcare', 'Logistics'];

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  attendance_status: AttendanceStatus;
};

export type TeamRow = {
  id: string;
  team_name: string;
  team_code: string;
  table_number: string | null;
  total_score: number | null;
  domain: TeamDomain | null;
  member_count: number;
  absent_count: number;
  members: TeamMember[];
};

export function useTeams() {
  return useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: async (): Promise<TeamRow[]> => {
      const [teamsRes, profilesRes] = await Promise.all([
        supabase.from('teams').select('*').order('team_name'),
        supabase.from('profiles').select('id, name, email, team_id, attendance_status'),
      ]);
      if (teamsRes.error) throw teamsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      const byTeam = new Map<string, TeamMember[]>();
      for (const p of profilesRes.data ?? []) {
        if (!p.team_id) continue;
        const arr = byTeam.get(p.team_id) ?? [];
        arr.push({
          id: p.id,
          name: p.name,
          email: p.email,
          attendance_status: p.attendance_status,
        });
        byTeam.set(p.team_id, arr);
      }
      return (teamsRes.data ?? []).map((t) => {
        const members = byTeam.get(t.id) ?? [];
        return {
          ...t,
          member_count: members.length,
          absent_count: members.filter((m) => m.attendance_status === 'absent').length,
          members,
        };
      });
    },
  });
}

export function useUnassignedProfiles() {
  return useQuery({
    queryKey: ['admin', 'unassigned-profiles'],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .is('team_id', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });
}

export function useLeaderboardTeams() {
  return useQuery({
    queryKey: ['leaderboard', 'teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, team_code, table_number, total_score')
        .order('total_score', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
