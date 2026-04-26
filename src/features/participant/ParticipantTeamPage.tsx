import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/composite/EmptyState';
import { SubmissionPanel } from '@/components/composite/SubmissionPanel';
import { supabase } from '@/data/client';

export function ParticipantTeamPage() {
  const { profile } = useAuth();

  const team = useQuery({
    queryKey: ['me', 'team', profile?.team_id],
    queryFn: async () => {
      if (!profile?.team_id) return null;
      const [tRes, mRes] = await Promise.all([
        supabase.from('teams').select('*').eq('id', profile.team_id).single(),
        supabase.from('profiles').select('id, name, email').eq('team_id', profile.team_id),
      ]);
      if (tRes.error) throw tRes.error;
      if (mRes.error) throw mRes.error;
      return { team: tRes.data, members: mRes.data ?? [] };
    },
    enabled: !!profile?.team_id,
  });

  if (!profile?.team_id) {
    return (
      <div className="mx-auto max-w-md px-6 pt-12">
        <EmptyState
          title="No team yet"
          body="Once an admin assigns you to a team, you'll see your teammates here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 pb-10 pt-12">
      <header className="space-y-1">
        <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">My team</div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {team.data?.team.team_name ?? '—'}
        </h1>
        <p className="text-2xs font-mono text-muted-foreground">{team.data?.team.team_code}</p>
      </header>

      {team.data?.team.table_number ? (
        <Card>
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <span className="text-muted-foreground">Table</span>
            <span className="font-display text-xl font-semibold">
              {team.data.team.table_number}
            </span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({team.data?.members.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(team.data?.members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
              <span>{m.name}</span>
              {m.id === profile?.id ? (
                <span className="text-2xs text-muted-foreground">you</span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <SubmissionPanel teamId={profile.team_id} />
    </div>
  );
}
