import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { supabase } from '@/data/client';
import { TEAM_DOMAINS, type TeamDomain } from '@/data/queries/teams';
import { APP_ROLES, labelForRole, type AppRole } from '@/domain/auth/roles';
import { createNotification } from '@/data/rpc/notifications';
import type { NotificationTarget } from '@/data/queries/notifications';

type ComposerProps = {
  asRole: AppRole;
  /** Called after a successful submission. */
  onSubmitted?: () => void;
};

type TeamOption  = { id: string; team_name: string; team_code: string };
type UserOption  = { id: string; name: string; email: string };

export function NotificationComposer({ asRole, onSubmitted }: ComposerProps) {
  const qc = useQueryClient();
  const isAdmin = asRole === 'super_admin';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<NotificationTarget>('all');
  const [pickedTeams, setPickedTeams] = useState<string[]>([]);
  const [pickedDomains, setPickedDomains] = useState<TeamDomain[]>([]);
  const [pickedUsers, setPickedUsers] = useState<string[]>([]);
  const [pickedRole, setPickedRole] = useState<AppRole>('participant');
  const [userSearch, setUserSearch] = useState('');

  const teams = useQuery({
    queryKey: ['composer', 'teams'],
    queryFn: async (): Promise<TeamOption[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, team_code')
        .order('team_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useQuery({
    queryKey: ['composer', 'users'],
    queryFn: async (): Promise<UserOption[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = users.data ?? [];
    if (!q) return list.slice(0, 20);
    return list
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 20);
  }, [users.data, userSearch]);

  const submit = useMutation({
    mutationFn: () =>
      createNotification(
        {
          title,
          body,
          target_type: targetType,
          target_team_ids: targetType === 'teams' ? pickedTeams : null,
          target_domains: targetType === 'domains' ? pickedDomains : null,
          target_user_ids: targetType === 'individuals' ? pickedUsers : null,
          target_role: targetType === 'role' ? pickedRole : null,
        },
        asRole,
      ),
    onSuccess: () => {
      toast.success(isAdmin ? 'Notification published' : 'Sent for admin approval');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setTitle('');
      setBody('');
      setTargetType('all');
      setPickedTeams([]);
      setPickedDomains([]);
      setPickedUsers([]);
      setPickedRole('participant');
      onSubmitted?.();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to send'),
  });

  function targetReady(): string | null {
    if (!title.trim()) return 'Title is required';
    if (!body.trim()) return 'Message body is required';
    if (targetType === 'teams' && pickedTeams.length === 0) return 'Pick at least one team';
    if (targetType === 'domains' && pickedDomains.length === 0) return 'Pick at least one domain';
    if (targetType === 'individuals' && pickedUsers.length === 0) return 'Pick at least one person';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = targetReady();
    if (err) {
      toast.error(err);
      return;
    }
    submit.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="notif-title">Title</Label>
        <Input
          id="notif-title"
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lunch is being served at table 3"
          required
        />
        <p className="text-[10px] text-muted-foreground">{title.length} / 140</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notif-body">Message</Label>
        <Textarea
          id="notif-body"
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Write the announcement here. Plain text only."
          required
        />
        <p className="text-[10px] text-muted-foreground">{body.length} / 2000</p>
      </div>

      <div className="space-y-2">
        <Label>Send to</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <TargetChip active={targetType === 'all'}         onClick={() => setTargetType('all')}>Everyone</TargetChip>
          <TargetChip active={targetType === 'teams'}       onClick={() => setTargetType('teams')}>Specific teams</TargetChip>
          <TargetChip active={targetType === 'domains'}     onClick={() => setTargetType('domains')}>Specific domains</TargetChip>
          <TargetChip active={targetType === 'individuals'} onClick={() => setTargetType('individuals')}>Specific people</TargetChip>
          <TargetChip active={targetType === 'role'}        onClick={() => setTargetType('role')}>By role</TargetChip>
        </div>
      </div>

      {targetType === 'teams' ? (
        <MultiPicker
          label="Pick teams"
          options={(teams.data ?? []).map((t) => ({ id: t.id, label: `${t.team_name} (${t.team_code})` }))}
          selected={pickedTeams}
          onChange={setPickedTeams}
        />
      ) : null}

      {targetType === 'domains' ? (
        <div className="space-y-1.5">
          <Label>Pick domains</Label>
          <div className="flex flex-wrap gap-2">
            {TEAM_DOMAINS.map((d) => {
              const on = pickedDomains.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setPickedDomains((prev) =>
                      on ? prev.filter((x) => x !== d) : [...prev, d],
                    )
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    on ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-secondary',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {targetType === 'individuals' ? (
        <div className="space-y-2">
          <Label>Pick people</Label>
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search name or email…"
          />
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {filteredUsers.map((u) => {
              const on = pickedUsers.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setPickedUsers((prev) =>
                      on ? prev.filter((x) => x !== u.id) : [...prev, u.id],
                    )
                  }
                  className={cn(
                    'flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-0',
                    on ? 'bg-secondary' : 'hover:bg-secondary/60',
                  )}
                >
                  <span>
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 text-2xs text-muted-foreground">{u.email}</span>
                  </span>
                  {on ? <span className="text-2xs">✓</span> : null}
                </button>
              );
            })}
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-6 text-center text-2xs text-muted-foreground">
                No matches
              </div>
            ) : null}
          </div>
          {pickedUsers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pickedUsers.map((id) => {
                const u = users.data?.find((x) => x.id === id);
                if (!u) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-2xs"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() => setPickedUsers((prev) => prev.filter((x) => x !== id))}
                      className="hover:text-destructive"
                      aria-label={`Remove ${u.name}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {targetType === 'role' ? (
        <div className="space-y-1.5">
          <Label>Pick role</Label>
          <Select value={pickedRole} onValueChange={(v) => setPickedRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APP_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{labelForRole(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <p className="mr-auto text-2xs text-muted-foreground">
          {isAdmin ? 'Publishes immediately.' : 'Will be queued for admin approval.'}
        </p>
        <Button type="submit" disabled={submit.isPending} className="gap-2">
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isAdmin ? 'Publish' : 'Submit for approval'}
        </Button>
      </div>
    </form>
  );
}

function TargetChip({
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
        'rounded-md border px-3 py-2 text-xs transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}

function MultiPicker({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Search…',
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Quick-glance summary so the admin sees what's picked even when they
  // scroll the list — important when teams > 20.
  const selectedCount = selected.length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-2xs text-muted-foreground hover:text-foreground"
          >
            Clear ({selectedCount})
          </button>
        ) : null}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="h-9"
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-border">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-2xs text-muted-foreground">
            {options.length === 0 ? 'No options' : 'Nothing matches'}
          </div>
        ) : (
          filtered.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() =>
                  onChange(on ? selected.filter((x) => x !== o.id) : [...selected, o.id])
                }
                className={cn(
                  'flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-0',
                  on ? 'bg-secondary' : 'hover:bg-secondary/60',
                )}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {on ? <span className="ml-2 text-2xs text-emerald-700 dark:text-emerald-300">✓</span> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
