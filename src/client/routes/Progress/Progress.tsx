import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Button } from '@/client/components/ui/button';
import { Activity, Calendar, TrendingUp, Dumbbell, BarChart3, ChevronDown, ChevronRight, Trash2, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActivity, useActivitySummary, useDeleteActivity } from './hooks';
import { useProgressStore } from './store';
import type { DateRange, ProgressTab } from './store';
import type { ActivityLogEntry, DailySummary } from '@/apis/activity-logs/types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';

const dateRangeLabels: Record<DateRange, string> = {
    '7days': 'Last 7 days',
    '14days': 'Last 14 days',
    '30days': 'Last 30 days',
    '90days': 'Last 90 days',
    'all': 'All time',
};

function getDateRange(range: DateRange): { startDate?: string; endDate?: string } {
    if (range === 'all') return {};
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '7days':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '14days':
            startDate.setDate(startDate.getDate() - 14);
            break;
        case '30days':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '90days':
            startDate.setDate(startDate.getDate() - 90);
            break;
    }
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
}

function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface ActivityGroup {
    type: 'single' | 'grouped';
    exerciseName: string;
    activities: ActivityLogEntry[];
    firstTime: string;
}

/**
 * Groups consecutive activities by exercise name if they are within 10 minutes of each other.
 * Non-consecutive exercises or exercises more than 10 minutes apart are not grouped.
 */
function groupConsecutiveActivities(activities: ActivityLogEntry[]): ActivityGroup[] {
    if (activities.length === 0) return [];

    const MAX_TIME_GAP_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
    const groups: ActivityGroup[] = [];
    let currentGroup: ActivityLogEntry[] = [activities[0]];

    for (let i = 1; i < activities.length; i++) {
        const current = activities[i];
        const previous = activities[i - 1];

        const currentTime = new Date(current.completedAt).getTime();
        const previousTime = new Date(previous.completedAt).getTime();
        const timeDiff = Math.abs(currentTime - previousTime);

        const sameExercise = current.exerciseName === previous.exerciseName;
        const withinTimeLimit = timeDiff <= MAX_TIME_GAP_MS;

        if (sameExercise && withinTimeLimit) {
            // Add to current group
            currentGroup.push(current);
        } else {
            // Finalize current group and start a new one
            groups.push({
                type: currentGroup.length > 1 ? 'grouped' : 'single',
                exerciseName: currentGroup[0].exerciseName,
                activities: currentGroup,
                firstTime: currentGroup[0].completedAt,
            });
            currentGroup = [current];
        }
    }

    // Don't forget to add the last group
    groups.push({
        type: currentGroup.length > 1 ? 'grouped' : 'single',
        exerciseName: currentGroup[0].exerciseName,
        activities: currentGroup,
        firstTime: currentGroup[0].completedAt,
    });

    return groups;
}

function ActivityItem({
    activity,
    onDelete,
    showPlanName = true,
}: {
    activity: ActivityLogEntry;
    onDelete?: (id: string) => void;
    showPlanName?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 group">
            <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {activity.exerciseImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={activity.exerciseImageUrl}
                        alt={activity.exerciseName}
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activity.exerciseName}</p>
                {showPlanName && (
                    <p className="text-sm text-muted-foreground">
                        {activity.planName}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2">
                <div className="text-right text-sm text-muted-foreground">
                    <p>{formatTime(activity.completedAt)}</p>
                </div>
                {onDelete && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(activity._id)}
                        className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function GroupedActivityItem({
    group,
    onDelete,
}: {
    group: ActivityGroup;
    onDelete?: (id: string) => void;
}) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral expand/collapse state
    const [isExpanded, setIsExpanded] = useState(false);
    const firstActivity = group.activities[0];

    // Single activity - no grouping UI
    if (group.type === 'single') {
        return <ActivityItem activity={firstActivity} onDelete={onDelete} />;
    }

    // Grouped activities
    return (
        <div className="border-b border-border/50 last:border-0">
            {/* Collapsed header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/50 transition-colors rounded-lg -mx-2 px-2"
            >
                <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {firstActivity.exerciseImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={firstActivity.exerciseImageUrl}
                            alt={firstActivity.exerciseName}
                            className="h-full w-full object-contain"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center">
                            <Dumbbell className="h-5 w-5 text-muted-foreground" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                        {group.exerciseName}
                        <span className="text-muted-foreground ml-1">(x{group.activities.length})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {firstActivity.planName}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right text-sm text-muted-foreground">
                        <p>{formatTime(group.firstTime)}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="pl-4 border-l-2 border-muted ml-5 mb-2">
                    {group.activities.map((activity) => (
                        <div key={activity._id} className="flex items-center gap-3 py-2 group">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{activity.exerciseName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right text-sm text-muted-foreground">
                                    <p>{formatTime(activity.completedAt)}</p>
                                </div>
                                {onDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onDelete(activity._id)}
                                        className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DaySummaryCard({ summary }: { summary: DailySummary }) {
    return (
        <Card className="rounded-xl">
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="font-semibold">{formatDate(summary.date)}</p>
                        <p className="text-sm text-muted-foreground">
                            {summary.totalExercises} exercise{summary.totalExercises !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{summary.totalSets}</p>
                        <p className="text-sm text-muted-foreground">sets</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1">
                    {summary.muscleGroups.map((muscle) => (
                        <Badge
                            key={muscle}
                            variant="outline"
                            className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)] dark:border-[hsl(210,100%,30%)] text-xs"
                        >
                            {muscle}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function ActivityLog({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivity({ limit: 50, startDate, endDate });
    const deleteActivityMutation = useDeleteActivity();
    const activities = data?.activities || [];

    const handleDelete = (activityId: string) => {
        deleteActivityMutation.mutate({ activityId });
    };

    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Only show empty state when data has been fetched and is truly empty
    if (activities.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        Complete some sets to see your activity log
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Group activities by date
    const groupedByDate = activities.reduce((acc, activity) => {
        const date = formatDate(activity.completedAt);
        if (!acc[date]) acc[date] = [];
        acc[date].push(activity);
        return acc;
    }, {} as Record<string, ActivityLogEntry[]>);

    return (
        <div className="space-y-4">
            {Object.entries(groupedByDate).map(([date, dayActivities]) => {
                // Group consecutive exercises within each day
                const groupedActivities = groupConsecutiveActivities(dayActivities);

                return (
                    <Card key={date} className="rounded-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {date}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {groupedActivities.map((group, index) => (
                                <GroupedActivityItem
                                    key={`${group.exerciseName}-${group.firstTime}-${index}`}
                                    group={group}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

function DailySummaries({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivitySummary({ period: 'day', startDate, endDate });
    const summaries = data?.summaries || [];

    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-xl">
                        <CardContent className="p-4">
                            <div className="flex justify-between mb-3">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                                <Skeleton className="h-10 w-10" />
                            </div>
                            <div className="flex gap-1">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // Only show empty state when data has been fetched and is truly empty
    if (summaries.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No data yet</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        Complete some workouts to see your progress
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {summaries.map((summary) => (
                <DaySummaryCard key={summary.date} summary={summary} />
            ))}
        </div>
    );
}

function StatsOverview() {
    const { data, isLoading } = useActivitySummary({ period: 'week' });

    const totalSets = data?.totalSets ?? 0;
    const totalDays = data?.totalWorkoutDays ?? 0;
    const hasData = data !== undefined;

    // Show skeleton when loading
    if (!hasData || isLoading) {
        return (
            <div className="grid grid-cols-2 gap-3 mb-6">
                <Card className="rounded-xl">
                    <CardContent className="p-4 text-center">
                        <Skeleton className="h-9 w-12 mx-auto mb-1" />
                        <Skeleton className="h-4 w-20 mx-auto" />
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4 text-center">
                        <Skeleton className="h-9 w-12 mx-auto mb-1" />
                        <Skeleton className="h-4 w-24 mx-auto" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{totalSets}</p>
                    <p className="text-sm text-muted-foreground">Total Sets</p>
                </CardContent>
            </Card>
            <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{totalDays}</p>
                    <p className="text-sm text-muted-foreground">Workout Days</p>
                </CardContent>
            </Card>
        </div>
    );
}

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ProgressCharts({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivitySummary({ period: 'day', startDate, endDate });
    const summaries = data?.summaries || [];

    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return (
            <div className="space-y-4">
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <Skeleton className="h-5 w-32 mb-4" />
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Only show empty state when data has been fetched and is truly empty
    if (summaries.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No data for charts</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        Complete some workouts to see your progress visualized
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Prepare chart data - last 14 days
    const chartData = summaries.slice(0, 14).reverse().map((summary) => ({
        date: formatShortDate(summary.date),
        sets: summary.totalSets,
        exercises: summary.totalExercises,
    }));

    // Calculate muscle group frequency
    const muscleFrequency: Record<string, number> = {};
    summaries.forEach((summary) => {
        summary.muscleGroups.forEach((muscle) => {
            muscleFrequency[muscle] = (muscleFrequency[muscle] || 0) + 1;
        });
    });

    const muscleData = Object.entries(muscleFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([muscle, count]) => ({ muscle, count }));

    return (
        <div className="space-y-4">
            {/* Sets per day chart */}
            <Card className="rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Daily Sets (Last 14 Days)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                tickLine={{ stroke: 'hsl(var(--border))' }}
                            />
                            <YAxis 
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                tickLine={{ stroke: 'hsl(var(--border))' }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar 
                                dataKey="sets" 
                                fill="hsl(var(--primary))" 
                                radius={[4, 4, 0, 0]}
                                name="Sets"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Muscle groups chart */}
            {muscleData.length > 0 && (
                <Card className="rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Dumbbell className="h-4 w-4" />
                            Muscle Groups Trained
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={muscleData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis 
                                    type="number"
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    axisLine={{ stroke: 'hsl(var(--border))' }}
                                    tickLine={{ stroke: 'hsl(var(--border))' }}
                                />
                                <YAxis 
                                    type="category"
                                    dataKey="muscle" 
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    axisLine={{ stroke: 'hsl(var(--border))' }}
                                    tickLine={{ stroke: 'hsl(var(--border))' }}
                                    width={70}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Bar 
                                    dataKey="count" 
                                    fill="hsl(210, 100%, 50%)" 
                                    radius={[0, 4, 4, 0]}
                                    name="Days Trained"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

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

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral refresh state
    const [isRefreshing, setIsRefreshing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral timestamp
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    
    const queryClient = useQueryClient();
    
    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Invalidate all activity-related queries to trigger refetch
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['activity'] }),
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] }),
        ]);
        setLastRefreshed(new Date());
        setIsRefreshing(false);
    };

    return (
        <div className="p-4 pb-20">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Progress
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Updated {formatLastUpdated(lastRefreshed)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-9 w-9 rounded-lg"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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

            <StatsOverview />

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


