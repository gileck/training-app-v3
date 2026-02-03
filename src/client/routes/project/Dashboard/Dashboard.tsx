/**
 * Dashboard Page Component
 *
 * Main analytics dashboard with metrics, charts, and activity feed.
 * Phase 3: Added activity feed with filtering and CSV export.
 */

import { Alert, AlertDescription } from '@/client/components/ui/alert';
import {
    DashboardHeader,
    DashboardSkeleton,
    MetricsSection,
    ChartsSection,
    ActivityFeedSection,
} from './components';
import { useDashboardAnalytics } from './hooks';

/**
 * Main Dashboard component
 */
export function Dashboard() {
    const { data, isLoading, error, isRefetching } = useDashboardAnalytics();

    // Loading state
    if (isLoading && !data) {
        return (
            <div className="mx-auto max-w-6xl py-4 px-2 sm:px-4">
                <DashboardSkeleton />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="mx-auto max-w-6xl py-4 px-2 sm:px-4">
                <DashboardHeader />
                <Alert variant="destructive" className="mt-4">
                    <AlertDescription>
                        Failed to load dashboard data: {error.message}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Empty state (no data)
    if (!data) {
        return (
            <div className="mx-auto max-w-6xl py-4 px-2 sm:px-4">
                <DashboardHeader />
                <Alert variant="info" className="mt-4">
                    <AlertDescription>
                        No data available for the selected date range. Try expanding the date range.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl py-4 px-2 sm:px-4 pb-20 sm:pb-4">
            <DashboardHeader />

            {/* Metrics cards - 2 columns on mobile, 4 on desktop */}
            <div className="mt-4">
                <MetricsSection data={data} />
            </div>

            {/* Interactive charts - 1 column on mobile, 2 on desktop */}
            <div className="mt-4">
                <ChartsSection data={data} />
            </div>

            {/* Activity feed with filtering */}
            <div className="mt-4">
                <ActivityFeedSection
                    activities={data.activities || []}
                    isRefetching={isRefetching}
                />
            </div>
        </div>
    );
}
