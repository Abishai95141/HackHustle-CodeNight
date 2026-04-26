import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Edit2, Flame, Loader2, Plus, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { StatusPill } from '@/components/composite/StatusPill';
import { AttendancePill } from '@/components/composite/AttendancePill';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUsers, type UserRow, type AttendanceStatus } from '@/data/queries/users';
import { useTeams, TEAM_DOMAINS, type TeamDomain } from '@/data/queries/teams';
import { createUser, deleteUser, purgeAllUsers, updateUserRole } from '@/data/rpc/users';
import { APP_ROLES, labelForRole, type AppRole } from '@/domain/auth/roles';
import { downloadCsv, parseCsv } from '@/lib/csv';
import { supabase } from '@/data/client';

type CsvRow = {
  name?: string;
  email?: string;
  phone?: string;
  team_name?: string;
  team_code?: string;
  domain?: string;
  tshirt_size?: string;
  dietary_restrictions?: string;
  role?: string;
};

export function AdminUsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [venueFilter, setVenueFilter] = useState<'all' | 'inside' | 'outside'>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | AttendanceStatus>('all');

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editingRole, setEditingRole] = useState<AppRole>('participant');

  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const [creating, setCreating] = useState(false);
  const [createTeamId, setCreateTeamId] = useState<string>('none');
  const [createRole, setCreateRole] = useState<AppRole>('participant');
  const [createDomain, setCreateDomain] = useState<TeamDomain | 'none'>('none');

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const { data: teams = [] } = useTeams();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.team?.team_name.toLowerCase().includes(q) ||
        u.team?.team_code.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesVenue =
        venueFilter === 'all' ||
        (venueFilter === 'inside' && !!u.is_inside_venue) ||
        (venueFilter === 'outside' && !u.is_inside_venue);
      const matchesAttendance =
        attendanceFilter === 'all' || u.attendance_status === attendanceFilter;
      return matchesQuery && matchesRole && matchesVenue && matchesAttendance;
    });
  }, [users, search, roleFilter, venueFilter, attendanceFilter]);

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => updateUserRole(userId, role),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update role'),
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete user'),
  });

  const createUserMutation = useMutation({
    mutationFn: (input: Parameters<typeof createUser>[0]) => createUser(input),
    onSuccess: (result) => {
      if (result.alreadyExists) {
        toast.info('User already exists — no changes made');
      } else {
        toast.success('User created');
      }
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
      setCreating(false);
      setCreateTeamId('none');
      setCreateRole('participant');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create user'),
  });

  const purgeMutation = useMutation({
    mutationFn: () => purgeAllUsers(),
    onSuccess: ({ deleted, skipped }) => {
      toast.success(`Purged ${deleted} user(s) (kept ${skipped})`);
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['rsvp'] });
      setPurgeOpen(false);
      setPurgeConfirm('');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to purge users'),
  });

  const PURGE_PHRASE = 'DELETE ALL USERS';
  const otherUserCount = users.length;  // approximation — admin's own row is included; UI text accounts for it.

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseCsv<CsvRow>(file);

      // Pre-validation pass: every row needs name+email; participants additionally
      // need team_name + team_code + a valid domain. Reject the whole import on
      // invalid participant rows so the admin doesn't end up with half-imported
      // teams missing their domain.
      const inferRole = (raw: string | undefined): AppRole =>
        ((APP_ROLES as readonly string[]).includes(raw ?? '') ? (raw as AppRole) : 'participant');

      const invalid: string[] = [];
      const valid: CsvRow[] = [];
      for (const r of rows) {
        if (!r.email || !r.name) continue;  // skip blank rows silently
        const role = inferRole(r.role);
        if (role === 'participant') {
          if (!r.team_name || !r.team_code) {
            invalid.push(`${r.email}: participant rows need team_name + team_code`);
            continue;
          }
          if (!r.domain || !(TEAM_DOMAINS as readonly string[]).includes(r.domain)) {
            invalid.push(
              `${r.email}: participant rows need domain ∈ {${TEAM_DOMAINS.join(', ')}} (got "${r.domain ?? ''}")`,
            );
            continue;
          }
        }
        valid.push(r);
      }
      if (invalid.length > 0) {
        toast.error(`Import aborted — ${invalid.length} row(s) invalid. First: ${invalid[0]}`, {
          duration: 8000,
        });
        console.warn('CSV import invalid rows:', invalid);
        return;
      }
      if (valid.length === 0) {
        toast.error('No valid rows. Required columns: name, email; participants also need team_name, team_code, domain.');
        return;
      }

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const credentials: Record<string, unknown>[] = [];

      for (const row of valid) {
        try {
          let teamId: string | null = null;

          if (row.team_code) {
            // Look up existing team. If found and missing a domain (or has a
            // mismatched domain), reconcile from the CSV — the CSV is the
            // source of truth for participant teams.
            const { data: existingTeam, error: lookupErr } = await supabase
              .from('teams')
              .select('id, domain')
              .eq('team_code', row.team_code)
              .maybeSingle();
            if (lookupErr) throw lookupErr;

            const csvDomain = (row.domain && (TEAM_DOMAINS as readonly string[]).includes(row.domain)
              ? (row.domain as TeamDomain)
              : null);

            if (existingTeam) {
              teamId = existingTeam.id;
              // If the existing team has no domain but this row supplies one, set it.
              if (!existingTeam.domain && csvDomain) {
                const { error: updErr } = await supabase
                  .from('teams')
                  .update({ domain: csvDomain })
                  .eq('id', existingTeam.id);
                if (updErr) throw updErr;
              }
            } else {
              const { data: newTeam, error: teamErr } = await supabase
                .from('teams')
                .insert({
                  team_name: row.team_name!,
                  team_code: row.team_code,
                  domain: csvDomain,
                })
                .select('id')
                .single();
              if (teamErr) throw teamErr;
              teamId = newTeam.id;
            }
          }

          const password = `Hack${Math.random().toString(36).slice(2, 10)}!`;
          const role = inferRole(row.role);

          const result = await createUser({
            email: row.email!,
            password,
            name: row.name!,
            team_id: teamId,
            phone: row.phone ?? null,
            tshirt_size: row.tshirt_size ?? null,
            dietary_restrictions: row.dietary_restrictions ?? null,
            role,
          });

          if (result.alreadyExists) {
            skipped++;
          } else {
            created++;
            credentials.push({
              name: row.name,
              email: row.email,
              password,
              role,
              team_name: row.team_name,
              team_code: row.team_code,
              domain: row.domain ?? '',
            });
          }
        } catch (err) {
          failed++;
          console.error('Import row failed', row, err);
        }
      }

      toast.success(`${created} created · ${skipped} skipped · ${failed} failed`);
      if (credentials.length) {
        downloadCsv(`hackhustle-credentials-${new Date().toISOString().slice(0, 10)}.csv`, credentials);
        toast.info('Credentials CSV downloaded');
      }
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse CSV');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Users"
          subtitle="Bulk-import participants, manage roles, audit account state."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={creating}
            onOpenChange={(o) => {
              setCreating(o);
              if (!o) {
                setCreateTeamId('none');
                setCreateRole('participant');
                setCreateDomain('none');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus className="h-4 w-4" /> Create user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New user</DialogTitle>
                <DialogDescription>
                  Same fields as the CSV importer. Leave password blank to auto-generate.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const password =
                    String(fd.get('password') ?? '').trim() ||
                    `Hack${Math.random().toString(36).slice(2, 10)}!`;

                  // Domain rule: participants must belong to a team with a domain.
                  if (createRole === 'participant') {
                    if (createTeamId === 'none') {
                      toast.error('Participants must be assigned to a team.');
                      return;
                    }
                    const team = teams.find((t) => t.id === createTeamId);
                    const teamDomain = team?.domain ?? null;
                    const formDomain = createDomain !== 'none' ? createDomain : null;
                    const effective = teamDomain ?? formDomain;
                    if (!effective) {
                      toast.error('Pick a domain — required for participants.');
                      return;
                    }
                    // If the team has no domain yet, set it from the form so all
                    // future members of the team inherit the same domain.
                    if (!teamDomain && formDomain) {
                      const { error: setErr } = await supabase
                        .from('teams')
                        .update({ domain: formDomain })
                        .eq('id', createTeamId);
                      if (setErr) {
                        toast.error(setErr.message ?? 'Failed to set team domain');
                        return;
                      }
                      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
                    }
                  }

                  createUserMutation.mutate({
                    name: String(fd.get('name')).trim(),
                    email: String(fd.get('email')).trim(),
                    password,
                    team_id: createTeamId !== 'none' ? createTeamId : null,
                    phone: String(fd.get('phone') ?? '').trim() || null,
                    tshirt_size: String(fd.get('tshirt_size') ?? '').trim() || null,
                    dietary_restrictions:
                      String(fd.get('dietary_restrictions') ?? '').trim() || null,
                    role: createRole,
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="create_name">Name</Label>
                    <Input id="create_name" name="name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create_email">Email</Label>
                    <Input id="create_email" name="email" type="email" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create_password">Password</Label>
                  <Input
                    id="create_password"
                    name="password"
                    type="text"
                    placeholder="auto-generated if blank"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="create_phone">Phone</Label>
                    <Input id="create_phone" name="phone" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create_tshirt_size">T-shirt size</Label>
                    <Input id="create_tshirt_size" name="tshirt_size" placeholder="S/M/L/XL" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>
                      Team {createRole === 'participant' ? <span className="text-rose-600">*</span> : null}
                    </Label>
                    <Select
                      value={createTeamId}
                      onValueChange={(v) => {
                        setCreateTeamId(v);
                        // Auto-fill the domain from the picked team. The user can
                        // still override below; on submit we propagate the choice
                        // back to the team if it was previously unset.
                        const t = teams.find((x) => x.id === v);
                        setCreateDomain(t?.domain ?? 'none');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No team</SelectItem>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.team_name} ({t.team_code})
                            {t.domain ? ` · ${t.domain}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={createRole} onValueChange={(v) => setCreateRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APP_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {labelForRole(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {createRole === 'participant' ? (() => {
                  const team = teams.find((t) => t.id === createTeamId);
                  const teamHasDomain = !!team?.domain;
                  return (
                    <div className="space-y-1.5">
                      <Label>
                        Domain <span className="text-rose-600">*</span>
                        {teamHasDomain ? (
                          <span className="ml-2 text-2xs font-normal text-muted-foreground">
                            (inherited from team)
                          </span>
                        ) : null}
                      </Label>
                      <Select
                        value={teamHasDomain ? (team!.domain as string) : createDomain}
                        onValueChange={(v) => setCreateDomain(v as TeamDomain | 'none')}
                        disabled={teamHasDomain}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a domain" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_DOMAINS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!teamHasDomain && createTeamId !== 'none' ? (
                        <p className="text-2xs text-muted-foreground">
                          This team has no domain yet — selecting one will set it for the whole team.
                        </p>
                      ) : null}
                    </div>
                  );
                })() : null}

                <div className="space-y-1.5">
                  <Label htmlFor="create_dietary_restrictions">Dietary restrictions</Label>
                  <Input id="create_dietary_restrictions" name="dietary_restrictions" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <input
            type="file"
            ref={fileRef}
            accept=".csv"
            className="hidden"
            onChange={handleCsv}
          />
          <Button variant="outline" asChild>
            <a href="/sample-participants.csv" download>
              Sample CSV
            </a>
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button
            variant="outline"
            className="border-rose-500/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
            onClick={() => {
              setPurgeOpen(true);
              setPurgeConfirm('');
            }}
          >
            <Flame className="h-4 w-4" /> Purge
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, team…"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {APP_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {labelForRole(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={venueFilter} onValueChange={(v) => setVenueFilter(v as typeof venueFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (venue)</SelectItem>
            <SelectItem value="inside">Inside venue</SelectItem>
            <SelectItem value="outside">Outside venue</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={attendanceFilter}
          onValueChange={(v) => setAttendanceFilter(v as typeof attendanceFilter)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (RSVP)</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="checked_out">Checked out</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Name</TableHead>
              <TableHead className="min-w-[200px]">Email</TableHead>
              <TableHead className="min-w-[200px]">Team</TableHead>
              <TableHead className="min-w-[110px]">Role</TableHead>
              <TableHead className="min-w-[170px]">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <EmptyState
                    title="No users match"
                    body="Adjust the search or import a CSV to onboard participants."
                    action={
                      <Button onClick={() => fileRef.current?.click()}>
                        <UserPlus className="h-4 w-4" /> Import CSV
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.team ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-2">
                          <span>{u.team.team_name}</span>
                          <span className="font-mono text-2xs text-muted-foreground">{u.team.team_code}</span>
                        </span>
                        {u.team.domain ? (
                          <span className="text-2xs text-muted-foreground">{u.team.domain}</span>
                        ) : u.role === 'participant' ? (
                          <span className="text-2xs text-rose-600 dark:text-rose-400">! domain missing</span>
                        ) : null}
                      </div>
                    ) : u.role === 'participant' ? (
                      <span className="text-2xs text-rose-600 dark:text-rose-400">! no team</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{labelForRole(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <AttendancePill status={u.attendance_status} />
                      <StatusPill tone={u.is_inside_venue ? 'on' : 'off'}>
                        {u.is_inside_venue ? 'Inside venue' : 'Outside venue'}
                      </StatusPill>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(u);
                          setEditingRole(u.role ?? 'participant');
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(u)}
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

      {/* Edit role dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update role</DialogTitle>
            <DialogDescription>
              {editing?.name} · {editing?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={editingRole} onValueChange={(v) => setEditingRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {labelForRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editing && updateRole.mutate({ userId: editing.id, role: editingRole })}
              disabled={updateRole.isPending}
            >
              {updateRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-medium text-foreground">{deleting?.name}</span> ({deleting?.email}). This cascades the profile and removes their role. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && removeUser.mutate(deleting.id)}>
              {removeUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge all users — extremely destructive */}
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
              Purge ALL users
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every authenticated user except <strong>you</strong> — about{' '}
              <strong>{Math.max(0, otherUserCount - 1)}</strong> account(s) including profiles and
              roles. Teams and meal sessions are kept. This cannot be undone.
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
              disabled={purgeConfirm !== PURGE_PHRASE || purgeMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => purgeMutation.mutate()}
            >
              {purgeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              Purge everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
