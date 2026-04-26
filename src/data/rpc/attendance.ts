import { supabase } from '@/data/client';
import type { AttendanceStatus } from '@/data/queries/users';

export async function markAttendance(
  userId: string,
  status: AttendanceStatus,
  note?: string | null,
) {
  const { error } = await supabase.rpc('mark_attendance', {
    _user_id: userId,
    _status: status,
    _note: note ?? null,
  });
  if (error) throw error;
}

export async function bulkMarkAttendance(
  userIds: string[],
  status: AttendanceStatus,
) {
  // Sequential by design: mark_attendance is a SECURITY DEFINER call;
  // running serially keeps audit trails ordered and surfaces the first
  // failure instead of swallowing partial-success state.
  const results = await Promise.allSettled(
    userIds.map((id) => markAttendance(id, status)),
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { ok: results.length - failed, failed };
}
