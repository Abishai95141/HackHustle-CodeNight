/**
 * Full-page loader. Used as both the auth-bootstrap fallback and the Suspense
 * fallback for code-split routes. Three pulsing dots feel less like a spinner
 * and more like a paced "we're working on it" indicator.
 */
export function LoadingScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground [animation-delay:-0.32s]" />
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground [animation-delay:-0.16s]" />
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground" />
        </div>
        <span className="text-2xs uppercase tracking-[0.2em]">{label}</span>
      </div>
    </div>
  );
}
