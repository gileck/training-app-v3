/**
 * MarkdownText
 *
 * Standard markdown renderer used across the app. Wraps `react-markdown`
 * with `remark-gfm` (tables, strikethrough, task lists, autolinks) and
 * the project's `.markdown-body` global styles (see `src/client/styles/
 * globals.css`).
 *
 * Use this anywhere user-authored or model-authored markdown needs to
 * render — agent assistant bubbles, feature-request descriptions,
 * decision contexts, etc.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/client/lib/utils';

export interface MarkdownTextProps {
    /** Markdown source. */
    content: string;
    /** Extra classes appended to the `.markdown-body text-sm` wrapper. */
    className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
    return (
        <div className={cn('markdown-body text-sm', className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
}
