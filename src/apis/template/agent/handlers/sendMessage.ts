/**
 * Send a message in an agent conversation.
 *
 * Vercel-side entry point. The happy path:
 *   1. Create the user message row
 *   2. Create a pending assistant message stub (shared ObjectId with
 *      the trace + `sourceMessageId` for the RPC)
 *   3. Open the agent trace
 *   4. Fire-and-forget enqueue the RPC job (daemon picks it up)
 *
 * The error path matters as much as the happy path: if anything fails
 * AFTER the pending assistant row is created (most commonly
 * `assertRpcConnection` throwing because no admin-approved RPC session
 * exists), we MUST finalize the row as errored. Otherwise the client's
 * polling sees a forever-pending message and the UI is stuck on
 * "Working on it…" with no way to recover.
 */

import { ObjectId } from 'mongodb';
import { agentConversations } from '@/server/database';
import { createRpcJob } from '@/server/template/rpc/collection';
import {
    startTrace,
    appendTrace,
    finishTrace,
} from '@/server/database/collections/template/agentTraces/agentTraces';
import { getModelById } from '@/common/ai/models';
import { toQueryId, toStringId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type { SendMessageRequest, SendMessageResponse } from '../types';

const RPC_TTL_MS = 60 * 60 * 1000; // 1 hour

// Convention: every app's agent lives at this path. The daemon resolves
// it at runtime (it's a string, not a static import), so the agent is
// 100% project-owned under src/server/project/agent/** with no synced
// override seam. The agent's identity (system prompt) lives in its
// handler via createAgentHandler({ systemPrompt }). `build-app-agent`
// builds the agent here.
const AGENT_HANDLER_PATH = 'src/server/project/agent/handler';

function getModelProvider(modelId: string): string | null {
    try {
        return getModelById(modelId).provider;
    } catch {
        return null;
    }
}

export const sendMessage = async (
    request: SendMessageRequest,
    context: ApiHandlerContext
): Promise<SendMessageResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.conversationId) return { error: 'conversationId is required' };
    if (!request.modelId) return { error: 'modelId is required' };
    if (!request.text || !request.text.trim()) {
        return { error: 'text is required' };
    }
    // Capture as non-nullable string so TypeScript narrows it inside
    // the failPending closure below (TS can't carry the guard across
    // the lambda boundary).
    const userIdStr: string = context.userId;

    let userId: ObjectId;
    let conversationId: ObjectId;
    try {
        userId = toQueryId(userIdStr) as ObjectId;
        conversationId = toQueryId(request.conversationId) as ObjectId;
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : 'Invalid id',
        };
    }

    const conversation = await agentConversations.findConversationById(
        conversationId,
        userId
    );
    if (!conversation) return { error: 'Conversation not found' };

    // Build history BEFORE writing the new user message.
    const priorMessages =
        await agentConversations.findMessagesByConversationId(
            conversationId,
            userId
        );
    const history = priorMessages
        .filter((m) => m.status === 'completed' && m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

    const attachments = request.attachments ?? [];
    const userMessage = await agentConversations.createUserMessage({
        conversationId,
        userId,
        content: request.text.trim(),
        attachments,
    });

    const assistantMessage =
        await agentConversations.createPendingAssistantMessage({
            conversationId,
            userId,
        });

    // From here on, ANY error must finalize the pending assistant row
    // so the client doesn't see a forever-pending bubble.
    const adapter = agentConversations.makeAgentConversationsAdapter(
        userIdStr
    );
    const failPending = async (
        userVisibleMessage: string,
        traceMessage: string,
        traceData: Record<string, unknown>
    ): Promise<SendMessageResponse> => {
        try {
            await appendTrace(
                assistantMessage._id,
                { userId: userIdStr, conversationId },
                {
                    layer: 'vercel',
                    level: 'error',
                    message: traceMessage,
                    data: traceData,
                }
            );
            await adapter.finalizeAssistantMessage({
                id: assistantMessage._id,
                content: userVisibleMessage,
                cost: 0,
                events: [],
            });
            await finishTrace(assistantMessage._id, 'errored');
        } catch (innerErr) {
            // Don't let cleanup errors mask the original cause.
            console.error('sendMessage cleanup failed:', innerErr);
        }
        const erroredDoc = {
            ...assistantMessage,
            content: userVisibleMessage,
            status: 'errored' as const,
            cost: 0,
            finalizedAt: new Date(),
        };
        return {
            userMessage: agentConversations.toMessageClient(userMessage),
            assistantMessage: agentConversations.toMessageClient(erroredDoc),
            error: userVisibleMessage,
        };
    };

    try {
        const previousProvider = getModelProvider(conversation.modelId);
        const requestedProvider = getModelProvider(request.modelId);
        const canResumeSession = Boolean(
            conversation.sessionId &&
                previousProvider &&
                requestedProvider &&
                previousProvider === requestedProvider
        );
        const resumeSessionId =
            conversation.sessionId && canResumeSession
                ? conversation.sessionId
                : undefined;
        const shouldClearStoredSession = Boolean(
            conversation.sessionId &&
                requestedProvider &&
                previousProvider !== requestedProvider
        );

        // Provider SDK session ids are not portable. For example,
        // Claude Code's session id cannot be resumed by Codex, and
        // Codex will fail with "no rollout found" if we hand it that id.
        if (shouldClearStoredSession) {
            await agentConversations.clearConversationSessionId(conversationId);
        }

        const titleUpdate =
            priorMessages.length === 0
                ? { title: request.text.trim().slice(0, 80) }
                : {};
        await agentConversations.touchConversation(conversationId, {
            modelId: request.modelId,
            ...titleUpdate,
        });

        await startTrace({
            id: assistantMessage._id,
            userId: userIdStr,
            conversationId,
        });
        await appendTrace(
            assistantMessage._id,
            { userId: userIdStr, conversationId },
            {
                layer: 'vercel',
                level: 'info',
                message: 'send.received',
                data: {
                    modelId: request.modelId,
                    previousModelId: conversation.modelId,
                    previousProvider,
                    requestedProvider,
                    textLength: request.text.length,
                    historyLength: history.length,
                    resumeSessionId: resumeSessionId ?? null,
                    droppedResumeSessionId:
                        shouldClearStoredSession
                            ? conversation.sessionId
                            : null,
                },
            }
        );

        // Split image attachments from other files. Images go into
        // `userImageUrls` so vision-capable adapters can pass them as
        // native multimodal content blocks (the model literally sees
        // the pixels). Non-image files stay inline as text URLs —
        // adapters without vision (or for non-image content) can
        // fetch via their built-in URL-fetch tool.
        const imageAttachments = attachments.filter((a) =>
            a.contentType.startsWith('image/')
        );
        const nonImageAttachments = attachments.filter(
            (a) => !a.contentType.startsWith('image/')
        );
        const enrichedUserText = nonImageAttachments.length === 0
            ? request.text.trim()
            : [
                  request.text.trim(),
                  '',
                  'Attached files (fetch the URL to read contents):',
                  ...nonImageAttachments.map(
                      (a) =>
                          `- ${a.name} (${a.contentType}, ${Math.round(a.size / 1024)} KB): ${a.url}`
                  ),
              ].join('\n');

        await createRpcJob({
            handlerPath: AGENT_HANDLER_PATH,
            args: {
                userId: userIdStr,
                conversationId: toStringId(conversationId),
                sourceMessageId: toStringId(assistantMessage._id),
                modelId: request.modelId,
                // Per-turn override only; the default lives in the
                // project handler (createAgentHandler({ systemPrompt })).
                systemPrompt: request.systemPrompt,
                userText: enrichedUserText,
                userImageUrls: imageAttachments.map((a) => a.url),
                history,
                resumeSessionId,
            },
            secret: process.env.RPC_SECRET ?? '',
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + RPC_TTL_MS),
        });

        await appendTrace(
            assistantMessage._id,
            { userId: userIdStr, conversationId },
            { layer: 'vercel', level: 'info', message: 'rpc.enqueued' }
        );

        return {
            userMessage: agentConversations.toMessageClient(userMessage),
            assistantMessage:
                agentConversations.toMessageClient(assistantMessage),
        };
    } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        // Heuristic: the most common failure mode here is the RPC
        // connection gate rejecting an unapproved session. Surface a
        // clearer message than the raw error code.
        const looksLikeGateError = /RPC connection/i.test(raw);
        const userVisible = looksLikeGateError
            ? "The RPC daemon isn't connected. Approve an RPC session from the Connection page and try again."
            : `Couldn't reach the agent daemon: ${raw}`;
        console.error('sendMessage enqueue failed:', error);
        return failPending(userVisible, 'rpc.enqueue-failed', { error: raw });
    }
};
