import { Card, CardContent } from '@/client/components/ui/card';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { useActivitySummary } from '../hooks';
import type { DailySummary } from '@/apis/activity-logs/types';
import type { DateRange } from '../store';

function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
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

export interface DailySummariesProps {
    dateRange: DateRange;
}

export function DailySummaries({ dateRange }: DailySummariesProps) {
    const { data, isLoading } = useActivitySummary({ aggregation: 'day', period: dateRange });
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
