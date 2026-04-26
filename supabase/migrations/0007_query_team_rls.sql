-- ============================================================
-- 0007_query_team_rls
--   - Grant the 'query_team' role read + update access to support queries
--     so they can triage and respond. Insert/delete remain admin-only.
--   - Allow query_team to SELECT profiles so a triaged query can show the
--     reporter's name/email.
-- ============================================================

-- Profiles: let query_team read participant rows so the queries page can
-- display the reporter's identity. (No update — they don't need it.)
CREATE POLICY "profiles_select_query_team" ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'query_team'));

-- Queries: SELECT all
CREATE POLICY "queries_select_query_team" ON public.queries FOR SELECT
  USING (public.has_role(auth.uid(), 'query_team'));

-- Queries: UPDATE (status, admin_notes) — query_team can answer/triage.
-- WITH CHECK is identical: don't let them re-key the row to another user.
CREATE POLICY "queries_update_query_team" ON public.queries FOR UPDATE
  USING      (public.has_role(auth.uid(), 'query_team'))
  WITH CHECK (public.has_role(auth.uid(), 'query_team'));
