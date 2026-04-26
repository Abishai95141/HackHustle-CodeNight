import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { AttendanceStatus, TeamDomain } from '@/data/queries/users';

export type RosterRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  team: { id: string; team_name: string; team_code: string; domain: TeamDomain | null } | null;
  attendance_status: AttendanceStatus;
  attendance_marked_at: string | null;
  attendance_marked_by: string | null;
  attendance_marked_by_name: string | null;
  is_inside_venue: boolean | null;
};

export function useAttendanceRoster() {
  const qc = useQueryClient();
  const id = useId();

  // Realtime: any profile change re-pulls the roster. The table is small enough
  // that a full refetch is cheap, and it keeps the row data and the marker name
  // (joined from profiles) consistent without manual cache merging.
  // Channel name is unique per instance so admin + RSVP routes can both mount
  // this hook concurrently without dedupe.
  useEffect(() => {
    const channel = supabase
      .channel(`rsvp-roster-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          qc.invalidateQueries({ queryKey: ['rsvp', 'roster'] });
          qc.invalidateQueries({ queryKey: ['admin', 'users'] });
          qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, id]);

  return useQuery({
    queryKey: ['rsvp', 'roster'],
    queryFn: async (): Promise<RosterRow[]> => {
      // 1. Pull every participant-eligible profile (anyone the RSVP staff can see).
      // 2. Resolve the marker name in a second small lookup so we don't have to
      //    rely on a self-join in PostgREST (which would require the FK to be
      //    declared, and PostgREST gets prickly about ambiguous self-joins).
      const profilesRes = await supabase
        .from('profiles')
        .select(
          'id, name, email, phone, attendance_status, attendance_marked_at, attendance_marked_by, is_inside_venue, team:teams(id, team_name, team_code, domain)',
        )
        .order('name');
      if (profilesRes.error) throw profilesRes.error;

      const markerIds = Array.from(
        new Set((profilesRes.data ?? []).map((p) => p.attendance_marked_by).filter((v): v is string => !!v)),
      );

      let markerNameById = new Map<string, string>();
      if (markerIds.length > 0) {
        const markersRes = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', markerIds);
        if (markersRes.error) throw markersRes.error;
        markerNameById = new Map((markersRes.data ?? []).map((m) => [m.id, m.name]));
      }

      return (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        team: (p.team as RosterRow['team']) ?? null,
        attendance_status: p.attendance_status,
        attendance_marked_at: p.attendance_marked_at,
        attendance_marked_by: p.attendance_marked_by,
        attendance_marked_by_name: p.attendance_marked_by ? markerNameById.get(p.attendance_marked_by) ?? null : null,
        is_inside_venue: p.is_inside_venue,
      }));
    },
  });
}

export type AttendanceCounts = Record<AttendanceStatus, number>;

export function summarizeAttendance(rows: RosterRow[]): AttendanceCounts {
  const counts: AttendanceCounts = { pending: 0, checked_in: 0, checked_out: 0, absent: 0 };
  for (const r of rows) counts[r.attendance_status]++;
  return counts;
}
