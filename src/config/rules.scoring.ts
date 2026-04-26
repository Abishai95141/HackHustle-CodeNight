import { v2Rubrics, type Rubric } from '@/domain/scoring/rules';

// Active scoring config. Swap this import to change rubrics across the app
// without touching UI or DB.
export const activeRubrics: Rubric[] = v2Rubrics;
export const activeRoundName = 'Round 1';
