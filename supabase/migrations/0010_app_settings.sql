-- ============================================================
-- 0010_app_settings
--   - app_settings: tiny key/value store for global event-runtime flags
--   - Three seeded flags:
--       scores_published    bool   judge scores hidden from participants
--                                   until admin flips this on
--       submissions_locked  bool   when true, only admins can write team
--                                   submissions (deck + GitHub)
--       logging_enabled     bool   master switch for the activity_logs
--                                   firehose; admin can disable to save
--                                   write capacity during peak load
--   - Trigger on submissions enforces the lock server-side so the rule
--     can't be bypassed by a stale client cache
--   - Realtime publication so all clients see toggles instantly
-- ============================================================

CREATE TABLE public.app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION public.touch_app_setting_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_app_settings_touch_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_setting_updated_at();

-- ===== POLICIES =====
-- Anyone authenticated can READ flags — every shell needs them to render.
CREATE POLICY "app_settings_select_authenticated" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can write.
CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- ===== SEED =====
INSERT INTO public.app_settings (key, value) VALUES
  ('scores_published',   'false'::jsonb),
  ('submissions_locked', 'false'::jsonb),
  ('logging_enabled',    'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ===== HELPER =====
-- A small SECURITY DEFINER reader so triggers/RLS can fetch a flag without
-- worrying about the caller's privileges on app_settings.
CREATE OR REPLACE FUNCTION public.app_setting_bool(_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value)::text::boolean FROM public.app_settings WHERE key = _key), false)
$$;

-- ===== SUBMISSION LOCK TRIGGER =====
-- Blocks INSERT and UPDATE on submissions when submissions_locked is true,
-- unless the actor is an admin (admin can always edit / unlock-and-fix).
CREATE OR REPLACE FUNCTION public.guard_submission_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.app_setting_bool('submissions_locked')
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Submissions are locked by the organizers.'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_submissions_guard_lock
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_lock();
