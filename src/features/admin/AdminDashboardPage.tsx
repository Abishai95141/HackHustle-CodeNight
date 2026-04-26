import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Bell, DoorOpen, Gavel, HelpCircle, LogIn, LogOut as LogOutIcon, ShieldCheck, Trophy, UserCheck, UserMinus, Users, Utensils } from 'lucide-react';
import { PageHeader } from '@/components/composite/PageHeader';
import { StatusPill } from '@/components/composite/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/data/client';
import { cn } from '@/lib/cn';

export function AdminDashboardPage() {
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async () => {
      // The participant count needs to be role-aware: profiles whose role is
      // 'participant' and who aren't marked absent. Staff counts are by role.
      // We pull all profiles (small table) and join roles in JS; cleaner than
      // wrestling PostgREST joins for several count queries.
      const [
        profilesRes,
        rolesRes,
        insideRes,
        openQRes,
        mealsRes,
        teamsRes,
        pendingNotifsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, attendance_status'),
        supabase.from('user_roles').select('user_id, role'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_inside_venue', true)
          .neq('attendance_status', 'absent'),
        supabase.from('queries').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase
          .from('meal_transactions')
          .select('id, profiles!inner(attendance_status)', { count: 'exact', head: true })
          .neq('profiles.attendance_status', 'absent'),
        supabase.from('teams').select('id', { count: 'exact', head: true }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const profiles = (profilesRes.data ?? []) as {
        id: string;
        attendance_status: 'pending' | 'checked_in' | 'checked_out' | 'absent';
      }[];
      const roleByUser = new Map<string, string>();
      for (const r of rolesRes.data ?? []) roleByUser.set(r.user_id, r.role);

      const breakdown = { pending: 0, checked_in: 0, checked_out: 0, absent: 0 };
      const staff = { super_admin: 0, volunteer: 0, judge: 0, rsvp: 0 };
      let participants = 0;
      for (const p of profiles) {
        breakdown[p.attendance_status]++;
        const role = roleByUser.get(p.id) ?? 'participant';
        if (role === 'participant') {
          if (p.attendance_status !== 'absent') participants++;
        } else if (role in staff) {
          (staff as Record<string, number>)[role]++;
        }
      }

      return {
        participants,
        staff,
        inside: insideRes.count ?? 0,
        openQueries: openQRes.count ?? 0,
        meals: mealsRes.count ?? 0,
        teams: teamsRes.count ?? 0,
        breakdown,
        pendingNotifs: pendingNotifsRes.count ?? 0,
      };
    },
  });

  const recentNotifications = useQuery({
    queryKey: ['admin', 'dashboard', 'notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, status, published_at, created_at, target_type')
        .eq('status', 'approved')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recentAttendance = useQuery({
    queryKey: ['admin', 'dashboard', 'attendance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('id, scan_type, timestamp, user:profiles(name)')
        .order('timestamp', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        scan_type: 'entry' | 'exit';
        timestamp: string | null;
        user: { name: string } | null;
      }[];
    },
  });

  const recentMeals = useQuery({
    queryKey: ['admin', 'dashboard', 'meals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_transactions')
        .select('id, meal_type, timestamp, user:profiles(name)')
        .order('timestamp', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        meal_type: string;
        timestamp: string | null;
        user: { name: string } | null;
      }[];
    },
  });

  const recentQueries = useQuery({
    queryKey: ['admin', 'dashboard', 'queries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queries')
        .select('id, title, status, created_at, user:profiles(name)')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        title: string;
        status: 'open' | 'in_progress' | 'resolved';
        created_at: string | null;
        user: { name: string } | null;
      }[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () =>
        invalidateAll(qc),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_transactions' }, () =>
        invalidateAll(qc),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries' }, () =>
        invalidateAll(qc),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () =>
        invalidateAll(qc),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" subtitle="Operational pulse — attendance, meals, support, judging." />

      {/* People — participants get a hero card; staff break out by role. */}
      <section className="space-y-3">
        <SectionHeading>People</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardContent className="flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Participants
                </span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="font-display text-4xl font-semibold tracking-tight tabular-nums">
                {stats.data?.participants ?? '—'}
              </div>
              <div className="text-2xs text-muted-foreground">excludes absent</div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-3 p-5 pt-0">
              <StaffStat icon={ShieldCheck} label="Admins" value={stats.data?.staff.super_admin} />
              <StaffStat icon={UserCheck} label="RSVP" value={stats.data?.staff.rsvp} />
              <StaffStat icon={Users} label="Volunteers" value={stats.data?.staff.volunteer} />
              <StaffStat icon={Gavel} label="Judges" value={stats.data?.staff.judge} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Attendance lifecycle */}
      <section className="space-y-3">
        <SectionHeading>Attendance</SectionHeading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <AttendanceTile to="/admin/rsvp?status=pending"     label="Pending"     value={stats.data?.breakdown.pending}     icon={Users}      tone="neutral" />
          <AttendanceTile to="/admin/rsvp?status=checked_in"  label="Checked in"  value={stats.data?.breakdown.checked_in}  icon={LogIn}      tone="emerald" />
          <AttendanceTile to="/admin/rsvp?status=checked_out" label="Checked out" value={stats.data?.breakdown.checked_out} icon={LogOutIcon} tone="sky" />
          <AttendanceTile to="/admin/rsvp?status=absent"      label="Absent"      value={stats.data?.breakdown.absent}      icon={UserMinus}  tone="rose" />
        </div>
      </section>

      {/* Operations */}
      <section className="space-y-3">
        <SectionHeading>Operations</SectionHeading>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={DoorOpen} label="Inside venue" value={stats.data?.inside} />
          <Stat icon={Utensils} label="Meals served" value={stats.data?.meals} hint="excludes absent" />
          <Stat icon={Trophy} label="Teams" value={stats.data?.teams} />
          <Stat icon={HelpCircle} label="Open queries" value={stats.data?.openQueries} />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(recentAttendance.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No scans yet.</p>
            ) : (
              recentAttendance.data!.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{a.user?.name ?? '—'}</div>
                    <div className="text-2xs text-muted-foreground">
                      {a.timestamp ? format(new Date(a.timestamp), 'HH:mm') : '—'}
                    </div>
                  </div>
                  <StatusPill tone={a.scan_type === 'entry' ? 'on' : 'off'}>
                    {a.scan_type}
                  </StatusPill>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent meals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(recentMeals.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No meals claimed yet.</p>
            ) : (
              recentMeals.data!.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{m.user?.name ?? '—'}</div>
                    <div className="text-2xs text-muted-foreground">
                      {m.timestamp ? format(new Date(m.timestamp), 'HH:mm') : '—'}
                    </div>
                  </div>
                  <span className="font-mono text-2xs text-muted-foreground">{m.meal_type}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(recentQueries.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No queries yet.</p>
            ) : (
              recentQueries.data!.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{q.title}</div>
                    <div className="text-2xs text-muted-foreground">{q.user?.name ?? '—'}</div>
                  </div>
                  <StatusPill tone={q.status === 'resolved' ? 'on' : 'off'}>
                    {q.status.replace('_', ' ')}
                  </StatusPill>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="inline-flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
          <Link
            to="/admin/notifications"
            className="text-2xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            {(stats.data?.pendingNotifs ?? 0) > 0
              ? `${stats.data?.pendingNotifs} pending →`
              : 'Manage →'}
          </Link>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(recentNotifications.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No notifications published yet.</p>
          ) : (
            recentNotifications.data!.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{n.title}</div>
                  <div className="text-2xs text-muted-foreground">target: {n.target_type}</div>
                </div>
                <span className="text-2xs text-muted-foreground">
                  {n.published_at ? format(new Date(n.published_at), 'HH:mm') : '—'}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceTile({
  to,
  label,
  value,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'emerald' | 'sky' | 'rose';
}) {
  const tones: Record<string, string> = {
    neutral: 'border-border text-foreground',
    emerald: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    sky: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
    rose: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
  };
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors hover:bg-secondary/40',
        tones[tone],
      )}
    >
      <div>
        <div className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-semibold">{value ?? '—'}</div>
      </div>
      <Icon className="h-5 w-5 opacity-70" />
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="font-display text-2xl font-semibold tracking-tight">
          {value ?? '—'}
        </div>
        {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

function StaffStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-1 font-display text-xl font-semibold tabular-nums">
        {value ?? '—'}
      </div>
    </div>
  );
}
