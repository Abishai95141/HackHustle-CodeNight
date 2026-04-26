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
  BAND_LABEL,
  TOTAL_MAX,
  bandFor,
  totalOf,
  v2Rubrics,
  type RubricKey,
  type ScoreSheet,
} from '@/domain/scoring/rules';
import { upsertScore } from '@/data/rpc/judging';
import type { ScoreRow } from '@/data/queries/judging';

const BAND_TONE: Record<ReturnType<typeof bandFor>, string> = {
  missing: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  weak: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  good: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  excellent: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
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

      <ol className="space-y-4">
        {v2Rubrics.map((r) => {
          const value = sheet[r.key] ?? 0;
          const band = bandFor(value, r.max);
          return (
            <li
              key={r.key}
              className="space-y-2 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-2xs text-muted-foreground">{r.hint}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg tabular-nums">
                    {value}
                    <span className="ml-1 text-2xs text-muted-foreground">/ {r.max}</span>
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]',
                      BAND_TONE[band],
                    )}
                  >
                    {BAND_LABEL[band]}
                  </span>
                </div>
              </div>
              <Slider
                min={0}
                max={r.max}
                step={1}
                value={[value]}
                onValueChange={([v]) => update(r.key, v)}
                onValueCommit={() => submit.mutate()}
              />
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
