/**
 * Feature Requests Admin Page
 *
 * Admin dashboard for managing feature requests.
 * Mobile-first design with responsive filter controls.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import { Loader2, AlertCircle, Inbox, Lightbulb, Plus, ArrowDownAZ } from 'lucide-react';
import { useFeatureRequests, useBatchGitHubStatuses } from './hooks';
import { useFeatureRequestsStore } from './store';
import { FeatureRequestCard } from './components/FeatureRequestCard';
import { CompletedSection } from './components/CompletedSection';
import { FilterChipBar } from './components/FilterChipBar';
import { CreateFeatureRequestDialog } from './components/CreateFeatureRequestDialog';
import { applyAllFilters } from './utils/filterUtils';
import { applySorting, separateDoneItems } from './utils/sortingUtils';
import type { SortMode } from './utils/sortingUtils';
import type { GetGitHubStatusResponse } from '@/apis/template/feature-requests/types';

// Sort mode display labels
const SORT_MODE_LABELS: Record<SortMode, string> = {
    smart: 'Smart (Default)',
    newest: 'Newest First',
    oldest: 'Oldest First',
    priority: 'Priority',
    updated: 'Recently Updated',
};

const SORT_MODE_SHORT_LABELS: Record<SortMode, string> = {
    smart: 'Smart',
    newest: 'Newest',
    oldest: 'Oldest',
    priority: 'Priority',
    updated: 'Updated',
};

export function FeatureRequests() {
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

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { data: rawRequests, isLoading, error } = useFeatureRequests({});

    const githubLinkedIds = useMemo(() => {
        if (!rawRequests) return [];
        return rawRequests
            .filter((r) => r.githubProjectItemId)
            .map((r) => r._id);
    }, [rawRequests]);

    const { data: batchStatusData, isLoading: isLoadingStatuses, error: statusError } = useBatchGitHubStatuses(githubLinkedIds);

    const githubStatusMap = useMemo(() => {
        const map: Record<string, GetGitHubStatusResponse | undefined> = {};
        if (batchStatusData) {
            Object.entries(batchStatusData).forEach(([requestId, status]) => {
                if (status) {
                    map[requestId] = status;
                }
            });
        }
        return map;
    }, [batchStatusData]);

    const { activeRequests, doneRequests } = useMemo(() => {
        if (!rawRequests) return { activeRequests: [], doneRequests: [] };
        const filtered = applyAllFilters(
            rawRequests,
            { statusFilters, priorityFilters, githubFilters, activityFilters },
            githubStatusMap
        );
        const { activeItems, doneItems } = separateDoneItems(filtered, githubStatusMap);
        const sortedActive = applySorting(activeItems, sortMode, githubStatusMap);
        return { activeRequests: sortedActive, doneRequests: doneItems };
    }, [rawRequests, statusFilters, priorityFilters, githubFilters, activityFilters, githubStatusMap, sortMode]);

    const totalFilteredCount = activeRequests.length + doneRequests.length;
    const showLoading = isLoading || rawRequests === undefined;
    const isLoadingGitHubData = isLoadingStatuses && githubLinkedIds.length > 0;
    const rateLimitError = statusError instanceof Error && statusError.message.includes('rate limit')
        ? 'GitHub API rate limit reached. Status data may be incomplete.'
        : null;

    return (
        <div className="space-y-4 pb-6">
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
                        <Button variant="outline" size="sm" className="shrink-0 gap-2">
                            <ArrowDownAZ className="h-4 w-4" />
                            <span className="hidden sm:inline">{SORT_MODE_LABELS[sortMode]}</span>
                            <span className="sm:hidden">{SORT_MODE_SHORT_LABELS[sortMode]}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {(Object.keys(SORT_MODE_LABELS) as SortMode[]).map((mode) => (
                            <DropdownMenuItem
                                key={mode}
                                onClick={() => setSortMode(mode)}
                                className={sortMode === mode ? 'bg-accent' : ''}
                            >
                                {SORT_MODE_LABELS[mode]}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {rateLimitError && (
                <Card className="border-warning bg-warning/10">
                    <CardContent className="py-3 px-4 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                        <p className="text-sm text-warning">{rateLimitError}</p>
                    </CardContent>
                </Card>
            )}

            {isLoadingGitHubData && !showLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Loading GitHub statuses...</span>
                </div>
            )}

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
                            <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4">
                                Clear Filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3 sm:space-y-4">
                    {activeRequests.map((request) => (
                        <FeatureRequestCard key={request._id} request={request} />
                    ))}
                    <CompletedSection doneItems={doneRequests} />
                </div>
            )}

            <CreateFeatureRequestDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </div>
    );
}
