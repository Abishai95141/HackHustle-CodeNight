-- ============================================================
-- 0013_set_team_table_number
--   SECURITY DEFINER RPC so RSVP staff (in addition to super_admin) can
--   update teams.table_number without granting the broader teams_admin_all
--   write surface. Mid-event re-seating is an RSVP responsibility — they're
--   the ones at the door. Only this column is mutable through this path.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_team_table_number(_team_id UUID, _table_number TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
       public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'rsvp')
  ) THEN
    RAISE EXCEPTION 'Not authorized to set table number'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.teams
     SET table_number = NULLIF(trim(_table_number), ''),
         updated_at   = now()
   WHERE id = _team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_team_table_number(UUID, TEXT) TO authenticated;
