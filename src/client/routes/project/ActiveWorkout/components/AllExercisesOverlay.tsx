import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/ui/dialog';
import {
    Dumbbell,
    ArrowLeft,
    Check,
    ChevronUp,
    ChevronDown,
    GripVertical,
    Trash2,
} from 'lucide-react';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

export interface AllExercisesOverlayProps {
    exercises: ExerciseWeekProgress[];
    currentIndex: number;
    onSelectExercise: (index: number) => void;
    onReorderExercises: (nextExercises: ExerciseWeekProgress[]) => void;
    onRemoveExercise: (planExerciseId: string) => void;
    canAddFromPlan: boolean;
    planWeekExercises: ExerciseWeekProgress[];
    isSavedWorkout: boolean;
    onAddExercise: (exercise: ExerciseWeekProgress) => void;
    onBack: () => void;
}

export function AllExercisesOverlay({
    exercises,
    currentIndex,
    onSelectExercise,
    onReorderExercises,
    onRemoveExercise,
    canAddFromPlan,
    planWeekExercises,
    isSavedWorkout,
    onAddExercise,
    onBack,
}: AllExercisesOverlayProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- route-local UI mode
    const [reorderMode, setReorderMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- route-local dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const moveExercise = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= exercises.length) return;
        const next = [...exercises];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return;
        next.splice(toIndex, 0, moved);
        onReorderExercises(next);
    };

    return (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-lg font-semibold truncate">All Exercises</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddDialogOpen(true)}
                        disabled={!canAddFromPlan}
                    >
                        Add exercise
                    </Button>
                    <Button
                        variant={reorderMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setReorderMode((v) => !v)}
                    >
                        {reorderMode ? 'Done' : 'Edit'}
                    </Button>
                </div>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isSavedWorkout ? (
                    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        Changes here affect the <span className="font-medium text-foreground">active workout</span> only and won&apos;t update your saved workout.
                    </div>
                ) : null}
                {exercises.map((exercise, index) => {
                    const isComplete = exercise.setsCompleted >= exercise.targetSets;
                    const isCurrent = index === currentIndex;

                    const rowClassName = `w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        isCurrent ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted'
                    }`;

                    return (
                        <div key={exercise.planExerciseId} className={rowClassName}>
                            {reorderMode ? (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <GripVertical className="h-4 w-4 text-muted-foreground/70" />
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => moveExercise(index, index - 1)}
                                            disabled={index === 0}
                                            aria-label="Move up"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => moveExercise(index, index + 1)}
                                            disabled={index === exercises.length - 1}
                                            aria-label="Move down"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                        onClick={() => onRemoveExercise(exercise.planExerciseId)}
                                        aria-label="Remove from workout"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : null}
                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                {exercise.exerciseDef.imageUrl ? (
                                    <img
                                        src={exercise.exerciseDef.imageUrl}
                                        alt=""
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                disabled={reorderMode}
                                onClick={() => onSelectExercise(index)}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium truncate">{exercise.exerciseDef.name}</p>
                                        {isComplete && <Check className="h-4 w-4 text-success flex-shrink-0" />}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {exercise.planExercise.reps} reps
                                        {exercise.planExercise.weight > 0 && ` · ${exercise.planExercise.weight}kg`}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0">
                                <span className={`text-lg font-bold tabular-nums ${isComplete ? 'text-success' : ''}`}>
                                    {exercise.setsCompleted}/{exercise.targetSets}
                                </span>
                                {/* Mini dots */}
                                <div className="flex gap-0.5 mt-1">
                                    {Array.from({ length: exercise.targetSets }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-1.5 h-1.5 rounded-full ${
                                                i < exercise.setsCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Add Exercise Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add exercise</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {[...planWeekExercises]
                            .filter((exercise) => !exercises.some((ex) => ex.planExerciseId === exercise.planExerciseId))
                            .sort((a, b) => {
                                const aLeft = Math.max(0, a.targetSets - a.setsCompleted);
                                const bLeft = Math.max(0, b.targetSets - b.setsCompleted);
                                if (bLeft !== aLeft) return bLeft - aLeft; // Most sets left first
                                return a.exerciseDef.name.localeCompare(b.exerciseDef.name);
                            })
                            .map((exercise) => (
                                (() => {
                                    const isComplete = exercise.setsCompleted >= exercise.targetSets;
                                    return (
                                <div
                                    key={exercise.planExerciseId}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 bg-card"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border/40 flex-shrink-0">
                                            {exercise.exerciseDef.imageUrl ? (
                                                <img
                                                    src={exercise.exerciseDef.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate">{exercise.exerciseDef.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {exercise.targetSets} sets · {exercise.planExercise.reps} reps
                                                {exercise.planExercise.weight > 0 && ` · ${exercise.planExercise.weight}kg`}
                                            </p>
                                        </div>
                                    </div>
                                    {isComplete ? (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Check className="h-4 w-4 text-success" />
                                            <span className="text-xs font-medium text-success">Done</span>
                                        </div>
                                    ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            onAddExercise(exercise);
                                            setAddDialogOpen(false);
                                        }}
                                    >
                                        Add
                                    </Button>
                                    )}
                                </div>
                                    );
                                })()
                            ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
