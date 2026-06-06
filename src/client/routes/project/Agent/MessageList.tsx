import { useEffect, useMemo, useRef, useState } from 'react';
import {
    User,
    AlertTriangle,
    WifiOff,
    Bot,
    Copy,
    Check,
    Pencil,
    RotateCw,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/client/lib/utils';
import { Avatar, AvatarFallback } from '@/client/components/template/ui/avatar';
import { toast } from '@/client/components/template/ui/toast';
import { MarkdownText } from '@/client/components/template/MarkdownText';
import { FilePreview } from '@/client/components/template/chat/FilePreview';
import { MultipleChoiceQuestion } from '@/client/components/template/chat/MultipleChoiceQuestion';
import type {
    AgentMessageAttachment,
    AgentMessageClient,
    AgentQuestionAnswer,
    AgentQuestionClient,
    AgentTraceClient,
} from '@/apis/template/agent/types';
import type { TraceEntry } from '@/server/database/collections/template/agentTraces/types';
import { isMessageLivePending } from '@/client/features/template/agent';
import { EventTimeline } from './EventTimeline';
import { TraceLogEntry } from './TraceLogEntry';

interface MessageListProps {
    messages: AgentMessageClient[];
    traces?: AgentTraceClient[];
    verbose?: boolean;
    /** Multiple-choice questions the agent asked, keyed to their
     *  assistant message via `messageId`. */
    questions?: AgentQuestionClient[];
    /** Submit the user's answer to a pending question. */
    onAnswerQuestion?: (
        questionId: string,
        answers: AgentQuestionAnswer[]
    ) => void;
    /** Id of the question whose answer is currently being submitted. */
    answeringQuestionId?: string | null;
    /** Prefill the input with this text for editing. */
    onEditUserMessage?: (text: string) => void;
    /** Re-send the same text as a fresh turn. */
    onResendUserMessage?: (text: string) => void;
}

type Item =
    | { kind: 'message'; at: number; message: AgentMessageClient }
    | { kind: 'trace'; at: number; entry: TraceEntry };

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1000).toFixed(0)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
}

/** Compact wall-clock duration. <60s shows sub-second precision so the
 *  live ticker actually visibly moves; minutes drop to whole-second
 *  precision; hours collapse to "Xh Ym". */
function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin.toString().padStart(2, '0')}m`;
}

/** Re-renders every `intervalMs` while `enabled`. Scoped to whichever
 *  component uses it so the rest of the bubble doesn't re-render. */
function useNowTick(intervalMs: number, enabled: boolean): number {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral tick for a live timer
    const [now, setNow] = useState<number>(() => Date.now());
    useEffect(() => {
        if (!enabled) return;
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [enabled, intervalMs]);
    return now;
}

function LiveElapsed({ since }: { since: string }) {
    const now = useNowTick(500, true);
    const ms = now - new Date(since).getTime();
    return <>{formatDuration(ms)}</>;
}

function MessageFooter({
    message,
    isPending,
}: {
    message: AgentMessageClient;
    isPending: boolean;
}) {
    const parts: React.ReactNode[] = [];

    if (message.cost > 0) {
        parts.push(<span key="cost">${message.cost.toFixed(4)}</span>);
    }
    if (message.tokens) {
        const total = message.tokens.input + message.tokens.output;
        parts.push(
            <span key="tokens">
                {formatTokens(total)} tokens (
                {formatTokens(message.tokens.input)} in /{' '}
                {formatTokens(message.tokens.output)} out)
            </span>
        );
    }

    // Total/live duration: live ticker while pending, static
    // finalizedAt-createdAt once done. Always show — it's the most
    // useful metric for "how long did that take".
    if (isPending) {
        parts.push(<LiveElapsed key="elapsed" since={message.createdAt} />);
    } else if (message.finalizedAt) {
        const ms =
            new Date(message.finalizedAt).getTime() -
            new Date(message.createdAt).getTime();
        parts.push(<span key="elapsed">{formatDuration(ms)}</span>);
    }

    if (parts.length === 0) return null;

    return (
        <span className="px-2 text-[10px] text-muted-foreground">
            {parts.map((p, i) => (
                <span key={i}>
                    {i > 0 && ' · '}
                    {p}
                </span>
            ))}
        </span>
    );
}

export function MessageList({
    messages,
    traces,
    verbose,
    questions,
    onAnswerQuestion,
    answeringQuestionId,
    onEditUserMessage,
    onResendUserMessage,
}: MessageListProps) {
    const endRef = useRef<HTMLDivElement>(null);

    // Group questions under their assistant message so each bubble can
    // render its own widget(s). Memoized so the map identity is stable
    // across renders that don't change the questions.
    const questionsByMessageId = useMemo(() => {
        const map = new Map<string, AgentQuestionClient[]>();
        for (const q of questions ?? []) {
            const list = map.get(q.messageId);
            if (list) list.push(q);
            else map.set(q.messageId, [q]);
        }
        return map;
    }, [questions]);

    const items: Item[] = useMemo(() => {
        const out: Item[] = messages.map((m) => {
            // In verbose mode, anchor an assistant bubble at
            // `finalizedAt` (when the answer was actually produced)
            // rather than `createdAt` (when the pending stub went into
            // the DB). That puts the final bubble AFTER the trace
            // entries that led to it — matches the natural reading
            // order "here's what happened, here's the result".
            const useFinalized =
                verbose &&
                m.role === 'assistant' &&
                !!m.finalizedAt;
            const at = useFinalized
                ? new Date(m.finalizedAt as string).getTime()
                : new Date(m.createdAt).getTime();
            return { kind: 'message', at, message: m };
        });
        if (verbose && traces) {
            for (const t of traces) {
                for (const entry of t.entries) {
                    out.push({
                        kind: 'trace',
                        at: new Date(entry.at).getTime(),
                        entry,
                    });
                }
            }
        }
        // Stable order: time, then messages before traces at the same
        // instant (so a user message renders above its first vercel
        // trace, and a finalized assistant bubble lands after any
        // last-instant adapter trace).
        out.sort((a, b) => {
            if (a.at !== b.at) return a.at - b.at;
            if (a.kind !== b.kind) return a.kind === 'message' ? -1 : 1;
            return 0;
        });
        return out;
    }, [messages, traces, verbose]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [items]);

    // Pre-compute the most-recent prior user text per message id, so
    // the Retry button on an errored assistant bubble knows what to
    // resend without scanning each render. MUST stay above the early
    // return below — hooks have to run unconditionally.
    const previousUserTextByMessageId = useMemo(() => {
        const map = new Map<string, string>();
        let lastUserText: string | undefined;
        for (const m of messages) {
            if (m.role === 'user' && m.content) {
                lastUserText = m.content;
            } else if (m.role === 'assistant' && lastUserText) {
                map.set(m.id, lastUserText);
            }
        }
        return map;
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="max-w-sm space-y-3 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-medium">How can I help with your training?</h2>
                    <p className="text-sm text-muted-foreground">
                        I&apos;m Coach. Ask about your training plans and this
                        week&apos;s progress, or have me add exercises, update
                        sets, or switch your active plan.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-4 py-6">
            {items.map((item, idx) => {
                if (item.kind === 'trace') {
                    return <TraceLogEntry key={`t-${idx}`} entry={item.entry} />;
                }
                return (
                    <div key={item.message.id} className="pt-3">
                        <MessageBubble
                            message={item.message}
                            previousUserText={previousUserTextByMessageId.get(
                                item.message.id
                            )}
                            questions={questionsByMessageId.get(item.message.id)}
                            isLivePending={isMessageLivePending(
                                item.message,
                                questionsByMessageId.get(item.message.id) ?? []
                            )}
                            onAnswerQuestion={onAnswerQuestion}
                            answeringQuestionId={answeringQuestionId}
                            onEdit={onEditUserMessage}
                            onResend={onResendUserMessage}
                        />
                    </div>
                );
            })}
            <div ref={endRef} />
        </div>
    );
}

function MessageBubble({
    message,
    previousUserText,
    questions,
    isLivePending,
    onAnswerQuestion,
    answeringQuestionId,
    onEdit,
    onResend,
}: {
    message: AgentMessageClient;
    previousUserText?: string;
    questions?: AgentQuestionClient[];
    isLivePending?: boolean;
    onAnswerQuestion?: (
        questionId: string,
        answers: AgentQuestionAnswer[]
    ) => void;
    answeringQuestionId?: string | null;
    onEdit?: (text: string) => void;
    onResend?: (text: string) => void;
}) {
    const isUser = message.role === 'user';
    const isPending = message.status === 'pending';
    // "Stuck" = pending but no longer live (daemon went away). A message
    // blocked on a question or actively streaming stays live, so it's
    // never shown as stuck.
    const isStuck = isPending && !isLivePending;
    const isErrored = message.status === 'errored' || isStuck;
    const isAssistantError = !isUser && isErrored && !isStuck;
    const canCopy = !isUser && !!message.content && !isPending && !isAssistantError;
    // The turn is paused on an open question → the widget below is the
    // focus, so the timeline collapses to a "Waiting for your answer" pill.
    const awaitingInput = !!questions?.some((q) => q.status === 'pending');

    return (
        <div
            className={cn(
                'group flex gap-3',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            {isUser && (
                <Avatar className="h-8 w-8 shrink-0 bg-primary/10">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        <User className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
            )}

            <div
                className={cn(
                    'flex min-w-0 flex-col gap-1',
                    isUser ? 'max-w-[85%] items-end' : 'max-w-full items-start'
                )}
            >
                {!isUser && (
                    <EventTimeline
                        messageId={message.id}
                        events={message.events}
                        isStreaming={isPending && !isStuck}
                        awaitingInput={awaitingInput}
                    />
                )}

                {!isUser && questions && questions.length > 0 && (
                    <div className="flex w-full flex-col gap-2">
                        {questions.map((q) => (
                            <MultipleChoiceQuestion
                                key={q.id}
                                question={q}
                                isSubmitting={answeringQuestionId === q.id}
                                onSubmit={(answers) =>
                                    onAnswerQuestion?.(q.id, answers)
                                }
                            />
                        ))}
                    </div>
                )}

                {isUser && message.attachments.length > 0 && (
                    <AttachmentList attachments={message.attachments} />
                )}

                {/* Assistant error → dedicated ErrorBubble with
                    summary + collapsible details + copy/retry. */}
                {isAssistantError && (
                    <ErrorBubble
                        content={message.content}
                        retryText={previousUserText}
                        onResend={onResend}
                    />
                )}

                {/* Stuck (daemon offline) gets its own card — we don't
                    have a useful underlying error to surface. */}
                {isStuck && (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                        <div className="flex items-start gap-2">
                            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                            <span>
                                The agent didn&apos;t respond. The RPC daemon
                                may be offline or your session may have
                                expired. Send another message to try again.
                            </span>
                        </div>
                    </div>
                )}

                {/* Normal bubble for user messages and successful
                    assistant content. While pending with no content
                    yet, the Working/Reasoning panel above acts as the
                    live indicator — no redundant "Working on it…" box. */}
                {!isAssistantError && !isStuck &&
                    (isUser || message.content) && (
                        <div
                            className={cn(
                                'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                                isUser
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card text-foreground',
                                !isUser && 'border border-border'
                            )}
                        >
                            {isUser ? (
                                <p className="whitespace-pre-wrap break-words">
                                    {message.content}
                                </p>
                            ) : (
                                <MarkdownText content={message.content} />
                            )}
                        </div>
                    )}

                {!isUser && !isStuck && (
                    <MessageFooter message={message} isPending={isPending} />
                )}

                <MessageActions
                    isUser={isUser}
                    canCopy={canCopy}
                    canEdit={isUser && !!onEdit}
                    canResend={isUser && !!onResend && !isPending}
                    text={message.content}
                    onEdit={onEdit}
                    onResend={onResend}
                />
            </div>
        </div>
    );
}

function MessageActions({
    isUser,
    canCopy,
    canEdit,
    canResend,
    text,
    onEdit,
    onResend,
}: {
    isUser: boolean;
    canCopy: boolean;
    canEdit: boolean;
    canResend: boolean;
    text: string;
    onEdit?: (text: string) => void;
    onResend?: (text: string) => void;
}) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral "copied!" feedback
    const [copiedAt, setCopiedAt] = useState<number | null>(null);
    const showActions = canCopy || canEdit || canResend;
    if (!showActions) return null;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedAt(Date.now());
            // Revert the icon after 1.5s. Using the timestamp as state
            // (instead of a boolean) means rapid re-copies reset the
            // timer correctly via React's re-render.
            setTimeout(() => setCopiedAt(null), 1500);
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const wasCopiedRecently = copiedAt !== null;

    return (
        <div
            className={cn(
                // Hidden until hover (desktop) — always visible on
                // touch devices that don't expose :hover, so use a
                // small opacity instead of opacity-0.
                'flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100',
                isUser ? 'justify-end' : 'justify-start',
                'px-2'
            )}
        >
            {canCopy && (
                <ActionButton
                    label={wasCopiedRecently ? 'Copied' : 'Copy'}
                    onClick={copy}
                >
                    {wasCopiedRecently ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </ActionButton>
            )}
            {canEdit && (
                <ActionButton label="Edit" onClick={() => onEdit?.(text)}>
                    <Pencil className="h-3.5 w-3.5" />
                </ActionButton>
            )}
            {canResend && (
                <ActionButton
                    label="Resend"
                    onClick={() => onResend?.(text)}
                >
                    <RotateCw className="h-3.5 w-3.5" />
                </ActionButton>
            )}
        </div>
    );
}

/**
 * Strip the boilerplate the handler wraps around raw errors so we can
 * surface a tight summary. The handler emits things like:
 *   "Sorry — the agent crashed: <real error>. Try again or pick a different model."
 *   "Sorry — the agent failed: <real error>. Try again or pick a different model."
 *   "Daemon error: <real error>"
 *   "Cancelled by user."
 *
 * Returns a one-line `summary` (first line, capped) and the full
 * `details` text for the collapsible panel.
 */
function parseAgentError(content: string): {
    summary: string;
    details: string;
} {
    const stripped = content
        .replace(/^Sorry —\s*the agent (crashed|failed):\s*/i, '')
        .replace(/^Daemon error:\s*/i, '')
        .replace(/\s*Try again or pick a different model\.?\s*$/i, '')
        .trim();
    const firstLine = (stripped.split(/\r?\n/)[0] ?? stripped).trim();
    const summary =
        firstLine.length > 180 ? firstLine.slice(0, 180) + '…' : firstLine;
    return { summary, details: stripped };
}

function ErrorBubble({
    content,
    retryText,
    onResend,
}: {
    content: string;
    retryText?: string;
    onResend?: (text: string) => void;
}) {
    const { summary, details } = useMemo(() => parseAgentError(content), [content]);
    // eslint-disable-next-line state-management/prefer-state-architecture -- per-bubble UI toggle
    const [expanded, setExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral "copied" feedback
    const [copiedAt, setCopiedAt] = useState<number | null>(null);

    const hasMoreThanSummary = details.length > summary.length;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(details);
            setCopiedAt(Date.now());
            setTimeout(() => setCopiedAt(null), 1500);
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const canRetry = !!retryText && !!onResend;

    return (
        <div className="w-full rounded-2xl border border-destructive/40 bg-destructive/5">
            <div className="flex items-start gap-2 px-4 py-3 text-sm leading-relaxed text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-destructive">Agent failed</div>
                    <div className="mt-0.5 break-words text-foreground/90">
                        {summary}
                    </div>
                </div>
            </div>

            {expanded && hasMoreThanSummary && (
                <pre className="mx-3 mb-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-card/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {details}
                </pre>
            )}

            <div className="flex flex-wrap items-center gap-1 border-t border-destructive/20 px-2 py-1.5">
                {hasMoreThanSummary && (
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {expanded ? 'Hide details' : 'Show details'}
                    </button>
                )}

                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    {copiedAt ? (
                        <>
                            <Check className="h-3.5 w-3.5 text-success" />
                            Copied
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy error
                        </>
                    )}
                </button>

                {canRetry && (
                    <button
                        type="button"
                        onClick={() => onResend?.(retryText as string)}
                        className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                    >
                        <RotateCw className="h-3.5 w-3.5" />
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}

function AttachmentList({
    attachments,
}: {
    attachments: AgentMessageAttachment[];
}) {
    return (
        <div className="flex flex-wrap justify-end gap-1.5">
            {attachments.map((att) => (
                <FilePreview
                    key={att.url}
                    url={att.url}
                    contentType={att.contentType}
                    name={att.name}
                />
            ))}
        </div>
    );
}

function ActionButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
            {children}
        </button>
    );
}
