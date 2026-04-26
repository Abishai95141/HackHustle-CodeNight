import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Edit2, Flame, Loader2, Plus, Search, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTeams, useUnassignedProfiles, TEAM_DOMAINS, type TeamDomain, type TeamRow } from '@/data/queries/teams';
import { supabase } from '@/data/client';

export function AdminTeamsPage() {
  const { data: teams = [], isLoading } = useTeams();
  const { data: unassigned = [] } = useUnassignedProfiles();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [deleting, setDeleting] = useState<TeamRow | null>(null);
  const [addMemberId, setAddMemberId] = useState<string>('');
  const [createDomain, setCreateDomain] = useState<TeamDomain | 'none'>('none');
  const [editDomain, setEditDomain] = useState<TeamDomain | 'none'>('none');
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const PURGE_PHRASE = 'DELETE ALL TEAMS';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.team_name.toLowerCase().includes(q) ||
        t.team_code.toLowerCase().includes(q) ||
        (t.table_number ?? '').toLowerCase().includes(q),
    );
  }, [teams, search]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
    qc.invalidateQueries({ queryKey: ['admin', 'unassigned-profiles'] });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const createTeam = useMutation({
    mutationFn: async (input: {
      team_name: string;
      team_code: string;
      table_number?: string | null;
      domain?: TeamDomain | null;
    }) => {
      const { error } = await supabase.from('teams').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team created');
      invalidateAll();
      setCreating(false);
      setCreateDomain('none');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create team'),
  });

  const updateTeam = useMutation({
    mutationFn: async (input: {
      id: string;
      team_name: string;
      team_code: string;
      table_number: string | null;
      total_score: number;
      domain: TeamDomain | null;
    }) => {
      const { error } = await supabase
        .from('teams')
        .update({
          team_name: input.team_name,
          team_code: input.team_code,
          table_number: input.table_number,
          total_score: input.total_score,
          domain: input.domain,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team updated');
      invalidateAll();
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update team'),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team deleted');
      invalidateAll();
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete team'),
  });

  const purgeAllTeams = useMutation({
    // Admin RLS (teams_admin_all) authorizes the bulk delete. PostgREST needs
    // a WHERE clause for DELETE — `not('id', 'is', null)` matches every row.
    // Cascades: profile.team_id → NULL, judge_assignments + judge_scores +
    // submissions → CASCADE delete, queries.team_id → SET NULL.
    mutationFn: async (): Promise<{ deleted: number }> => {
      const { count, error } = await supabase
        .from('teams')
        .delete({ count: 'exact' })
        .not('id', 'is', null);
      if (error) throw error;
      return { deleted: count ?? 0 };
    },
    onSuccess: ({ deleted }) => {
      toast.success(`Purged ${deleted} team(s)`);
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['rsvp'] });
      setPurgeOpen(false);
      setPurgeConfirm('');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to purge teams'),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ team_id: null }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member removed');
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to remove member'),
  });

  const addMember = useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: string }) => {
      const { error } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member added');
      setAddMemberId('');
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to add member'),
  });

  const editingFresh = editing ? teams.find((t) => t.id === editing.id) ?? editing : null;

  useEffect(() => {
    if (editing) setEditDomain(editing.domain ?? 'none');
  }, [editing]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Teams" subtitle="Create, rename, assign tables." />
        <div className="flex flex-wrap items-center gap-2">
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Create team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New team</DialogTitle>
              <DialogDescription>Team codes must be unique.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createTeam.mutate({
                  team_name: String(fd.get('team_name')).trim(),
                  team_code: String(fd.get('team_code')).trim(),
                  table_number: String(fd.get('table_number') ?? '').trim() || null,
                  domain: createDomain !== 'none' ? createDomain : null,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="team_name">Team name</Label>
                <Input id="team_name" name="team_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team_code">Team code</Label>
                <Input id="team_code" name="team_code" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="table_number">Table number</Label>
                  <Input id="table_number" name="table_number" placeholder="optional" />
                </div>
                <div className="space-y-1.5">
                  <Label>Domain</Label>
                  <Select value={createDomain} onValueChange={(v) => setCreateDomain(v as TeamDomain | 'none')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No domain</SelectItem>
                      {TEAM_DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTeam.isPending}>
                  {createTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          className="border-rose-500/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
          onClick={() => {
            setPurgeOpen(true);
            setPurgeConfirm('');
          }}
        >
          <Flame className="h-4 w-4" /> Purge all
        </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams…"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <EmptyState
                    title="No teams yet"
                    body="Create one manually or import a participant CSV — teams are auto-created from team_code."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.team_name}</TableCell>
                  <TableCell className="font-mono text-2xs text-muted-foreground">{t.team_code}</TableCell>
                  <TableCell>
                    {t.domain ? (
                      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]">
                        {t.domain}
                      </span>
                    ) : t.member_count > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300"
                        title="Teams with participants must have a domain set"
                      >
                        ! missing
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{t.table_number ?? '—'}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-2 text-muted-foreground"
                      title={t.absent_count > 0 ? `${t.absent_count} absent` : undefined}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {t.member_count}
                      {t.absent_count > 0 ? (
                        <span className="text-rose-600 dark:text-rose-300">({t.absent_count} absent)</span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{(t.total_score ?? 0).toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(t)}
                        title="Delete team"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAddMemberId('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
            <DialogDescription className="font-mono text-2xs">
              {editingFresh?.team_code}
            </DialogDescription>
          </DialogHeader>
          {editingFresh ? (
            <div className="space-y-5">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  updateTeam.mutate({
                    id: editingFresh.id,
                    team_name: String(fd.get('team_name')).trim(),
                    team_code: String(fd.get('team_code')).trim(),
                    table_number: String(fd.get('table_number') ?? '').trim() || null,
                    total_score: Number(fd.get('total_score') ?? 0),
                    domain: editDomain !== 'none' ? editDomain : null,
                  });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="edit_team_name">Team name</Label>
                  <Input id="edit_team_name" name="team_name" defaultValue={editingFresh.team_name} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_team_code">Team code</Label>
                  <Input id="edit_team_code" name="team_code" defaultValue={editingFresh.team_code} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit_table_number">Table number</Label>
                    <Input
                      id="edit_table_number"
                      name="table_number"
                      defaultValue={editingFresh.table_number ?? ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit_total_score">Total score</Label>
                    <Input
                      id="edit_total_score"
                      name="total_score"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={editingFresh.total_score ?? 0}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Domain</Label>
                  <Select value={editDomain} onValueChange={(v) => setEditDomain(v as TeamDomain | 'none')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No domain</SelectItem>
                      {TEAM_DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Close
                  </Button>
                  <Button type="submit" disabled={updateTeam.isPending}>
                    {updateTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </form>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Members ({editingFresh.member_count})
                </div>
                {editingFresh.members.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {editingFresh.members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2">
                        <span>
                          {m.name}
                          <span className="ml-1 text-muted-foreground">({m.email})</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Remove from team"
                          onClick={() => removeMember.mutate(m.id)}
                          disabled={removeMember.isPending}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No members yet.</p>
                )}

                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Select value={addMemberId} onValueChange={setAddMemberId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Add unassigned user…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No unassigned users
                        </div>
                      ) : (
                        unassigned.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.email})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    disabled={!addMemberId || addMember.isPending}
                    onClick={() => addMember.mutate({ userId: addMemberId, teamId: editingFresh.id })}
                    title="Add to team"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-medium text-foreground">{deleting?.team_name}</span>{' '}
              <span className="font-mono text-2xs">({deleting?.team_code})</span>. Members will be unassigned
              and judging rows for this team will cascade. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteTeam.mutate(deleting.id)}
              disabled={deleteTeam.isPending}
            >
              {deleteTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge ALL teams */}
      <AlertDialog
        open={purgeOpen}
        onOpenChange={(o) => {
          setPurgeOpen(o);
          if (!o) setPurgeConfirm('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              Purge ALL teams
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deletes every team — currently <strong>{teams.length}</strong>. Cascades:
              members get unassigned (<code>team_id</code> → null), judge assignments,
              judge scores, and submissions are removed, queries lose their team link.
              User accounts and attendance records are kept. Cannot be undone.
              <br />
              <br />
              Type <span className="font-mono text-foreground">{PURGE_PHRASE}</span> to enable the
              red button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
            placeholder={PURGE_PHRASE}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={purgeConfirm !== PURGE_PHRASE || purgeAllTeams.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => purgeAllTeams.mutate()}
            >
              {purgeAllTeams.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              Purge every team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
