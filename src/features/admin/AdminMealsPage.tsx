import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Loader2, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMealRoster, useMealSessions } from '@/data/queries/meals';
import { supabase } from '@/data/client';
import { cn } from '@/lib/cn';

export function AdminMealsPage() {
  const { data: sessions = [], isLoading } = useMealSessions();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);

  // Auto-select the first session once sessions load. Re-checking on every
  // render keeps the selection valid even if a session is deleted.
  useEffect(() => {
    if (!sessions.length) {
      if (selectedMealType !== null) setSelectedMealType(null);
      return;
    }
    const stillExists = sessions.some((s) => s.meal_type === selectedMealType);
    if (!stillExists) setSelectedMealType(sessions[0].meal_type);
  }, [sessions, selectedMealType]);

  const totalParticipants = useQuery({
    queryKey: ['admin', 'participant-count'],
    queryFn: async () => {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const createSession = useMutation({
    mutationFn: async (input: { meal_type: string; display_name: string }) => {
      const { error } = await supabase.from('meal_sessions').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Session created');
      qc.invalidateQueries({ queryKey: ['admin', 'meals'] });
      setCreating(false);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create session'),
  });

  const toggleActive = useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('meal_sessions')
        .update({ is_active: input.is_active })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'meals'] }),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to toggle'),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Meals" subtitle="Sessions, claim funnel, active toggles." />
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> New session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create meal session</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createSession.mutate({
                  meal_type: String(fd.get('meal_type')).trim(),
                  display_name: String(fd.get('display_name')).trim(),
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="meal_type">Meal type ID</Label>
                <Input id="meal_type" name="meal_type" placeholder="e.g. LUNCH_DAY1" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="display_name">Display name</Label>
                <Input id="display_name" name="display_name" placeholder="e.g. Lunch · Day 1" required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSession.isPending}>
                  {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Participants" value={String(totalParticipants.data ?? '—')} />
        <Stat label="Active sessions" value={String(sessions.filter((s) => s.is_active).length)} />
        <Stat
          label="Meals served"
          value={String(sessions.reduce((sum, s) => sum + s.claimed, 0))}
        />
        <Stat label="Sessions" value={String(sessions.length)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead>Claimed</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>%</TableHead>
              <TableHead className="w-16 text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <EmptyState
                    title="No meal sessions"
                    body="Create one for breakfast, lunch, dinner, snacks, etc."
                  />
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => {
                const total = totalParticipants.data ?? 0;
                const remaining = Math.max(0, total - s.claimed);
                const pct = total > 0 ? Math.round((s.claimed / total) * 100) : 0;
                const active = selectedMealType === s.meal_type;
                return (
                  <TableRow
                    key={s.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      active ? 'bg-secondary' : 'hover:bg-secondary/50',
                    )}
                    onClick={() => setSelectedMealType(s.meal_type)}
                  >
                    <TableCell className="font-mono text-2xs">{s.meal_type}</TableCell>
                    <TableCell className="font-medium">{s.display_name}</TableCell>
                    <TableCell>{s.claimed}</TableCell>
                    <TableCell className="text-muted-foreground">{remaining}</TableCell>
                    <TableCell>{pct}%</TableCell>
                    <TableCell
                      className="text-right"
                      // Clicks on the switch shouldn't bubble up and re-select the row.
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={!!s.is_active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: s.id, is_active: v })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedMealType ? (
        <MealRosterPanel
          mealType={selectedMealType}
          displayName={
            sessions.find((s) => s.meal_type === selectedMealType)?.display_name ?? selectedMealType
          }
        />
      ) : null}
    </div>
  );
}

type RosterFilter = 'all' | 'claimed' | 'pending';

function MealRosterPanel({ mealType, displayName }: { mealType: string; displayName: string }) {
  const { data: roster = [], isLoading } = useMealRoster(mealType);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    let claimed = 0;
    for (const r of roster) if (r.claimed_at) claimed++;
    return { total: roster.length, claimed, pending: roster.length - claimed };
  }, [roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((r) => {
      if (filter === 'claimed' && !r.claimed_at) return false;
      if (filter === 'pending' && r.claimed_at) return false;
      if (q) {
        const hay =
          `${r.name} ${r.email} ${r.team?.team_name ?? ''} ${r.team?.team_code ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roster, filter, search]);

  const pct = counts.total > 0 ? Math.round((counts.claimed / counts.total) * 100) : 0;

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Roster</div>
          <h2 className="font-display text-lg font-semibold tracking-tight">{displayName}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-2xs">
          <span className="rounded-full border border-border bg-card px-2 py-0.5">
            {counts.total} total
          </span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
            {counts.claimed} claimed · {pct}%
          </span>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
            {counts.pending} not yet
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
          <Chip active={filter === 'claimed'} onClick={() => setFilter('claimed')}>Claimed</Chip>
          <Chip active={filter === 'pending'} onClick={() => setFilter('pending')}>Not yet claimed</Chip>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, team…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scanned by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Loading roster…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-0">
                  <EmptyState
                    title={counts.total === 0 ? 'No participants' : 'No matches'}
                    body={
                      counts.total === 0
                        ? 'Once participants are imported and not absent, they appear here.'
                        : 'Loosen the search or filter to see more rows.'
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const claimed = !!r.claimed_at;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {claimed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-2xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      {r.team ? (
                        <div>
                          <div className="text-sm">{r.team.team_name}</div>
                          <div className="font-mono text-2xs text-muted-foreground">{r.team.team_code}</div>
                        </div>
                      ) : (
                        <span className="text-2xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {claimed ? (
                        <span className="font-mono text-2xs text-emerald-700 dark:text-emerald-300">
                          {format(new Date(r.claimed_at!), 'MMM d · HH:mm')}
                        </span>
                      ) : (
                        <span className="text-2xs text-muted-foreground">Not yet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-2xs text-muted-foreground">{r.scanned_by_name ?? '—'}</span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function Chip({
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
        'inline-flex items-center rounded px-2.5 py-1 text-xs transition-colors',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
