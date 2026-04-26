-- ============================================================
-- 0005_submissions_and_rubric
--   - submissions table (one per team) for deck file + GitHub URL
--   - storage bucket 'submissions' + RLS for team / judge / admin
--   - replace judge_scores with the new 7-criteria rubric matching
--     the official HACKATHON EVAL SHEET
-- ============================================================

-- ===== SUBMISSIONS TABLE =====

CREATE TABLE public.submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID UNIQUE NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  github_url      TEXT,
  deck_path       TEXT,            -- key in 'submissions' bucket, e.g. '<team_id>/deck.pdf'
  deck_filename   TEXT,
  deck_mime       TEXT,
  deck_size_bytes BIGINT,
  updated_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT submissions_github_url_chk
    CHECK (github_url IS NULL OR github_url ~* '^https?://')
);

CREATE INDEX submissions_team_id_idx ON public.submissions (team_id);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION public.touch_submission_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_submissions_touch_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_submission_updated_at();

-- RLS: team members can read & write their team's submission row
CREATE POLICY "submissions_team_select" ON public.submissions FOR SELECT
  USING (team_id = public.user_team_id(auth.uid()));
CREATE POLICY "submissions_team_insert" ON public.submissions FOR INSERT
  WITH CHECK (team_id = public.user_team_id(auth.uid()));
CREATE POLICY "submissions_team_update" ON public.submissions FOR UPDATE
  USING      (team_id = public.user_team_id(auth.uid()))
  WITH CHECK (team_id = public.user_team_id(auth.uid()));

-- Admin: full
CREATE POLICY "submissions_admin_all" ON public.submissions
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Judge: SELECT only when assigned to this team in any round
CREATE POLICY "submissions_judge_select" ON public.submissions FOR SELECT
  USING (
        public.has_role(auth.uid(), 'judge')
    AND EXISTS (
      SELECT 1 FROM public.judge_assignments ja
      WHERE ja.team_id = submissions.team_id AND ja.judge_id = auth.uid()
    )
  );

-- ===== STORAGE BUCKET + POLICIES =====

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions',
  'submissions',
  false,
  52428800,  -- 50 MB cap
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS uses object name's first folder as the team_id (text compare is enough).

-- Team members: read/write their own folder
CREATE POLICY "submissions_storage_team_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
        bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = public.user_team_id(auth.uid())::text
  )
  WITH CHECK (
        bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = public.user_team_id(auth.uid())::text
  );

-- Admins: full access
CREATE POLICY "submissions_storage_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
        bucket_id = 'submissions'
    AND public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
        bucket_id = 'submissions'
    AND public.has_role(auth.uid(), 'super_admin')
  );

-- Judges: read access to teams they're assigned to
CREATE POLICY "submissions_storage_judge_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
        bucket_id = 'submissions'
    AND public.has_role(auth.uid(), 'judge')
    AND EXISTS (
      SELECT 1 FROM public.judge_assignments ja
      WHERE ja.judge_id = auth.uid()
        AND ja.team_id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- ===== NEW JUDGE_SCORES — 7 criteria from the eval sheet =====
-- ============================================================
-- Drop the old 4-criterion scoring; pre-launch so no production scores to migrate.
-- Order matters: triggers + table get rebuilt; the team-total trigger function
-- (update_team_score) is unchanged from 0001_init and can be re-attached after.

DROP TRIGGER IF EXISTS on_judge_score_change ON public.judge_scores;
DROP TABLE IF EXISTS public.judge_scores;

CREATE TABLE public.judge_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  round_name  TEXT NOT NULL DEFAULT 'Round 1',

  -- All seven criteria from the official eval sheet. Caps match the sheet.
  score_problem         SMALLINT CHECK (score_problem         BETWEEN 0 AND 15),
  score_solution        SMALLINT CHECK (score_solution        BETWEEN 0 AND 20),
  score_trust           SMALLINT CHECK (score_trust           BETWEEN 0 AND 20),
  score_innovation      SMALLINT CHECK (score_innovation      BETWEEN 0 AND 15),
  score_feasibility     SMALLINT CHECK (score_feasibility     BETWEEN 0 AND 10),
  score_user_experience SMALLINT CHECK (score_user_experience BETWEEN 0 AND 10),
  score_prototype       SMALLINT CHECK (score_prototype       BETWEEN 0 AND 10),

  notes TEXT,

  total_score INTEGER GENERATED ALWAYS AS (
      COALESCE(score_problem,         0)
    + COALESCE(score_solution,        0)
    + COALESCE(score_trust,           0)
    + COALESCE(score_innovation,      0)
    + COALESCE(score_feasibility,     0)
    + COALESCE(score_user_experience, 0)
    + COALESCE(score_prototype,       0)
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (judge_id, team_id, round_name)
);

ALTER TABLE public.judge_scores ENABLE ROW LEVEL SECURITY;

-- Same RLS shape as 0001 (one judge owns their scores; admins see everything).
CREATE POLICY "judge_scores_select_self"  ON public.judge_scores FOR SELECT USING (judge_id = auth.uid());
CREATE POLICY "judge_scores_insert_self"  ON public.judge_scores FOR INSERT WITH CHECK (judge_id = auth.uid());
CREATE POLICY "judge_scores_update_self"  ON public.judge_scores FOR UPDATE USING (judge_id = auth.uid());
CREATE POLICY "judge_scores_admin_select" ON public.judge_scores FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "judge_scores_admin_all"    ON public.judge_scores FOR ALL    USING (public.has_role(auth.uid(), 'super_admin'));

-- Re-attach team aggregate trigger (unchanged from 0001).
CREATE TRIGGER on_judge_score_change
  AFTER INSERT OR UPDATE OR DELETE ON public.judge_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_team_score();

-- updated_at touch trigger (the 0001 table didn't auto-touch; new one does)
CREATE OR REPLACE FUNCTION public.touch_judge_score_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_judge_scores_touch_updated_at
  BEFORE UPDATE ON public.judge_scores
  FOR EACH ROW EXECUTE FUNCTION public.touch_judge_score_updated_at();

-- judge_scores already in supabase_realtime publication from 0001 — DROP TABLE
-- removed it implicitly. Re-add.
ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_scores;
