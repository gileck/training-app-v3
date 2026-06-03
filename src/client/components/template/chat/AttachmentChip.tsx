/**
 * AttachmentChip + AttachmentSlot
 *
 * Composer-state chip for in-flight upload UI. Two visual variants:
 *
 *   - `'pill'` (default) — compact horizontal row: thumbnail (32×32),
 *     filename, upload spinner, optional × button. Good for dense
 *     lists and forms.
 *   - `'card'` — large square thumbnail (64×64) with × in the top-
 *     right corner. Filename is in a tooltip only (or rendered as a
 *     small caption for non-image files). Optimized for modern chat
 *     composers where image-first feels right.
 *
 * For display-only persisted attachments (no remove, no spinner), use
 * `FilePreview` instead.
 *
 * The `AttachmentSlot` shape is intentionally generic enough that any
 * feature with a file-upload composer (chat input, bug-report form,
 * profile picker) can drive it from local state.
 */

import { Loader2, X, File as FileIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/client/lib/utils';

export interface AttachmentSlot {
    /** Local-only id for keying + removal. Caller-supplied so they can
     *  correlate with their own upload mutation. */
    id: string;
    name: string;
    contentType: string;
    status: 'uploading' | 'uploaded' | 'failed';
    /** Failure reason, when status is 'failed'. */
    error?: string;
    /** Final public URL once uploaded. */
    url?: string;
    /** Server-reported byte size. Populated alongside `url`. */
    size?: number;
    /** Local blob URL (`URL.createObjectURL(file)`) for instant image
     *  preview while the upload is in flight. The caller is
     *  responsible for revoking it. */
    previewUrl?: string;
}

export interface AttachmentChipProps {
    attachment: AttachmentSlot;
    /** When provided, renders the × button that calls back. Pass
     *  `undefined` for read-only chips. */
    onRemove?: () => void;
    /** Visual variant. Defaults to `'pill'`. */
    variant?: 'pill' | 'card';
}

export function AttachmentChip({
    attachment,
    onRemove,
    variant = 'pill',
}: AttachmentChipProps) {
    if (variant === 'card') {
        return <CardChip attachment={attachment} onRemove={onRemove} />;
    }
    return <PillChip attachment={attachment} onRemove={onRemove} />;
}

function PillChip({
    attachment,
    onRemove,
}: {
    attachment: AttachmentSlot;
    onRemove?: () => void;
}) {
    const isImage = attachment.contentType.startsWith('image/');
    const isFailed = attachment.status === 'failed';
    const isUploading = attachment.status === 'uploading';
    const displayUrl = attachment.previewUrl || attachment.url;

    return (
        <div
            className={cn(
                'group relative flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs',
                isFailed && 'border-destructive/40 bg-destructive/5'
            )}
            title={attachment.error || attachment.name}
        >
            {isImage && displayUrl ? (
                <img
                    src={displayUrl}
                    alt={attachment.name}
                    className="h-8 w-8 rounded object-cover"
                />
            ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    {isFailed ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            )}
            <span className="max-w-[160px] truncate">{attachment.name}</span>
            {isUploading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Remove attachment"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

function CardChip({
    attachment,
    onRemove,
}: {
    attachment: AttachmentSlot;
    onRemove?: () => void;
}) {
    const isImage = attachment.contentType.startsWith('image/');
    const isFailed = attachment.status === 'failed';
    const isUploading = attachment.status === 'uploading';
    const displayUrl = attachment.previewUrl || attachment.url;

    return (
        <div
            className={cn(
                'group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-sm',
                isFailed && 'border-destructive/40 bg-destructive/10'
            )}
            title={attachment.error || attachment.name}
        >
            {isImage && displayUrl ? (
                <img
                    src={displayUrl}
                    alt={attachment.name}
                    className={cn(
                        'h-full w-full object-cover',
                        isUploading && 'opacity-60'
                    )}
                />
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
                    {isFailed ? (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">
                        {attachment.name}
                    </span>
                </div>
            )}

            {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                </div>
            )}

            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 shadow-md transition-opacity hover:bg-foreground group-hover:opacity-100 focus:opacity-100"
                    aria-label="Remove attachment"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}
