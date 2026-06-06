import { MessageSquarePlus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import { cn } from '@/client/lib/utils';
import {
    useAgentConversations,
    useCreateAgentConversation,
    useDeleteAgentConversation,
    useAgentUIStore,
} from '@/client/features/template/agent';

interface ConversationSidebarProps {
    onNavigate?: () => void;
}

export function ConversationSidebar({ onNavigate }: ConversationSidebarProps) {
    const selectedId = useAgentUIStore((s) => s.selectedConversationId);
    const setSelected = useAgentUIStore((s) => s.setSelectedConversationId);
    const modelId = useAgentUIStore((s) => s.selectedModelId);

    const { data: conversations = [], isLoading } = useAgentConversations();
    const createMutation = useCreateAgentConversation();
    const deleteMutation = useDeleteAgentConversation();

    const handleNew = () => {
        createMutation.mutate({ modelId });
        onNavigate?.();
    };

    return (
        <div className="flex h-full flex-col bg-card">
            <div className="border-b border-border p-3">
                <Button
                    className="w-full justify-start gap-2"
                    onClick={handleNew}
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MessageSquarePlus className="h-4 w-4" />
                    )}
                    New conversation
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {isLoading && conversations.length === 0 ? (
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                        No conversations yet. Start one to begin.
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {conversations.map((c) => {
                            const isSelected = c.id === selectedId;
                            return (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelected(c.id);
                                            onNavigate?.();
                                        }}
                                        className={cn(
                                            'group relative flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                                            isSelected
                                                ? 'bg-primary/10 text-foreground'
                                                : 'text-foreground/80 hover:bg-muted'
                                        )}
                                    >
                                        <span className="flex-1 truncate">
                                            {c.title}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMutation.mutate(c.id);
                                            }}
                                            className={cn(
                                                'rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100',
                                                isSelected && 'opacity-60'
                                            )}
                                            aria-label="Delete conversation"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
