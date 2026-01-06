import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';
import {
    TrendingUp,
    Dumbbell,
    BarChart3,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import { useActivitySummary } from '../hooks';
import type { DateRange } from '../store';

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Stats Overview Component
export interface StatsOverviewProps {
    dateRange: DateRange;
}

export function StatsOverview({ dateRange }: StatsOverviewProps) {
    const { data, isLoading } = useActivitySummary({ aggregation: 'day', period: dateRange });

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

// Progress Charts Component
export interface ProgressChartsProps {
    dateRange: DateRange;
}

export function ProgressCharts({ dateRange }: ProgressChartsProps) {
    const { data, isLoading } = useActivitySummary({ aggregation: 'day', period: dateRange });
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
