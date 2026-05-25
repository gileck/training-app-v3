/**
 * Generic conversations-collection interface.
 *
 * The agentic engine's handler factory talks to "conversations" only
 * through this interface — the actual MongoDB schema is per-project
 * (different agents store different metadata on each message). Each
 * project ships a tiny wrapper around its own collection that
 * satisfies this contract.
 *
 * Why an interface (and not just direct imports): so the template's
 * `createAgentHandler` factory can be used by ai-doctor, fitness-
 * training, diet-coach, finance-manager, etc. without taking a
 * dependency on any one project's collection.
 *
 * What's deliberately NOT here:
 *   - Append-pending-question style hooks. Project-specific tools
 *     (e.g. ai-doctor's ask_user_question) produce project-specific
 *     side-effects on the DB. Bake those into your project wrapper's
 *     `appendAgentEvent` — when the event is one you care about,
 *     write the extra rows there. The factory just calls
 *     `appendAgentEvent`; it doesn't know or care.
 *   - Message creation / pending placeholder. The send-message API
 *     handler (per-project) already created the pending assistant
 *     row before the daemon job got queued. The factory only
 *     finalizes / appends events to that row.
 */

import type { ObjectId } from 'mongodb';
import type { AgentEvent, TurnTokenUsage } from '../types';

export interface FinalizeAssistantInput {
    /** Pre-generated ObjectId of the assistant turn — same id the
     *  send-message handler used when creating the pending row. */
    id: ObjectId;
    /** Final visible text the user sees. */
    content: string;
    /** Total turn cost in USD (sum across all model + tool calls). */
    cost: number;
    /** Total token usage for this turn (sum across models). Absent if
     *  the adapter didn't report usage (rare). */
    tokens?: TurnTokenUsage;
    /** Full event timeline from the adapter. Persist as-is; the UI
     *  renders it as a thinking-timeline above the bubble. */
    events: AgentEvent[];
}

export interface AgentConversationsCollection {
    /**
     * Stream one event to the assistant turn. Called by the handler
     * factory for every event the adapter emits, in order. Project
     * wrappers can side-effect here (e.g. extract pending questions
     * from `ask_user_question` tool calls) — the factory only awaits
     * the promise.
     */
    appendAgentEvent(messageId: ObjectId, event: AgentEvent): Promise<void>;

    /**
     * Close out the assistant turn. Idempotent (last-write-wins) so
     * pre-handler crash paths can finalize with an error before the
     * daemon ever runs.
     */
    finalizeAssistantMessage(input: FinalizeAssistantInput): Promise<void>;

    /**
     * Persist the provider-side session id so the next turn can
     * resume the SDK session (saves history-in-prompt re-serialisation).
     */
    setConversationSessionId(conversationId: ObjectId, sessionId: string): Promise<void>;
}
