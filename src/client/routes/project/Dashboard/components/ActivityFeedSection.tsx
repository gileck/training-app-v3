/**
 * Activity Feed Section Component
 *
 * Activity timeline with filter tabs, scrollable list,
 * and polling indicator for "real-time" updates.
 */

import { useMemo } from 'react';
import { Card } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { RefreshCw, Activity as ActivityIcon } from 'lucide-react';
import { ActivityItem } from './ActivityItem';
import { useDashboardStore } from '../store';
import { filterActivities, getActivityTypeOptions } from '../utils/generateActivities';
import type { Activity, ActivityType } from '../types';

interface ActivityFeedSectionProps {
    activities: Activity[];
    isRefetching?: boolean;
}

export function ActivityFeedSection({ activities, isRefetching }: ActivityFeedSectionProps) {
    const activityTypeFilter = useDashboardStore((s) => s.activityTypeFilter);
    const setActivityTypeFilter = useDashboardStore((s) => s.setActivityTypeFilter);

    const filterOptions = getActivityTypeOptions();

    // Filter activities based on selected type
    const filteredActivities = useMemo(
        () => filterActivities(activities, activityTypeFilter),
        [activities, activityTypeFilter]
    );

    return (
        <Card className="p-4">
            {/* Header with title and filter tabs */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <ActivityIcon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Recent Activity</h3>
                    {isRefetching && (
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Filter tabs - horizontal scroll on mobile */}
                <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {filterOptions.map((option) => (
                        <Button
                            key={option.value}
                            variant={activityTypeFilter === option.value ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 min-w-fit flex-shrink-0 px-3 text-xs"
                            onClick={() => setActivityTypeFilter(option.value as ActivityType | 'all')}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Activity list with scrollable container */}
            {filteredActivities.length > 0 ? (
                <div className="mt-4 h-[320px] overflow-y-auto pr-2">
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                        {/* Activity items */}
                        <div className="space-y-1">
                            {filteredActivities.map((activity) => (
                                <ActivityItem key={activity.id} activity={activity} />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mt-4 flex h-[200px] flex-col items-center justify-center rounded-md bg-muted/30">
                    <ActivityIcon className="h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                        No activities found
                    </p>
                    {activityTypeFilter !== 'all' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => setActivityTypeFilter('all')}
                        >
                            Show all activities
                        </Button>
                    )}
                </div>
            )}

            {/* Footer with activity count */}
            {filteredActivities.length > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>
                        Showing {filteredActivities.length} of {activities.length} activities
                    </span>
                    <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Updates every 30s
                    </span>
                </div>
            )}
        </Card>
    );
}
