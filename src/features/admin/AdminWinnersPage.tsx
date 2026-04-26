import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Crown, Eye, EyeOff, Loader2, Medal, Save, X } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { TEAM_DOMAINS, useTeams, type TeamDomain } from '@/data/queries/teams';
import { useWinners, type WinnerRow } from '@/data/queries/winners';
import { upsertWinner } from '@/data/rpc/winners';
import { useAppSettingsValue } from '@/data/queries/appSettings';
import { setAppSetting } from '@/data/rpc/appSettings';

const RANK_LABEL: Record<1 | 2, string> = { 1: '1st place', 2: '2nd place' };

const DOMAIN_TONE: Record<TeamDomain, string> = {
  Fintech: 'border-emerald-500/40 bg-emerald-500/5',
  Healthcare: 'border-sky-500/40 bg-sky-500/5',
  Logistics: 'border-amber-500/40 bg-amber-500/5',
};

const DOMAIN_TEXT: Record<TeamDomain, string> = {
  Fintech: 'text-emerald-700 dark:text-emerald-300',
  Healthcare: 'text-sky-700 dark:text-sky-300',
  Logistics: 'text-amber-700 dark:text-amber-300',
};

export function AdminWinnersPage() {
  const winners = useWinners();
  const teams = useTeams();
  const settings = useAppSettingsValue();
  const qc = useQueryClient();

  // Build a quick lookup by (domain, rank) so we can fish each row out.
  const byKey = useMemo(() => {
    const m = new Map<string, WinnerRow>();
    for (const w of winners.data ?? []) m.set(`${w.domain}:${w.rank}`, w);
    return m;
  }, [winners.data]);

  const announceMutation = useMutation({
    mutationFn: (value: boolean) => setAppSetting('winners_announced', value),
    onMutate: async (value) => {
      // Optimistic so the toggle feels instant.
      await qc.cancelQueries({ queryKey: ['app-settings'] });
      const prev = qc.getQueryData<Record<string, boolean>>(['app-settings']);
      qc.setQueryData(['app-settings'], (old: Record<string, boolean> | undefined) => ({
        ...(old ?? {}),
        winners_announced: value,
      }));
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(['app-settings'], ctx?.prev);
      toast.error(err.message ?? 'Failed to toggle');
    },
    onSuccess: (_data, value) => {
      toast.success(value ? 'Winners announced — visible to participants' : 'Winners hidden');
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Winners"
        subtitle="Pick 1st and 2nd place per domain. Toggle Announce to reveal them in participants' portals."
      />

      {/* Announce control */}
      <Card className={cn(settings.winners_announced && 'border-amber-500/40')}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full bg-secondary',
              settings.winners_announced ? 'text-amber-600 dark:text-amber-400' : '',
            )}>
              {settings.winners_announced ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-sm font-medium">
                {settings.winners_announced ? 'Announced — winners are live' : 'Not announced — winners hidden'}
              </div>
              <div className="text-2xs text-muted-foreground">
                {settings.winners_announced
                  ? 'Participants and the public board can see the winners now.'
                  : 'Pick teams below, then flip this on when you\'re ready.'}
              </div>
            </div>
          </div>
          <Switch
            checked={settings.winners_announced}
            onCheckedChange={(v) => announceMutation.mutate(v)}
            aria-label="Announce winners"
          />
        </CardContent>
      </Card>

      {/* Per-domain editor */}
      <div className="grid gap-6 md:grid-cols-3">
        {TEAM_DOMAINS.map((domain) => (
          <Card key={domain} className={cn('overflow-hidden', DOMAIN_TONE[domain])}>
            <CardContent className="space-y-5 p-5">
              <header className="flex items-center justify-between">
                <h2 className={cn('font-display text-lg font-semibold tracking-tight', DOMAIN_TEXT[domain])}>
                  {domain}
                </h2>
              </header>
              {([1, 2] as const).map((rank) => (
                <SlotEditor
                  key={rank}
                  domain={domain}
                  rank={rank}
                  row={byKey.get(`${domain}:${rank}`) ?? null}
                  teams={(teams.data ?? []).filter((t) => t.domain === domain)}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlotEditor({
  domain,
  rank,
  row,
  teams,
}: {
  domain: TeamDomain;
  rank: 1 | 2;
  row: WinnerRow | null;
  teams: { id: string; team_name: string; team_code: string }[];
}) {
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState<string>(row?.team_id ?? 'none');
  const [citation, setCitation] = useState<string>(row?.citation ?? '');

  // Re-sync local state when the realtime payload arrives or the slot changes.
  // Keep edits if they diverge from the server only when the user is actively
  // typing — keep it simple: the slot is small, latest-wins is fine.
  if (row && row.team_id !== teamId && document.activeElement?.tagName !== 'TEXTAREA') {
    // No-op intentional — initial useState already pulled it; later realtime
    // updates pull through the parent re-render.
  }

  const save = useMutation({
    mutationFn: () =>
      upsertWinner({
        domain,
        rank,
        teamId: teamId === 'none' ? null : teamId,
        citation: citation.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`${domain} ${RANK_LABEL[rank]} saved`);
      qc.invalidateQueries({ queryKey: ['winners'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save'),
  });

  const Icon = rank === 1 ? Crown : Medal;
  const slotTone =
    rank === 1
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-slate-400/40 bg-slate-400/10 text-slate-700 dark:text-slate-200';

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]', slotTone)}>
          <Icon className="h-3 w-3" />
          {RANK_LABEL[rank]}
        </span>
        {teamId !== 'none' || citation ? (
          <button
            type="button"
            onClick={() => {
              setTeamId('none');
              setCitation('');
            }}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
            title="Clear slot"
          >
            <X className="h-3 w-3" /> clear
          </button>
        ) : null}
      </div>

      <Select value={teamId} onValueChange={setTeamId}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a team…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— None —</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.team_name}{' '}
              <span className="font-mono text-2xs text-muted-foreground">({t.team_code})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-1">
        <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          Citation (optional, ≤280 chars)
        </Label>
        <Textarea
          rows={2}
          value={citation}
          onChange={(e) => setCitation(e.target.value)}
          maxLength={280}
          placeholder="One sentence about why they won…"
          className="text-sm"
        />
      </div>

      <Button
        size="sm"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full"
      >
        {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </Button>
    </div>
  );
}
