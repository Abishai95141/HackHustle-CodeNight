import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Award,
  CheckCircle2,
  Circle,
  Edit2,
  ExternalLink,
  FileText,
  Github,
  Hash,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttendancePill } from '@/components/composite/AttendancePill';
import { cn } from '@/lib/cn';
import { supabase } from '@/data/client';
import { signDeckUrl } from '@/data/rpc/submissions';
import type { TeamRow, TeamDomain } from '@/data/queries/teams';
import { TOTAL_MAX } from '@/domain/scoring/rules';
import { activeRoundName } from '@/config/rules.scoring';
import { toast } from 'sonner';
import type { AttendanceStatus } from '@/data/queries/users';

const DOMAIN_TONE: Record<TeamDomain, string> = {
  Fintech: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Healthcare: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Logistics: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

type Props = {
  team: TeamRow | null;
  onClose: () => void;
  onEdit: (team: TeamRow) => void;
  onDelete: (team: TeamRow) => void;
};

/** Read-mostly profile of a team. Lazy-loads submission + judging completion
 *  so the parent table list isn't slowed down. */
export function TeamDetailDialog({ team, onClose, onEdit, onDelete }: Props) {
  const detail = useQuery({
    queryKey: ['admin', 'team-detail', team?.id],
    enabled: !!team,
    queryFn: async () => {
      if (!team) return null;
      const [submissionRes, assignsRes, scoresRes, membersRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('deck_path, deck_filename, deck_size_bytes, github_url, updated_at')
          .eq('team_id', team.id)
          .maybeSingle(),
        supabase
          .from('judge_assignments')
          .select('judge_id')
          .eq('team_id', team.id)
          .eq('round_name', activeRoundName),
        supabase
          .from('judge_scores')
          .select('judge_id')
          .eq('team_id', team.id)
          .eq('round_name', activeRoundName),
        // Pull richer member info than what TeamRow.members carries.
        supabase
          .from('profiles')
          .select('id, name, email, attendance_status, is_inside_venue')
          .eq('team_id', team.id)
          .order('name'),
      ]);
      if (submissionRes.error) throw submissionRes.error;
      if (assignsRes.error) throw assignsRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (membersRes.error) throw membersRes.error;

      const assignedIds = new Set((assignsRes.data ?? []).map((a) => a.judge_id));
      const scoredIds = new Set((scoresRes.data ?? []).map((s) => s.judge_id));
      let judgeNameById = new Map<string, string>();
      if (assignedIds.size > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(assignedIds));
        judgeNameById = new Map((data ?? []).map((p) => [p.id, p.name]));
      }

      return {
        submission: submissionRes.data ?? null,
        assignedJudges: Array.from(assignedIds).map((id) => ({
          id,
          name: judgeNameById.get(id) ?? '—',
          scored: scoredIds.has(id),
        })),
        members: (membersRes.data ?? []) as Array<{
          id: string;
          name: string;
          email: string;
          attendance_status: AttendanceStatus;
          is_inside_venue: boolean | null;
        }>,
      };
    },
  });

  async function openDeck() {
    if (!detail.data?.submission?.deck_path) return;
    try {
      const url = await signDeckUrl(detail.data.submission.deck_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Failed to open file';
      toast.error(m);
    }
  }

  const judgingStatusLabel = (() => {
    const a = detail.data?.assignedJudges.length ?? 0;
    const s = detail.data?.assignedJudges.filter((j) => j.scored).length ?? 0;
    if (a === 0) return 'No judges assigned';
    if (s === 0) return 'Not started';
    if (s < a) return `Partial · ${s}/${a}`;
    return `Complete · ${s}/${a}`;
  })();

  return (
    <Dialog open={!!team} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {team ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{team.team_name}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono">{team.team_code}</span>
                {team.table_number ? <span>· Table {team.table_number}</span> : null}
              </DialogDescription>
            </DialogHeader>

            {/* Identity pills */}
            <div className="flex flex-wrap items-center gap-2">
              {team.domain ? (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
                    DOMAIN_TONE[team.domain],
                  )}
                >
                  {team.domain}
                </span>
              ) : (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-2xs uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300">
                  ! No domain
                </span>
              )}
              <span className="rounded-full border border-border px-2 py-0.5 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                {team.member_count} member{team.member_count === 1 ? '' : 's'}
              </span>
              {team.absent_count > 0 ? (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-2xs uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300">
                  {team.absent_count} absent
                </span>
              ) : null}
            </div>

            {/* Score */}
            <Section title="Score">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tabular-nums">
                  {(team.total_score ?? 0).toFixed(1)}
                </span>
                <span className="text-2xs text-muted-foreground">/ {TOTAL_MAX}</span>
              </div>
            </Section>

            {/* Submission */}
            <Section title="Submission">
              {detail.data?.submission && (detail.data.submission.deck_path || detail.data.submission.github_url) ? (
                <div className="space-y-2 text-sm">
                  {detail.data.submission.deck_path ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate text-2xs">
                          {detail.data.submission.deck_filename ?? 'Deck'}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" onClick={openDeck}>
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </Button>
                    </div>
                  ) : (
                    <p className="text-2xs text-muted-foreground">No deck uploaded.</p>
                  )}
                  {detail.data.submission.github_url ? (
                    <a
                      href={detail.data.submission.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-2xs hover:underline"
                    >
                      <Github className="h-3.5 w-3.5" /> {detail.data.submission.github_url}
                    </a>
                  ) : (
                    <p className="text-2xs text-muted-foreground">No GitHub link.</p>
                  )}
                  {detail.data.submission.updated_at ? (
                    <p className="text-2xs text-muted-foreground">
                      Updated {format(new Date(detail.data.submission.updated_at), 'MMM d, HH:mm')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-2xs text-muted-foreground">Team hasn't submitted anything yet.</p>
              )}
            </Section>

            {/* Judging */}
            <Section title={`Judging (${activeRoundName})`}>
              <div className="mb-2 inline-flex items-center gap-1.5 text-2xs">
                <Award className="h-3.5 w-3.5" />
                {judgingStatusLabel}
              </div>
              {(detail.data?.assignedJudges.length ?? 0) > 0 ? (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {detail.data!.assignedJudges.map((j) => (
                    <li key={j.id} className="flex items-center gap-2 text-2xs">
                      {j.scored ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={j.scored ? '' : 'text-muted-foreground'}>{j.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>

            {/* Members */}
            <Section title={`Members (${detail.data?.members.length ?? team.member_count})`}>
              {(detail.data?.members ?? []).length === 0 ? (
                <p className="text-2xs text-muted-foreground">No members yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.data!.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-2xs text-muted-foreground">{m.email}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AttendancePill status={m.attendance_status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Action footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEdit(team);
                }}
              >
                <Edit2 className="h-4 w-4" /> Edit team
              </Button>
              <Button
                variant="outline"
                className="border-rose-500/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                onClick={() => {
                  onClose();
                  onDelete(team);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete team
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-md border border-border bg-card/50 p-3">
      <h3 className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
