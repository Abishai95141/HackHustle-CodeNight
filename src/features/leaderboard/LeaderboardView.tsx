import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/composite/EmptyState';
import { useLeaderboardTeams } from '@/data/queries/teams';
import { supabase } from '@/data/client';
import { cn } from '@/lib/cn';

export function LeaderboardView({ compact = false }: { compact?: boolean }) {
  const { data: teams = [], isLoading } = useLeaderboardTeams();
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        qc.invalidateQueries({ queryKey: ['leaderboard', 'teams'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_scores' }, () => {
        qc.invalidateQueries({ queryKey: ['leaderboard', 'teams'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (teams.length === 0) {
    return (
      <EmptyState
        title="No rankings yet"
        body="Once judges submit scores, teams will appear here in real time."
      />
    );
  }

  const top = teams.slice(0, 3);
  const rest = teams.slice(3);

  return (
    <div className="space-y-8">
      {!compact && top.length >= 3 ? (
        <div className="grid grid-cols-3 items-end gap-3">
          <PodiumCard rank={2} team={top[1]} />
          <PodiumCard rank={1} team={top[0]} />
          <PodiumCard rank={3} team={top[2]} />
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Team</TableHead>
                {!compact ? <TableHead>Table</TableHead> : null}
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(compact ? teams : rest).map((t, i) => {
                const rank = compact ? i + 1 : i + 4;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono tabular-nums text-muted-foreground">{rank}</TableCell>
                    <TableCell className="font-medium">{t.team_name}</TableCell>
                    {!compact ? (
                      <TableCell className="text-muted-foreground">{t.table_number ?? '—'}</TableCell>
                    ) : null}
                    <TableCell className="text-right font-mono tabular-nums">
                      {(t.total_score ?? 0).toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PodiumCard({ rank, team }: { rank: 1 | 2 | 3; team: { team_name: string; total_score: number | null } | undefined }) {
  if (!team) return <div />;
  const tall = rank === 1;
  const Icon = rank === 1 ? Crown : Medal;
  return (
    <div className={cn('flex flex-col items-center gap-2', tall ? '' : 'pt-6')}>
      <Icon className={cn('h-6 w-6', tall ? '' : 'h-5 w-5')} />
      <Card className={cn('w-full text-center', tall ? 'border-foreground/40' : '')}>
        <CardContent className={cn('flex flex-col items-center justify-center gap-1', tall ? 'p-6' : 'p-4')}>
          <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">#{rank}</div>
          <div className={cn('truncate font-display font-semibold tracking-tight', tall ? 'text-lg' : 'text-base')}>
            {team.team_name}
          </div>
          <div className={cn('font-mono tabular-nums', tall ? 'text-3xl' : 'text-xl')}>
            {(team.total_score ?? 0).toFixed(1)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
