/**
 * Feature Requests Admin Page
 *
 * Admin dashboard for managing feature requests.
 */

import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import { Loader2, AlertCircle, Inbox, Lightbulb, ArrowUpDown } from 'lucide-react';
import { useFeatureRequests } from './hooks';
import { useFeatureRequestsStore, StatusFilterOption } from './store';
import { FeatureRequestCard } from './components/FeatureRequestCard';
import type { FeatureRequestStatus, FeatureRequestPriority } from '@/apis/feature-requests/types';

const statusOptions: { value: StatusFilterOption; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
    { value: 'rejected', label: 'Rejected' },
];

const priorityOptions: { value: FeatureRequestPriority | 'all'; label: string }[] = [
    { value: 'all', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

// Active statuses (excludes done, rejected)
const activeStatuses: FeatureRequestStatus[] = ['new', 'in_progress'];

export function FeatureRequests() {
    // Persistent UI state from store
    const statusFilter = useFeatureRequestsStore((state) => state.statusFilter);
    const setStatusFilter = useFeatureRequestsStore((state) => state.setStatusFilter);
    const priorityFilter = useFeatureRequestsStore((state) => state.priorityFilter);
    const setPriorityFilter = useFeatureRequestsStore((state) => state.setPriorityFilter);
    const sortOrder = useFeatureRequestsStore((state) => state.sortOrder);
    const setSortOrder = useFeatureRequestsStore((state) => state.setSortOrder);

    // Build API filters
    const apiStatusFilter =
        statusFilter === 'all' || statusFilter === 'active'
            ? undefined
            : (statusFilter as FeatureRequestStatus);

    const { data: rawRequests, isLoading, error } = useFeatureRequests({
        status: apiStatusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        sortOrder,
    });

    // Apply client-side filtering for 'active' status
    let requests = rawRequests;
    if (statusFilter === 'active' && rawRequests) {
        requests = rawRequests.filter((r) => activeStatuses.includes(r.status as FeatureRequestStatus));
    }

    // Apply client-side priority filter if we fetched all
    if (priorityFilter !== 'all' && requests) {
        requests = requests.filter((r) => r.priority === priorityFilter);
    }

    const showLoading = isLoading || requests === undefined;

    return (
        <div className="space-y-4 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-yellow-500" />
                    <h1 className="text-xl font-semibold">Feature Requests</h1>
                    {!showLoading && requests && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
                            {requests.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilterOption)}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={priorityFilter}
                    onValueChange={(value) =>
                        setPriorityFilter(value as FeatureRequestPriority | 'all')
                    }
                >
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
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
            ) : requests?.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">No feature requests found.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests?.map((request) => (
                        <FeatureRequestCard key={request._id} request={request} />
                    ))}
                </div>
            )}
        </div>
    );
}
