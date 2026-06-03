/**
 * FilePreview
 *
 * Display-only renderer for a persisted file attachment. Picks between
 * an image thumbnail and a generic file pill based on the MIME type.
 * For use in message threads, comment views, gallery rows, etc. —
 * anywhere a stored URL needs a compact visual.
 *
 * For in-flight composer state (upload progress / errors / remove
 * button) use `AttachmentChip` instead.
 */

import { File as FileIcon, Download } from 'lucide-react';
import { cn } from '@/client/lib/utils';

export interface FilePreviewProps {
    url: string;
    contentType: string;
    name: string;
    /** Clickable links open the file in a new tab. Defaults to true. */
    linkable?: boolean;
    /** Max width for the image variant (Tailwind class).
     *  Defaults to `max-w-[240px]`. */
    maxImageWidthClass?: string;
    /** Max height for the image variant (Tailwind class).
     *  Defaults to `max-h-60`. */
    maxImageHeightClass?: string;
    className?: string;
}

export function FilePreview({
    url,
    contentType,
    name,
    linkable = true,
    maxImageWidthClass = 'max-w-[240px]',
    maxImageHeightClass = 'max-h-60',
    className,
}: FilePreviewProps) {
    const isImage = contentType.startsWith('image/');

    if (isImage) {
        const img = (
            <img
                src={url}
                alt={name}
                className={cn(maxImageHeightClass, 'w-auto object-contain')}
            />
        );
        return linkable ? (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    'block overflow-hidden rounded-lg border border-border',
                    maxImageWidthClass,
                    className
                )}
                title={name}
            >
                {img}
            </a>
        ) : (
            <div
                className={cn(
                    'overflow-hidden rounded-lg border border-border',
                    maxImageWidthClass,
                    className
                )}
                title={name}
            >
                {img}
            </div>
        );
    }

    const tileClasses = cn(
        'group flex max-w-[240px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs',
        linkable && 'hover:bg-muted',
        className
    );
    const inner = (
        <>
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{name}</span>
            {linkable && (
                <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            )}
        </>
    );
    return linkable ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={tileClasses} title={name}>
            {inner}
        </a>
    ) : (
        <div className={tileClasses} title={name}>
            {inner}
        </div>
    );
}
