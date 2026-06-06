import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import { toStringId } from '@/server/template/utils';
import type {
    AgentConversationsCollection,
    AgentEvent,
    FinalizeAssistantInput,
} from '@/server/template/agentic';
import {
    setConversationSessionId as setConversationSessionIdRow,
    touchConversation,
} from './conversations';
import type {
    AgentMessageAttachment,
    AgentMessageClient,
    AgentMessageDocument,
    AgentMessageRole,
} from './types';

const COLLECTION = 'agentMessages';
let collectionPromise: Promise<Collection<AgentMessageDocument>> | null = null;

function getCollection(): Promise<Collection<AgentMessageDocument>> {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const db = await getDb();
            const col = db.collection<AgentMessageDocument>(COLLECTION);
            await col.createIndex({ conversationId: 1, createdAt: 1 });
            return col;
        })().catch((err) => {
            collectionPromise = null;
            throw err;
        });
    }
    return collectionPromise;
}

export async function createUserMessage(input: {
    conversationId: ObjectId;
    userId: ObjectId;
    content: string;
    attachments?: AgentMessageAttachment[];
}): Promise<AgentMessageDocument> {
    const col = await getCollection();
    const doc: AgentMessageDocument = {
        _id: new ObjectId(),
        conversationId: input.conversationId,
        userId: input.userId,
        role: 'user',
        content: input.content,
        events: [],
        cost: 0,
        status: 'completed',
        createdAt: new Date(),
        finalizedAt: new Date(),
        ...(input.attachments && input.attachments.length > 0
            ? { attachments: input.attachments }
            : {}),
    };
    await col.insertOne(doc);
    return doc;
}

/**
 * Create a pending assistant message stub. Returned ObjectId is shared
 * with the agent trace row and used as `sourceMessageId` in the RPC
 * args — the daemon's handler will append events and finalize it.
 */
export async function createPendingAssistantMessage(input: {
    conversationId: ObjectId;
    userId: ObjectId;
}): Promise<AgentMessageDocument> {
    const col = await getCollection();
    const doc: AgentMessageDocument = {
        _id: new ObjectId(),
        conversationId: input.conversationId,
        userId: input.userId,
        role: 'assistant',
        content: '',
        events: [],
        cost: 0,
        status: 'pending',
        createdAt: new Date(),
    };
    await col.insertOne(doc);
    return doc;
}

export async function findMessagesByConversationId(
    conversationId: ObjectId,
    userId: ObjectId
): Promise<AgentMessageDocument[]> {
    const col = await getCollection();
    return col
        .find({ conversationId, userId })
        .sort({ createdAt: 1 })
        .toArray();
}

export async function deleteMessagesByConversationId(
    conversationId: ObjectId,
    userId: ObjectId
): Promise<void> {
    const col = await getCollection();
    await col.deleteMany({ conversationId, userId });
}

export async function findMessageById(
    messageId: ObjectId,
    userId: ObjectId
): Promise<AgentMessageDocument | null> {
    const col = await getCollection();
    return col.findOne({ _id: messageId, userId });
}

/**
 * Cancel a pending assistant message. Atomic: only flips the row if
 * it's still pending, so it can't race with a daemon finalize landing
 * at the same moment. Returns true if we actually cancelled.
 */
export async function cancelPendingMessage(
    messageId: ObjectId,
    userId: ObjectId,
    reason = 'Cancelled by user.'
): Promise<boolean> {
    const col = await getCollection();
    const result = await col.updateOne(
        { _id: messageId, userId, status: 'pending' },
        {
            $set: {
                status: 'errored',
                content: reason,
                cost: 0,
                finalizedAt: new Date(),
            },
        }
    );
    return result.matchedCount > 0;
}

export function toMessageClient(doc: AgentMessageDocument): AgentMessageClient {
    return {
        id: toStringId(doc._id),
        conversationId: toStringId(doc.conversationId),
        role: doc.role as AgentMessageRole,
        content: doc.content,
        events: doc.events,
        cost: doc.cost,
        tokens: doc.tokens ?? null,
        attachments: doc.attachments ?? [],
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
        finalizedAt: doc.finalizedAt ? doc.finalizedAt.toISOString() : null,
    };
}

// ─── AgentConversationsCollection adapter ────────────────────────────────

/**
 * Factory that satisfies `AgentConversationsCollection` from the
 * agentic template. The daemon's handler calls these three methods
 * during a turn — we never expose them directly to API handlers.
 *
 * `userId` is captured for two reasons: (1) so we can stamp it on
 * future writes if needed, and (2) so the contract matches the
 * template's `conversations: (userId) => …` factory shape.
 */
export function makeAgentConversationsAdapter(
    _userId: string
): AgentConversationsCollection {
    return {
        async appendAgentEvent(
            messageId: ObjectId,
            event: AgentEvent
        ): Promise<void> {
            const col = await getCollection();
            await col.updateOne(
                { _id: messageId },
                { $push: { events: event } }
            );
        },

        async finalizeAssistantMessage(
            input: FinalizeAssistantInput
        ): Promise<void> {
            const col = await getCollection();
            // Filter on status:'pending' so a late-arriving daemon
            // finalize doesn't overwrite a user cancellation (or any
            // other terminal state set elsewhere). If the row isn't
            // pending anymore, this is a no-op.
            const existing = await col.findOne({ _id: input.id });
            const $set: Record<string, unknown> = {
                content: input.content,
                cost: input.cost,
                events: input.events,
                // The handler's error paths always pass `events: []`
                // (and a "Sorry —" content string); success paths
                // always have at least one event.
                status: input.events.length === 0 ? 'errored' : 'completed',
                finalizedAt: new Date(),
            };
            if (input.tokens) {
                $set.tokens = input.tokens;
            }
            const result = await col.updateOne(
                { _id: input.id, status: 'pending' },
                { $set }
            );
            if (result.matchedCount > 0 && existing) {
                await touchConversation(existing.conversationId);
            }
        },

        async setConversationSessionId(
            conversationId: ObjectId,
            sessionId: string
        ): Promise<void> {
            await setConversationSessionIdRow(conversationId, sessionId);
        },
    };
}
