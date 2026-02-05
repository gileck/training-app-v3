import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Check, Dumbbell } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';

interface ExercisesTabProps {
    planExercises: PlanExerciseWithDefinition[];
    selectedExercises: Map<string, number | undefined>;
    allocationMap: Map<string, number>;
    onToggleExercise: (id: string, exercise: PlanExerciseWithDefinition) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
}

export function ExercisesTab({
    planExercises,
    selectedExercises,
    allocationMap,
    onToggleExercise,
    onSelectAll,
    onDeselectAll,
}: ExercisesTabProps) {
    if (planExercises.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="text-muted-foreground">
                    <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No exercises in plan</p>
                </div>
            </div>
        );
    }

    // Split exercises into selected and non-selected
    const selectedExercisesList = planExercises.filter(ex => selectedExercises.has(ex._id));
    const nonSelectedExercisesList = planExercises.filter(ex => !selectedExercises.has(ex._id));

    const renderExercise = (exercise: PlanExerciseWithDefinition) => {
        const isSelected = selectedExercises.has(exercise._id);
        const selectedSets = selectedExercises.get(exercise._id) ?? exercise.sets;
        const alreadyAllocated = allocationMap.get(exercise._id) || 0;
        const isFullyAllocated = alreadyAllocated >= exercise.sets;
        const totalWithThis = alreadyAllocated + (isSelected ? selectedSets : 0);
        const isOverAllocated = totalWithThis > exercise.sets;

        return (
            <div
                key={exercise._id}
                onClick={() => onToggleExercise(exercise._id, exercise)}
                className={`rounded-xl transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : isFullyAllocated
                            ? 'bg-muted/50 opacity-60'
                            : 'bg-background hover:bg-background/80'
                }`}
            >
                <div className="flex items-center gap-3 p-3">
                    {/* Checkbox */}
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        isSelected
                            ? 'bg-primary border-primary scale-110'
                            : 'border-muted-foreground/20 bg-background'
                    }`}>
                        {isSelected && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
                    </div>

                    {/* Exercise image */}
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative border border-border/50">
                        {exercise.exerciseDef.imageUrl ? (
                            <Image
                                src={exercise.exerciseDef.imageUrl}
                                alt={exercise.exerciseDef.name}
                                fill
                                className="object-contain p-1"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    {/* Exercise info */}
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                            {exercise.exerciseDef.name}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                                {exercise.reps} reps
                                {exercise.weight > 0 && ` · ${exercise.weight}kg`}
                            </span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className={`${
                                isOverAllocated
                                    ? 'text-warning'
                                    : isFullyAllocated
                                        ? 'text-success'
                                        : ''
                            }`}>
                                {alreadyAllocated}/{exercise.sets} allocated
                                {isFullyAllocated && !isSelected && ' ✓'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
            {/* Selection Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
                <span className="text-sm font-medium">
                    {selectedExercises.size === 0
                        ? 'Select exercises'
                        : `${selectedExercises.size} selected`}
                </span>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSelectAll}
                        className="text-xs h-8 px-3 rounded-lg hover:bg-primary/10 hover:text-primary"
                    >
                        All
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDeselectAll}
                        className="text-xs h-8 px-3 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                    >
                        None
                    </Button>
                </div>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {/* Selected Exercises Section */}
                {selectedExercisesList.length > 0 && (
                    <div className="p-4 pb-2">
                        <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 px-1">
                            Selected ({selectedExercisesList.length})
                        </h3>
                        <div className="space-y-2">
                            {selectedExercisesList.map(renderExercise)}
                        </div>
                    </div>
                )}

                {/* Available Exercises Section */}
                {nonSelectedExercisesList.length > 0 && (
                    <div className="p-4 pt-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                            Available ({nonSelectedExercisesList.length})
                        </h3>
                        <div className="space-y-2">
                            {nonSelectedExercisesList.map(renderExercise)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
