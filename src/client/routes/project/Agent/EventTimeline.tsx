import { ChevronDown, ChevronRight, Wrench, CheckCircle2, XCircle, Brain, MessageCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/client/components/template/ui/badge';
import { cn } from '@/client/lib/utils';
import type { AgentEvent } from '@/server/template/agentic';
import { useAgentUIStore } from '@/client/features/template/agent';

interface EventTimelineProps {
    messageId: string;
    events: AgentEvent[];
    isStreaming: boolean;
    /** True when the turn is paused waiting for the user to answer an
     *  ask_user question. The actionable widget renders below, so the
     *  timeline should step back: collapse and say it's waiting, not
     *  "Working…" with the tool JSON dumped open. */
    awaitingInput?: boolean;
}

export function EventTimeline({
    messageId,
    events,
    isStreaming,
    awaitingInput,
}: EventTimelineProps) {
    const userExpanded = useAgentUIStore((s) =>
        s.expandedTimelineMessageIds.includes(messageId)
    );
    const toggle = useAgentUIStore((s) => s.toggleTimelineExpanded);

    // During a live run this IS the working indicator (the "Working on
    // it…" bubble was retired) — so it must show, and auto-expand so
    // the thinking process is visible without an extra click. When the
    // turn finishes, the timeline collapses back to a "Reasoning"
    // pill the user can re-open at will.
    if (events.length === 0 && !isStreaming) return null;
    // Don't auto-expand while waiting on the user — the question widget
    // below is the focus; the user can still expand to inspect.
    const expanded = (isStreaming && !awaitingInput) || userExpanded;
    const label = awaitingInput
        ? 'Waiting for your answer'
        : isStreaming
          ? 'Working…'
          : 'Reasoning';

    const toolCount = events.filter((e) => e.type === 'tool_call').length;
    const thinkingCount = events.filter((e) => e.type === 'thinking').length;

    return (
        <div className="mt-2 w-full rounded-lg border border-border bg-card/60">
            <button
                type="button"
                onClick={() => toggle(messageId)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
                {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                )}
                <span className="font-medium">{label}</span>
                {toolCount > 0 && (
                    <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" /> {toolCount}
                    </span>
                )}
                {thinkingCount > 0 && (
                    <span className="flex items-center gap-1">
                        <Brain className="h-3 w-3" /> {thinkingCount}
                    </span>
                )}
                {isStreaming && !awaitingInput && (
                    <span className="ml-auto inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                )}
            </button>

            {expanded && (
                <ol className="space-y-2 border-t border-border px-3 py-2">
                    {events.length === 0 ? (
                        <li className="flex items-start gap-2 text-xs text-muted-foreground">
                            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                            <span>Waiting for first response from the model…</span>
                        </li>
                    ) : (
                        events.map((event, idx) => (
                            <EventRow key={`${event.at}-${idx}`} event={event} />
                        ))
                    )}
                </ol>
            )}
        </div>
    );
}

function EventRow({ event }: { event: AgentEvent }) {
    switch (event.type) {
        case 'thinking':
            return (
                <li className="flex items-start gap-2 text-xs">
                    <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                        {event.content}
                    </p>
                </li>
            );
        case 'tool_call':
            return (
                <li className="flex items-start gap-2 text-xs">
                    <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                                {event.name}
                            </code>
                        </div>
                        {Object.keys(event.args).length > 0 && (
                            <pre className="overflow-x-auto rounded bg-muted/50 p-1.5 text-[11px]">
                                {JSON.stringify(event.args, null, 2)}
                            </pre>
                        )}
                    </div>
                </li>
            );
        case 'tool_result':
            return (
                <li className="flex items-start gap-2 text-xs">
                    {event.ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                    <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground">
                                {event.name} →
                            </span>
                            {event.summary && (
                                <span className="text-foreground">
                                    {event.summary}
                                </span>
                            )}
                            {event.wrote && (
                                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                    saved
                                </Badge>
                            )}
                            {event.truncated && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                    truncated
                                </Badge>
                            )}
                        </div>
                    </div>
                </li>
            );
        case 'message':
            return (
                <li className="flex items-start gap-2 text-xs">
                    <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className={cn('text-muted-foreground line-clamp-2')}>
                        {event.content}
                    </p>
                </li>
            );
    }
}
