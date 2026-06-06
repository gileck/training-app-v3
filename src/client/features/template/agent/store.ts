import { createStore } from '@/client/stores';
import { agentClientConfig } from '@/client/utils/project/agentClientConfig';

interface AgentUIState {
    /** Currently-selected conversation id, or null when on the empty
     *  "start a new chat" screen. Persisted so reopening the app
     *  resumes the last thread. */
    selectedConversationId: string | null;
    /** Last picked agent model id. Persisted so the picker remembers
     *  across sessions. */
    selectedModelId: string;
    /** Per-message: which messages have their thinking timeline
     *  expanded. Not persisted — it's a transient view choice and the
     *  default (collapsed) is fine on each app load. */
    expandedTimelineMessageIds: string[];
    /** When on, the thread renders every trace entry inline alongside
     *  messages, with timestamps + layer/level metadata. Persisted so
     *  developers leave it on across reloads. */
    verboseMode: boolean;

    /** Client-clock bookends per assistant message, for the debug
     *  trace: when the user clicked send vs. when this client first
     *  rendered the finalized answer. Not persisted — these are live
     *  measurements only meaningful within the current session. */
    clientTimings: Record<string, { sentAt?: string; receivedAt?: string }>;
    /** A send was just initiated (client clock) but the assistant
     *  message id isn't known yet; bound to the next live turn. */
    pendingClientSentAt: string | null;

    setSelectedConversationId: (id: string | null) => void;
    setSelectedModelId: (id: string) => void;
    toggleTimelineExpanded: (messageId: string) => void;
    setVerboseMode: (on: boolean) => void;
    /** Stamp "user clicked send" on the client clock. */
    recordClientSend: () => void;
    /** Bind the pending send timestamp to the assistant turn it
     *  started. No-op if there's nothing pending or it's already bound. */
    bindClientSentToMessage: (messageId: string) => void;
    /** Stamp "client first saw the finalized answer". One-shot. */
    recordClientReceived: (messageId: string) => void;
}

const DEFAULT_MODEL_ID = agentClientConfig.defaultModelId;

export const useAgentUIStore = createStore<AgentUIState>({
    key: 'agent-ui',
    label: 'Agent UI',
    creator: (set, get) => ({
        selectedConversationId: null,
        selectedModelId: DEFAULT_MODEL_ID,
        expandedTimelineMessageIds: [],
        verboseMode: false,
        clientTimings: {},
        pendingClientSentAt: null,
        setSelectedConversationId: (id) => set({ selectedConversationId: id }),
        setSelectedModelId: (id) => set({ selectedModelId: id }),
        toggleTimelineExpanded: (messageId) => {
            const current = get().expandedTimelineMessageIds;
            set({
                expandedTimelineMessageIds: current.includes(messageId)
                    ? current.filter((id) => id !== messageId)
                    : [...current, messageId],
            });
        },
        setVerboseMode: (on) => set({ verboseMode: on }),
        recordClientSend: () =>
            set({ pendingClientSentAt: new Date().toISOString() }),
        bindClientSentToMessage: (messageId) => {
            const pending = get().pendingClientSentAt;
            if (!pending) return;
            const existing = get().clientTimings[messageId];
            if (existing?.sentAt) return;
            set({
                pendingClientSentAt: null,
                clientTimings: {
                    ...get().clientTimings,
                    [messageId]: { ...existing, sentAt: pending },
                },
            });
        },
        recordClientReceived: (messageId) => {
            const existing = get().clientTimings[messageId];
            if (existing?.receivedAt) return; // one-shot — never overwrite
            set({
                clientTimings: {
                    ...get().clientTimings,
                    [messageId]: { ...existing, receivedAt: new Date().toISOString() },
                },
            });
        },
    }),
    persistOptions: {
        partialize: (state) => ({
            selectedConversationId: state.selectedConversationId,
            selectedModelId: state.selectedModelId,
            verboseMode: state.verboseMode,
        }),
    },
});
