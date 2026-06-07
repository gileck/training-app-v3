import type { ObjectId } from 'mongodb';
import {
    findTracesByConversation,
    toAgentTraceClient,
} from '@/server/database/collections/template/agentTraces/agentTraces';
import type {
    AgentTraceClient,
    TraceEntry,
} from '@/server/database/collections/template/agentTraces/types';
import { findRpcJobBySourceMessageId } from '@/server/template/rpc/collection';
import { toQueryId, toStringId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type { GetTracesRequest, GetTracesResponse } from '../types';

/**
 * Pretty-print waiting time so the diagnostic message is actionable
 * ("waited 47s" is more useful than "1.7e+09 ms").
 */
function formatWaitedMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60_000)}m`;
}

/**
 * Synthesize trace entries from the matching rpc-jobs row so the
 * verbose log explains what happens AFTER `rpc.enqueued`. The daemon's
 * own trace stream starts at `handler.received`, which leaves a gap
 * if the daemon isn't running or crashes before our handler runs
 * (most commonly a module-import error or a missing daemon process).
 */
function synthesizeRpcJobEntries(input: {
    enqueuedAt: string | null;
    rpcJob: {
        status: 'pending' | 'processing' | 'completed' | 'failed';
        startedAt: string | null;
        completedAt: string | null;
        error: string | null;
    };
}): TraceEntry[] {
    const out: TraceEntry[] = [];
    const { rpcJob, enqueuedAt } = input;

    if (rpcJob.status === 'pending') {
        const waitedMs = enqueuedAt
            ? Date.now() - new Date(enqueuedAt).getTime()
            : 0;
        const stale = waitedMs > 10_000;
        out.push({
            at: new Date().toISOString(),
            layer: 'daemon',
            level: stale ? 'error' : 'warn',
            message: 'rpc-job.pending',
            data: {
                waited: formatWaitedMs(waitedMs),
                hint: stale
                    ? 'No daemon claimed this job. Is `yarn daemon` running? Is the daemon on the right database?'
                    : 'Waiting for daemon to claim the job…',
            },
        });
        return out;
    }

    if (rpcJob.startedAt) {
        out.push({
            at: rpcJob.startedAt,
            layer: 'daemon',
            level: 'info',
            message: 'rpc-job.claimed',
        });
    }

    if (rpcJob.status === 'failed') {
        out.push({
            at: rpcJob.completedAt ?? new Date().toISOString(),
            layer: 'daemon',
            level: 'error',
            message: 'rpc-job.failed',
            data: {
                error: rpcJob.error ?? 'unknown error',
                hint: 'The daemon failed before our handler ran — usually a module-import error in src/server/project/agent/handler.ts. Check the daemon console.',
            },
        });
    }

    // status === 'completed' and 'processing' don't need extra entries
    // because the handler's own trace stream covers them.
    return out;
}

async function enrichTraceWithRpcJob(
    trace: AgentTraceClient
): Promise<AgentTraceClient> {
    const job = await findRpcJobBySourceMessageId(trace.id);
    if (!job) return trace;

    const enqueuedEntry = trace.entries.find(
        (e) => e.message === 'rpc.enqueued'
    );
    const synthesized = synthesizeRpcJobEntries({
        enqueuedAt: enqueuedEntry?.at ?? trace.startedAt,
        rpcJob: {
            status: job.status,
            startedAt: job.startedAt ? job.startedAt.toISOString() : null,
            completedAt: job.completedAt
                ? job.completedAt.toISOString()
                : null,
            error: job.error ?? null,
        },
    });

    return {
        ...trace,
        entries: [...trace.entries, ...synthesized],
        rpcJob: {
            jobId: toStringId(job._id),
            status: job.status,
            error: job.error ?? null,
            startedAt: job.startedAt ? job.startedAt.toISOString() : null,
            completedAt: job.completedAt
                ? job.completedAt.toISOString()
                : null,
        },
    };
}

export const getTraces = async (
    request: GetTracesRequest,
    context: ApiHandlerContext
): Promise<GetTracesResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.conversationId) return { error: 'conversationId is required' };

    try {
        const conversationId = toQueryId(request.conversationId) as ObjectId;
        const docs = await findTracesByConversation(
            context.userId,
            conversationId
        );
        const traces = docs.map(toAgentTraceClient);
        const enriched = await Promise.all(traces.map(enrichTraceWithRpcJob));
        return { traces: enriched };
    } catch (error) {
        console.error('getTraces error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to load traces',
        };
    }
};
