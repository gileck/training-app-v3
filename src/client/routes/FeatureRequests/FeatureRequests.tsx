/**
 * Feature Requests Admin Page
 *
 * Admin dashboard for managing feature requests.
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
import { Label } from '@/client/components/ui/label';
import { Input } from '@/client/components/ui/input';
import { Textarea } from '@/client/components/ui/textarea';
import { Loader2, AlertCircle, Inbox, Lightbulb, ArrowUpDown, Plus, Send } from 'lucide-react';
import { useFeatureRequests, useCreateFeatureRequest } from './hooks';
import { useFeatureRequestsStore } from './store';
import { FeatureRequestCard } from './components/FeatureRequestCard';
import { FilterChipBar } from './components/FilterChipBar';
import { applyAllFilters } from './utils/filterUtils';
import { toast } from '@/client/components/ui/toast';
import type { GetGitHubStatusResponse } from '@/apis/feature-requests/types';

// No longer needed - replaced with FilterChipBar component

export function FeatureRequests() {
    // Persistent multi-filter state from store
    const statusFilters = useFeatureRequestsStore((state) => state.statusFilters);
    const priorityFilters = useFeatureRequestsStore((state) => state.priorityFilters);
    const githubFilters = useFeatureRequestsStore((state) => state.githubFilters);
    const activityFilters = useFeatureRequestsStore((state) => state.activityFilters);
    const sortOrder = useFeatureRequestsStore((state) => state.sortOrder);

    const toggleStatusFilter = useFeatureRequestsStore((state) => state.toggleStatusFilter);
    const togglePriorityFilter = useFeatureRequestsStore((state) => state.togglePriorityFilter);
    const toggleGitHubFilter = useFeatureRequestsStore((state) => state.toggleGitHubFilter);
    const toggleActivityFilter = useFeatureRequestsStore((state) => state.toggleActivityFilter);
    const clearAllFilters = useFeatureRequestsStore((state) => state.clearAllFilters);
    const setSortOrder = useFeatureRequestsStore((state) => state.setSortOrder);

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
    const { data: rawRequests, isLoading, error } = useFeatureRequests({
        sortOrder,
    });

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

    // Apply client-side filtering using all active filters
    const filteredRequests = useMemo(() => {
        if (!rawRequests) return [];

        return applyAllFilters(
            rawRequests,
            {
                statusFilters,
                priorityFilters,
                githubFilters,
                activityFilters,
            },
            githubStatusMap
        );
    }, [rawRequests, statusFilters, priorityFilters, githubFilters, activityFilters, githubStatusMap]);

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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-yellow-500" />
                    <h1 className="text-xl font-semibold">Feature Requests</h1>
                    {!showLoading && filteredRequests && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
                            {filteredRequests.length}
                        </span>
                    )}
                </div>
                <Button onClick={() => setIsDialogOpen(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Request
                </Button>
            </div>

            {/* Filter Chips */}
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
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                    className="shrink-0"
                >
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
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
            ) : filteredRequests.length === 0 ? (
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
                <div className="space-y-4">
                    {filteredRequests.map((request) => (
                        <FeatureRequestCard key={request._id} request={request} />
                    ))}
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
                <DialogContent className="sm:max-w-md">
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

                        <div className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={handleDialogClose}
                                disabled={createMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
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
