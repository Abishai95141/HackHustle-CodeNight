-- ============================================================
-- 0003_rsvp_domains_notifications
--   - team_domain enum + teams.domain column
--   - attendance_status enum + profile attendance lifecycle columns
--   - notifications table (with target chooser + status flow)
--   - mark_attendance() RPC (only writer of attendance_status)
--   - block_scans_for_absent + guard_absent_profile_writes triggers
--   - RLS policies for notifications and the new RSVP role
--   - realtime publication for notifications + profiles
-- ============================================================

-- ===== ENUMS =====
CREATE TYPE public.team_domain         AS ENUM ('Fintech', 'Healthcare', 'Logistics');
CREATE TYPE public.attendance_status   AS ENUM ('pending', 'checked_in', 'checked_out', 'absent');
CREATE TYPE public.notification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.notification_target AS ENUM ('all', 'teams', 'domains', 'individuals', 'role');

-- ===== TEAM DOMAIN =====
ALTER TABLE public.teams
  ADD COLUMN domain team_domain;

-- ===== PROFILE ATTENDANCE LIFECYCLE =====
ALTER TABLE public.profiles
  ADD COLUMN attendance_status    attendance_status NOT NULL DEFAULT 'pending',
  ADD COLUMN attendance_marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN attendance_marked_at TIMESTAMPTZ,
  ADD COLUMN attendance_note      TEXT;

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_role    app_role NOT NULL,
  title           TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 140),
  body            TEXT NOT NULL CHECK (length(body)  > 0 AND length(body)  <= 2000),
  target_type     notification_target NOT NULL,
  target_team_ids UUID[],
  target_domains  team_domain[],
  target_user_ids UUID[],
  target_role     app_role,
  status          notification_status NOT NULL DEFAULT 'pending',
  approved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT notifications_target_payload_chk CHECK (
       (target_type = 'all'         AND target_team_ids IS NULL AND target_domains IS NULL AND target_user_ids IS NULL AND target_role IS NULL)
    OR (target_type = 'teams'       AND target_team_ids IS NOT NULL AND array_length(target_team_ids,1) > 0
                                    AND target_domains IS NULL AND target_user_ids IS NULL AND target_role IS NULL)
    OR (target_type = 'domains'     AND target_domains  IS NOT NULL AND array_length(target_domains,1)  > 0
                                    AND target_team_ids IS NULL AND target_user_ids IS NULL AND target_role IS NULL)
    OR (target_type = 'individuals' AND target_user_ids IS NOT NULL AND array_length(target_user_ids,1) > 0
                                    AND target_team_ids IS NULL AND target_domains IS NULL AND target_role IS NULL)
    OR (target_type = 'role'        AND target_role     IS NOT NULL
                                    AND target_team_ids IS NULL AND target_domains IS NULL AND target_user_ids IS NULL)
  )
);
CREATE INDEX notifications_status_idx         ON public.notifications (status);
CREATE INDEX notifications_published_idx      ON public.notifications (published_at DESC);
CREATE INDEX notifications_team_targets_gin   ON public.notifications USING GIN (target_team_ids);
CREATE INDEX notifications_user_targets_gin   ON public.notifications USING GIN (target_user_ids);
CREATE INDEX notifications_domain_targets_gin ON public.notifications USING GIN (target_domains);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ===== HELPER FUNCTIONS (SECURITY DEFINER, mirrors has_role pattern) =====
-- Used by the participant SELECT policy on notifications. Going through
-- SECURITY DEFINER avoids re-entering RLS on profiles/teams for every row.

CREATE OR REPLACE FUNCTION public.user_team_id(_uid UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.profiles WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION public.user_team_domain(_uid UUID)
RETURNS team_domain
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.domain
  FROM public.profiles p
  LEFT JOIN public.teams t ON t.id = p.team_id
  WHERE p.id = _uid
$$;

-- ===== mark_attendance: ONLY canonical writer of attendance_status =====
-- Restricts the writable column set so RSVP/admin can never accidentally
-- rewrite name/email/team_id/etc. via the broad profiles UPDATE policies.
-- Also keeps is_inside_venue + checked_in_day1 in sync with the lifecycle.

CREATE OR REPLACE FUNCTION public.mark_attendance(
  _user_id UUID,
  _status  attendance_status,
  _note    TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'rsvp') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized to mark attendance' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    attendance_status    = _status,
    attendance_marked_by = auth.uid(),
    attendance_marked_at = now(),
    attendance_note      = COALESCE(_note, attendance_note),
    is_inside_venue      = CASE
                              WHEN _status = 'checked_in'                      THEN true
                              WHEN _status IN ('checked_out', 'absent')        THEN false
                              ELSE is_inside_venue
                            END,
    checked_in_day1      = CASE
                              WHEN _status = 'checked_in' THEN true
                              ELSE checked_in_day1
                            END,
    last_scan_timestamp  = CASE
                              WHEN _status = 'checked_in' THEN now()
                              ELSE last_scan_timestamp
                            END,
    updated_at           = now()
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_attendance(UUID, attendance_status, TEXT) TO authenticated;

-- ===== TRIGGERS — absent blocks volunteer scans =====

CREATE OR REPLACE FUNCTION public.block_scans_for_absent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND attendance_status = 'absent'
  ) THEN
    RAISE EXCEPTION 'Participant is marked absent — scan invalid'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_logs_block_absent
  BEFORE INSERT ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_scans_for_absent();

CREATE TRIGGER trg_meal_transactions_block_absent
  BEFORE INSERT ON public.meal_transactions
  FOR EACH ROW EXECUTE FUNCTION public.block_scans_for_absent();

-- The volunteer scanner does TWO writes per scan: (1) profiles.update is_inside_venue,
-- then (2) attendance_logs.insert. We block both so the database can never get out of
-- sync — even if a client bypasses the JS guard.
-- The trigger DOES allow attendance_status itself to change (so RSVP can revert
-- absent → checked_in/checked_out without tripping its own guard).

CREATE OR REPLACE FUNCTION public.guard_absent_profile_writes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.attendance_status = 'absent'
     AND NEW.attendance_status = 'absent'  -- still absent -> protect scan-related fields
     AND (
            NEW.is_inside_venue     IS DISTINCT FROM OLD.is_inside_venue
         OR NEW.last_scan_timestamp IS DISTINCT FROM OLD.last_scan_timestamp
         OR NEW.checked_in_day1     IS DISTINCT FROM OLD.checked_in_day1
     ) THEN
    RAISE EXCEPTION 'Participant is marked absent — scan invalid'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_guard_absent
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_absent_profile_writes();

-- ===== RLS POLICIES — extending existing ones =====

-- profiles: let RSVP READ profiles (so the roster page works).
-- WRITES go through mark_attendance() (SECURITY DEFINER) which bypasses RLS
-- and locks the column set, so we deliberately do NOT grant a broader
-- profiles_update_rsvp policy — that would let RSVP overwrite arbitrary fields.
CREATE POLICY "profiles_select_rsvp"  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'rsvp'));

-- teams: RSVP needs to read teams to render team names on the roster.
-- (already publicly readable via teams_select_all; no new policy required.)

-- ===== RLS POLICIES — notifications =====

-- Read: creator sees own; admin sees all; targeted participants see approved-and-published.
CREATE POLICY "notifications_select_creator" ON public.notifications FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "notifications_select_admin"   ON public.notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "notifications_select_targeted" ON public.notifications FOR SELECT
  USING (
    status = 'approved'
    AND (published_at IS NULL OR published_at <= now())
    AND (
         target_type = 'all'
      OR (target_type = 'teams'       AND public.user_team_id(auth.uid())     = ANY(target_team_ids))
      OR (target_type = 'domains'     AND public.user_team_domain(auth.uid()) = ANY(target_domains))
      OR (target_type = 'individuals' AND auth.uid() = ANY(target_user_ids))
      OR (target_type = 'role'        AND public.has_role(auth.uid(), target_role))
    )
  );

-- Insert:
--   * volunteers can ONLY draft pending notifications and cannot self-approve
--   * admins can insert directly with any status (the RPC layer sets approved + published)
CREATE POLICY "notifications_insert_volunteer" ON public.notifications FOR INSERT
  WITH CHECK (
        public.has_role(auth.uid(), 'volunteer')
    AND created_by = auth.uid()
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND published_at IS NULL
  );

CREATE POLICY "notifications_insert_admin" ON public.notifications FOR INSERT
  WITH CHECK (
        public.has_role(auth.uid(), 'super_admin')
    AND created_by = auth.uid()
  );

-- Update: only admins. Volunteers cannot self-approve via UPDATE.
CREATE POLICY "notifications_update_admin" ON public.notifications FOR UPDATE
  USING      (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Delete: admin only (rare; usually we keep for audit).
CREATE POLICY "notifications_delete_admin" ON public.notifications FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ===== updated_at touch trigger for notifications =====
CREATE OR REPLACE FUNCTION public.touch_notification_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notifications_touch_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_updated_at();

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
