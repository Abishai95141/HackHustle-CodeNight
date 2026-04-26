import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Bell, FileText, Lock, Sparkles, Unlock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useMyNotifications } from '@/data/queries/notifications';
import { useMyProblemStatements } from '@/data/queries/problemStatements';
import { useAppSettingsValue } from '@/data/queries/appSettings';
import { NotificationCard } from '@/components/composite/NotificationCard';
import { EnableNotificationsBanner } from '@/components/composite/EnableNotificationsBanner';
import { supabase } from '@/data/client';
import type { TeamDomain } from '@/data/queries/teams';

export function ParticipantHomePage() {
  const { profile, signOut } = useAuth();
  const [reveal, setReveal] = useState(false);
  const notifications = useMyNotifications();
  const latest = (notifications.data ?? []).slice(0, 2);
  const problems = useMyProblemStatements();
  const problemCount = problems.data?.length ?? 0;
  const { winners_announced } = useAppSettingsValue();

  const team = useQuery({
    queryKey: ['me', 'team-summary', profile?.team_id],
    enabled: !!profile?.team_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('team_name, team_code, domain')
        .eq('id', profile!.team_id!)
        .maybeSingle();
      if (error) throw error;
      return data as { team_name: string; team_code: string; domain: TeamDomain | null } | null;
    },
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-12">
      <header className="mb-6 space-y-1">
        <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Hello</div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {profile?.name ?? 'Participant'}
        </h1>
      </header>

      <EnableNotificationsBanner />

      {winners_announced ? (
        <Link
          to="/me/winners"
          className="group relative mb-6 flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-4 transition-transform hover:scale-[1.01]"
        >
          <Sparkles className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 text-amber-500/15" />
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xs font-medium uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Winners announced
            </div>
            <div className="text-sm font-medium">See who took home each domain →</div>
          </div>
        </Link>
      ) : null}

      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:bg-secondary"
      >
        {reveal && profile?.qr_token ? (
          <div className="flex h-full items-center justify-center bg-white">
            <QRCodeSVG value={profile.qr_token} size={260} level="M" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Tap to reveal</div>
            <div className="font-display text-lg font-medium">My QR</div>
          </div>
        )}
      </button>

      <p className="mt-4 text-2xs text-muted-foreground">
        Show this code at the entrance and at meal counters. Don't share screenshots.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Email" value={profile?.email ?? '—'} />
        <Stat label="Inside venue" value={profile?.is_inside_venue ? 'Yes' : 'No'} />
        {team.data ? (
          <>
            <Stat label="Team" value={team.data.team_name} />
            <Stat label="Domain" value={team.data.domain ?? '—'} />
          </>
        ) : null}
      </div>

      <Link
        to="/me/problems"
        className="mt-10 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium">Problem statements</div>
            <div className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
              {problemCount > 0 ? (
                <>
                  <Unlock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {problemCount} released for your domain
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  Not released yet — check back soon
                </>
              )}
            </div>
          </div>
        </div>
        <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">View →</span>
      </Link>

      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </h2>
          <Link to="/me/notifications" className="text-2xs text-muted-foreground underline-offset-4 hover:underline">
            See all
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-2xs text-muted-foreground">
            You're all caught up.
          </p>
        ) : (
          latest.map((n) => <NotificationCard key={n.id} notification={n} />)
        )}
      </section>

      <button
        type="button"
        onClick={signOut}
        className="mt-auto pt-10 text-center text-2xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
