import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { InlineLoader } from '@/components/composite/InlineLoader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminQueries,
  type QueryCategory,
  type QueryStatus,
  type SupportQuery,
} from '@/data/queries/queries';
import { supabase } from '@/data/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const STATUS_OPTIONS: QueryStatus[] = ['open', 'in_progress', 'resolved'];
// Mirrors the Postgres enum `query_category` (see types.gen.ts).
const CATEGORY_OPTIONS: QueryCategory[] = ['wifi', 'bug', 'mentor_help', 'logistics', 'other'];

export function AdminQueriesPage() {
  const { data: queries = [], isLoading } = useAdminQueries();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | QueryStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | QueryCategory>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return queries.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [
        row.title,
        row.description ?? '',
        row.user?.name ?? '',
        row.user?.email ?? '',
        row.team?.team_name ?? '',
        row.team?.team_code ?? '',
        row.category,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [queries, statusFilter, categoryFilter, search]);

  const update = useMutation({
    mutationFn: async (input: { id: string; status?: QueryStatus; admin_notes?: string }) => {
      const { error } = await supabase
        .from('queries')
        .update({
          status: input.status,
          admin_notes: input.admin_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'queries'] }),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update'),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Queries" subtitle="Triage participant support requests." />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[240px]">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, team, user, category…"
            className="pl-9"
            aria-label="Search queries"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground sm:ml-auto">
          {filtered.length} of {queries.length}
        </span>
      </div>

      {isLoading ? (
        <InlineLoader />
      ) : queries.length === 0 ? (
        <EmptyState
          title="No queries"
          body="When participants raise support tickets they'll appear here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing matches" body="Adjust the search or filters." />
      ) : (
        <div className="space-y-4">
          {filtered.map((q) => (
            <QueryCard
              key={q.id}
              q={q}
              onStatus={(status) => update.mutate({ id: q.id, status })}
              onNotes={(admin_notes) => update.mutate({ id: q.id, admin_notes })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QueryCard({
  q,
  onStatus,
  onNotes,
}: {
  q: SupportQuery;
  onStatus: (s: QueryStatus) => void;
  onNotes: (n: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">{q.title}</h3>
            <Badge variant="muted">{q.category.replace('_', ' ')}</Badge>
          </div>
          <p className="text-2xs text-muted-foreground">
            {q.user?.name ?? '—'}
            {q.team ? <> · <span className="font-mono">{q.team.team_code}</span> {q.team.team_name}</> : null}
            {q.created_at ? <> · {format(new Date(q.created_at), 'MMM d, HH:mm')}</> : null}
          </p>
        </div>
        <Select value={q.status} onValueChange={(v) => onStatus(v as QueryStatus)}>
          <SelectTrigger className="w-40" aria-label={`Status for ${q.title}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {q.description ? <p className="text-muted-foreground">{q.description}</p> : null}
        <Textarea
          defaultValue={q.admin_notes ?? ''}
          placeholder="Internal notes…"
          onBlur={(e) => {
            const next = e.target.value;
            if (next !== (q.admin_notes ?? '')) onNotes(next);
          }}
        />
      </CardContent>
    </Card>
  );
}
