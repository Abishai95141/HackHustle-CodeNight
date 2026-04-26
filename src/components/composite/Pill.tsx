import { cn } from '@/lib/cn';

/**
 * Single source of truth for tinted status pills across the app.
 * Replaces 15+ ad-hoc inline `inline-flex rounded-full border px-2 py-0.5`
 * spans that had drifted in size/colour. Use this whenever you need a small
 * coloured chip — domain pills, status pills, role pills, etc.
 *
 * Tones use bg/border/text triplets that pass WCAG AA in both modes:
 *  - emerald, sky, amber, rose, violet  → 9-100 scale ramps
 *  - neutral                            → border-border + muted-foreground
 *  - solid                              → inverted (foreground bg)
 */
export type PillTone =
  | 'neutral'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'slate'
  | 'solid';

const TONES: Record<PillTone, string> = {
  neutral: 'border-border bg-secondary text-muted-foreground',
  emerald:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  sky: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  violet:
    'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  slate:
    'border-slate-400/40 bg-slate-400/10 text-slate-700 dark:text-slate-200',
  solid: 'border-transparent bg-foreground text-background',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[10px] tracking-[0.14em]',
  md: 'px-2.5 py-0.5 text-2xs tracking-[0.14em]',
} as const;

export function Pill({
  tone = 'neutral',
  size = 'md',
  icon,
  className,
  children,
  title,
}: {
  tone?: PillTone;
  size?: keyof typeof SIZES;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium uppercase',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
