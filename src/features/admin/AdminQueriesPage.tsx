import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAdminQueries, type QueryStatus, type SupportQuery } from '@/data/queries/queries';
import { supabase } from '@/data/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const STATUS_OPTIONS: QueryStatus[] = ['open', 'in_progress', 'resolved'];

export function AdminQueriesPage() {
  const { data: queries = [], isLoading } = useAdminQueries();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | QueryStatus>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? queries : queries.filter((q) => q.status === filter)),
    [queries, filter],
  );

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Queries" subtitle="Triage participant support requests." />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-44">
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
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No queries"
          body="When participants raise support tickets they'll appear here."
        />
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">{q.title}</h3>
            <Badge variant="muted">{q.category.replace('_', ' ')}</Badge>
          </div>
          <p className="text-2xs text-muted-foreground">
            {q.user?.name ?? '—'} · {q.created_at ? format(new Date(q.created_at), 'MMM d, HH:mm') : '—'}
          </p>
        </div>
        <Select value={q.status} onValueChange={(v) => onStatus(v as QueryStatus)}>
          <SelectTrigger className="w-40">
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
