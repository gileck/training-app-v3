import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Plus, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { ExerciseCardGrid, ExerciseCardList } from './ExerciseCard';
import type { ExerciseWeekProgressFromStore } from '@/client/features/project/plan-data';

interface ExercisesTabContentProps {
    viewMode: 'grid' | 'list';
    exercises: ExerciseWeekProgressFromStore[];
    incompleteExercises: ExerciseWeekProgressFromStore[];
    completedExercises: ExerciseWeekProgressFromStore[];
    skippedExercises: ExerciseWeekProgressFromStore[];
    selectedExerciseIds: string[];
    onToggleSelection: (id: string) => void;
    onAddSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onRemoveSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onCompleteAll: (exercise: ExerciseWeekProgressFromStore) => void;
    onOpenDetails: (exercise: ExerciseWeekProgressFromStore) => void;
    onNavigateToAddExercises: () => void;
}

export function ExercisesTabContent({
    viewMode,
    exercises,
    incompleteExercises,
    completedExercises,
    skippedExercises,
    selectedExerciseIds,
    onToggleSelection,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    onNavigateToAddExercises,
}: ExercisesTabContentProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [completedExpanded, setCompletedExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [skippedExpanded, setSkippedExpanded] = useState(false);

    return (
        <div className="space-y-4">
            {/* No exercises */}
            {exercises.length === 0 && (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No exercises in this plan</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            Add exercises to start tracking your workouts
                        </p>
                        <Button onClick={onNavigateToAddExercises}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Exercises
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Incomplete Exercises */}
            {incompleteExercises.length > 0 && (
                <div className="space-y-3">
                    {incompleteExercises.map((exercise) =>
                        viewMode === 'grid' ? (
                            <ExerciseCardGrid
                                key={exercise.planExerciseId}
                                exercise={exercise}
                                onAddSet={() => onAddSet(exercise)}
                                onRemoveSet={() => onRemoveSet(exercise)}
                                onCompleteAll={() => onCompleteAll(exercise)}
                                onOpenDetails={() => onOpenDetails(exercise)}
                                isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                onSelect={() => onToggleSelection(exercise.planExerciseId)}
                            />
                        ) : (
                            <ExerciseCardList
                                key={exercise.planExerciseId}
                                exercise={exercise}
                                onAddSet={() => onAddSet(exercise)}
                                onRemoveSet={() => onRemoveSet(exercise)}
                                onCompleteAll={() => onCompleteAll(exercise)}
                                onOpenDetails={() => onOpenDetails(exercise)}
                                isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                onSelect={() => onToggleSelection(exercise.planExerciseId)}
                            />
                        )
                    )}
                </div>
            )}

            {/* Completed Exercises Section */}
            {completedExercises.length > 0 && (
                <div className="space-y-3">
                    <button
                        onClick={() => setCompletedExpanded(!completedExpanded)}
                        className="flex items-center justify-between w-full py-2 text-left"
                    >
                        <span className="text-sm font-medium text-muted-foreground">
                            Completed Exercises ({completedExercises.length})
                        </span>
                        {completedExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {completedExpanded && (
                        <div className="space-y-3">
                            {completedExercises.map((exercise) =>
                                viewMode === 'grid' ? (
                                    <ExerciseCardGrid
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => onAddSet(exercise)}
                                        onRemoveSet={() => onRemoveSet(exercise)}
                                        onCompleteAll={() => {}}
                                        onOpenDetails={() => onOpenDetails(exercise)}
                                        isComplete
                                        isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                        onSelect={() => onToggleSelection(exercise.planExerciseId)}
                                    />
                                ) : (
                                    <ExerciseCardList
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => onAddSet(exercise)}
                                        onRemoveSet={() => onRemoveSet(exercise)}
                                        onCompleteAll={() => {}}
                                        onOpenDetails={() => onOpenDetails(exercise)}
                                        isComplete
                                        isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                        onSelect={() => onToggleSelection(exercise.planExerciseId)}
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Skipped Exercises Section */}
            {skippedExercises.length > 0 && (
                <div className="space-y-3">
                    <button
                        onClick={() => setSkippedExpanded(!skippedExpanded)}
                        className="flex items-center justify-between w-full py-2 text-left"
                    >
                        <span className="text-sm font-medium text-muted-foreground">
                            Skipped Exercises ({skippedExercises.length})
                        </span>
                        {skippedExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {skippedExpanded && (
                        <div className="space-y-3">
                            {skippedExercises.map((exercise) =>
                                viewMode === 'grid' ? (
                                    <ExerciseCardGrid
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => onAddSet(exercise)}
                                        onRemoveSet={() => onRemoveSet(exercise)}
                                        onCompleteAll={() => onCompleteAll(exercise)}
                                        onOpenDetails={() => onOpenDetails(exercise)}
                                        isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                        onSelect={() => onToggleSelection(exercise.planExerciseId)}
                                    />
                                ) : (
                                    <ExerciseCardList
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => onAddSet(exercise)}
                                        onRemoveSet={() => onRemoveSet(exercise)}
                                        onCompleteAll={() => onCompleteAll(exercise)}
                                        onOpenDetails={() => onOpenDetails(exercise)}
                                        isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                        onSelect={() => onToggleSelection(exercise.planExerciseId)}
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
