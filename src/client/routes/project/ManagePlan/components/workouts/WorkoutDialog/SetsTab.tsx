import Image from 'next/image';
import { Button } from '@/client/components/template/ui/button';
import { Dumbbell, AlertTriangle, Plus, Minus } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';

interface SetsTabProps {
    planExercises: PlanExerciseWithDefinition[];
    selectedExercises: Map<string, number | undefined>;
    allocationMap: Map<string, number>;
    onSetsChange: (exerciseId: string, sets: number) => void;
}

export function SetsTab({
    planExercises,
    selectedExercises,
    allocationMap,
    onSetsChange,
}: SetsTabProps) {
    // Filter to only show selected exercises
    const selectedExercisesList = planExercises.filter(ex => selectedExercises.has(ex._id));

    if (selectedExercisesList.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="text-muted-foreground">
                    <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">No exercises selected</p>
                    <p className="text-sm">Select exercises in the Exercises tab</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-muted/30">
            {selectedExercisesList.map((exercise) => {
                const selectedSets = selectedExercises.get(exercise._id) ?? exercise.sets;
                const alreadyAllocated = allocationMap.get(exercise._id) || 0;
                const totalWithThis = alreadyAllocated + selectedSets;
                const isOverAllocated = totalWithThis > exercise.sets;
                const isFullyAllocated = alreadyAllocated >= exercise.sets;

                return (
                    <div
                        key={exercise._id}
                        className="rounded-xl bg-background border border-border p-4 space-y-3"
                    >
                        {/* Exercise Header */}
                        <div className="flex items-center gap-3">
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
                                <h4 className="font-medium truncate">
                                    {exercise.exerciseDef.name}
                                </h4>
                                <div className="text-sm text-muted-foreground">
                                    {exercise.reps} reps
                                    {exercise.weight > 0 && ` · ${exercise.weight}kg`}
                                </div>
                            </div>
                        </div>

                        {/* Allocation Info - only show if exercise is allocated in other workouts */}
                        {alreadyAllocated > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Already allocated:</span>
                                <span className={`font-medium ${
                                    isFullyAllocated ? 'text-success' : ''
                                }`}>
                                    {alreadyAllocated}/{exercise.sets} sets
                                    {isFullyAllocated && ' ✓'}
                                </span>
                            </div>
                        )}

                        {/* Sets Input with +/- buttons */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-12">Sets:</span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg"
                                    onClick={() => onSetsChange(exercise._id, Math.max(0, selectedSets - 1))}
                                    disabled={selectedSets === 0}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <div className="w-16 h-9 flex items-center justify-center font-medium text-base bg-muted rounded-lg">
                                    {selectedSets}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg"
                                    onClick={() => onSetsChange(exercise._id, selectedSets + 1)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                                / {exercise.sets} weekly
                            </span>
                        </div>

                        {/* Over-allocation warning */}
                        {isOverAllocated && (
                            <div className="flex items-center gap-2 text-xs rounded-lg p-2 border border-border/50 text-[oklch(0.47_0.14_51.32)] dark:text-[oklch(0.70_0.14_51.32)]">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                <span className="font-medium">
                                    Total: {totalWithThis} sets exceeds weekly allocation of {exercise.sets} sets
                                </span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
