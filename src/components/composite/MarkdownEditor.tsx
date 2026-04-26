import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { MarkdownView } from '@/components/composite/MarkdownView';

type Mode = 'write' | 'preview';

export function MarkdownEditor({
  value,
  onChange,
  rows = 14,
  placeholder = 'Write your problem statement in Markdown…',
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<Mode>('write');

  return (
    <div className={cn('space-y-2', className)}>
      <div className="inline-flex rounded-md border border-border p-0.5">
        <Tab active={mode === 'write'} onClick={() => setMode('write')} icon={Pencil}>
          Write
        </Tab>
        <Tab active={mode === 'preview'} onClick={() => setMode('preview')} icon={Eye}>
          Preview
        </Tab>
      </div>
      {mode === 'write' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="font-mono text-sm leading-relaxed"
        />
      ) : (
        <div className="min-h-[280px] rounded-md border border-border bg-card px-4 py-3">
          {value.trim() ? (
            <MarkdownView markdown={value} />
          ) : (
            <p className="text-2xs text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
