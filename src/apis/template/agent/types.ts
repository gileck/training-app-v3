import type {
    AgentConversationClient,
    AgentMessageAttachment,
    AgentMessageClient,
} from '@/server/database/collections/template/agentConversations';
import type { AgentTraceClient } from '@/server/database/collections/template/agentTraces/types';
import type {
    AgentQuestionAnswer,
    AgentQuestionClient,
} from '@/server/database/collections/template/agentQuestions/types';

// Re-export the client shapes so all agent types live under one import.
export type {
    AgentConversationClient,
    AgentMessageAttachment,
    AgentMessageClient,
    AgentTraceClient,
    AgentQuestionClient,
    AgentQuestionAnswer,
};

// ─── list conversations ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ListConversationsRequest {}

export interface ListConversationsResponse {
    conversations?: AgentConversationClient[];
    error?: string;
}

// ─── get conversation (+ messages) ───────────────────────────────────────

export interface GetConversationRequest {
    conversationId: string;
}

export interface GetConversationResponse {
    conversation?: AgentConversationClient;
    messages?: AgentMessageClient[];
    /** Multiple-choice questions the agent asked in this conversation.
     *  Each is keyed to its assistant message via `messageId`. A
     *  'pending' question renders as an interactive widget the user can
     *  answer; answered/cancelled/expired ones render locked. */
    questions?: AgentQuestionClient[];
    error?: string;
}

// ─── create conversation ─────────────────────────────────────────────────

export interface CreateConversationRequest {
    title?: string;
    modelId: string;
}

export interface CreateConversationResponse {
    conversation?: AgentConversationClient;
    error?: string;
}

// ─── delete conversation ─────────────────────────────────────────────────

export interface DeleteConversationRequest {
    conversationId: string;
}

export interface DeleteConversationResponse {
    deleted?: boolean;
    error?: string;
}

// ─── cancel message ──────────────────────────────────────────────────────

export interface CancelMessageRequest {
    messageId: string;
}

export interface CancelMessageResponse {
    cancelled?: boolean;
    error?: string;
}

// ─── answer question (multiple-choice) ───────────────────────────────────

export interface AnswerQuestionRequest {
    questionId: string;
    /** Per sub-question answer (selected labels + optional `other` free
     *  text) — index-aligned to the question batch's `questions`. */
    answers: AgentQuestionAnswer[];
}

export interface AnswerQuestionResponse {
    question?: AgentQuestionClient;
    error?: string;
}

// ─── get traces (verbose mode) ───────────────────────────────────────────

export interface GetTracesRequest {
    conversationId: string;
}

export interface GetTracesResponse {
    traces?: AgentTraceClient[];
    error?: string;
}

// ─── upload attachment ───────────────────────────────────────────────────

export interface UploadAttachmentRequest {
    /** Original filename, used for display + extension hint. */
    name: string;
    /** MIME type, e.g. "image/png". */
    contentType: string;
    /** Base64-encoded file contents (no data: prefix). */
    base64: string;
}

export interface UploadAttachmentResponse {
    attachment?: AgentMessageAttachment;
    error?: string;
}

// ─── send message ────────────────────────────────────────────────────────

export interface SendMessageRequest {
    conversationId: string;
    modelId: string;
    text: string;
    /** Optional pre-uploaded attachments (from the upload-attachment
     *  API). Persisted on the user message and surfaced to the agent
     *  inline in the user text. */
    attachments?: AgentMessageAttachment[];
    /** Override the default system prompt for this turn. */
    systemPrompt?: string;
}

export interface SendMessageResponse {
    /** The user message that was just created. */
    userMessage?: AgentMessageClient;
    /** The pending assistant message stub. The daemon fills it in
     *  asynchronously — client polls `getConversation` to see events
     *  appear and the final answer. */
    assistantMessage?: AgentMessageClient;
    error?: string;
}
