import { cn } from '@/lib/cn';
import type { AttendanceStatus } from '@/data/queries/users';

const config: Record<
  AttendanceStatus,
  { label: string; className: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    className: 'border-border text-muted-foreground bg-muted/40',
    dot: 'bg-muted-foreground/60',
  },
  checked_in: {
    label: 'Checked in',
    className: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10',
    dot: 'bg-emerald-500',
  },
  checked_out: {
    label: 'Checked out',
    className: 'border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/10',
    dot: 'bg-sky-500',
  },
  absent: {
    label: 'Absent',
    className: 'border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10',
    dot: 'bg-rose-500',
  },
};

export function AttendancePill({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  const c = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
        c.className,
        className,
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}
