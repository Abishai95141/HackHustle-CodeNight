-- Make app_settings flags readable by unauthenticated visitors so the public
-- leaderboard (`/board/:slug`) can honour the scores_published toggle. The
-- three flags are non-sensitive booleans — no email, password, or PII.
-- Writes remain admin-only via app_settings_admin_write.

DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings;

CREATE POLICY "app_settings_select_public" ON public.app_settings
  FOR SELECT USING (true);
