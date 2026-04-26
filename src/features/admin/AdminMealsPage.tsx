import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
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
import { useMealSessions } from '@/data/queries/meals';
import { supabase } from '@/data/client';

export function AdminMealsPage() {
  const { data: sessions = [], isLoading } = useMealSessions();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

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
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-2xs">{s.meal_type}</TableCell>
                    <TableCell className="font-medium">{s.display_name}</TableCell>
                    <TableCell>{s.claimed}</TableCell>
                    <TableCell className="text-muted-foreground">{remaining}</TableCell>
                    <TableCell>{pct}%</TableCell>
                    <TableCell className="text-right">
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
    </div>
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
