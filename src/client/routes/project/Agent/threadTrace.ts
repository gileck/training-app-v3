/**
 * Build a single, copy-pasteable end-to-end debug report for an agent
 * thread — the whole journey of every turn:
 *
 *   client → server (vercel: send.received, rpc.enqueued)
 *          → agent  (daemon: rpc-job.claimed, handler.received;
 *                    handler/adapter: adapter.picked → start → finished;
 *                    agent events: thinking / tool_call / tool_result)
 *          → server (assistant message finalized: status, cost, tokens)
 *          → client (the answer the user sees)
 *
 * Per assistant turn we merge the trace entries (server/daemon/agent
 * lifecycle) and the message events (the model's own activity) into one
 * timeline sorted by timestamp, with offsets relative to the turn start.
 *
 * The output is plain text optimised for pasting into a bug report.
 */

import type {
    AgentConversationClient,
    AgentMessageClient,
    AgentTraceClient,
} from '@/apis/template/agent/types';
import type { AgentEvent } from '@/server/template/agentic';
import type { TraceEntry } from '@/server/database/collections/template/agentTraces/types';

interface Row {
    at: number;
    /** Display tag, e.g. "vercel/info" or "agent". */
    tag: string;
    label: string;
    detail?: string;
}

const MAX_DETAIL = 1000;

function fmtOffset(ms: number): string {
    if (ms < 0) return `-${fmtOffset(-ms)}`;
    if (ms < 1000) return `+${Math.round(ms)}ms`;
    if (ms < 60_000) return `+${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `+${m}m${s.toString().padStart(2, '0')}s`;
}

function compact(data: unknown): string | undefined {
    if (data === undefined || data === null) return undefined;
    let text: string;
    try {
        text = typeof data === 'string' ? data : JSON.stringify(data);
    } catch {
        text = String(data);
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return undefined;
    return text.length > MAX_DETAIL ? text.slice(0, MAX_DETAIL) + '…' : text;
}

function traceEntryToRow(entry: TraceEntry): Row {
    return {
        at: new Date(entry.at).getTime(),
        tag: `${entry.layer}/${entry.level}`,
        label: entry.message,
        detail: compact(entry.data),
    };
}

function eventToRow(event: AgentEvent): Row {
    const at = new Date(event.at).getTime();
    switch (event.type) {
        case 'thinking':
            return { at, tag: 'agent', label: 'thinking', detail: compact(event.content) };
        case 'tool_call':
            return {
                at,
                tag: 'agent',
                label: `tool_call ${event.name}`,
                detail: compact(event.args),
            };
        case 'tool_result':
            return {
                at,
                tag: 'agent',
                label: `tool_result ${event.name} → ${event.ok ? 'ok' : 'error'}${
                    event.wrote ? ' (saved)' : ''
                }${event.truncated ? ' (truncated)' : ''}`,
                detail: compact(event.summary),
            };
        case 'message':
            return { at, tag: 'agent', label: 'message', detail: compact(event.content) };
    }
}

function padTag(tag: string): string {
    return tag.length >= 16 ? tag : tag.padEnd(16);
}

function renderTimeline(rows: Row[]): string[] {
    if (rows.length === 0) return ['    (no trace entries — daemon may not have run)'];
    const sorted = [...rows].sort((a, b) => a.at - b.at);
    const t0 = sorted[0].at;
    return sorted.map((r) => {
        const offset = fmtOffset(r.at - t0).padStart(8);
        const head = `    ${offset}  ${padTag(r.tag)}  ${r.label}`;
        return r.detail ? `${head}\n${' '.repeat(30)}↳ ${r.detail}` : head;
    });
}

export function buildThreadTraceReport(input: {
    conversation: AgentConversationClient | undefined;
    messages: AgentMessageClient[];
    traces: AgentTraceClient[];
    /** Per-assistant-message client-clock bookends (send / first render).
     *  Keyed by message id. Missing for historical turns this session
     *  never witnessed. */
    clientTimings?: Record<string, { sentAt?: string; receivedAt?: string }>;
    exportedAt: string;
}): string {
    const { conversation, messages, traces, exportedAt } = input;
    const clientTimings = input.clientTimings ?? {};
    const traceByMessageId = new Map(traces.map((t) => [t.id, t]));

    const out: string[] = [];
    out.push('═══ AGENT THREAD E2E TRACE ═══');
    if (conversation) {
        out.push(`Conversation : ${conversation.title} (${conversation.id})`);
        out.push(`Model        : ${conversation.modelId}`);
        out.push(`Session      : ${conversation.sessionId ?? '(none)'}`);
    }
    out.push(`Messages     : ${messages.length}`);
    out.push(`Exported     : ${exportedAt}`);
    out.push(
        'Legend       : client=this browser · vercel=server entry · daemon/handler/adapter=agent run · agent=model events'
    );
    out.push(
        'Note         : client vs server offsets include clock skew + network; compare within a layer.'
    );
    out.push('');

    for (const m of messages) {
        out.push('────────────────────────────────────────────────────────');
        if (m.role === 'user') {
            out.push(`[user] ${m.id}  ${m.createdAt}`);
            if (m.content) out.push(`  ${m.content.replace(/\n/g, '\n  ')}`);
            if (m.attachments.length > 0) {
                out.push(
                    `  attachments: ${m.attachments
                        .map((a) => `${a.name} (${a.contentType})`)
                        .join(', ')}`
                );
            }
            out.push('');
            continue;
        }

        // assistant turn
        const trace = traceByMessageId.get(m.id);
        const finalized = m.finalizedAt ?? '—';
        const cost = m.cost > 0 ? `$${m.cost.toFixed(4)}` : '$0';
        const tokens = m.tokens
            ? `${m.tokens.input}in/${m.tokens.output}out`
            : 'n/a';
        out.push(
            `[assistant] ${m.id}  status=${m.status}  cost=${cost}  tokens=${tokens}`
        );
        out.push(`  created=${m.createdAt}  finalized=${finalized}`);
        if (trace) {
            out.push(
                `  trace.status=${trace.status}${
                    trace.rpcJob ? `  rpcJob=${trace.rpcJob.status}` : ''
                }${
                    trace.rpcJob?.error ? `  rpcJob.error="${trace.rpcJob.error}"` : ''
                }`
            );
        } else {
            out.push('  trace: (none found for this turn)');
        }

        const ct = clientTimings[m.id];
        const clientRows: Row[] = [];
        if (ct?.sentAt) {
            clientRows.push({
                at: new Date(ct.sentAt).getTime(),
                tag: 'client',
                label: 'client.sent',
                detail: 'user clicked send',
            });
        }
        if (ct?.receivedAt) {
            clientRows.push({
                at: new Date(ct.receivedAt).getTime(),
                tag: 'client',
                label: 'client.answer-rendered',
                detail: 'finalized answer reached the client',
            });
        }

        const rows: Row[] = [
            ...clientRows,
            ...(trace?.entries ?? []).map(traceEntryToRow),
            ...m.events.map(eventToRow),
        ];
        out.push('  TIMELINE:');
        out.push(...renderTimeline(rows));

        out.push('  ANSWER:');
        out.push(
            m.content
                ? `    ${m.content.replace(/\n/g, '\n    ')}`
                : '    (empty)'
        );
        out.push('');
    }

    return out.join('\n');
}
