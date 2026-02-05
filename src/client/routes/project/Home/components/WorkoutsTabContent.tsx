import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import { Settings2, Plus, Bookmark } from 'lucide-react';
import { PlanWorkoutCard } from './PlanWorkoutCard';
import type { PlanWorkoutClient } from '@/server/database/collections/project/planWorkouts/types';
import type { ExerciseWeekProgressFromStore } from '@/client/features/project/plan-data';

interface WorkoutsTabContentProps {
    isLoading: boolean;
    dataLoaded: boolean;
    planWorkoutsList: PlanWorkoutClient[];
    exercises: ExerciseWeekProgressFromStore[];
    weekWorkoutSets: Record<string, Record<string, number>>;
    expandedWorkoutId: string | null;
    onToggleExpand: (workoutId: string) => void;
    onStartWorkout: (
        exercises: ExerciseWeekProgressFromStore[],
        planWorkoutId: string,
        planWorkoutName: string
    ) => void;
    onAddSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onRemoveSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onCompleteAll: (exercise: ExerciseWeekProgressFromStore) => void;
    onOpenDetails: (exercise: ExerciseWeekProgressFromStore) => void;
    selectedExerciseIds: string[];
    onToggleSelection: (id: string) => void;
    onNavigateToManageWorkouts: () => void;
}

export function WorkoutsTabContent({
    isLoading,
    dataLoaded,
    planWorkoutsList,
    exercises,
    weekWorkoutSets,
    expandedWorkoutId,
    onToggleExpand,
    onStartWorkout,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    selectedExerciseIds,
    onToggleSelection,
    onNavigateToManageWorkouts,
}: WorkoutsTabContentProps) {
    return (
        <div className="space-y-4">
            {/* Create Workout Button */}
            <Button
                onClick={onNavigateToManageWorkouts}
                variant="outline"
                className="w-full h-12 rounded-xl"
            >
                <Settings2 className="mr-2 h-5 w-5" />
                Manage Workouts
            </Button>

            {/* Loading State - show skeleton when loading without cached data */}
            {(isLoading || !dataLoaded) && (
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <Card key={i} className="rounded-xl border-0 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State - only show when data loaded AND truly empty */}
            {dataLoaded && planWorkoutsList.length === 0 && (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Saved Workouts</h3>
                        <p className="text-sm text-muted-foreground text-center mb-4">
                            Create workouts from your exercises to quickly start sessions
                        </p>
                        <Button onClick={onNavigateToManageWorkouts} className="rounded-xl">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Workout
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Plan Workouts List */}
            {dataLoaded && planWorkoutsList.length > 0 && (
                <div className="space-y-3">
                    {planWorkoutsList.map((workout) => {
                        // Map plan workout items to exercises using week data
                        const exerciseMap = new Map(exercises.map((ex) => [ex.planExerciseId, ex]));
                        const workoutExercises: ExerciseWeekProgressFromStore[] = workout.items
                            .map((item) => exerciseMap.get(item.planExerciseId))
                            .filter((ex): ex is ExerciseWeekProgressFromStore => ex !== undefined);

                        return (
                            <PlanWorkoutCard
                                key={workout._id}
                                workout={workout}
                                exercises={exercises}
                                workoutSets={weekWorkoutSets[workout._id] || {}}
                                isExpanded={expandedWorkoutId === workout._id}
                                onToggleExpand={() =>
                                    onToggleExpand(expandedWorkoutId === workout._id ? '' : workout._id)
                                }
                                onStart={() => {
                                    if (workoutExercises.length === 0) return;
                                    onStartWorkout(workoutExercises, workout._id, workout.name);
                                }}
                                onAddSet={onAddSet}
                                onRemoveSet={onRemoveSet}
                                onCompleteAll={onCompleteAll}
                                onOpenDetails={onOpenDetails}
                                selectedExerciseIds={selectedExerciseIds}
                                onToggleSelection={onToggleSelection}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
