import type { ObjectId } from 'mongodb';

/**
 * One per assistant-turn attempt. `_id` is the SAME ObjectId we use
 * for the pending assistant message, so joining traces ↔ messages is a
 * single lookup and the trace exists even when the message never gets
 * finalized.
 */
export interface AgentTraceDocument {
    _id: ObjectId;
    userId: string;
    conversationId: ObjectId;
    /** Lifecycle status — flipped to 'completed' or 'errored' by the
     *  last writer. Stays at 'started' if the whole pipeline crashed
     *  before reaching finalize — that's our signal that something
     *  blew up silently. */
    status: 'started' | 'completed' | 'errored';
    startedAt: Date;
    finishedAt?: Date;
    entries: TraceEntry[];
}

export interface TraceEntry {
    /** ISO timestamp. */
    at: string;
    /** Pipeline layer this came from. */
    layer: 'vercel' | 'daemon' | 'handler' | 'adapter' | 'sdk' | 'tool';
    /** Severity. */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Short kebab-case event name, e.g. "rpc.enqueued", "adapter.start". */
    message: string;
    /** Structured payload. Redact free-text fields before passing in. */
    data?: unknown;
}

/**
 * Pre-handler crash captured from the matching rpc-jobs document.
 * Surfaces failures that happened BEFORE our handler's first
 * appendTrace could run (e.g. handler-module import errors). Without
 * this, traces would silently sit at status='started' forever.
 */
export interface RpcJobError {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
}

/** Wire-shape for the get-traces API (dates as ISO strings). */
export interface AgentTraceClient {
    id: string;
    conversationId: string;
    status: AgentTraceDocument['status'];
    startedAt: string;
    finishedAt: string | null;
    entries: TraceEntry[];
    /** Set when there's a matching rpc-jobs record. When the trace
     *  status is 'started' but rpcJob.status is 'failed', the
     *  rpcJob.error is almost certainly the smoking gun (module-load
     *  crash, etc). */
    rpcJob?: RpcJobError;
}
