/**
 * Generic daemon-side RPC handler factory for an agentic turn.
 *
 * Wraps the universal lifecycle every agent needs:
 *   1. Validate RPC args
 *   2. Open a trace row (keyed by sourceMessageId)
 *   3. Pick a model adapter
 *   4. Build a per-turn tool context (userId + conversationId + data)
 *   5. Run the adapter, streaming events to the conversations
 *      collection as they happen
 *   6. Retry once without `resumeSessionId` if the failure looks like a
 *      missing-session error (e.g. SDK's session store got wiped)
 *   7. Finalize the assistant message (success or error path)
 *   8. Persist the SDK session id so the next turn can resume
 *   9. Close out the trace
 *
 * Project usage: build an `AgentHandlerConfig`, call
 * `createAgentHandler(config)`, export the result as the module's
 * `default`. That's the entire project handler.ts file.
 */

import { ObjectId } from 'mongodb';
import {
    appendTrace,
    finishTrace,
} from '@/server/database/collections/template/agentTraces/agentTraces';
import type {
    AgenticAdapter,
    AgenticResult,
    AgenticRunOptions,
    AgenticTool,
    AgentEvent,
} from '../types';
import type { AgentConversationsCollection } from '../conversations/types';

export interface AgentHandlerConfig<TData> {
    /** Stable agent slug — same value used in the adapter config. Used
     *  in error-log prefixes and arg-validation error messages. */
    agentName: string;
    /** The tool list the model can call. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    tools: readonly AgenticTool<any, TData>[];
    /** Build the per-turn data context for this user. Same factory
     *  used by the Codex MCP server bootstrap. */
    createDataContext: (userId: string) => TData;
    /** Factory that binds the conversations collection to the per-
     *  turn userId. Returns an `AgentConversationsCollection` whose
     *  methods don't need the userId on every call. */
    conversations: (userId: string) => AgentConversationsCollection;
    /** Model adapters to try in order. The first one whose
     *  `supportsModel(modelId)` returns true handles the turn. */
    adapters: readonly AgenticAdapter[];
}

interface HandlerArgs {
    userId: string;
    conversationId: string;
    sourceMessageId: string;
    modelId: string;
    systemPrompt: string;
    userText: string;
    userImageUrls?: string[];
    history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
    maxIterations?: number;
    resumeSessionId?: string;
    effort?: 'low' | 'medium' | 'high' | 'xhigh';
}

/**
 * True only for errors that indicate the saved provider resume id is
 * gone or belongs to a different provider. That's the one case where
 * retrying without `resumeSessionId` has a chance of succeeding.
 * Excludes generic "session" mentions in rate limits, auth, network,
 * and timeout errors.
 */
function isMissingSessionError(message: string): boolean {
    return /session.*(not\s*found|missing|does\s*not\s*exist|unknown|expired|invalid|no\s*such)/i.test(
        message
    ) || /(no\s*such|unknown|invalid)\s+session/i.test(message)
        || /thread\/resume/i.test(message)
        || /no\s+rollout\s+found/i.test(message)
        || /thread.*(not\s*found|missing|does\s*not\s*exist|unknown|expired|invalid|no\s*such)/i.test(message)
        || /(no\s*such|unknown|invalid)\s+thread/i.test(message);
}

function isHistoryEntry(v: unknown): v is { role: 'user' | 'assistant'; content: string } {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return (o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string';
}

function parseArgs(agentName: string, raw: Record<string, unknown>): HandlerArgs {
    const required = ['userId', 'conversationId', 'sourceMessageId', 'modelId', 'systemPrompt', 'userText'] as const;
    for (const k of required) {
        if (typeof raw[k] !== 'string' || !raw[k]) {
            throw new Error(`${agentName} handler requires string "${k}"`);
        }
    }
    if (!Array.isArray(raw.history)) {
        throw new Error(`${agentName} handler requires "history" array`);
    }
    if (!raw.history.every(isHistoryEntry)) {
        throw new Error(`${agentName} handler "history" entries must be { role, content }`);
    }
    return {
        userId: raw.userId as string,
        conversationId: raw.conversationId as string,
        sourceMessageId: raw.sourceMessageId as string,
        modelId: raw.modelId as string,
        systemPrompt: raw.systemPrompt as string,
        userText: raw.userText as string,
        userImageUrls:
            Array.isArray(raw.userImageUrls) &&
            raw.userImageUrls.every((u): u is string => typeof u === 'string')
                ? (raw.userImageUrls as string[])
                : undefined,
        history: raw.history as ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
        maxIterations:
            typeof raw.maxIterations === 'number' && Number.isFinite(raw.maxIterations)
                ? raw.maxIterations
                : undefined,
        resumeSessionId:
            typeof raw.resumeSessionId === 'string' && raw.resumeSessionId
                ? raw.resumeSessionId
                : undefined,
        effort:
            raw.effort === 'low' ||
            raw.effort === 'medium' ||
            raw.effort === 'high' ||
            raw.effort === 'xhigh'
                ? raw.effort
                : undefined,
    };
}

export function createAgentHandler<TData>(
    config: AgentHandlerConfig<TData>
): (rawArgs: Record<string, unknown>) => Promise<AgenticResult & { finalized: boolean }> {
    const logPrefix = `[${config.agentName}]`;
    const pickAdapter = (modelId: string): AgenticAdapter | null =>
        config.adapters.find((a) => a.supportsModel(modelId)) ?? null;

    return async function handleAgent(rawArgs) {
        const args = parseArgs(config.agentName, rawArgs);
        const messageObjectId = new ObjectId(args.sourceMessageId);
        const conversationObjectId = new ObjectId(args.conversationId);
        const conversations = config.conversations(args.userId);
        // Trace context for appendTrace upsert. The trace row is
        // OPTIONALLY opened by the project's API layer (e.g. Vercel-
        // side sendMessage.ts calls startTrace before enqueueing the
        // RPC job so it can capture pre-daemon events). If the project
        // skips that, our first appendTrace below creates the row via
        // $setOnInsert — daemon-side traces work either way.
        const traceCtx = { userId: args.userId, conversationId: conversationObjectId };

        await appendTrace(messageObjectId, traceCtx, {
            layer: 'daemon',
            level: 'info',
            message: 'handler.received',
            data: {
                modelId: args.modelId,
                userTextLength: args.userText.length,
                historyLength: args.history.length,
                resumeSessionId: args.resumeSessionId ?? null,
                hostname: process.env.HOSTNAME ?? null,
            },
        });

        const adapter = pickAdapter(args.modelId);
        if (!adapter) {
            const errorText =
                `No agentic adapter handles model "${args.modelId}". ` +
                `Supported adapters: ${config.adapters.map((a) => a.name).join(', ')}`;
            await appendTrace(messageObjectId, traceCtx, {
                layer: 'handler',
                level: 'error',
                message: 'adapter.notFound',
                data: { modelId: args.modelId, available: config.adapters.map((a) => a.name) },
            });
            await conversations.finalizeAssistantMessage({
                id: messageObjectId,
                content: `Sorry — ${errorText}`,
                cost: 0,
                events: [],
            });
            await finishTrace(messageObjectId, 'errored');
            throw new Error(errorText);
        }
        await appendTrace(messageObjectId, traceCtx, {
            layer: 'handler',
            level: 'info',
            message: 'adapter.picked',
            data: { adapter: adapter.name },
        });

        const data = config.createDataContext(args.userId);
        const toolContext = {
            userId: args.userId,
            conversationId: conversationObjectId,
            data,
            sourceMessageId: args.sourceMessageId,
        };

        const runOpts: AgenticRunOptions<TData> = {
            modelId: args.modelId,
            systemPrompt: args.systemPrompt,
            history: args.history,
            userText: args.userText,
            userImageUrls: args.userImageUrls,
            tools: [...config.tools],
            toolContext,
            maxIterations: args.maxIterations,
            resumeSessionId: args.resumeSessionId,
            effort: args.effort,
            onEvent: async (event: AgentEvent) => {
                await conversations.appendAgentEvent(messageObjectId, event);
            },
        };

        await appendTrace(messageObjectId, traceCtx, {
            layer: 'handler',
            level: 'info',
            message: 'adapter.start',
            data: { maxIterations: args.maxIterations ?? null, toolCount: config.tools.length },
        });

        // Run the agent. Finalize the message ON THE DAEMON regardless
        // of outcome — the Vercel send-message handler is fire-and-
        // forget, so the daemon owns the full lifecycle of the
        // assistant message.
        let result: AgenticResult;
        const retryWithoutResume = async (
            reason: string
        ): Promise<AgenticResult> => {
            console.warn(
                `${logPrefix} resume failed, retrying without session id`,
                { sessionId: args.resumeSessionId, reason }
            );
            await appendTrace(messageObjectId, traceCtx, {
                layer: 'adapter',
                level: 'warn',
                message: 'adapter.retry-without-resume',
                data: { droppedSessionId: args.resumeSessionId, reason },
            });
            return adapter.runAgent({ ...runOpts, resumeSessionId: undefined });
        };
        try {
            result = await adapter.runAgent(runOpts);
            if (
                args.resumeSessionId &&
                result.finishReason === 'error' &&
                isMissingSessionError(result.finalText)
            ) {
                result = await retryWithoutResume(result.finalText);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`${logPrefix} adapter threw:`, err);
            await appendTrace(messageObjectId, traceCtx, {
                layer: 'adapter',
                level: 'error',
                message: 'adapter.threw',
                // Stack traces are admin-only (see CLAUDE.md) — and
                // trace entries are exposed via findTracesByConversation
                // scoped only to userId. Keep the message; drop the
                // stack to avoid leaking server internals.
                data: { error: message },
            });
            // Resume-mode failure (e.g. SDK can't find the saved
            // session because the daemon's home directory was wiped) →
            // retry once from scratch by dropping the resumeSessionId.
            // Falls back to history-in-system-prompt mode.
            //
            // Narrow match: only when the error actually says the
            // session couldn't be found. A broad /session/i would also
            // match rate limits, auth failures, and timeouts — wasting
            // a retry that will fail again.
            if (args.resumeSessionId && isMissingSessionError(message)) {
                try {
                    result = await retryWithoutResume(message);
                } catch (retryErr) {
                    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    await appendTrace(messageObjectId, traceCtx, {
                        layer: 'adapter',
                        level: 'error',
                        message: 'adapter.retry-failed',
                        data: { error: retryMsg },
                    });
                    await conversations.finalizeAssistantMessage({
                        id: messageObjectId,
                        content: `Sorry — the agent crashed: ${retryMsg}. Try again or pick a different model.`,
                        cost: 0,
                        events: [],
                    });
                    await finishTrace(messageObjectId, 'errored');
                    throw retryErr;
                }
            } else {
                await conversations.finalizeAssistantMessage({
                    id: messageObjectId,
                    content: `Sorry — the agent crashed: ${message}. Try again or pick a different model.`,
                    cost: 0,
                    events: [],
                });
                await finishTrace(messageObjectId, 'errored');
                throw err;
            }
        }

        await appendTrace(messageObjectId, traceCtx, {
            layer: 'handler',
            level: 'info',
            message: 'adapter.finished',
            data: {
                finishReason: result.finishReason,
                cost: result.cost,
                eventCount: result.events.length,
                finalTextLength: result.finalText.length,
                sessionId: result.sessionId ?? null,
            },
        });

        await conversations.finalizeAssistantMessage({
            id: messageObjectId,
            content: result.finalText,
            cost: result.cost,
            tokens: result.tokens,
            events: result.events,
        });

        // Persist the session id on the conversation so subsequent
        // turns can resume. Same id from a resume turn is fine
        // (idempotent), so we just write it.
        if (result.sessionId) {
            await conversations.setConversationSessionId(
                conversationObjectId,
                result.sessionId
            );
        }

        await finishTrace(messageObjectId, result.finishReason === 'error' ? 'errored' : 'completed');

        return { ...result, finalized: true };
    };
}
