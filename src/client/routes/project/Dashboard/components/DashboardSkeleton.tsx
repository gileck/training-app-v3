/**
 * Dashboard Skeleton Component
 *
 * Loading state for the dashboard with skeleton placeholders.
 */

import { Skeleton } from '@/client/components/ui/skeleton';
import { Card } from '@/client/components/ui/card';

/**
 * Skeleton for a single metric card
 */
function MetricCardSkeleton() {
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
        </Card>
    );
}

/**
 * Skeleton for a chart section
 */
function ChartSkeleton() {
    return (
        <Card className="p-4">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-48 w-full" />
        </Card>
    );
}

/**
 * Skeleton for the activity feed
 */
function ActivityFeedSkeleton() {
    return (
        <Card className="p-4">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

/**
 * Full dashboard skeleton
 */
export function DashboardSkeleton() {
    return (
        <div className="space-y-4">
            {/* Header skeleton */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-8 w-40" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            {/* Metrics cards skeleton - 2 columns on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
            </div>

            {/* Charts skeleton - 1 column on mobile, 2 on desktop */}
            <div className="grid gap-4 md:grid-cols-2">
                <ChartSkeleton />
                <ChartSkeleton />
            </div>

            {/* Activity feed skeleton */}
            <ActivityFeedSkeleton />
        </div>
    );
}

export { MetricCardSkeleton, ChartSkeleton, ActivityFeedSkeleton };
