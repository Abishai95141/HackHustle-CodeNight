import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Award, Eraser, Gavel, Loader2, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/data/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import {
  useJudges,
  useJudgeAssignments,
  useRankingsByDomain,
} from '@/data/queries/judging';
import { assignTeamsToJudge, unassignTeamFromJudge } from '@/data/rpc/judging';
import { TEAM_DOMAINS, useTeams, type TeamDomain } from '@/data/queries/teams';
import { activeRoundName } from '@/config/rules.scoring';
import { TOTAL_MAX } from '@/domain/scoring/rules';

type Tab = 'assign' | 'rankings';
type DomainFilter = 'all' | TeamDomain;

export function AdminJudgingPage() {
  const [tab, setTab] = useState<Tab>('assign');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Judging"
        subtitle={`Assign teams to judges and watch the per-domain rankings, ${activeRoundName}.`}
      />

      <div className="inline-flex rounded-md border border-border p-0.5">
        <TabBtn active={tab === 'assign'} onClick={() => setTab('assign')} icon={Gavel}>
          Assignments
        </TabBtn>
        <TabBtn active={tab === 'rankings'} onClick={() => setTab('rankings')} icon={Award}>
          Rankings
        </TabBtn>
      </div>

      {tab === 'assign' ? <AssignSection /> : <RankingsSection />}
    </div>
  );
}

function AssignSection() {
  const judges = useJudges();
  const teams = useTeams();
  const assignments = useJudgeAssignments();
  const qc = useQueryClient();

  const [judgeId, setJudgeId] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Map: judge_id -> Set<team_id> (current round)
  const assignedByJudge = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of assignments.data ?? []) {
      if (a.round_name !== activeRoundName) continue;
      const cur = map.get(a.judge_id) ?? new Set<string>();
      cur.add(a.team_id);
      map.set(a.judge_id, cur);
    }
    return map;
  }, [assignments.data]);

  const assignedToCurrent = judgeId ? assignedByJudge.get(judgeId) ?? new Set<string>() : new Set<string>();

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (teams.data ?? []).filter((t) => {
      if (domainFilter !== 'all' && t.domain !== domainFilter) return false;
      if (
        q &&
        !t.team_name.toLowerCase().includes(q) &&
        !t.team_code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [teams.data, domainFilter, search]);

  const assignBulk = useMutation({
    mutationFn: () =>
      assignTeamsToJudge({
        judgeId,
        teamIds: Array.from(picked),
        roundName: activeRoundName,
      }),
    onSuccess: ({ inserted }) => {
      toast.success(`Assigned ${inserted} team(s) (skipped duplicates)`);
      qc.invalidateQueries({ queryKey: ['admin', 'judge-assignments'] });
      qc.invalidateQueries({ queryKey: ['judge', 'assignments'] });
      setPicked(new Set());
    },
    onError: (err: Error) => toast.error(err.message ?? 'Assign failed'),
  });

  const unassign = useMutation({
    mutationFn: (teamId: string) =>
      unassignTeamFromJudge({ judgeId, teamId, roundName: activeRoundName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'judge-assignments'] });
      qc.invalidateQueries({ queryKey: ['judge', 'assignments'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Unassign failed'),
  });

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function pickAllVisible() {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const t of filteredTeams) if (!assignedToCurrent.has(t.id)) next.add(t.id);
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Judges list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Judges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {judges.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (judges.data ?? []).length === 0 ? (
            <EmptyState
              title="No judges"
              body="Promote a user to judge from the Users page."
            />
          ) : (
            (judges.data ?? []).map((j) => {
              const count = assignedByJudge.get(j.id)?.size ?? 0;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    setJudgeId(j.id);
                    setPicked(new Set());
                  }}
                  className={cn(
                    'flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    judgeId === j.id ? 'bg-secondary' : 'hover:bg-secondary/60',
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{j.name}</div>
                    <div className="truncate text-2xs text-muted-foreground">{j.email}</div>
                  </div>
                  <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Team picker */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Teams {judgeId ? `· assigning to ${judges.data?.find((j) => j.id === judgeId)?.name}` : ''}
            </CardTitle>
            {judgeId ? (
              <Button
                size="sm"
                disabled={picked.size === 0 || assignBulk.isPending}
                onClick={() => assignBulk.mutate()}
              >
                {assignBulk.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Assign {picked.size > 0 ? picked.size : ''} →
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team…"
                className="pl-9"
              />
            </div>
            <Select value={domainFilter} onValueChange={(v) => setDomainFilter(v as DomainFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {TEAM_DOMAINS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {judgeId ? (
              <Button variant="outline" size="sm" onClick={pickAllVisible}>
                Select visible
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!judgeId ? (
            <EmptyState
              title="Pick a judge to start"
              body="Choose a judge on the left, then select teams to assign."
            />
          ) : filteredTeams.length === 0 ? (
            <EmptyState
              title="No teams match"
              body="Adjust the domain filter or search."
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Team</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead className="w-32 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((t) => {
                    const isAssigned = assignedToCurrent.has(t.id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Checkbox
                            checked={picked.has(t.id)}
                            onCheckedChange={() => togglePick(t.id)}
                            disabled={isAssigned}
                            aria-label={`Pick ${t.team_name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{t.team_name}</div>
                          <div className="font-mono text-2xs text-muted-foreground">{t.team_code}</div>
                        </TableCell>
                        <TableCell>
                          {t.domain ? (
                            <DomainPill domain={t.domain} />
                          ) : (
                            <span className="text-2xs text-rose-600 dark:text-rose-400">! none</span>
                          )}
                        </TableCell>
                        <TableCell className="text-2xs text-muted-foreground">
                          {t.member_count}
                          {t.absent_count > 0 ? ` (${t.absent_count} absent)` : ''}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAssigned ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => unassign.mutate(t.id)}
                              className="gap-1 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Unassign
                            </Button>
                          ) : (
                            <span className="text-2xs text-muted-foreground">Available</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const RESET_PHRASE = 'RESET ALL SCORES';

function RankingsSection() {
  const { data: rows = [], isLoading } = useRankingsByDomain();
  const qc = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');

  const grouped = useMemo(() => {
    const m = new Map<TeamDomain | 'unassigned', typeof rows>();
    for (const r of rows) {
      const k = (r.domain ?? 'unassigned') as TeamDomain | 'unassigned';
      const cur = m.get(k) ?? [];
      cur.push(r);
      m.set(k, cur);
    }
    // Sort within each domain by total_score desc.
    for (const list of m.values()) list.sort((a, b) => b.total_score - a.total_score);
    return m;
  }, [rows]);

  const resetAll = useMutation({
    // Delete every judge_scores row. The on_judge_score_change trigger then
    // recomputes teams.total_score to 0 (AVG over zero rows → 0 via COALESCE).
    // Admin RLS (judge_scores_admin_all) authorizes the delete.
    mutationFn: async () => {
      // PostgREST requires a WHERE clause for DELETE — use a tautology on a
      // never-null column so it matches every row.
      const { error } = await supabase
        .from('judge_scores')
        .delete()
        .not('id', 'is', null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('All scores reset');
      qc.invalidateQueries({ queryKey: ['admin', 'rankings'] });
      qc.invalidateQueries({ queryKey: ['judge', 'assignments'] });
      qc.invalidateQueries({ queryKey: ['leaderboard', 'teams'] });
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
      setResetOpen(false);
      setResetConfirm('');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to reset'),
  });

  const totalScored = rows.filter((r) => r.total_score > 0).length;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-2.5">
        <div className="text-2xs text-muted-foreground">
          {totalScored} of {rows.length} teams have scores
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setResetOpen(true);
            setResetConfirm('');
          }}
          className="border-rose-500/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
        >
          <Eraser className="h-4 w-4" /> Reset all scores
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
      {TEAM_DOMAINS.map((d) => {
        const list = grouped.get(d) ?? [];
        return (
          <Card key={d}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                <DomainPill domain={d} />
              </CardTitle>
              <span className="text-2xs text-muted-foreground">{list.length} teams</span>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {list.length === 0 ? (
                <p className="text-2xs text-muted-foreground">No teams in this domain yet.</p>
              ) : (
                list.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold',
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : idx === 1
                              ? 'bg-slate-400/20 text-slate-700 dark:text-slate-200'
                              : idx === 2
                                ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                                : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.team_name}</div>
                        <div className="truncate font-mono text-2xs text-muted-foreground">
                          {t.team_code}
                          {t.table_number ? ` · Table ${t.table_number}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm tabular-nums">
                      {t.total_score.toFixed(1)}
                      <span className="ml-0.5 text-2xs text-muted-foreground">/{TOTAL_MAX}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      {(grouped.get('unassigned') ?? []).length > 0 ? (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base text-rose-700 dark:text-rose-300">
              Teams without a domain
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {(grouped.get('unassigned') ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.team_name}</div>
                  <div className="truncate font-mono text-2xs text-muted-foreground">
                    {t.team_code}
                  </div>
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {t.total_score.toFixed(1)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      </div>

      <AlertDialog
        open={resetOpen}
        onOpenChange={(o) => {
          setResetOpen(o);
          if (!o) setResetConfirm('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              Reset all scores
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes <strong>every</strong> score row from <code>judge_scores</code> and
              recalculates each team's total back to zero. Affects all judges, all rounds, all
              domains. Cannot be undone.
              <br />
              <br />
              Type <span className="font-mono text-foreground">{RESET_PHRASE}</span> to enable the
              red button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder={RESET_PHRASE}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetConfirm !== RESET_PHRASE || resetAll.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => resetAll.mutate()}
            >
              {resetAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              Reset every score
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function DomainPill({ domain }: { domain: TeamDomain }) {
  const tones: Record<TeamDomain, string> = {
    Fintech: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Healthcare: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    Logistics: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
        tones[domain],
      )}
    >
      {domain}
    </span>
  );
}
