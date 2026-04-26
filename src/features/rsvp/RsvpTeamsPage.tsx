import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Pencil, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { setTeamTableNumber } from '@/data/rpc/teams';

type TeamRow = {
  id: string;
  team_name: string;
  team_code: string;
  table_number: string | null;
  domain: TeamDomain | null;
};

function useTeamsLite() {
  return useQuery({
    queryKey: ['rsvp', 'teams-lite'],
    queryFn: async (): Promise<TeamRow[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, team_code, table_number, domain')
        .order('team_name');
      if (error) throw error;
      return (data ?? []) as TeamRow[];
    },
  });
}

const DOMAIN_TONE: Record<TeamDomain, string> = {
  Fintech: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Healthcare: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Logistics: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export function RsvpTeamsPage() {
  const { data: teams = [], isLoading } = useTeamsLite();
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<'all' | TeamDomain>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      if (domainFilter !== 'all' && t.domain !== domainFilter) return false;
      if (q) {
        const hay = `${t.team_name} ${t.team_code} ${t.table_number ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [teams, search, domainFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables"
        subtitle="Quickly assign or move team tables. Click any cell in the Table column to edit."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team or table…"
            className="pl-9"
          />
        </div>
        <Select value={domainFilter} onValueChange={(v) => setDomainFilter(v as 'all' | TeamDomain)}>
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

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No teams"
            body="Once teams are imported they appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead className="w-32">Table</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.team_name}</div>
                    <div className="font-mono text-2xs text-muted-foreground">{t.team_code}</div>
                  </TableCell>
                  <TableCell>
                    {t.domain ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
                          DOMAIN_TONE[t.domain],
                        )}
                      >
                        {t.domain}
                      </span>
                    ) : (
                      <span className="text-2xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <InlineTableEdit team={t} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function InlineTableEdit({ team }: { team: TeamRow }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.table_number ?? '');

  const save = useMutation({
    mutationFn: () => setTeamTableNumber(team.id, draft.trim() || null),
    onMutate: async () => {
      const next = draft.trim() || null;
      await qc.cancelQueries({ queryKey: ['rsvp', 'teams-lite'] });
      const prev = qc.getQueryData<TeamRow[]>(['rsvp', 'teams-lite']);
      qc.setQueryData<TeamRow[]>(['rsvp', 'teams-lite'], (old) =>
        (old ?? []).map((t) => (t.id === team.id ? { ...t, table_number: next } : t)),
      );
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(['rsvp', 'teams-lite'], ctx?.prev);
      toast.error(err.message ?? 'Failed to save');
    },
    onSuccess: () => {
      toast.success('Table updated');
      setEditing(false);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['rsvp', 'teams-lite'] }),
  });

  function commit() {
    if ((team.table_number ?? '') === draft.trim()) {
      setEditing(false);
      return;
    }
    save.mutate();
  }
  function cancel() {
    setDraft(team.table_number ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={commit}
          className="h-8 w-20"
          placeholder="—"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            commit();
          }}
          className="text-emerald-600 hover:text-emerald-700"
          title="Save (Enter)"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          className="text-muted-foreground hover:text-foreground"
          title="Cancel (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(team.table_number ?? '');
        setEditing(true);
      }}
      className="group inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-secondary"
      title="Click to edit table"
    >
      <span className={team.table_number ? '' : 'text-muted-foreground'}>
        {team.table_number ?? '—'}
      </span>
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}
