-- ============================================================
-- 0012_winners
--   - winners table: admin-curated 1st & 2nd place per domain. NOT derived
--     from judge_scores; admin picks the team explicitly.
--   - winners_announced flag in app_settings gates participant visibility.
--   - RLS: admins always see/write; non-admin reads return rows only when
--     the announce flag is on (clean server-side gate).
-- ============================================================

CREATE TABLE public.winners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      team_domain NOT NULL,
  rank        SMALLINT NOT NULL CHECK (rank IN (1, 2)),
  team_id     UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  citation    TEXT CHECK (citation IS NULL OR length(citation) <= 280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain, rank)
);

CREATE INDEX winners_domain_rank_idx ON public.winners (domain, rank);

ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.winners;

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION public.touch_winner_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_winners_touch_updated_at
  BEFORE UPDATE ON public.winners
  FOR EACH ROW EXECUTE FUNCTION public.touch_winner_updated_at();

-- ===== POLICIES =====
-- Admin: full CRUD anytime.
CREATE POLICY "winners_admin_all" ON public.winners
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Everyone else (authenticated + anon for the public board): SELECT only when
-- the announce flag is on. Uses the SECURITY DEFINER helper from 0010 so this
-- doesn't recurse through app_settings RLS.
CREATE POLICY "winners_select_when_announced" ON public.winners
  FOR SELECT USING (public.app_setting_bool('winners_announced'));

-- ===== SEED THE FLAG =====
INSERT INTO public.app_settings (key, value)
  VALUES ('winners_announced', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- ===== SEED EMPTY ROWS =====
-- Six pre-allocated slots (3 domains × 2 ranks) so the admin UI can render a
-- predictable matrix without tracking inserts vs updates. Each starts with
-- NULL team_id which the UI surfaces as "not picked yet".
INSERT INTO public.winners (domain, rank, team_id) VALUES
  ('Fintech',    1, NULL),
  ('Fintech',    2, NULL),
  ('Healthcare', 1, NULL),
  ('Healthcare', 2, NULL),
  ('Logistics',  1, NULL),
  ('Logistics',  2, NULL)
ON CONFLICT (domain, rank) DO NOTHING;
