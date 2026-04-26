import { cn } from '@/lib/cn';

/**
 * Compact inline loading indicator for sub-page sections (a card, a panel, a
 * roster). Same dot motif as the full-page LoadingScreen so the visual
 * language stays consistent. Use full-page LoadingScreen for route-level
 * suspense; use this for in-card waits.
 */
export function InlineLoader({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-3 py-8 text-2xs uppercase tracking-[0.2em] text-muted-foreground',
        className,
      )}
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground [animation-delay:-0.32s]" />
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground [animation-delay:-0.16s]" />
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
      </span>
      {label}
    </div>
  );
}
