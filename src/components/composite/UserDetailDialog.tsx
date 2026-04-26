import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AtSign, Calendar, Edit2, Mail, Phone, Shirt, Trash2, Users as UsersIcon, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttendancePill } from '@/components/composite/AttendancePill';
import { StatusPill } from '@/components/composite/StatusPill';
import { supabase } from '@/data/client';
import type { UserRow } from '@/data/queries/users';
import { labelForRole } from '@/domain/auth/roles';

type Props = {
  user: UserRow | null;
  onClose: () => void;
  onEditRole: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
};

/** Read-mostly profile dialog for any participant or staff member. Lazy-fetches
 *  attendance audit + meal-claim count once opened so the parent table doesn't
 *  pay for unused data. */
export function UserDetailDialog({ user, onClose, onEditRole, onDelete }: Props) {
  const detail = useQuery({
    queryKey: ['admin', 'user-detail', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const [profileRes, mealsCountRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'phone, tshirt_size, dietary_restrictions, created_at, attendance_marked_at, attendance_marked_by',
          )
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('meal_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (mealsCountRes.error) throw mealsCountRes.error;

      let markedByName: string | null = null;
      if (profileRes.data?.attendance_marked_by) {
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', profileRes.data.attendance_marked_by)
          .maybeSingle();
        markedByName = data?.name ?? null;
      }

      return {
        phone: profileRes.data?.phone ?? null,
        tshirt_size: profileRes.data?.tshirt_size ?? null,
        dietary_restrictions: profileRes.data?.dietary_restrictions ?? null,
        created_at: profileRes.data?.created_at ?? null,
        attendance_marked_at: profileRes.data?.attendance_marked_at ?? null,
        marked_by_name: markedByName,
        meals_claimed: mealsCountRes.count ?? 0,
      };
    },
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {user ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{user.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </DialogDescription>
            </DialogHeader>

            {/* Identity pills */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{labelForRole(user.role)}</Badge>
              <AttendancePill status={user.attendance_status} />
              <StatusPill tone={user.is_inside_venue ? 'on' : 'off'}>
                {user.is_inside_venue ? 'Inside venue' : 'Outside venue'}
              </StatusPill>
            </div>

            {/* Profile section */}
            <Section title="Profile">
              <Field icon={Phone} label="Phone" value={detail.data?.phone ?? '—'} />
              <Field icon={Shirt} label="T-shirt" value={detail.data?.tshirt_size ?? '—'} />
              <Field
                icon={Utensils}
                label="Dietary"
                value={detail.data?.dietary_restrictions ?? 'None'}
              />
              <Field
                icon={Utensils}
                label="Meals claimed"
                value={String(detail.data?.meals_claimed ?? 0)}
              />
            </Section>

            {/* Team section */}
            {user.team ? (
              <Section title="Team">
                <Field icon={UsersIcon} label="Name" value={user.team.team_name} />
                <Field icon={AtSign} label="Code" value={user.team.team_code} mono />
                <Field icon={UsersIcon} label="Domain" value={user.team.domain ?? '—'} />
              </Section>
            ) : user.role === 'participant' ? (
              <Section title="Team">
                <p className="text-2xs text-rose-600 dark:text-rose-400">! No team assigned</p>
              </Section>
            ) : null}

            {/* Audit */}
            <Section title="Activity">
              {detail.data?.attendance_marked_at ? (
                <Field
                  icon={Calendar}
                  label={`Attendance ${user.attendance_status.replace('_', ' ')}`}
                  value={`${format(
                    new Date(detail.data.attendance_marked_at),
                    'MMM d, HH:mm',
                  )}${detail.data.marked_by_name ? ` · by ${detail.data.marked_by_name}` : ''}`}
                />
              ) : null}
              {detail.data?.created_at ? (
                <Field
                  icon={Calendar}
                  label="Account created"
                  value={format(new Date(detail.data.created_at), 'MMM d, HH:mm')}
                />
              ) : null}
            </Section>

            {/* Action footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEditRole(user);
                }}
              >
                <Edit2 className="h-4 w-4" /> Edit role
              </Button>
              <Button
                variant="outline"
                className="border-rose-500/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                onClick={() => {
                  onClose();
                  onDelete(user);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete user
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-md border border-border bg-card/50 p-3">
      <h3 className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={mono ? 'font-mono text-xs' : 'text-right'}>{value}</span>
    </div>
  );
}
