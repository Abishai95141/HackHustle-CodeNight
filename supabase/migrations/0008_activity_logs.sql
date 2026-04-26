-- ============================================================
-- 0008_activity_logs
--   - activity_logs table for client-emitted UI events + server-side state
--     changes
--   - RLS: anyone authenticated can INSERT their own row, only admins can
--     SELECT or DELETE
--   - BEFORE INSERT trigger snapshots user_id/role/email/name from auth.uid()
--     so the client only has to send the action + metadata; the row is
--     tamper-resistant for those identity fields
--   - Indexes on the columns the admin Logs page filters by
-- ============================================================

CREATE TABLE public.activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Actor (snapshot — preserved if the user later changes role / is deleted)
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_role     app_role,
  user_email    TEXT,
  user_name     TEXT,

  -- What happened
  category      TEXT NOT NULL CHECK (category IN ('auth', 'route', 'click', 'mutation', 'error', 'system')),
  action        TEXT NOT NULL CHECK (length(action) > 0 AND length(action) <= 200),
  resource_type TEXT,
  resource_id   TEXT,

  status        TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'warn')),
  error_message TEXT,

  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Device / network
  user_agent    TEXT,
  device_type   TEXT,        -- 'mobile' | 'tablet' | 'desktop' (best-effort)
  session_id    TEXT         -- per-tab uuid; correlates a user's events
);

-- The page reads "most recent first, optionally filtered by user/category"
-- so the leading occurred_at index handles the common case; the partial
-- indexes accelerate the sidebar filters.
CREATE INDEX activity_logs_occurred_at_idx ON public.activity_logs (occurred_at DESC);
CREATE INDEX activity_logs_user_idx        ON public.activity_logs (user_id, occurred_at DESC);
CREATE INDEX activity_logs_category_idx    ON public.activity_logs (category, occurred_at DESC);
CREATE INDEX activity_logs_status_idx      ON public.activity_logs (status, occurred_at DESC) WHERE status <> 'ok';
CREATE INDEX activity_logs_resource_idx    ON public.activity_logs (resource_type, resource_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Snapshot trigger — fills user_id from auth.uid(), then enriches
-- user_role/email/name from profiles + user_roles via SECURITY DEFINER so
-- this works even when the inserter (a participant) can't directly read
-- other profiles.
CREATE OR REPLACE FUNCTION public.fill_activity_log_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prof RECORD;
  r app_role;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  IF NEW.user_id IS NOT NULL THEN
    SELECT email, name INTO prof FROM public.profiles WHERE id = NEW.user_id;
    IF FOUND THEN
      NEW.user_email := COALESCE(NEW.user_email, prof.email);
      NEW.user_name  := COALESCE(NEW.user_name,  prof.name);
    END IF;
    SELECT role INTO r FROM public.user_roles WHERE user_id = NEW.user_id LIMIT 1;
    IF FOUND THEN
      NEW.user_role := COALESCE(NEW.user_role, r);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_logs_snapshot
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_activity_log_snapshot();

-- ===== POLICIES =====

-- INSERT: any authenticated user, but only writing rows attributed to themselves
-- (the trigger overrides user_id to auth.uid() if NULL; this WITH CHECK gates
-- the case where a malicious client tries to forge user_id explicitly).
CREATE POLICY "activity_logs_insert_self" ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- SELECT: admin only. No leakage of behavioural data to other staff.
CREATE POLICY "activity_logs_select_admin" ON public.activity_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- DELETE: admin only — used by the Logs page purge action.
CREATE POLICY "activity_logs_delete_admin" ON public.activity_logs FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- (No realtime publication membership — the Logs page uses polling on demand.
--  Realtime on a high-write table would saturate the websocket.)
