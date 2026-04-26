import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Lock, Medal, Sparkles, Star } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { InlineLoader } from '@/components/composite/InlineLoader';
import { supabase } from '@/data/client';
import { useWinners, type WinnerRow } from '@/data/queries/winners';
import { useAppSettingsValue } from '@/data/queries/appSettings';
import { TEAM_DOMAINS, type TeamDomain } from '@/data/queries/teams';
import { cn } from '@/lib/cn';

// Domain visual identity — matches the chips used elsewhere so the colour
// system reads as intentional rather than decorative.
const DOMAIN_TONES: Record<TeamDomain, { from: string; to: string; chip: string; ring: string; ink: string }> = {
  Fintech: {
    from: 'from-emerald-500/20',
    to: 'to-emerald-500/0',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/30',
    ink: 'text-emerald-700 dark:text-emerald-300',
  },
  Healthcare: {
    from: 'from-sky-500/20',
    to: 'to-sky-500/0',
    chip: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-500/30',
    ink: 'text-sky-700 dark:text-sky-300',
  },
  Logistics: {
    from: 'from-amber-500/20',
    to: 'to-amber-500/0',
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/30',
    ink: 'text-amber-700 dark:text-amber-300',
  },
};

export function ParticipantWinnersPage() {
  const { profile } = useAuth();
  const { winners_announced } = useAppSettingsValue();
  const { data: rows = [], isLoading } = useWinners();

  // Look up the participant's own team domain so we can emphasize it.
  const myTeam = useQuery({
    queryKey: ['me', 'team-summary', profile?.team_id],
    enabled: !!profile?.team_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, domain')
        .eq('id', profile!.team_id!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; domain: TeamDomain | null } | null;
    },
  });

  const myDomain = myTeam.data?.domain ?? null;
  const myTeamId = myTeam.data?.id ?? null;

  // Group rows by domain. The seed migration makes 6 rows guaranteed to exist
  // (3 domains × 2 ranks). Some may have null team_id (admin hasn't picked).
  const grouped = useMemo(() => {
    const m = new Map<TeamDomain, WinnerRow[]>();
    for (const d of TEAM_DOMAINS) m.set(d, []);
    for (const w of rows) m.get(w.domain)?.push(w);
    for (const list of m.values()) list.sort((a, b) => a.rank - b.rank);
    return m;
  }, [rows]);

  // Order the domains so the participant's own domain renders first.
  const orderedDomains = useMemo(() => {
    if (!myDomain) return TEAM_DOMAINS;
    return [myDomain, ...TEAM_DOMAINS.filter((d) => d !== myDomain)];
  }, [myDomain]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 sm:p-8">
        {/* Background sparkles */}
        <Sparkles className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 text-amber-500/10" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            Champions
          </div>
          <PageHeader
            title="Winners"
            subtitle={
              winners_announced
                ? 'The teams that took home the top spots in each domain.'
                : 'Stay tuned — the moment results are released, they appear here.'
            }
          />
        </div>
      </header>

      <div className="mt-6">
        {!winners_announced ? (
          <LockedState />
        ) : isLoading ? (
          <InlineLoader />
        ) : rows.every((r) => !r.team_id) ? (
          <LockedState />
        ) : (
          <div className="space-y-10">
            {orderedDomains.map((domain) => (
              <DomainPanel
                key={domain}
                domain={domain}
                slots={grouped.get(domain) ?? []}
                isMine={myDomain === domain}
                myTeamId={myTeamId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LockedState() {
  return (
    <EmptyState
      title="Winners haven't been announced yet"
      body="The organizers will release the results here. The page updates live — no need to refresh."
      action={
        <div className="inline-flex items-center gap-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Live updates enabled
        </div>
      }
    />
  );
}

function DomainPanel({
  domain,
  slots,
  isMine,
  myTeamId,
}: {
  domain: TeamDomain;
  slots: WinnerRow[];
  isMine: boolean;
  myTeamId: string | null;
}) {
  const tone = DOMAIN_TONES[domain];
  const first = slots.find((s) => s.rank === 1) ?? null;
  const second = slots.find((s) => s.rank === 2) ?? null;
  const anyPicked = !!(first?.team_id || second?.team_id);

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6',
        isMine ? 'border-foreground/20 shadow-sm' : 'border-border',
      )}
    >
      {/* Soft tinted backdrop in domain colour */}
      <div className={cn('pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br', tone.from, tone.to)} />

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
              tone.chip,
            )}
          >
            {domain}
          </span>
          {isMine ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">
              <Star className="h-2.5 w-2.5" />
              Your domain
            </span>
          ) : null}
        </div>
      </header>

      {!anyPicked ? (
        <div className="rounded-md border border-dashed border-border p-4 text-2xs text-muted-foreground">
          The organizers haven't released this domain yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          {/* 1st place — taller, dominant */}
          <div className="md:col-span-3">
            <PodiumCard
              rank={1}
              row={first}
              isMine={!!(first?.team_id && first.team_id === myTeamId)}
              tone={tone}
            />
          </div>
          {/* 2nd place — shorter, narrower */}
          <div className="md:col-span-2">
            <PodiumCard
              rank={2}
              row={second}
              isMine={!!(second?.team_id && second.team_id === myTeamId)}
              tone={tone}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function PodiumCard({
  rank,
  row,
  isMine,
  tone,
}: {
  rank: 1 | 2;
  row: WinnerRow | null;
  isMine: boolean;
  tone: { ring: string; ink: string };
}) {
  if (!row || !row.team_id || !row.team) {
    return (
      <div className="flex h-full min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center">
        <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          {rank === 1 ? '1st place' : '2nd place'}
        </span>
        <span className="mt-1 text-2xs text-muted-foreground">Not announced</span>
      </div>
    );
  }

  const isFirst = rank === 1;

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border bg-background p-5 transition-transform duration-300',
        // Gold for 1st, silver for 2nd
        isFirst
          ? 'border-amber-500/50 shadow-[0_0_0_1px_rgba(245,158,11,0.05),0_8px_30px_-12px_rgba(245,158,11,0.45)]'
          : 'border-slate-400/40 shadow-[0_0_0_1px_rgba(148,163,184,0.05),0_6px_24px_-12px_rgba(148,163,184,0.45)]',
        isMine && 'ring-2 ring-offset-2 ring-offset-background',
        isMine && tone.ring,
        // Subtle scale-in on appearance.
        'animate-slide-up',
      )}
    >
      {/* Decorative ribbon corner */}
      <div
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-28 w-28 rotate-12 opacity-30',
          isFirst
            ? 'bg-gradient-to-br from-amber-400/40 to-amber-200/0'
            : 'bg-gradient-to-br from-slate-400/40 to-slate-200/0',
        )}
      />

      {/* Crown / Medal badge */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.18em]',
            isFirst
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-slate-400/50 bg-slate-400/10 text-slate-700 dark:text-slate-200',
          )}
        >
          {isFirst ? <Crown className="h-3.5 w-3.5" /> : <Medal className="h-3.5 w-3.5" />}
          {isFirst ? '1st place' : '2nd place'}
        </span>
        {isMine ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-foreground/30 bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground">
            <Sparkles className="h-2.5 w-2.5" />
            That's you
          </span>
        ) : null}
      </div>

      {/* Team name — the hero element */}
      <div className="space-y-1">
        <h3
          className={cn(
            'font-display font-semibold tracking-tight',
            isFirst ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
          )}
        >
          {row.team.team_name}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
          <span className="font-mono">{row.team.team_code}</span>
          {row.team.table_number ? <span>· Table {row.team.table_number}</span> : null}
        </div>
      </div>

      {row.citation ? (
        <p
          className={cn(
            'mt-auto rounded-md border-l-2 pl-3 text-sm italic leading-relaxed text-foreground/80',
            isFirst ? 'border-amber-500/60' : 'border-slate-400/60',
          )}
        >
          "{row.citation}"
        </p>
      ) : null}
    </article>
  );
}
