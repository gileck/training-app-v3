import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/template/ui/tabs';
import { Button } from '@/client/components/template/ui/button';
import {
    Activity,
    Calendar,
    TrendingUp,
    BarChart3,
    ChevronDown,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useActivitySummary } from './hooks';
import { useProgressStore } from './store';
import type { DateRange, ProgressTab } from './store';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import { ActivityLog } from './components/ActivityLog';
import { DailySummaries } from './components/DailySummaries';
import { StatsOverview, ProgressCharts } from './components/ProgressCharts';

const dateRangeLabels: Record<DateRange, string> = {
    '7days': 'Last 7 days',
    '14days': 'Last 14 days',
    '30days': 'Last 30 days',
    '90days': 'Last 90 days',
    'all': 'All time',
};

function formatLastUpdated(date: Date | undefined): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Progress() {
    // Persistent UI state from store
    const activeTab = useProgressStore((state) => state.activeTab);
    const setActiveTab = useProgressStore((state) => state.setActiveTab);
    const dateRange = useProgressStore((state) => state.dateRange);
    const setDateRange = useProgressStore((state) => state.setDateRange);

    // Track background fetching state for refresh indicator
    // This uses the same query key as StatsOverview, so it shares cache
    const { isFetching: isBackgroundFetching, dataUpdatedAt } = useActivitySummary({
        aggregation: 'day',
        period: dateRange,
    });

    const queryClient = useQueryClient();

    // Show last updated time based on actual data
    const lastUpdatedDate = dataUpdatedAt ? new Date(dataUpdatedAt) : undefined;

    const handleRefresh = async () => {
        // Invalidate all activity-related queries to trigger refetch
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['activity'] }),
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] }),
        ]);
    };

    return (
        <div className="p-4 pb-20">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Progress
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        {isBackgroundFetching ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Refreshing...
                            </>
                        ) : (
                            <>Updated {formatLastUpdated(lastUpdatedDate)}</>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isBackgroundFetching}
                        className="h-9 w-9 rounded-lg"
                    >
                        <RefreshCw className={`h-4 w-4 ${isBackgroundFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-lg">
                                <Calendar className="h-4 w-4 mr-2" />
                                {dateRangeLabels[dateRange]}
                                <ChevronDown className="h-4 w-4 ml-2" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {(Object.keys(dateRangeLabels) as DateRange[]).map((range) => (
                                <DropdownMenuItem
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={dateRange === range ? 'bg-accent' : ''}
                                >
                                    {dateRangeLabels[range]}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <StatsOverview dateRange={dateRange} />

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProgressTab)}>
                <TabsList className="w-full mb-4">
                    <TabsTrigger value="activity" className="flex-1">
                        <Activity className="h-4 w-4 mr-2" />
                        Activity
                    </TabsTrigger>
                    <TabsTrigger value="charts" className="flex-1">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Charts
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="flex-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        Summary
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-0">
                    <ActivityLog dateRange={dateRange} />
                </TabsContent>

                <TabsContent value="charts" className="mt-0">
                    <ProgressCharts dateRange={dateRange} />
                </TabsContent>

                <TabsContent value="summary" className="mt-0">
                    <DailySummaries dateRange={dateRange} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
