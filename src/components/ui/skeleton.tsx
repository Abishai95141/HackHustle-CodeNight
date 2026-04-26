import { cn } from '@/lib/cn';

/**
 * Loading placeholder. Uses a subtle shimmer instead of a hard pulse so it
 * feels less spinning-loader and more "content is arriving".
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(110deg,hsl(var(--secondary))_8%,hsl(var(--muted))_18%,hsl(var(--secondary))_33%)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

/** Common compositions used by feature pages. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2 w-2/3" />
      </div>
    </div>
  );
}
