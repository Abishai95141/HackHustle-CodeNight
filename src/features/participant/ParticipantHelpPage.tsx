import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/composite/EmptyState';
import { StatusPill } from '@/components/composite/StatusPill';
import { useMyQueries, type QueryCategory } from '@/data/queries/queries';
import { supabase } from '@/data/client';

const CATEGORIES: { value: QueryCategory; label: string }[] = [
  { value: 'wifi', label: 'WiFi / Internet' },
  { value: 'bug', label: 'Bug' },
  { value: 'mentor_help', label: 'Mentor help' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'other', label: 'Other' },
];

export function ParticipantHelpPage() {
  const { profile } = useAuth();
  const { data: queries = [] } = useMyQueries(profile?.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<QueryCategory>('other');

  const create = useMutation({
    mutationFn: async (input: { category: QueryCategory; title: string; description: string }) => {
      if (!profile) throw new Error('Not signed in');
      const { error } = await supabase.from('queries').insert({
        user_id: profile.id,
        team_id: profile.team_id ?? null,
        category: input.category,
        title: input.title,
        description: input.description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Submitted');
      qc.invalidateQueries({ queryKey: ['me', 'queries'] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to submit'),
  });

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 pb-10 pt-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Help</div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">My queries</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New query</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  category,
                  title: String(fd.get('title')).trim(),
                  description: String(fd.get('description') ?? ''),
                });
              }}
            >
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as QueryCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Details</Label>
                <Textarea id="description" name="description" rows={4} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {queries.length === 0 ? (
        <EmptyState title="No queries" body="Tap New to raise a support request." />
      ) : (
        <div className="space-y-3">
          {queries.map((q) => (
            <Card key={q.id}>
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{q.title}</div>
                    <div className="text-2xs text-muted-foreground">
                      {q.category.replace('_', ' ')} ·{' '}
                      {q.created_at ? format(new Date(q.created_at), 'MMM d, HH:mm') : '—'}
                    </div>
                  </div>
                  <StatusPill tone={q.status === 'resolved' ? 'on' : 'off'}>
                    {q.status.replace('_', ' ')}
                  </StatusPill>
                </div>
                {q.description ? (
                  <p className="text-muted-foreground">{q.description}</p>
                ) : null}
                {q.admin_notes ? (
                  <div className="rounded-md border border-border bg-muted/40 p-2 text-2xs text-muted-foreground">
                    <span className="font-medium uppercase tracking-[0.18em]">Reply</span> ·{' '}
                    {q.admin_notes}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
