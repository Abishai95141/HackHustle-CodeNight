-- ============================================================
-- 0004_problem_statements
--   - problem_statements table (admin-authored markdown grouped by team_domain)
--   - RLS: admin full CRUD; staff (volunteer/judge/rsvp) can read drafts;
--          participants only see PUBLISHED statements for their team's domain
--   - Realtime so unlock/edit propagates to participants live
-- ============================================================

CREATE TABLE public.problem_statements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        team_domain NOT NULL,
  title         TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  body_md       TEXT NOT NULL CHECK (length(body_md) > 0),
  is_published  BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 1 CHECK (display_order > 0),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX problem_statements_domain_idx
  ON public.problem_statements (domain, display_order);
CREATE INDEX problem_statements_published_idx
  ON public.problem_statements (is_published);

ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statements REPLICA IDENTITY FULL;

-- ===== POLICIES =====

-- Admins: full CRUD.
CREATE POLICY "ps_admin_all" ON public.problem_statements
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Other staff (volunteer / judge / rsvp): can read everything (drafts too)
-- so they can answer participant questions about upcoming releases.
CREATE POLICY "ps_staff_select" ON public.problem_statements FOR SELECT
  USING (
       public.has_role(auth.uid(), 'volunteer')
    OR public.has_role(auth.uid(), 'judge')
    OR public.has_role(auth.uid(), 'rsvp')
  );

-- Participants: see only PUBLISHED rows for their team's domain.
-- user_team_domain() is SECURITY DEFINER so this never recurses into
-- profiles/teams RLS — required to keep evaluation cheap and non-fragile.
CREATE POLICY "ps_participant_select" ON public.problem_statements FOR SELECT
  USING (
        is_published = true
    AND domain = public.user_team_domain(auth.uid())
  );

-- ===== updated_at touch trigger =====
CREATE OR REPLACE FUNCTION public.touch_problem_statement_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_problem_statements_touch_updated_at
  BEFORE UPDATE ON public.problem_statements
  FOR EACH ROW EXECUTE FUNCTION public.touch_problem_statement_updated_at();

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.problem_statements;
