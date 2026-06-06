import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import { toStringId } from '@/server/template/utils';
import type { AgentConversationDocument, AgentConversationClient } from './types';

const COLLECTION = 'agentConversations';
let collectionPromise: Promise<Collection<AgentConversationDocument>> | null = null;

function getCollection(): Promise<Collection<AgentConversationDocument>> {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const db = await getDb();
            const col = db.collection<AgentConversationDocument>(COLLECTION);
            await col.createIndex({ userId: 1, updatedAt: -1 });
            return col;
        })().catch((err) => {
            collectionPromise = null;
            throw err;
        });
    }
    return collectionPromise;
}

export async function createConversation(input: {
    userId: ObjectId;
    title: string;
    modelId: string;
}): Promise<AgentConversationDocument> {
    const col = await getCollection();
    const now = new Date();
    const doc: AgentConversationDocument = {
        _id: new ObjectId(),
        userId: input.userId,
        title: input.title,
        modelId: input.modelId,
        createdAt: now,
        updatedAt: now,
    };
    await col.insertOne(doc);
    return doc;
}

export async function findConversationsByUserId(
    userId: ObjectId
): Promise<AgentConversationDocument[]> {
    const col = await getCollection();
    return col.find({ userId }).sort({ updatedAt: -1 }).toArray();
}

export async function findConversationById(
    conversationId: ObjectId,
    userId: ObjectId
): Promise<AgentConversationDocument | null> {
    const col = await getCollection();
    return col.findOne({ _id: conversationId, userId });
}

export async function touchConversation(
    conversationId: ObjectId,
    updates?: Partial<Pick<AgentConversationDocument, 'title' | 'modelId'>>
): Promise<void> {
    const col = await getCollection();
    await col.updateOne(
        { _id: conversationId },
        { $set: { ...updates, updatedAt: new Date() } }
    );
}

export async function setConversationSessionId(
    conversationId: ObjectId,
    sessionId: string
): Promise<void> {
    const col = await getCollection();
    await col.updateOne(
        { _id: conversationId },
        { $set: { sessionId, updatedAt: new Date() } }
    );
}

export async function clearConversationSessionId(
    conversationId: ObjectId
): Promise<void> {
    const col = await getCollection();
    await col.updateOne(
        { _id: conversationId },
        { $unset: { sessionId: '' }, $set: { updatedAt: new Date() } }
    );
}

export async function deleteConversation(
    conversationId: ObjectId,
    userId: ObjectId
): Promise<boolean> {
    const col = await getCollection();
    const result = await col.deleteOne({ _id: conversationId, userId });
    return result.deletedCount === 1;
}

export function toConversationClient(
    doc: AgentConversationDocument
): AgentConversationClient {
    return {
        id: toStringId(doc._id),
        title: doc.title,
        modelId: doc.modelId,
        sessionId: doc.sessionId ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}
