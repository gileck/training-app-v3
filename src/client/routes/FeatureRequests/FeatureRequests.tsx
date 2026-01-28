/**
 * Feature Requests Admin Page
 *
 * Admin dashboard for managing feature requests.
 * Mobile-first design with responsive filter controls.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { Label } from '@/client/components/ui/label';
import { Input } from '@/client/components/ui/input';
import { Textarea } from '@/client/components/ui/textarea';
import { Loader2, AlertCircle, Inbox, Lightbulb, Plus, Send, ArrowDownAZ } from 'lucide-react';
import { useFeatureRequests, useCreateFeatureRequest } from './hooks';
import { useFeatureRequestsStore } from './store';
import { FeatureRequestCard } from './components/FeatureRequestCard';
import { CompletedSection } from './components/CompletedSection';
import { FilterChipBar } from './components/FilterChipBar';
import { applyAllFilters } from './utils/filterUtils';
import { applySorting, separateDoneItems } from './utils/sortingUtils';
import type { SortMode } from './utils/sortingUtils';
import { toast } from '@/client/components/ui/toast';
import type { GetGitHubStatusResponse } from '@/apis/feature-requests/types';

// Sort mode display labels
const SORT_MODE_LABELS: Record<SortMode, string> = {
    smart: 'Smart (Default)',
    newest: 'Newest First',
    oldest: 'Oldest First',
    priority: 'Priority',
    updated: 'Recently Updated',
};

// Short labels for mobile
const SORT_MODE_SHORT_LABELS: Record<SortMode, string> = {
    smart: 'Smart',
    newest: 'Newest',
    oldest: 'Oldest',
    priority: 'Priority',
    updated: 'Updated',
};

export function FeatureRequests() {
    // Persistent multi-filter state from store
    const statusFilters = useFeatureRequestsStore((state) => state.statusFilters);
    const priorityFilters = useFeatureRequestsStore((state) => state.priorityFilters);
    const githubFilters = useFeatureRequestsStore((state) => state.githubFilters);
    const activityFilters = useFeatureRequestsStore((state) => state.activityFilters);
    const sortMode = useFeatureRequestsStore((state) => state.sortMode);

    const toggleStatusFilter = useFeatureRequestsStore((state) => state.toggleStatusFilter);
    const togglePriorityFilter = useFeatureRequestsStore((state) => state.togglePriorityFilter);
    const toggleGitHubFilter = useFeatureRequestsStore((state) => state.toggleGitHubFilter);
    const toggleActivityFilter = useFeatureRequestsStore((state) => state.toggleActivityFilter);
    const clearAllFilters = useFeatureRequestsStore((state) => state.clearAllFilters);
    const setSortMode = useFeatureRequestsStore((state) => state.setSortMode);

    // Dialog state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [title, setTitle] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [description, setDescription] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [page, setPage] = useState('');

    const createMutation = useCreateFeatureRequest();

    // Fetch all requests without API-level filtering (client-side filtering now)
    const { data: rawRequests, isLoading, error } = useFeatureRequests({});

    // Build GitHub status map for filtering
    // Use Record instead of Map to prevent infinite re-renders (stable reference comparison)
    const githubStatusMap = useMemo(() => {
        const map: Record<string, GetGitHubStatusResponse | undefined> = {};
        // This will be populated as individual cards fetch their statuses
        // For now, we'll use the status from the request object itself
        rawRequests?.forEach((request) => {
            if (request.githubProjectItemId && request.githubProjectStatus) {
                map[request._id] = {
                    status: request.githubProjectStatus,
                    reviewStatus: request.githubReviewStatus || null,
                };
            }
        });
        return map;
    }, [rawRequests]);

    // Apply client-side filtering and sorting
    const { activeRequests, doneRequests } = useMemo(() => {
        if (!rawRequests) return { activeRequests: [], doneRequests: [] };

        // First, apply filters
        const filtered = applyAllFilters(
            rawRequests,
            {
                statusFilters,
                priorityFilters,
                githubFilters,
                activityFilters,
            },
            githubStatusMap
        );

        // Then, separate done items from active items
        const { activeItems, doneItems } = separateDoneItems(filtered, githubStatusMap);

        // Finally, apply sorting (only to active items, done items already sorted by completion date)
        const sortedActive = applySorting(activeItems, sortMode, githubStatusMap);

        return { activeRequests: sortedActive, doneRequests: doneItems };
    }, [rawRequests, statusFilters, priorityFilters, githubFilters, activityFilters, githubStatusMap, sortMode]);

    const totalFilteredCount = activeRequests.length + doneRequests.length;

    const showLoading = isLoading || rawRequests === undefined;

    const handleDialogClose = () => {
        setTitle('');
        setDescription('');
        setPage('');
        setIsDialogOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }

        if (!description.trim()) {
            toast.error('Please enter a description');
            return;
        }

        try {
            await createMutation.mutateAsync({
                title: title.trim(),
                description: description.trim(),
                page: page.trim() || undefined,
            });

            handleDialogClose();
        } catch (error) {
            // Error toast already shown by mutation onError
            // Just log for debugging if needed
            console.error('Create feature request failed:', error);
        }
    };

    return (
        <div className="space-y-4 pb-6">
            {/* Header - Mobile optimized with stacked layout on small screens */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500 sm:h-6 sm:w-6" />
                    <h1 className="text-lg font-semibold sm:text-xl">Feature Requests</h1>
                    {!showLoading && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:text-sm">
                            {totalFilteredCount}
                        </span>
                    )}
                </div>
                <Button onClick={() => setIsDialogOpen(true)} size="sm" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    New Request
                </Button>
            </div>

            {/* Filter and Sort Controls - Mobile optimized */}
            <div className="flex items-center gap-2">
                <FilterChipBar
                    statusFilters={statusFilters}
                    onToggleStatusFilter={toggleStatusFilter}
                    priorityFilters={priorityFilters}
                    onTogglePriorityFilter={togglePriorityFilter}
                    githubFilters={githubFilters}
                    onToggleGitHubFilter={toggleGitHubFilter}
                    activityFilters={activityFilters}
                    onToggleActivityFilter={toggleActivityFilter}
                    onClearAll={clearAllFilters}
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-2"
                        >
                            <ArrowDownAZ className="h-4 w-4" />
                            <span className="hidden sm:inline">{SORT_MODE_LABELS[sortMode]}</span>
                            <span className="sm:hidden">{SORT_MODE_SHORT_LABELS[sortMode]}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                            onClick={() => setSortMode('smart')}
                            className={sortMode === 'smart' ? 'bg-accent' : ''}
                        >
                            {SORT_MODE_LABELS.smart}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setSortMode('newest')}
                            className={sortMode === 'newest' ? 'bg-accent' : ''}
                        >
                            Newest First
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setSortMode('oldest')}
                            className={sortMode === 'oldest' ? 'bg-accent' : ''}
                        >
                            Oldest First
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setSortMode('priority')}
                            className={sortMode === 'priority' ? 'bg-accent' : ''}
                        >
                            Priority
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setSortMode('updated')}
                            className={sortMode === 'updated' ? 'bg-accent' : ''}
                        >
                            Recently Updated
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Content */}
            {showLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                        <p className="mt-4 text-muted-foreground">
                            Failed to load feature requests. Please try again.
                        </p>
                    </CardContent>
                </Card>
            ) : totalFilteredCount === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">
                            {rawRequests && rawRequests.length > 0
                                ? 'No feature requests match the current filters.'
                                : 'No feature requests found.'}
                        </p>
                        {rawRequests && rawRequests.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearAllFilters}
                                className="mt-4"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3 sm:space-y-4">
                    {/* Active items */}
                    {activeRequests.map((request) => (
                        <FeatureRequestCard key={request._id} request={request} />
                    ))}

                    {/* Completed section (auto-collapsed) */}
                    <CompletedSection doneItems={doneRequests} />
                </div>
            )}

            {/* Create Feature Request Dialog */}
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open && !createMutation.isPending) {
                        handleDialogClose();
                    }
                }}
            >
                <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:mx-auto sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-yellow-500" />
                            New Feature Request
                        </DialogTitle>
                        <DialogDescription>
                            Create a new feature request for the admin dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                placeholder="Brief summary of the feature"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={createMutation.isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                className="min-h-[120px] resize-none"
                                placeholder="Describe the feature request in detail"
                                value={description}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                                disabled={createMutation.isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="page">Related Page (optional)</Label>
                            <Input
                                id="page"
                                placeholder="/admin/feature-requests"
                                value={page}
                                onChange={(e) => setPage(e.target.value)}
                                disabled={createMutation.isPending}
                            />
                            <p className="text-xs text-muted-foreground">
                                Which page or area does this feature relate to?
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full sm:flex-1"
                                onClick={handleDialogClose}
                                disabled={createMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="w-full sm:flex-1"
                                disabled={createMutation.isPending || !title.trim() || !description.trim()}
                            >
                                {createMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Create Request
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
