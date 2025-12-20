import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Activity, Calendar, TrendingUp, Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { useActivity, useActivitySummary } from './hooks';
import type { ActivityLogEntry, DailySummary } from '@/apis/activity-logs/types';

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

function ActivityItem({ activity }: { activity: ActivityLogEntry }) {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
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
                <p className="text-sm text-muted-foreground">
                    Set {activity.setNumber} • {activity.planName}
                </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
                <p>{formatTime(activity.completedAt)}</p>
            </div>
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

function ActivityLog() {
    const { data, isLoading } = useActivity({ limit: 50 });
    const activities = data?.activities || [];

    if (isLoading) {
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
            {Object.entries(groupedByDate).map(([date, dayActivities]) => (
                <Card key={date} className="rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {date}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {dayActivities.map((activity) => (
                            <ActivityItem key={activity._id} activity={activity} />
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function DailySummaries() {
    const { data, isLoading } = useActivitySummary({ period: 'day' });
    const summaries = data?.summaries || [];

    if (isLoading) {
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

export function Progress() {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral tab state
    const [activeTab, setActiveTab] = useState('activity');

    return (
        <div className="p-4 pb-20">
            <h1 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress
            </h1>

            <StatsOverview />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-4">
                    <TabsTrigger value="activity" className="flex-1">
                        <Activity className="h-4 w-4 mr-2" />
                        Activity
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="flex-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        Summary
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-0">
                    <ActivityLog />
                </TabsContent>

                <TabsContent value="summary" className="mt-0">
                    <DailySummaries />
                </TabsContent>
            </Tabs>
        </div>
    );
}


