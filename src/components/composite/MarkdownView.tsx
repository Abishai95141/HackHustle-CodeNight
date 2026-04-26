import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

export function MarkdownView({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none dark:prose-invert',
        // Tighten default tailwind prose sizes so they sit comfortably inside cards.
        'prose-headings:font-display prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
        'prose-p:leading-relaxed prose-li:leading-relaxed',
        'prose-pre:rounded-md prose-pre:bg-secondary prose-pre:text-foreground',
        'prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:text-2xs prose-code:before:content-none prose-code:after:content-none',
        'prose-a:text-primary prose-a:underline-offset-4',
        'prose-table:text-sm prose-th:font-medium',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
