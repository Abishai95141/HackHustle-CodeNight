import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ListFilter, Search } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { EmptyState } from '@/components/composite/EmptyState';
import { InlineLoader } from '@/components/composite/InlineLoader';
import { SubmissionView } from '@/components/composite/SubmissionPanel';
import { ScoringForm } from '@/components/composite/ScoringForm';
import { cn } from '@/lib/cn';
import { activeRoundName } from '@/config/rules.scoring';
import { TOTAL_MAX } from '@/domain/scoring/rules';
import { useMyAssignedTeams, type AssignedTeam } from '@/data/queries/judging';
import { TEAM_DOMAINS, type TeamDomain } from '@/data/queries/teams';
import { supabase } from '@/data/client';
import type { SubmissionRow } from '@/data/queries/submissions';

type DomainFilter = 'all' | TeamDomain;

export function JudgeListPage() {
  const { user } = useAuth();
  const { data: teams = [], isLoading } = useMyAssignedTeams(user?.id);

  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Counts per domain for the tab badges.
  const counts = useMemo(() => {
    const m = new Map<TeamDomain | 'unassigned', number>();
    for (const t of teams) {
      const k = (t.domain ?? 'unassigned') as TeamDomain | 'unassigned';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      if (domainFilter !== 'all' && t.domain !== domainFilter) return false;
      if (q && !t.team_name.toLowerCase().includes(q) && !t.team_code.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [teams, domainFilter, search]);

  // Auto-select the first team in the current filter unless one is already chosen
  // and is still visible. On mobile this means the score page is always populated
  // — so the drawer is purely for switching between teams.
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((t) => t.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // Shared list panel — same render whether it lives in the desktop sidebar
  // or inside the mobile Sheet. Tap fires onPick which the parent uses to
  // both set the selected id AND close the drawer on mobile.
  function listPanel(onPick: (id: string) => void) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
              Assigned · {activeRoundName}
            </span>
            <span className="text-2xs text-muted-foreground">{teams.length} total</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <DomainTab active={domainFilter === 'all'} onClick={() => setDomainFilter('all')}>
              All <span className="ml-1 text-muted-foreground">{teams.length}</span>
            </DomainTab>
            {TEAM_DOMAINS.map((d) => (
              <DomainTab
                key={d}
                active={domainFilter === d}
                onClick={() => setDomainFilter(d)}
              >
                {d} <span className="ml-1 text-muted-foreground">{counts.get(d) ?? 0}</span>
              </DomainTab>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <InlineLoader className="px-4" />
          ) : teams.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No assignments"
                body="The admin hasn't assigned any teams to you yet."
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing matches" body="Adjust the filters or search." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const total = t.score?.total_score ?? null;
                const filled = total !== null;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onPick(t.id)}
                      className={cn(
                        'flex min-h-[56px] w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors',
                        selectedId === t.id ? 'bg-secondary' : 'hover:bg-secondary/60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {filled ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate font-medium">{t.team_name}</span>
                        </div>
                        <div className="ml-5 truncate text-2xs text-muted-foreground">
                          {t.domain ? `${t.domain} · ` : ''}
                          {t.table_number ? `Table ${t.table_number}` : t.team_code}
                        </div>
                      </div>
                      {filled ? (
                        <span className="font-mono text-sm tabular-nums">
                          {total}
                          <span className="ml-0.5 text-2xs text-muted-foreground">/{TOTAL_MAX}</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col md:h-[calc(100vh-3.5rem)] md:grid md:grid-cols-[360px_1fr]">
      {/* Mobile-only top bar with "Teams" drawer trigger */}
      <header className="sticky top-12 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ListFilter className="h-4 w-4" />
              Teams
              <span className="ml-1 rounded-full bg-secondary px-1.5 text-2xs text-muted-foreground">
                {filtered.length}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
            <SheetTitle className="sr-only">Assigned teams</SheetTitle>
            <SheetDescription className="sr-only">
              Pick a team to score. Use search and filters to narrow down.
            </SheetDescription>
            {listPanel((id) => {
              setSelectedId(id);
              setDrawerOpen(false);
            })}
          </SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1 text-right">
          <div className="truncate text-2xs uppercase tracking-[0.2em] text-muted-foreground">
            {selected?.domain ?? activeRoundName}
          </div>
          <div className="truncate text-sm font-medium">{selected?.team_name ?? '—'}</div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden min-h-0 md:flex md:flex-col md:border-r md:border-border md:bg-card">
        {listPanel((id) => setSelectedId(id))}
      </aside>

      {/* Score page */}
      <section className="overflow-y-auto bg-background p-4 sm:p-6 md:p-8">
        {selected ? (
          <TeamDetail team={selected} judgeId={user?.id ?? ''} />
        ) : (
          <EmptyState
            title="No team selected"
            body="Open the Teams drawer above to pick a team to score."
          />
        )}
      </section>
    </div>
  );
}

function TeamDetail({ team, judgeId }: { team: AssignedTeam; judgeId: string }) {
  const submission = useQuery({
    queryKey: ['judge', 'submission', team.id],
    queryFn: async (): Promise<SubmissionRow | null> => {
      const { data, error } = await supabase
        .from('submissions')
        .select(
          'id, team_id, github_url, deck_path, deck_filename, deck_mime, deck_size_bytes, updated_by, created_at, updated_at',
        )
        .eq('team_id', team.id)
        .maybeSingle();
      if (error) throw error;
      return (data as SubmissionRow | null) ?? null;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
            {team.round_name}
            {team.domain ? <span>· {team.domain}</span> : null}
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{team.team_name}</h2>
          <p className="text-sm text-muted-foreground">
            {team.table_number ? `Table ${team.table_number} · ` : ''}
            <span className="font-mono">{team.team_code}</span>
          </p>
        </div>
      </header>

      <section className="space-y-2">
        <h3 className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Submission</h3>
        <SubmissionView submission={submission.data ?? null} />
      </section>

      <section className="space-y-2">
        <h3 className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Scoring</h3>
        <ScoringForm
          judgeId={judgeId}
          teamId={team.id}
          roundName={team.round_name}
          initial={team.score}
        />
      </section>
    </div>
  );
}

function DomainTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-2xs transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
