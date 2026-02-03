import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import { Dumbbell } from 'lucide-react';
import { getMuscleGroups } from '@/apis/exercise-definitions/client';
import type { DailySummary } from '@/apis/activity-logs/types';
import { calculateMuscleGroupData, getIntensityColor } from '../utils/muscleGroupCalculations';
import { useQueryDefaults } from '@/client/query/defaults';

export interface MuscleGroupIntensityChartProps {
    summaries: DailySummary[];
    isLoading?: boolean;
}

export function MuscleGroupIntensityChart({ summaries, isLoading }: MuscleGroupIntensityChartProps) {
    const queryDefaults = useQueryDefaults();

    // Fetch muscle groups from API
    const { data: muscleGroupsData, isLoading: isMuscleGroupsLoading, error } = useQuery({
        queryKey: ['muscle-groups'],
        queryFn: async () => {
            const response = await getMuscleGroups({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        ...queryDefaults,
    });

    const allMuscleGroups = muscleGroupsData?.muscleGroups || [];

    // Calculate muscle group data
    const muscleData = useMemo(() => {
        if (allMuscleGroups.length === 0) return [];
        return calculateMuscleGroupData(summaries, allMuscleGroups);
    }, [summaries, allMuscleGroups]);

    // Show loading state when data is being fetched
    if (isLoading || isMuscleGroupsLoading) {
        return (
            <Card className="rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Muscle Groups Trained
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-2 flex-1" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show error state
    if (error) {
        return (
            <Card className="rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Muscle Groups Trained
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground">
                        Failed to load muscle groups
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Show empty state when no exercises in library
    if (allMuscleGroups.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Muscle Groups Trained
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground">
                        No exercises in library yet
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Show empty state when no workouts
    const hasWorkouts = summaries.length > 0;
    if (!hasWorkouts) {
        return (
            <Card className="rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Muscle Groups Trained
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground mb-4">
                        No workout data for this period. All muscle groups show as untrained.
                    </p>
                    <div className="space-y-2">
                        {muscleData.slice(0, 5).map((item) => (
                            <div key={item.muscle} className="flex items-center gap-3">
                                <span className="text-sm w-24 flex-shrink-0">{item.muscle}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted border border-dashed border-muted-foreground/30" />
                                <span className="text-xs text-muted-foreground w-24 text-right">
                                    Not trained
                                </span>
                            </div>
                        ))}
                        {muscleData.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                                +{muscleData.length - 5} more muscle groups
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Render data state with intensity bars
    return (
        <Card className="rounded-xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Dumbbell className="h-4 w-4" />
                    Muscle Groups Trained
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                    {muscleData.map((item) => {
                        const maxDays = Math.max(...muscleData.map((d) => d.daysCount));
                        const widthPercent = maxDays > 0 ? (item.daysCount / maxDays) * 100 : 0;
                        const colorClass = getIntensityColor(item.intensity);

                        return (
                            <div key={item.muscle} className="flex items-center gap-3">
                                <span className="text-sm w-24 flex-shrink-0 truncate" title={item.muscle}>
                                    {item.muscle}
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${colorClass}`}
                                        style={{ width: `${widthPercent}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground w-24 text-right">
                                    {item.daysCount > 0
                                        ? `${item.daysCount} ${item.daysCount === 1 ? 'day' : 'days'}`
                                        : 'Not trained'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
