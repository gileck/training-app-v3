/**
 * Agent route — modern chat UX powered by the agentic RPC engine.
 *
 * Layout:
 *   Desktop: two columns — sidebar (conversations) | chat
 *   Mobile:  chat full-width, sidebar in a Sheet drawer
 *
 * Polling: useAgentConversation auto-refetches at 1.5s while any
 * message has status='pending', so the daemon's events stream in as
 * they're persisted to Mongo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Menu,
    Bot,
    Terminal,
    MoreVertical,
    ClipboardCopy,
    Home as HomeIcon,
} from 'lucide-react';
import { useRouter } from '@/client/features';
import { Button } from '@/client/components/template/ui/button';
import { toast } from '@/client/components/template/ui/toast';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/client/components/template/ui/sheet';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import {
    CLAUDE_CODE_MODELS,
    CODEX_MODELS,
} from '@/common/ai/models';
import { RpcConnectionIndicator } from '@/client/features/template/rpc-connection';
import {
    useAgentUIStore,
    useAgentConversation,
    useAgentConversations,
    useAgentTraces,
    useCreateAgentConversation,
    useSendAgentMessage,
    useCancelAgentMessage,
    useAnswerAgentQuestion,
    useUploadAttachment,
    isMessageLivePending,
    groupQuestionsByMessageId,
} from '@/client/features/template/agent';
import { getTraces } from '@/apis/template/agent/client';
import type {
    AgentMessageAttachment,
    AgentTraceClient,
} from '@/apis/template/agent/types';
import { copyTextToClipboard } from '@/client/utils/clipboard';
import {
    ChatComposer,
    type AttachmentSlot,
    type ChatComposerHandle,
    type ChatComposerModelGroup,
} from '@/client/components/template/chat/ChatComposer';
import { ConversationSidebar } from './ConversationSidebar';
import { MessageList } from './MessageList';
import { buildThreadTraceReport } from './threadTrace';

const AGENT_MODELS: ChatComposerModelGroup[] = [
    { label: 'Claude Code', models: CLAUDE_CODE_MODELS },
    { label: 'Codex', models: CODEX_MODELS },
];

export function Agent() {
    const { navigate } = useRouter();
    const selectedId = useAgentUIStore((s) => s.selectedConversationId);
    const setSelected = useAgentUIStore((s) => s.setSelectedConversationId);
    const modelId = useAgentUIStore((s) => s.selectedModelId);
    const setModelId = useAgentUIStore((s) => s.setSelectedModelId);
    const verbose = useAgentUIStore((s) => s.verboseMode);
    const setVerbose = useAgentUIStore((s) => s.setVerboseMode);
    const clientTimings = useAgentUIStore((s) => s.clientTimings);
    const recordClientSend = useAgentUIStore((s) => s.recordClientSend);
    const bindClientSentToMessage = useAgentUIStore(
        (s) => s.bindClientSentToMessage
    );
    const recordClientReceived = useAgentUIStore((s) => s.recordClientReceived);

    // eslint-disable-next-line state-management/prefer-state-architecture -- transient sheet open/close
    const [sheetOpen, setSheetOpen] = useState(false);

    const inputRef = useRef<ChatComposerHandle | null>(null);

    // Attachment slots — each picked file becomes a slot that flips
    // through 'uploading' → 'uploaded' (or 'failed'). On send we
    // include only the successfully-uploaded ones.
    // eslint-disable-next-line state-management/prefer-state-architecture -- transient pre-submit composer state
    const [attachmentSlots, setAttachmentSlots] = useState<AttachmentSlot[]>([]);
    const uploadMutation = useUploadAttachment();

    const { data: conversations = [] } = useAgentConversations();
    const conversationQuery = useAgentConversation(selectedId);
    const createMutation = useCreateAgentConversation();
    const sendMutation = useSendAgentMessage();
    const cancelMutation = useCancelAgentMessage(selectedId);
    const answerMutation = useAnswerAgentQuestion(selectedId);

    const questions = conversationQuery.data?.questions ?? [];

    // Mirror the conversation hook's live-pending check so the trace
    // poll runs at the same cadence — both stop when the message goes
    // stale or finalizes. A message blocked on an open question (or with
    // recent activity) stays "live": the agent is working / waiting on
    // the user, not dead.
    const questionsByMessageId = useMemo(
        () => groupQuestionsByMessageId(questions),
        [questions]
    );
    const livePendingMessage = conversationQuery.data?.messages.find((m) =>
        isMessageLivePending(m, questionsByMessageId.get(m.id) ?? [])
    );
    const hasLivePending = Boolean(livePendingMessage);

    const tracesQuery = useAgentTraces({
        conversationId: selectedId,
        enabled: verbose,
        hasLivePending,
    });

    // If the persisted selectedId no longer exists (e.g. deleted on
    // another device), clear it so we land on the empty-state instead
    // of an infinite "not found" spinner.
    useEffect(() => {
        if (!selectedId) return;
        if (conversationQuery.isError) setSelected(null);
    }, [conversationQuery.isError, selectedId, setSelected]);

    const messages = conversationQuery.data?.messages ?? [];
    const conversation = conversationQuery.data?.conversation;

    // Per-thread model memory: when a conversation loads with a model
    // different from what the picker currently shows, sync the store
    // TO the conversation's value. After that the picker is the
    // source of truth — the user can change it freely and the next
    // `sendMessage` updates the conversation server-side to match.
    useEffect(() => {
        const convModelId = conversation?.modelId;
        if (convModelId && convModelId !== modelId) {
            setModelId(convModelId);
        }
        // We deliberately only react to the conversation's modelId
        // changing (i.e. a different conversation loaded). Reacting
        // to `modelId` here would create an infinite sync loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversation?.modelId]);

    // The picker is bound directly to the store. Conversation memory
    // is restored via the effect above.
    const activeModelId = modelId;

    const groupedModels = useMemo(() => AGENT_MODELS, []);

    // Observe assistant turns to capture the client-clock bookends:
    //   - bind the pending "user clicked send" stamp to the live turn
    //     it started (first time we see a real, pending assistant row);
    //   - stamp "client saw the finalized answer" when a turn we
    //     witnessed go pending later flips to a terminal status.
    // Skipping optimistic ids (they get replaced) and turns that were
    // already terminal on first sight (a historical thread we just
    // opened — we never witnessed those happen, so we don't fake times).
    const seenAssistantRef = useRef<Set<string>>(new Set());
    const sawPendingRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        for (const m of messages) {
            if (m.role !== 'assistant') continue;
            if (m.id.startsWith('optimistic:')) continue;
            if (!seenAssistantRef.current.has(m.id)) {
                seenAssistantRef.current.add(m.id);
                if (m.status === 'pending') {
                    sawPendingRef.current.add(m.id);
                    bindClientSentToMessage(m.id);
                }
            }
            if (m.status !== 'pending' && sawPendingRef.current.has(m.id)) {
                recordClientReceived(m.id);
            }
        }
    }, [messages, bindClientSentToMessage, recordClientReceived]);

    const patchSlot = (id: string, patch: Partial<AttachmentSlot>) => {
        setAttachmentSlots((cur) =>
            cur.map((s) => (s.id === id ? { ...s, ...patch } : s))
        );
    };

    const handleSend = async (text: string) => {
        // Client-clock bookend: the instant the user committed the send,
        // before any network/conversation-creation work. Bound to the
        // resulting assistant turn by the observer effect below.
        recordClientSend();
        // 'uploading' was blocked by MessageInput's submit guard;
        // 'failed' slots are silently dropped (user already saw the
        // toast from the upload mutation).
        const ready: AgentMessageAttachment[] = attachmentSlots
            .filter((s): s is AttachmentSlot & { url: string } =>
                s.status === 'uploaded' && !!s.url
            )
            .map((s) => ({
                url: s.url,
                contentType: s.contentType,
                name: s.name,
                size: s.size ?? 0,
            }));

        let convId = selectedId;
        if (!convId) {
            const created = await createMutation.mutateAsync({
                modelId: activeModelId,
                title: text.slice(0, 80),
            });
            convId = created.id;
        }
        sendMutation.mutate({
            conversationId: convId,
            modelId: activeModelId,
            text,
            attachments: ready.length > 0 ? ready : undefined,
        });
        // Slots have been claimed by the message — clear composer state.
        for (const s of attachmentSlots) {
            if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
        }
        setAttachmentSlots([]);
    };

    const handleAddFiles = (files: File[]) => {
        const newSlots: AttachmentSlot[] = files.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            contentType: file.type || 'application/octet-stream',
            status: 'uploading',
            previewUrl: file.type.startsWith('image/')
                ? URL.createObjectURL(file)
                : undefined,
        }));
        setAttachmentSlots((cur) => [...cur, ...newSlots]);

        files.forEach((file, idx) => {
            const slotId = newSlots[idx].id;
            uploadMutation.mutate(file, {
                onSuccess: (att) =>
                    patchSlot(slotId, {
                        status: 'uploaded',
                        url: att.url,
                        size: att.size,
                    }),
                onError: (err) =>
                    patchSlot(slotId, {
                        status: 'failed',
                        error: err instanceof Error ? err.message : String(err),
                    }),
            });
        });
    };

    const handleRemoveAttachment = (id: string) => {
        setAttachmentSlots((cur) => {
            const slot = cur.find((s) => s.id === id);
            if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl);
            return cur.filter((s) => s.id !== id);
        });
    };

    const handleEditUserMessage = (text: string) => {
        inputRef.current?.setText(text);
    };

    const handleResendUserMessage = (text: string) => {
        handleSend(text);
    };

    // Copy the whole thread's end-to-end trace (client → server → agent
    // → server → client) to the clipboard for debugging.
    //
    // Traces are PREFETCHED when the menu opens (below) so the actual
    // copy runs synchronously inside the click gesture — clipboard
    // writes fail with NotAllowedError if they happen after an `await`
    // (the network fetch) because the browser's transient activation /
    // focus is gone by then.
    const prefetchedTracesRef = useRef<AgentTraceClient[]>([]);

    const prefetchTraces = () => {
        if (!selectedId) return;
        getTraces({ conversationId: selectedId })
            .then((res) => {
                if (res.data?.traces) {
                    prefetchedTracesRef.current = res.data.traces;
                }
            })
            .catch(() => {
                // Best-effort — handleCopyTrace falls back to whatever
                // traces are already loaded (verbose mode) or none.
            });
    };

    const handleCopyTrace = () => {
        if (!selectedId) return;
        const traces =
            prefetchedTracesRef.current.length > 0
                ? prefetchedTracesRef.current
                : tracesQuery.data ?? [];
        const report = buildThreadTraceReport({
            conversation,
            messages,
            traces,
            clientTimings,
            exportedAt: new Date().toISOString(),
        });
        // Kick the copy synchronously (in-gesture) so clipboard
        // permission holds; toast only on the REAL result.
        void copyTextToClipboard(report).then((ok) => {
            if (ok) {
                toast.success('Thread trace copied to clipboard');
            } else {
                // Clipboard genuinely unavailable — make sure the user
                // can still grab the trace.
                console.log('[agent thread trace]\n' + report);
                toast.error(
                    'Clipboard blocked — trace logged to the browser console'
                );
            }
        });
    };

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background sm:h-[100dvh]">
            <div className="flex flex-1 overflow-hidden">
                {/* Desktop sidebar */}
                <aside className="hidden w-72 shrink-0 border-r border-border md:block">
                    <ConversationSidebar />
                </aside>

                {/* Mobile sidebar (Sheet) */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent side="left" className="w-72 p-0">
                        <SheetTitle className="sr-only">Conversations</SheetTitle>
                        <ConversationSidebar onNavigate={() => setSheetOpen(false)} />
                    </SheetContent>
                </Sheet>

                {/* Main chat column */}
                <main className="flex min-w-0 flex-1 flex-col">
                    {/* Top bar — [Home] [Threads] [Title] [RPC] [⋮ menu] */}
                    <header className="flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        {/* Leave the agent — this is a fullScreen route, so
                            the app's normal nav chrome is hidden and this
                            is the only way back out. */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => navigate('/')}
                            aria-label="Back to home"
                            title="Back to home"
                        >
                            <HomeIcon className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            // Mobile: opens the conversation sheet.
                            // Desktop: sidebar is permanent, button is
                            // hidden — but still rendered for layout
                            // consistency via md:hidden.
                            className="md:hidden"
                            onClick={() => setSheetOpen(true)}
                            aria-label="Open conversations"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
                            {conversation?.title ?? 'Coach'}
                        </h1>

                        <RpcConnectionIndicator />

                        <DropdownMenu
                            onOpenChange={(open) => {
                                // Prefetch traces while the menu is open so
                                // "Copy debug trace" can copy synchronously
                                // (no await) and keep clipboard permission.
                                if (open) prefetchTraces();
                            }}
                        >
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Thread menu"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>Debug</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem
                                    checked={verbose}
                                    onCheckedChange={(v) => setVerbose(!!v)}
                                >
                                    <Terminal className="mr-2 h-3.5 w-3.5" />
                                    Verbose trace log
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuItem
                                    disabled={!selectedId || messages.length === 0}
                                    onSelect={() => handleCopyTrace()}
                                >
                                    <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
                                    Copy debug trace
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                                    Model is set below the message input.
                                </DropdownMenuLabel>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </header>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto">
                        {selectedId && conversationQuery.isLoading ? (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Loading…
                            </div>
                        ) : conversations.length === 0 && !selectedId ? (
                            <EmptyWelcome />
                        ) : (
                            <div className="mx-auto max-w-3xl">
                                <MessageList
                                    messages={messages}
                                    traces={tracesQuery.data}
                                    verbose={verbose}
                                    questions={questions}
                                    onAnswerQuestion={(questionId, answers) =>
                                        answerMutation.mutate({
                                            questionId,
                                            answers,
                                        })
                                    }
                                    answeringQuestionId={
                                        answerMutation.isPending
                                            ? answerMutation.variables
                                                  ?.questionId ?? null
                                            : null
                                    }
                                    onEditUserMessage={handleEditUserMessage}
                                    onResendUserMessage={handleResendUserMessage}
                                />
                            </div>
                        )}
                    </div>

                    {/* Composer — shared template component; the model
                        picker is built in via the `models` prop. */}
                    <div className="bg-background">
                        <ChatComposer
                            ref={inputRef}
                            onSubmit={handleSend}
                            attachments={attachmentSlots}
                            onAddFiles={handleAddFiles}
                            onRemoveAttachment={handleRemoveAttachment}
                            models={groupedModels}
                            selectedModelId={activeModelId}
                            onSelectModel={setModelId}
                            disabled={createMutation.isPending}
                            isSending={sendMutation.isPending}
                            isAgentRunning={hasLivePending}
                            onCancel={
                                livePendingMessage
                                    ? () =>
                                          cancelMutation.mutate(
                                              livePendingMessage.id
                                          )
                                    : undefined
                            }
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}

function EmptyWelcome() {
    return (
        <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Bot className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Coach</h2>
                <p className="text-sm text-muted-foreground">
                    Your training assistant. Ask about your plans and weekly
                    progress, or have Coach update your plans, exercises, and
                    logged sets for you. Type below to start.
                </p>
                <p className="text-xs text-muted-foreground">
                    Try: <code className="rounded bg-muted px-1.5 py-0.5">How is my week going?</code>
                    {' · '}
                    <code className="rounded bg-muted px-1.5 py-0.5">Add squats to my plan</code>
                    {' · '}
                    <code className="rounded bg-muted px-1.5 py-0.5">Log a set</code>
                </p>
            </div>
        </div>
    );
}
