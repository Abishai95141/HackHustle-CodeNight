import { supabase } from '@/data/client';

/** Lets RSVP staff and super_admin set a team's table number. The DB function
 *  is SECURITY DEFINER so it bypasses the broader teams write RLS while only
 *  exposing this single column. */
export async function setTeamTableNumber(teamId: string, tableNumber: string | null) {
  const { error } = await supabase.rpc('set_team_table_number', {
    _team_id: teamId,
    _table_number: tableNumber ?? '',
  });
  if (error) throw error;
}
