import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, LogOut as LogOutIcon, Search, UserMinus, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { AttendancePill } from '@/components/composite/AttendancePill';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/cn';
import {
  useAttendanceRoster,
  summarizeAttendance,
  type RosterRow,
} from '@/data/queries/attendance';
import { TEAM_DOMAINS } from '@/data/queries/teams';
import { bulkMarkAttendance, markAttendance } from '@/data/rpc/attendance';
import type { AttendanceStatus } from '@/data/queries/users';

type Filter = 'all' | AttendanceStatus;

export function RsvpRosterPage() {
  const { data: rows = [], isLoading, error } = useAttendanceRoster();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAbsentId, setConfirmAbsentId] = useState<string | null>(null);
  const [confirmBulkAbsent, setConfirmBulkAbsent] = useState(false);

  const counts = useMemo(() => summarizeAttendance(rows), [rows]);

  // Distinct team list for the filter dropdown.
  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.team) map.set(r.team.id, `${r.team.team_name} (${r.team.team_code})`);
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.attendance_status !== filter) return false;
      if (teamFilter !== 'all' && r.team?.id !== teamFilter) return false;
      if (domainFilter !== 'all' && r.team?.domain !== domainFilter) return false;
      if (q && !(
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.team?.team_name.toLowerCase().includes(q) ||
        r.team?.team_code.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [rows, search, filter, teamFilter, domainFilter]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someChecked = filtered.some((r) => selected.has(r.id));

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) (checked ? next.add(r.id) : next.delete(r.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const markOne = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      markAttendance(id, status),
    onMutate: async ({ id, status }) => {
      // Optimistic UI: immediately swap the pill so the click feels instant.
      await qc.cancelQueries({ queryKey: ['rsvp', 'roster'] });
      const prev = qc.getQueryData<RosterRow[]>(['rsvp', 'roster']);
      qc.setQueryData<RosterRow[]>(['rsvp', 'roster'], (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, attendance_status: status } : r)),
      );
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(['rsvp', 'roster'], ctx?.prev);
      toast.error(err.message ?? 'Failed to mark');
    },
    onSuccess: (_data, vars) => {
      const labels: Record<AttendanceStatus, string> = {
        pending: 'reset to pending',
        checked_in: 'checked in',
        checked_out: 'checked out',
        absent: 'marked absent',
      };
      toast.success(`Participant ${labels[vars.status]}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['rsvp', 'roster'] }),
  });

  const markBulk = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: AttendanceStatus }) =>
      bulkMarkAttendance(ids, status),
    onSuccess: ({ ok, failed }) => {
      if (failed > 0) toast.error(`${ok} marked · ${failed} failed`);
      else toast.success(`${ok} marked`);
      setSelected(new Set());
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['rsvp', 'roster'] }),
  });

  function applyBulk(status: AttendanceStatus) {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error('Select participants first');
      return;
    }
    if (status === 'absent') {
      setConfirmBulkAbsent(true);
      return;
    }
    markBulk.mutate({ ids, status });
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
          <strong>Couldn't load roster.</strong> {(error as Error).message}
          {/missing|does not exist|schema/i.test((error as Error).message ?? '') ? (
            <div className="mt-1 text-2xs">
              The new schema may not be applied yet — run migrations
              <code className="mx-1 font-mono">0002_add_rsvp_enum.sql</code>
              and
              <code className="mx-1 font-mono">0003_rsvp_domains_notifications.sql</code>
              against your Supabase project.
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="RSVP roster"
          subtitle="Mark participants checked in, checked out, or absent at the door."
        />
        <div className="flex items-center gap-2">
          <CountTile label="Pending"     count={counts.pending}     onClick={() => setFilter('pending')}     active={filter === 'pending'} />
          <CountTile label="Checked-in"  count={counts.checked_in}  onClick={() => setFilter('checked_in')}  active={filter === 'checked_in'} tone="emerald" />
          <CountTile label="Checked-out" count={counts.checked_out} onClick={() => setFilter('checked_out')} active={filter === 'checked_out'} tone="sky" />
          <CountTile label="Absent"      count={counts.absent}      onClick={() => setFilter('absent')}      active={filter === 'absent'}  tone="rose" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, team…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="checked_out">Checked out</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teamOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
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
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          <span className="text-sm">
            <strong>{selected.size}</strong> selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyBulk('pending')}>
              Reset to pending
            </Button>
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => applyBulk('checked_in')}>
              <CheckCircle2 className="h-4 w-4" /> Check in
            </Button>
            <Button size="sm" className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => applyBulk('checked_out')}>
              <LogOutIcon className="h-4 w-4" /> Check out
            </Button>
            <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => applyBulk('absent')}>
              <UserMinus className="h-4 w-4" /> Absent
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked || (someChecked && 'indeterminate')}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Marked</TableHead>
              <TableHead className="w-[260px] text-right">Quick actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <EmptyState
                    title="No participants match"
                    body="Adjust the search or filters. Empty roster? Import participants from the Users page."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className={cn(selected.has(r.id) && 'bg-secondary/50')}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-2xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>
                    {r.team ? (
                      <div>
                        <div>{r.team.team_name}</div>
                        <div className="font-mono text-2xs text-muted-foreground">{r.team.team_code}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{r.team?.domain ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><AttendancePill status={r.attendance_status} /></TableCell>
                  <TableCell className="text-2xs text-muted-foreground">
                    {r.attendance_marked_at ? (
                      <>
                        {new Date(r.attendance_marked_at).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                        {r.attendance_marked_by_name ? <div>by {r.attendance_marked_by_name}</div> : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <ActionBtn
                        active={r.attendance_status === 'checked_in'}
                        tone="emerald"
                        onClick={() => markOne.mutate({ id: r.id, status: 'checked_in' })}
                        title="Check in"
                      >
                        <UserPlus className="h-4 w-4" />
                      </ActionBtn>
                      <ActionBtn
                        active={r.attendance_status === 'checked_out'}
                        tone="sky"
                        onClick={() => markOne.mutate({ id: r.id, status: 'checked_out' })}
                        title="Check out"
                      >
                        <LogOutIcon className="h-4 w-4" />
                      </ActionBtn>
                      <ActionBtn
                        active={r.attendance_status === 'absent'}
                        tone="rose"
                        onClick={() => setConfirmAbsentId(r.id)}
                        title="Absent"
                      >
                        <UserMinus className="h-4 w-4" />
                      </ActionBtn>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmAbsentId} onOpenChange={(o) => !o && setConfirmAbsentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark absent</AlertDialogTitle>
            <AlertDialogDescription>
              Once marked absent, this participant's QR code will be rejected at every volunteer scan
              (entry, exit, meals) and they'll be excluded from event metrics. You can revert later by
              checking them in or out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (!confirmAbsentId) return;
                markOne.mutate({ id: confirmAbsentId, status: 'absent' });
                setConfirmAbsentId(null);
              }}
            >
              Mark absent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmBulkAbsent}
        onOpenChange={(o) => {
          if (!o) setConfirmBulkAbsent(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {selected.size} participants absent</AlertDialogTitle>
            <AlertDialogDescription>
              Their QR scans will be rejected and they'll be excluded from event metrics.
              You can revert later from the same page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                markBulk.mutate({ ids: Array.from(selected), status: 'absent' });
                setConfirmBulkAbsent(false);
              }}
            >
              Mark absent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CountTile({
  label,
  count,
  onClick,
  active,
  tone = 'neutral',
}: {
  label: string;
  count: number;
  onClick: () => void;
  active: boolean;
  tone?: 'neutral' | 'emerald' | 'sky' | 'rose';
}) {
  const tones: Record<string, string> = {
    neutral: 'border-border text-foreground',
    emerald: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    sky: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
    rose: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-left transition-colors',
        tones[tone],
        active ? 'bg-secondary/60 ring-2 ring-foreground/20' : 'bg-card hover:bg-secondary/40',
      )}
    >
      <div className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold">{count}</div>
    </button>
  );
}

function ActionBtn({
  active,
  tone,
  onClick,
  title,
  children,
}: {
  active: boolean;
  tone: 'emerald' | 'sky' | 'rose';
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const baseTones: Record<string, string> = {
    emerald: 'hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    sky: 'hover:bg-sky-500/10 text-sky-700 dark:text-sky-300',
    rose: 'hover:bg-rose-500/10 text-rose-700 dark:text-rose-300',
  };
  const activeTones: Record<string, string> = {
    emerald: 'bg-emerald-500/15 ring-1 ring-emerald-500/40',
    sky: 'bg-sky-500/15 ring-1 ring-sky-500/40',
    rose: 'bg-rose-500/15 ring-1 ring-rose-500/40',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors',
        baseTones[tone],
        active && activeTones[tone],
      )}
    >
      {children}
    </button>
  );
}
