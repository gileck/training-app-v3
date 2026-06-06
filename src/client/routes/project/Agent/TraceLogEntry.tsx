/**
 * One trace entry rendered as a log-line bubble inline with messages.
 * Used only in verbose mode. Compact, monospace-leaning, with level
 * + layer badges so the eye can scan a noisy thread quickly.
 */

import { useState } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Info,
    AlertTriangle,
    OctagonAlert,
    Bug,
} from 'lucide-react';
import { Badge } from '@/client/components/template/ui/badge';
import { cn } from '@/client/lib/utils';
import type { TraceEntry } from '@/server/database/collections/template/agentTraces/types';

interface TraceLogEntryProps {
    entry: TraceEntry;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

const LEVEL_STYLES: Record<TraceEntry['level'], string> = {
    debug: 'text-muted-foreground/60',
    info: 'text-muted-foreground',
    warn: 'text-warning',
    error: 'text-destructive',
};

const LEVEL_ICON_STYLES: Record<TraceEntry['level'], React.ReactNode> = {
    debug: <Bug className="h-3 w-3" />,
    info: <Info className="h-3 w-3" />,
    warn: <AlertTriangle className="h-3 w-3" />,
    error: <OctagonAlert className="h-3 w-3" />,
};

export function TraceLogEntry({ entry }: TraceLogEntryProps) {
    const hasData =
        entry.data !== undefined &&
        entry.data !== null &&
        !(typeof entry.data === 'object' &&
          Object.keys(entry.data as object).length === 0);
    // eslint-disable-next-line state-management/prefer-state-architecture -- per-row UI toggle, ephemeral
    const [open, setOpen] = useState(false);

    return (
        <div
            className={cn(
                'group rounded-md border border-border/40 bg-card/40 px-3 py-1.5 font-mono text-[11px]',
                LEVEL_STYLES[entry.level]
            )}
        >
            <button
                type="button"
                disabled={!hasData}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'flex w-full items-center gap-2 text-left',
                    hasData ? 'cursor-pointer' : 'cursor-default'
                )}
            >
                {hasData ? (
                    open ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                    )
                ) : (
                    <span className="inline-block h-3 w-3 shrink-0" />
                )}
                <span className="shrink-0 tabular-nums opacity-60">
                    {formatTime(entry.at)}
                </span>
                <Badge
                    variant="outline"
                    className="h-4 shrink-0 px-1 py-0 text-[10px] font-normal uppercase"
                >
                    {entry.layer}
                </Badge>
                <span className="inline-flex shrink-0 items-center">
                    {LEVEL_ICON_STYLES[entry.level]}
                </span>
                <span className="truncate text-foreground/90">
                    {entry.message}
                </span>
            </button>

            {open && hasData && (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 px-2 py-1 text-[10px] text-foreground/80">
                    {JSON.stringify(entry.data, null, 2)}
                </pre>
            )}
        </div>
    );
}
