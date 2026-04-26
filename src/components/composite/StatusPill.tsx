import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'on' | 'off';

const tones: Record<Tone, string> = {
  neutral: 'border-border text-muted-foreground',
  on: 'border-foreground/40 text-foreground',
  off: 'border-border text-muted-foreground',
};

export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.14em]',
        tones[tone],
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          tone === 'on' ? 'bg-foreground' : 'bg-muted-foreground/50',
        )}
      />
      {children}
    </span>
  );
}
