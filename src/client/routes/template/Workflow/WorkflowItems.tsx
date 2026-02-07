/**
 * Workflow Items Page
 *
 * Unified admin page with two sections:
 * - Pending Approval: new feature requests and bug reports awaiting admin approval
 * - Pipeline: active workflow items progressing through the workflow
 *
 * Includes type filter chips (All / Features / Bugs) for client-side filtering.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Badge } from '@/client/components/template/ui/badge';
import { useRouter } from '@/client/features';
import { useWorkflowItems } from './hooks';
import type { PendingItem, WorkflowItem } from '@/apis/template/workflow/types';

type TypeFilter = 'all' | 'feature' | 'bug';

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTypeBadge(type: 'feature' | 'bug' | 'task'): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
    if (type === 'bug') return { label: 'Bug', variant: 'destructive' };
    if (type === 'task') return { label: 'Task', variant: 'secondary' };
    return { label: 'Feature', variant: 'default' };
}

function getStatusVariant(status: string | null): 'default' | 'destructive' | 'secondary' | 'outline' {
    if (!status) return 'outline';
    if (status === 'Done') return 'default';
    if (status === 'Backlog') return 'secondary';
    return 'outline';
}

function getReviewStatusVariant(reviewStatus: string | null): 'default' | 'destructive' | 'secondary' | 'outline' {
    if (!reviewStatus) return 'outline';
    if (reviewStatus === 'Approved') return 'default';
    if (reviewStatus === 'Request Changes' || reviewStatus === 'Rejected') return 'destructive';
    return 'secondary';
}

function PendingCard({ item }: { item: PendingItem }) {
    const { navigate } = useRouter();

    return (
        <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate(`/admin/item/${item.id}`)}
        >
            <CardContent className="p-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-tight line-clamp-2">
                            {item.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-muted-foreground">
                                {formatDate(item.createdAt)}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={item.type === 'bug' ? 'destructive' : 'default'} className="text-xs">
                            {item.type === 'bug' ? 'Bug' : 'Feature'}
                        </Badge>
                        {item.source && (
                            <Badge variant="secondary" className="text-xs">
                                via {item.source}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function WorkflowCard({ item }: { item: WorkflowItem }) {
    const { navigate } = useRouter();
    const typeBadge = getTypeBadge(item.type);
    const navId = item.sourceId || item.id;

    return (
        <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate(`/admin/item/${navId}`)}
        >
            <CardContent className="p-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-tight line-clamp-2">
                            {item.content?.title || 'Untitled'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {item.createdAt && (
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(item.createdAt)}
                                </span>
                            )}
                            {item.content?.number && (
                                <span className="text-xs text-muted-foreground">
                                    #{item.content.number}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={typeBadge.variant} className="text-xs">
                            {typeBadge.label}
                        </Badge>
                        <Badge variant={getStatusVariant(item.status)} className="text-xs">
                            {item.status || 'No status'}
                        </Badge>
                        {item.reviewStatus && (
                            <Badge variant={getReviewStatusVariant(item.reviewStatus)} className="text-xs">
                                {item.reviewStatus}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function FilterChips({ active, onChange }: { active: TypeFilter; onChange: (f: TypeFilter) => void }) {
    const chips: { value: TypeFilter; label: string }[] = [
        { value: 'all', label: 'All' },
        { value: 'feature', label: 'Features' },
        { value: 'bug', label: 'Bugs' },
    ];

    return (
        <div className="flex gap-1.5">
            {chips.map((chip) => (
                <button
                    key={chip.value}
                    onClick={() => onChange(chip.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        active === chip.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                >
                    {chip.label}
                </button>
            ))}
        </div>
    );
}

export function WorkflowItems() {
    const { data, isLoading, error } = useWorkflowItems();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral filter state within admin page
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

    const filteredPending = useMemo(() => {
        if (!data?.pendingItems) return [];
        const items = [...data.pendingItems].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (typeFilter === 'all') return items;
        return items.filter((item) => item.type === typeFilter);
    }, [data?.pendingItems, typeFilter]);

    const filteredPipeline = useMemo(() => {
        if (!data?.workflowItems) return [];
        const items = [...data.workflowItems].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
        if (typeFilter === 'all') return items;
        return items.filter((item) => {
            if (typeFilter === 'feature') return item.type === 'feature';
            if (typeFilter === 'bug') return item.type === 'bug';
            return true;
        });
    }, [data?.workflowItems, typeFilter]);

    if (isLoading || data === undefined) {
        return (
            <div className="p-4">
                <h1 className="text-lg font-semibold mb-4">Workflow</h1>
                <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <h1 className="text-lg font-semibold mb-4">Workflow</h1>
                <div className="text-sm text-destructive">
                    Failed to load workflow items: {error.message}
                </div>
            </div>
        );
    }

    const hasPending = filteredPending.length > 0;
    const hasPipeline = filteredPipeline.length > 0;
    const isEmpty = !hasPending && !hasPipeline;

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-semibold">Workflow</h1>
                <FilterChips active={typeFilter} onChange={setTypeFilter} />
            </div>

            {isEmpty && (
                <div className="text-sm text-muted-foreground">No workflow items found.</div>
            )}

            {hasPending && (
                <div className="mb-6">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Pending Approval ({filteredPending.length})
                    </h2>
                    <div className="flex flex-col gap-2">
                        {filteredPending.map((item) => (
                            <PendingCard key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {hasPipeline && (
                <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Pipeline ({filteredPipeline.length})
                    </h2>
                    <div className="flex flex-col gap-2">
                        {filteredPipeline.map((item) => (
                            <WorkflowCard key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
