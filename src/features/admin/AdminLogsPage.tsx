import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eraser,
  Loader2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { InlineLoader } from '@/components/composite/InlineLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useActivityLogs,
  useActivityLogStats,
  type ActivityLogRow,
  type LogCategory,
  type LogStatus,
} from '@/data/queries/activityLogs';
import { purgeActivityLogs, type PurgeMode } from '@/data/rpc/activityLogs';
import { labelForRole } from '@/domain/auth/roles';

const ALL_CATEGORIES: LogCategory[] = ['auth', 'route', 'click', 'mutation', 'error', 'system'];

const CATEGORY_TONE: Record<LogCategory, string> = {
  auth: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  route: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  click: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  mutation: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  system: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function defaultFromIso(): string {
  const d = startOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return d.toISOString().slice(0, 16); // datetime-local format
}

export function AdminLogsPage() {
  const qc = useQueryClient();

  const [fromIso, setFromIso] = useState<string>(defaultFromIso());
  const [toIso, setToIso] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LogStatus | 'all'>('all');
  const [categories, setCategories] = useState<Set<LogCategory>>(new Set(ALL_CATEGORIES));
  const [pageSize, setPageSize] = useState<number>(200);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeMode, setPurgeMode] = useState<PurgeMode>('older_than_7d');
  const [purgeConfirm, setPurgeConfirm] = useState('');

  const filters = useMemo(
    () => ({
      from: fromIso ? new Date(fromIso) : null,
      to: toIso ? new Date(toIso) : null,
      categories: categories.size === ALL_CATEGORIES.length ? undefined : Array.from(categories),
      status: statusFilter,
      search: search.trim() || undefined,
      pageSize,
    }),
    [fromIso, toIso, categories, statusFilter, search, pageSize],
  );

  const logs = useActivityLogs(filters);
  const stats = useActivityLogStats({ from: filters.from, to: filters.to });

  const purge = useMutation({
    mutationFn: () => purgeActivityLogs(purgeMode),
    onSuccess: ({ deleted }) => {
      toast.success(`Purged ${deleted.toLocaleString()} log row(s)`);
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'logs-stats'] });
      setPurgeOpen(false);
      setPurgeConfirm('');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Purge failed'),
  });

  const PURGE_PHRASE = purgeMode === 'all' ? 'PURGE ALL LOGS' : 'PURGE OLD LOGS';

  function toggleCategory(c: LogCategory) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      // Don't allow zero categories — confusing UX (no rows ever returned).
      if (next.size === 0) return new Set(ALL_CATEGORIES);
      return next;
    });
  }

  function resetFilters() {
    setFromIso(defaultFromIso());
    setToIso('');
    setSearch('');
    setStatusFilter('all');
    setCategories(new Set(ALL_CATEGORIES));
    setPageSize(200);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Activity logs"
          subtitle="Every meaningful click, route change, sign-in, and DB mutation. Filter, audit, and purge."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['admin', 'logs'] });
              qc.invalidateQueries({ queryKey: ['admin', 'logs-stats'] });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPurgeOpen(true)}
            className="border-rose-500/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
          >
            <Eraser className="h-3.5 w-3.5" /> Purge
          </Button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        {ALL_CATEGORIES.map((c) => (
          <CategoryTile
            key={c}
            label={c}
            value={stats.data?.counts[c] ?? 0}
            tone={CATEGORY_TONE[c]}
            active={categories.has(c)}
            onClick={() => toggleCategory(c)}
          />
        ))}
        <Card className="border-rose-500/40">
          <CardContent className="flex flex-col items-start gap-1 p-3">
            <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              Errors
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              {stats.data?.errors ?? 0}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              From
            </Label>
            <Input
              type="datetime-local"
              value={fromIso}
              onChange={(e) => setFromIso(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              To (blank = now)
            </Label>
            <Input
              type="datetime-local"
              value={toIso}
              onChange={(e) => setToIso(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LogStatus | 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="warn">Warnings</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              Page size
            </Label>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-5">
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              Search action / user / email
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. sign_in, click:button:Save, judge@…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-end justify-end">
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log list */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {logs.isLoading ? (
          <InlineLoader />
        ) : logs.error ? (
          <p className="px-4 py-12 text-center text-sm text-rose-700 dark:text-rose-300">
            Failed to load: {(logs.error as Error).message}
          </p>
        ) : (logs.data ?? []).length === 0 ? (
          <EmptyState
            title="No matching logs"
            body="Loosen the filters above. New events appear when the app is in use."
          />
        ) : (
          <ul className="divide-y divide-border">
            {logs.data!.map((row) => (
              <LogRow
                key={row.id}
                row={row}
                expanded={expanded.has(row.id)}
                onToggle={() => toggleExpanded(row.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-2xs text-muted-foreground">
        Showing the most recent {logs.data?.length ?? 0} events. Logs are stored
        for as long as you keep them — use Purge to free space.
      </p>

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
              <AlertTriangle className="h-5 w-5" /> Purge activity logs
            </AlertDialogTitle>
            <AlertDialogDescription>
              Choose what to delete. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              Range
            </Label>
            <Select value={purgeMode} onValueChange={(v) => setPurgeMode(v as PurgeMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="older_than_24h">Older than 24 hours</SelectItem>
                <SelectItem value="older_than_7d">Older than 7 days</SelectItem>
                <SelectItem value="older_than_30d">Older than 30 days</SelectItem>
                <SelectItem value="all">Every row (DESTRUCTIVE)</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
              Type <span className="font-mono text-foreground">{PURGE_PHRASE}</span> to confirm
            </Label>
            <Input
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder={PURGE_PHRASE}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={purgeConfirm !== PURGE_PHRASE || purge.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => purge.mutate()}
            >
              {purge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryTile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-all',
        tone,
        active ? 'opacity-100 ring-2 ring-foreground/20' : 'opacity-50 hover:opacity-100',
      )}
    >
      <span className="text-2xs font-medium uppercase tracking-[0.18em]">{label}</span>
      <span className="font-display text-lg font-semibold tabular-nums">{value}</span>
    </button>
  );
}

function LogRow({
  row,
  expanded,
  onToggle,
}: {
  row: ActivityLogRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40',
          row.status === 'error' && 'bg-rose-500/5',
        )}
      >
        <span className="mt-1 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <span className={cn(
          'mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]',
          CATEGORY_TONE[row.category],
        )}>
          {row.category}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-2xs text-foreground">{row.action}</span>
          <span className="block truncate text-2xs text-muted-foreground">
            {row.user_name ? `${row.user_name}` : 'anonymous'}
            {row.user_role ? ` · ${labelForRole(row.user_role)}` : ''}
            {row.user_email ? ` · ${row.user_email}` : ''}
            {row.device_type ? ` · ${row.device_type}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[10px] text-muted-foreground">
            {format(new Date(row.occurred_at), 'HH:mm:ss')}
          </span>
          <span className="block font-mono text-[10px] text-muted-foreground">
            {format(new Date(row.occurred_at), 'MMM d')}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-border bg-background/40 px-12 py-3 text-2xs">
          {row.error_message ? (
            <div>
              <div className="text-2xs font-medium uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
                Error
              </div>
              <div className="font-mono text-2xs text-rose-700 dark:text-rose-300">
                {row.error_message}
              </div>
            </div>
          ) : null}
          {row.resource_type || row.resource_id ? (
            <div>
              <span className="text-muted-foreground">Resource: </span>
              <span className="font-mono">{row.resource_type ?? '—'}</span>
              {row.resource_id ? <span className="font-mono"> · {row.resource_id}</span> : null}
            </div>
          ) : null}
          {row.session_id ? (
            <div>
              <span className="text-muted-foreground">Session: </span>
              <span className="font-mono">{row.session_id}</span>
            </div>
          ) : null}
          {row.user_agent ? (
            <div>
              <span className="text-muted-foreground">User-Agent: </span>
              <span className="font-mono break-all">{row.user_agent}</span>
            </div>
          ) : null}
          {row.metadata && Object.keys(row.metadata).length > 0 ? (
            <pre className="overflow-x-auto rounded-md border border-border bg-card p-2 font-mono text-[11px] leading-snug">
{JSON.stringify(row.metadata, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
