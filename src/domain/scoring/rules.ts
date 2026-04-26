// Official rubric — mirrors HACKATHON EVAL SHEET.pdf and the column set on
// public.judge_scores. Editing the keys here means editing the DB migration
// + the queries/judging.ts SELECT list at the same time.

export type RubricKey =
  | 'problem'
  | 'solution'
  | 'trust'
  | 'innovation'
  | 'feasibility'
  | 'user_experience'
  | 'prototype';

export type Rubric = {
  key: RubricKey;
  /** Database column name (canonical: `score_${key}`). */
  column: `score_${RubricKey}`;
  label: string;
  /** One-line guidance shown under the slider. */
  hint: string;
  max: number;
};

export const v2Rubrics: Rubric[] = [
  {
    key: 'problem',
    column: 'score_problem',
    label: 'Problem Understanding',
    hint: 'Clear problem framing, stakeholders, edge cases, threat awareness.',
    max: 15,
  },
  {
    key: 'solution',
    column: 'score_solution',
    label: 'Solution Design',
    hint: 'Architecture, data flow, scalability, failure handling.',
    max: 20,
  },
  {
    key: 'trust',
    column: 'score_trust',
    label: 'Trust, Reliability & Data Integrity',
    hint: 'Prevents misuse/tampering, ensures authenticity, protects data.',
    max: 20,
  },
  {
    key: 'innovation',
    column: 'score_innovation',
    label: 'Innovation',
    hint: 'Novel, meaningful differentiation — not generic.',
    max: 15,
  },
  {
    key: 'feasibility',
    column: 'score_feasibility',
    label: 'Feasibility',
    hint: 'Practical to deploy, works with real-world constraints.',
    max: 10,
  },
  {
    key: 'user_experience',
    column: 'score_user_experience',
    label: 'User Experience',
    hint: 'Ease of use, low friction, adoption potential.',
    max: 10,
  },
  {
    key: 'prototype',
    column: 'score_prototype',
    label: 'Prototype & Demo',
    hint: 'Working prototype, proves core logic — not just UI.',
    max: 10,
  },
];

export const TOTAL_MAX = v2Rubrics.reduce((s, r) => s + r.max, 0); // 100

export type ScoreSheet = Partial<Record<RubricKey, number>>;

export function totalOf(sheet: ScoreSheet, rubrics: Rubric[] = v2Rubrics): number {
  return rubrics.reduce((sum, r) => sum + (sheet[r.key] ?? 0), 0);
}

export function maxTotal(rubrics: Rubric[] = v2Rubrics): number {
  return rubrics.reduce((sum, r) => sum + r.max, 0);
}

/**
 * Marks-range meaning from the eval sheet, used to colour-code sliders/badges.
 * The sheet's bands target /10 columns; we scale proportionally for /15 and /20.
 */
export type Band = 'missing' | 'weak' | 'good' | 'excellent';

export function bandFor(value: number, max: number): Band {
  const t1 = (3 / 10) * max;
  const t2 = (6 / 10) * max;
  const t3 = (8 / 10) * max;
  if (value <= t1) return 'missing';
  if (value <= t2) return 'weak';
  if (value <= t3) return 'good';
  return 'excellent';
}

export const BAND_LABEL: Record<Band, string> = {
  missing: 'Very poor / missing',
  weak: 'Weak / incomplete',
  good: 'Good / solid',
  excellent: 'Excellent / near real-world',
};
