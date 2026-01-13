import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import {
    ChevronRight,
    CheckCheck,
    Play,
} from 'lucide-react';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';
import type { ExerciseWeekProgressFromStore } from '@/client/features/plan-data';
import { ExerciseCardList } from './ExerciseCard';

export interface PlanWorkoutCardProps {
    workout: PlanWorkoutClient;
    exercises: ExerciseWeekProgressFromStore[];
    onStart: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    // Exercise action handlers
    onAddSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onRemoveSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onCompleteAll: (exercise: ExerciseWeekProgressFromStore) => void;
    onOpenDetails: (exercise: ExerciseWeekProgressFromStore) => void;
    selectedExerciseIds: string[];
    onToggleSelection: (exerciseId: string) => void;
}

// Extended exercise type for workout-specific display
interface WorkoutExerciseDisplay extends ExerciseWeekProgressFromStore {
    workoutTargetSets: number;  // Sets allocated to THIS workout
    workoutSetsCompleted: number;  // Sets completed in THIS workout
}

export function PlanWorkoutCard({
    workout,
    exercises,
    onStart,
    isExpanded,
    onToggleExpand,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    selectedExerciseIds,
    onToggleSelection,
}: PlanWorkoutCardProps) {
    // Create a map for quick lookup of exercises by planExerciseId
    const exerciseMap = new Map(exercises.map((ex) => [ex.planExerciseId, ex]));

    // Resolve workout items to exercises with workout-specific data
    const resolvedExercises: WorkoutExerciseDisplay[] = workout.items
        .map((item) => {
            const ex = exerciseMap.get(item.planExerciseId);
            if (!ex) return null;

            // Get workout-specific sets completed
            const workoutProgress = ex.workoutSets?.find(
                (w) => w.workoutId === workout._id
            );

            return {
                ...ex,
                workoutTargetSets: item.sets || ex.targetSets,  // Sets allocated to this workout (fallback to weekly target when 0 or undefined)
                workoutSetsCompleted: workoutProgress?.setsCompleted || 0,  // Sets completed in this workout
            };
        })
        .filter((ex): ex is WorkoutExerciseDisplay => ex !== null);

    // Calculate workout progress using workout-specific sets
    const totalSets = resolvedExercises.reduce((sum, ex) => sum + ex.workoutTargetSets, 0);
    const completedSets = resolvedExercises.reduce((sum, ex) => sum + Math.min(ex.workoutSetsCompleted, ex.workoutTargetSets), 0);
    const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    const isWorkoutComplete = totalSets > 0 && completedSets >= totalSets;

    return (
        <Card className={`rounded-xl border-0 shadow-sm overflow-hidden ${isWorkoutComplete ? 'ring-2 ring-success/50' : ''}`}>
            <CardContent className="p-0">
                {/* Header - clickable to expand */}
                <div
                    className="p-4 cursor-pointer active:bg-muted/50 transition-colors"
                    onClick={onToggleExpand}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base truncate">{workout.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{resolvedExercises.length} exercise{resolvedExercises.length !== 1 ? 's' : ''}</span>
                                    {totalSets > 0 && (
                                        <>
                                            <span className="text-muted-foreground/50">•</span>
                                            <span className={completedSets > 0 ? (isWorkoutComplete ? 'text-success' : 'text-primary') : ''}>
                                                {completedSets}/{totalSets} sets
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStart();
                            }}
                            disabled={resolvedExercises.length === 0}
                            className={`h-10 w-10 rounded-full shadow-lg ${
                                isWorkoutComplete
                                    ? 'bg-success text-success-foreground shadow-success/25'
                                    : 'bg-primary text-primary-foreground shadow-primary/25'
                            }`}
                        >
                            {isWorkoutComplete ? <CheckCheck className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>
                    </div>
                    {/* Progress bar */}
                    {totalSets > 0 && (
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    isWorkoutComplete
                                        ? 'bg-success'
                                        : 'bg-gradient-to-r from-primary to-primary/80'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Expandable exercise list - reuses ExerciseCardList for consistency */}
                {isExpanded && (
                    <div className="border-t bg-muted/30 p-3 space-y-2">
                        {resolvedExercises.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No exercises found (they may have been removed from the plan)
                            </div>
                        ) : (
                            resolvedExercises.map((ex) => {
                                // Use workout-specific progress for display
                                const isExerciseDone = ex.workoutSetsCompleted >= ex.workoutTargetSets && ex.workoutTargetSets > 0;
                                // Create a modified exercise with workout-specific values for the card
                                const workoutExercise: ExerciseWeekProgressFromStore = {
                                    ...ex,
                                    targetSets: ex.workoutTargetSets,
                                    setsCompleted: ex.workoutSetsCompleted,
                                };
                                return (
                                    <ExerciseCardList
                                        key={ex.planExerciseId}
                                        exercise={workoutExercise}
                                        onAddSet={() => onAddSet(ex)}
                                        onRemoveSet={() => onRemoveSet(ex)}
                                        onCompleteAll={() => onCompleteAll(ex)}
                                        onOpenDetails={() => onOpenDetails(ex)}
                                        isComplete={isExerciseDone}
                                        isSelected={selectedExerciseIds.includes(ex.planExerciseId)}
                                        onSelect={() => onToggleSelection(ex.planExerciseId)}
                                    />
                                );
                            })
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
