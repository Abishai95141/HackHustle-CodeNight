export function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 px-6 text-center">
      <span className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
    </div>
  );
}
