import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Github,
  Loader2,
  Lock,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useTeamSubmission, type SubmissionRow } from '@/data/queries/submissions';
import { useAppSettingsValue } from '@/data/queries/appSettings';
import { deleteDeck, setGithubUrl, signDeckUrl, uploadDeck } from '@/data/rpc/submissions';

const ACCEPT = '.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function SubmissionPanel({ teamId }: { teamId: string }) {
  const { data: submission, isLoading } = useTeamSubmission(teamId);
  const { submissions_locked } = useAppSettingsValue();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [github, setGithub] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local github state with the row whenever it loads / changes.
  useEffect(() => {
    setGithub(submission?.github_url ?? '');
  }, [submission?.github_url]);

  const upload = useMutation({
    mutationFn: (file: File) => uploadDeck(teamId, file),
    onSuccess: () => {
      toast.success('Deck uploaded');
      qc.invalidateQueries({ queryKey: ['submission', teamId] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Upload failed'),
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!submission?.deck_path) throw new Error('Nothing to delete');
      return deleteDeck(teamId, submission.deck_path);
    },
    onSuccess: () => {
      toast.success('Deck removed');
      qc.invalidateQueries({ queryKey: ['submission', teamId] });
      setConfirmDelete(false);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete'),
  });

  const saveGithub = useMutation({
    mutationFn: () => setGithubUrl(teamId, github),
    onSuccess: () => {
      toast.success('GitHub link saved');
      qc.invalidateQueries({ queryKey: ['submission', teamId] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save'),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function openDeck() {
    if (!submission?.deck_path) return;
    try {
      const url = await signDeckUrl(submission.deck_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Failed to open file';
      toast.error(m);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight">Submission</h2>
        {submission?.updated_at ? (
          <span className="text-2xs text-muted-foreground">
            Updated {timeAgo(submission.updated_at)}
          </span>
        ) : null}
      </header>

      {submissions_locked ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-2xs text-amber-700 dark:text-amber-300">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <strong>Submissions are locked.</strong> Your existing files and link are visible
            below but can no longer be changed. Contact an organizer if you need an exception.
          </div>
        </div>
      ) : null}

      {/* Deck */}
      <section className="space-y-2">
        <Label className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          Deck (PDF or PPT, ≤3 MB)
        </Label>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onFile}
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : submission?.deck_path ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={openDeck}
                  className="block truncate text-sm font-medium hover:underline"
                  title={submission.deck_filename ?? submission.deck_path}
                >
                  {submission.deck_filename ?? submission.deck_path}
                </button>
                <div className="text-2xs text-muted-foreground">
                  {humanSize(submission.deck_size_bytes)}
                  {submission.deck_mime ? ` · ${friendlyMime(submission.deck_mime)}` : ''}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" onClick={openDeck}>
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending || submissions_locked}
              >
                {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Replace
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                onClick={() => setConfirmDelete(true)}
                title={submissions_locked ? 'Submissions are locked' : 'Remove deck'}
                disabled={submissions_locked}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending || submissions_locked}
            className="w-full"
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {submissions_locked ? 'Locked' : upload.isPending ? 'Uploading…' : 'Upload deck'}
          </Button>
        )}
      </section>

      {/* GitHub */}
      <section className="space-y-2">
        <Label htmlFor="ghu" className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          GitHub repository
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ghu"
              type="url"
              placeholder="https://github.com/your-team/repo"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="pl-9"
              disabled={submissions_locked}
            />
          </div>
          <Button
            type="button"
            onClick={() => saveGithub.mutate()}
            disabled={
              saveGithub.isPending ||
              github === (submission?.github_url ?? '') ||
              submissions_locked
            }
          >
            {saveGithub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save
          </Button>
        </div>
        {submission?.github_url ? (
          <a
            href={submission.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {submission.github_url}
          </a>
        ) : null}
      </section>

      <p className="text-2xs text-muted-foreground">
        Anyone on your team can update this. Judges and admins will see the latest version.
      </p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove deck</AlertDialogTitle>
            <AlertDialogDescription>
              The current deck will be deleted. You can upload a replacement anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => remove.mutate()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Lightweight read-only view of a team's submission for the judge portal. */
export function SubmissionView({ submission }: { submission: SubmissionRow | null }) {
  if (!submission || (!submission.deck_path && !submission.github_url)) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-2xs text-muted-foreground">
        Team hasn't submitted anything yet.
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      {submission.deck_path ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate text-sm">{submission.deck_filename ?? 'Deck'}</span>
            <span className="text-2xs text-muted-foreground">{humanSize(submission.deck_size_bytes)}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const url = await signDeckUrl(submission.deck_path!);
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to open');
              }
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open deck
          </Button>
        </div>
      ) : (
        <p className="text-2xs text-muted-foreground">No deck uploaded.</p>
      )}
      {submission.github_url ? (
        <a
          href={submission.github_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm hover:underline"
        >
          <Github className="h-4 w-4" /> {submission.github_url}
        </a>
      ) : (
        <p className="text-2xs text-muted-foreground">No GitHub link provided.</p>
      )}
    </div>
  );
}

function humanSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function friendlyMime(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PPT';
  return mime;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
