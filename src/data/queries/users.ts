import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { AppRole } from '@/domain/auth/roles';
import type { Database } from '@/data/types.gen';

export type AttendanceStatus = Database['public']['Enums']['attendance_status'];
export type TeamDomain = Database['public']['Enums']['team_domain'];

export type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_inside_venue: boolean | null;
  attendance_status: AttendanceStatus;
  attendance_marked_at: string | null;
  team: { id: string; team_name: string; team_code: string; domain: TeamDomain | null } | null;
  role: AppRole | null;
};

export function useUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<UserRow[]> => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, email, name, phone, is_inside_venue, attendance_status, attendance_marked_at, team:teams(id, team_name, team_code, domain)',
          )
          .order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleByUser = new Map<string, AppRole>();
      for (const r of rolesRes.data ?? []) roleByUser.set(r.user_id, r.role as AppRole);

      return (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        phone: p.phone,
        is_inside_venue: p.is_inside_venue,
        attendance_status: p.attendance_status,
        attendance_marked_at: p.attendance_marked_at,
        team: (p.team as UserRow['team']) ?? null,
        role: roleByUser.get(p.id) ?? null,
      }));
    },
  });
}
