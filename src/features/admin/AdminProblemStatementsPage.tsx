import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit2, FileText, Loader2, Lock, Plus, Search, Trash2, Unlock } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { EmptyState } from '@/components/composite/EmptyState';
import { InlineLoader } from '@/components/composite/InlineLoader';
import { MarkdownEditor } from '@/components/composite/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  useProblemStatements,
  type ProblemStatementRow,
} from '@/data/queries/problemStatements';
import {
  createProblemStatement,
  deleteProblemStatement,
  togglePublishProblemStatement,
  updateProblemStatement,
} from '@/data/rpc/problemStatements';
import { TEAM_DOMAINS, type TeamDomain } from '@/data/queries/teams';

type DomainFilter = 'all' | TeamDomain;
type StatusFilter = 'all' | 'published' | 'draft';

type EditorState = {
  id?: string;
  domain: TeamDomain;
  title: string;
  body_md: string;
  display_order: number;
  is_published: boolean;
};

const blankEditor = (defaultDomain: TeamDomain): EditorState => ({
  domain: defaultDomain,
  title: '',
  body_md: '',
  display_order: 1,
  is_published: false,
});

export function AdminProblemStatementsPage() {
  const { data: rows = [], isLoading, error } = useProblemStatements();
  const qc = useQueryClient();

  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(blankEditor('Fintech'));
  const [deleting, setDeleting] = useState<ProblemStatementRow | null>(null);

  const counts = useMemo(() => {
    const map = new Map<TeamDomain, number>();
    for (const d of TEAM_DOMAINS) map.set(d, 0);
    for (const r of rows) map.set(r.domain, (map.get(r.domain) ?? 0) + 1);
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (domainFilter !== 'all' && r.domain !== domainFilter) return false;
      if (statusFilter === 'published' && !r.is_published) return false;
      if (statusFilter === 'draft' && r.is_published) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, domainFilter, statusFilter, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['problem-statements'] });

  const create = useMutation({
    mutationFn: (input: EditorState) =>
      createProblemStatement({
        domain: input.domain,
        title: input.title,
        body_md: input.body_md,
        display_order: input.display_order,
        is_published: input.is_published,
      }),
    onSuccess: () => {
      toast.success('Problem statement created');
      invalidate();
      setEditorOpen(false);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create'),
  });

  const update = useMutation({
    mutationFn: (input: EditorState) =>
      updateProblemStatement(input.id!, {
        domain: input.domain,
        title: input.title,
        body_md: input.body_md,
        display_order: input.display_order,
        is_published: input.is_published,
      }),
    onSuccess: () => {
      toast.success('Problem statement updated');
      invalidate();
      setEditorOpen(false);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update'),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      togglePublishProblemStatement(id, value),
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: ['problem-statements', 'all'] });
      const prev = qc.getQueryData<ProblemStatementRow[]>(['problem-statements', 'all']);
      qc.setQueryData<ProblemStatementRow[]>(['problem-statements', 'all'], (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, is_published: value } : r)),
      );
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(['problem-statements', 'all'], ctx?.prev);
      toast.error(err.message ?? 'Failed to toggle');
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.value ? 'Unlocked for participants' : 'Locked');
    },
    onSettled: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProblemStatement(id),
    onSuccess: () => {
      toast.success('Deleted');
      invalidate();
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete'),
  });

  function openCreate() {
    const seed: TeamDomain = domainFilter === 'all' ? 'Fintech' : domainFilter;
    // Suggest the next display_order so admins don't have to think about it.
    const used = rows
      .filter((r) => r.domain === seed)
      .map((r) => r.display_order);
    const nextOrder = (used.length === 0 ? 0 : Math.max(...used)) + 1;
    setEditor({ ...blankEditor(seed), display_order: nextOrder });
    setEditorOpen(true);
  }

  function openEdit(row: ProblemStatementRow) {
    setEditor({
      id: row.id,
      domain: row.domain,
      title: row.title,
      body_md: row.body_md,
      display_order: row.display_order,
      is_published: row.is_published,
    });
    setEditorOpen(true);
  }

  function submitEditor(e: React.FormEvent) {
    e.preventDefault();
    if (!editor.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!editor.body_md.trim()) {
      toast.error('Body is required');
      return;
    }
    if (editor.id) update.mutate(editor);
    else create.mutate(editor);
  }

  // Cmd/Ctrl+S inside the dialog submits.
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const form = document.getElementById('ps-editor-form') as HTMLFormElement | null;
        form?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editorOpen]);

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
          <strong>Couldn't load problem statements.</strong> {(error as Error).message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Problem Statements"
          subtitle="Author the official challenge briefs by domain. Lock until release; participants see only their domain."
        />
        <Dialog
          open={editorOpen}
          onOpenChange={(o) => {
            setEditorOpen(o);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New problem statement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editor.id ? 'Edit problem statement' : 'New problem statement'}</DialogTitle>
              <DialogDescription>
                Markdown is supported. Toggle the publish switch when you're ready for participants to see it.
                <span className="ml-2 text-2xs text-muted-foreground">⌘/Ctrl+S to save</span>
              </DialogDescription>
            </DialogHeader>
            <form id="ps-editor-form" onSubmit={submitEditor} className="space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 space-y-1.5 md:col-span-6">
                  <Label htmlFor="ps-title">Title</Label>
                  <Input
                    id="ps-title"
                    value={editor.title}
                    onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="col-span-6 space-y-1.5 md:col-span-3">
                  <Label>Domain</Label>
                  <Select
                    value={editor.domain}
                    onValueChange={(v) => setEditor((s) => ({ ...s, domain: v as TeamDomain }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 space-y-1.5 md:col-span-3">
                  <Label htmlFor="ps-order">Display order</Label>
                  <Input
                    id="ps-order"
                    type="number"
                    min={1}
                    step={1}
                    value={editor.display_order}
                    onChange={(e) =>
                      setEditor((s) => ({
                        ...s,
                        display_order: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Body</Label>
                <MarkdownEditor
                  value={editor.body_md}
                  onChange={(v) => setEditor((s) => ({ ...s, body_md: v }))}
                />
                <p className="text-[10px] text-muted-foreground">{editor.body_md.length} chars</p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">
                    {editor.is_published ? 'Published — visible to participants' : 'Draft — hidden from participants'}
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    {editor.is_published
                      ? 'Toggle off to take this statement down.'
                      : 'Unlocked statements appear in participant portals immediately.'}
                  </div>
                </div>
                <Switch
                  checked={editor.is_published}
                  onCheckedChange={(v) => setEditor((s) => ({ ...s, is_published: v }))}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending || update.isPending}>
                  {create.isPending || update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editor.id ? 'Save changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DomainTab active={domainFilter === 'all'} onClick={() => setDomainFilter('all')}>
          All <span className="ml-1.5 text-2xs text-muted-foreground">{rows.length}</span>
        </DomainTab>
        {TEAM_DOMAINS.map((d) => (
          <DomainTab key={d} active={domainFilter === d} onClick={() => setDomainFilter(d)}>
            {d}
            <span className="ml-1.5 text-2xs text-muted-foreground">{counts.get(d) ?? 0}</span>
            {counts.get(d) !== undefined && counts.get(d)! !== 2 ? (
              <span
                className="ml-1 text-2xs text-amber-600 dark:text-amber-400"
                title="Spec is 2 per domain"
              >
                ·
              </span>
            ) : null}
          </DomainTab>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <InlineLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            body="Adjust filters or click 'New problem statement' to add one."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> New problem statement
              </Button>
            }
          />
        ) : (
          filtered.map((row) => (
            <article
              key={row.id}
              className={cn(
                'rounded-lg border bg-card p-4 transition-colors',
                row.is_published ? 'border-emerald-500/30' : 'border-border opacity-90',
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <DomainChip domain={row.domain} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{row.title}</h3>
                    <span className="font-mono text-2xs text-muted-foreground">
                      #{row.display_order}
                    </span>
                    {row.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                        <Unlock className="h-2.5 w-2.5" /> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        <Lock className="h-2.5 w-2.5" /> Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {bodyPreview(row.body_md)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
                    <span className="text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                      {row.is_published ? 'Unlocked' : 'Locked'}
                    </span>
                    <Switch
                      checked={row.is_published}
                      onCheckedChange={(v) => togglePublish.mutate({ id: row.id, value: v })}
                      aria-label={row.is_published ? 'Lock' : 'Unlock'}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(row)}
                    title="Delete"
                    className="text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete problem statement</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleting?.title}</strong>. Participants will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DomainTab({
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
        'inline-flex items-center rounded-md border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function DomainChip({ domain }: { domain: TeamDomain }) {
  const tones: Record<TeamDomain, string> = {
    Fintech: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Healthcare: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    Logistics: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
        tones[domain],
      )}
    >
      <FileText className="h-3 w-3" />
      {domain}
    </span>
  );
}

function bodyPreview(md: string): string {
  // Strip markdown noise for the row preview line: headings, lists, code fences,
  // links to text. Naive but enough to give admins a useful one-liner glance.
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}
