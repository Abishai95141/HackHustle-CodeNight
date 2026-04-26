import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import {
  TOTAL_MAX,
  bandFor,
  totalOf,
  v2Rubrics,
  type RubricKey,
  type ScoreSheet,
} from '@/domain/scoring/rules';

// Short labels for the band pill — the original "Very poor / missing" and
// "Excellent / near real-world" wrap awkwardly on mobile and crowd the score.
const BAND_SHORT_LABEL: Record<ReturnType<typeof bandFor>, string> = {
  missing: 'Missing',
  weak: 'Weak',
  good: 'Good',
  excellent: 'Excellent',
};
import { upsertScore } from '@/data/rpc/judging';
import type { ScoreRow } from '@/data/queries/judging';

// Subtle band styling — instead of a busy filled pill, a colored dot + text
// next to the slider scale. Same palette as before, far less visual weight.
const BAND_TEXT: Record<ReturnType<typeof bandFor>, string> = {
  missing: 'text-rose-700 dark:text-rose-300',
  weak: 'text-amber-700 dark:text-amber-300',
  good: 'text-sky-700 dark:text-sky-300',
  excellent: 'text-emerald-700 dark:text-emerald-300',
};
const BAND_DOT: Record<ReturnType<typeof bandFor>, string> = {
  missing: 'bg-rose-500',
  weak: 'bg-amber-500',
  good: 'bg-sky-500',
  excellent: 'bg-emerald-500',
};

function sheetFromRow(row: ScoreRow | null): ScoreSheet {
  const out: ScoreSheet = {};
  for (const r of v2Rubrics) {
    const v = row?.[r.column];
    out[r.key] = typeof v === 'number' ? v : 0;
  }
  return out;
}

export function ScoringForm({
  judgeId,
  teamId,
  roundName,
  initial,
}: {
  judgeId: string;
  teamId: string;
  roundName: string;
  initial: ScoreRow | null;
}) {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<ScoreSheet>(() => sheetFromRow(initial));
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');

  // Reset when navigating between teams or when fresh data arrives.
  useEffect(() => {
    setSheet(sheetFromRow(initial));
    setNotes(initial?.notes ?? '');
  }, [teamId, initial]);

  const submit = useMutation({
    mutationFn: () =>
      upsertScore({
        judgeId,
        teamId,
        roundName,
        sheet,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success('Score saved');
      qc.invalidateQueries({ queryKey: ['judge', 'assignments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'rankings'] });
      qc.invalidateQueries({ queryKey: ['leaderboard', 'teams'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save'),
  });

  function update(key: RubricKey, value: number) {
    setSheet((s) => ({ ...s, [key]: value }));
  }

  const total = totalOf(sheet);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
            Total
          </div>
          <div className="font-display text-3xl font-semibold tabular-nums">
            {total}
            <span className="ml-1 text-base font-normal text-muted-foreground">/ {TOTAL_MAX}</span>
          </div>
        </div>
        <div className="text-2xs text-muted-foreground">
          7 criteria · scale matches the official eval sheet
        </div>
      </header>

      <ol className="space-y-3">
        {v2Rubrics.map((r) => {
          const value = sheet[r.key] ?? 0;
          const band = bandFor(value, r.max);
          return (
            <li
              key={r.key}
              className="space-y-3 rounded-lg border border-border bg-card p-4"
            >
              {/* Title row — label + score, breathing space on the right */}
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">{r.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">{r.hint}</div>
                </div>
                <div className="shrink-0 font-mono text-xl tabular-nums leading-none">
                  {value}
                  <span className="ml-1 text-2xs font-normal text-muted-foreground">/{r.max}</span>
                </div>
              </div>

              {/* Slider with band dot inline so it doesn't add a third row */}
              <div className="space-y-2">
                <Slider
                  min={0}
                  max={r.max}
                  step={1}
                  value={[value]}
                  onValueChange={([v]) => update(r.key, v)}
                  onValueCommit={() => submit.mutate()}
                  aria-label={`${r.label} score`}
                />
                <div className="flex items-center justify-between text-2xs text-muted-foreground">
                  <span className="tabular-nums">0</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-medium uppercase tracking-[0.14em]',
                      BAND_TEXT[band],
                    )}
                  >
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full', BAND_DOT[band])} />
                    {BAND_SHORT_LABEL[band]}
                  </span>
                  <span className="tabular-nums">{r.max}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
        <Label htmlFor="judge-notes" className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          Notes (private)
        </Label>
        <Textarea
          id="judge-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional context for yourself or the admin."
          onBlur={() => submit.mutate()}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {submit.isPending ? (
          <span className="inline-flex items-center gap-2 text-2xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        ) : (
          <span className="text-2xs text-muted-foreground">Saves automatically when you release a slider.</span>
        )}
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          <Save className="h-4 w-4" /> Save now
        </Button>
      </div>
    </div>
  );
}
