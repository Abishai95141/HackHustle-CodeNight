import { useQuery } from '@tanstack/react-query';
import { FileText, Lock } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { MarkdownView } from '@/components/composite/MarkdownView';
import { supabase } from '@/data/client';
import { useMyProblemStatements } from '@/data/queries/problemStatements';
import type { TeamDomain } from '@/data/queries/teams';
import { cn } from '@/lib/cn';

export function ParticipantProblemsPage() {
  const { profile } = useAuth();
  const { data = [], isLoading } = useMyProblemStatements();

  const team = useQuery({
    queryKey: ['me', 'team-summary', profile?.team_id],
    enabled: !!profile?.team_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('team_name, team_code, domain')
        .eq('id', profile!.team_id!)
        .maybeSingle();
      if (error) throw error;
      return data as { team_name: string; team_code: string; domain: TeamDomain | null } | null;
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="Problem Statements"
        subtitle="The official challenge briefs for your domain. Updates appear live."
      />

      {team.data?.domain ? (
        <div className="mt-4">
          <DomainChip domain={team.data.domain} />
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !profile?.team_id ? (
          <EmptyState
            title="No team yet"
            body="Your team hasn't been assigned. Talk to an organizer to get added to a team."
          />
        ) : !team.data?.domain ? (
          <EmptyState
            title="Domain not assigned"
            body="Your team doesn't have a domain set yet. An organizer will assign one shortly."
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="Not released yet"
            body="The problem statements for your domain haven't been unlocked. We'll show them here the moment they go live."
            action={
              <div className="inline-flex items-center gap-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Live updates enabled
              </div>
            }
          />
        ) : (
          data.map((row) => (
            <article
              key={row.id}
              className="rounded-lg border border-border bg-card p-5"
            >
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-2xs text-muted-foreground">#{row.display_order}</span>
                <h2 className="font-display text-lg font-semibold tracking-tight">{row.title}</h2>
                <span className="ml-auto text-2xs text-muted-foreground">
                  Updated {timeAgo(row.updated_at)}
                </span>
              </header>
              <MarkdownView markdown={row.body_md} />
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function DomainChip({ domain }: { domain: TeamDomain }) {
  const tones: Record<TeamDomain, string> = {
    Fintech: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Healthcare: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    Logistics: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-medium uppercase tracking-[0.14em]',
        tones[domain],
      )}
    >
      <FileText className="h-3.5 w-3.5" />
      Your domain · {domain}
    </span>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
