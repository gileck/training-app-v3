import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import { Check, Dumbbell, AlertTriangle } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';

interface WorkoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingWorkout: PlanWorkoutClient | null;
    planExercises: PlanExerciseWithDefinition[];
    planWorkouts: PlanWorkoutClient[];
    onSave: (name: string, items: Array<{ planExerciseId: string; order: number; sets: number }>) => void;
    isPending: boolean;
}

export function WorkoutDialog({
    open,
    onOpenChange,
    editingWorkout,
    planExercises,
    planWorkouts,
    onSave,
    isPending,
}: WorkoutDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [workoutName, setWorkoutName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection with sets
    const [selectedExercises, setSelectedExercises] = useState<Map<string, number>>(new Map());

    // Calculate allocated sets per exercise across all workouts (excluding current editing workout)
    const allocationMap = useMemo(() => {
        const allocations = new Map<string, number>();

        for (const workout of planWorkouts) {
            // Skip current workout when editing
            if (editingWorkout && workout._id === editingWorkout._id) continue;

            for (const item of workout.items) {
                // Fallback to exercise's weekly sets for legacy data without per-workout allocation
                const exercise = planExercises.find(pe => pe._id === item.planExerciseId);
                const sets = item.sets || exercise?.sets || 0;
                const current = allocations.get(item.planExerciseId) || 0;
                allocations.set(item.planExerciseId, current + sets);
            }
        }

        return allocations;
    }, [planWorkouts, editingWorkout, planExercises]);

    // Reset form when dialog opens or editingWorkout changes
    useEffect(() => {
        if (open) {
            if (editingWorkout) {
                setWorkoutName(editingWorkout.name);
                // Select exercises with their sets from the editing workout
                const exerciseMap = new Map<string, number>();
                for (const item of editingWorkout.items) {
                    // Only include IDs that still exist in planExercises
                    const exercise = planExercises.find(pe => pe._id === item.planExerciseId);
                    if (exercise) {
                        // Fallback to exercise's weekly sets for legacy data without per-workout allocation
                        exerciseMap.set(item.planExerciseId, item.sets || exercise.sets);
                    }
                }
                setSelectedExercises(exerciseMap);
            } else {
                setWorkoutName('');
                setSelectedExercises(new Map());
            }
        }
    }, [open, editingWorkout, planExercises]);

    const handleToggleExercise = (exerciseId: string, exercise: PlanExerciseWithDefinition) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            if (newMap.has(exerciseId)) {
                newMap.delete(exerciseId);
            } else {
                // Default to remaining sets (or 0 if fully allocated)
                const allocated = allocationMap.get(exerciseId) || 0;
                const remaining = Math.max(0, exercise.sets - allocated);
                newMap.set(exerciseId, remaining);
            }
            return newMap;
        });
    };

    const handleSetsChange = (exerciseId: string, sets: number) => {
        setSelectedExercises((prev) => {
            const newMap = new Map(prev);
            newMap.set(exerciseId, Math.max(0, sets));
            return newMap;
        });
    };

    const handleSelectAll = () => {
        const newMap = new Map<string, number>();
        for (const exercise of planExercises) {
            const allocated = allocationMap.get(exercise._id) || 0;
            const remaining = Math.max(0, exercise.sets - allocated);
            newMap.set(exercise._id, remaining);
        }
        setSelectedExercises(newMap);
    };

    const handleDeselectAll = () => {
        setSelectedExercises(new Map());
    };

    const handleSave = () => {
        if (!workoutName.trim() || selectedExercises.size === 0) return;

        // Build items array with proper order
        const items = Array.from(selectedExercises.entries()).map(([planExerciseId, sets], index) => ({
            planExerciseId,
            order: index,
            sets,
        }));

        onSave(workoutName.trim(), items);
    };

    // Calculate total over-allocation warning
    const hasOverAllocation = useMemo(() => {
        for (const [exerciseId, sets] of selectedExercises) {
            const exercise = planExercises.find(e => e._id === exerciseId);
            if (!exercise) continue;
            const alreadyAllocated = allocationMap.get(exerciseId) || 0;
            if (alreadyAllocated + sets > exercise.sets) {
                return true;
            }
        }
        return false;
    }, [selectedExercises, allocationMap, planExercises]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
                {/* Header */}
                <div className="p-6 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">
                            {editingWorkout ? 'Edit Workout' : 'New Workout'}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Workout Name Input */}
                    <div className="mt-4">
                        <Input
                            id="workout-name"
                            value={workoutName}
                            onChange={(e) => setWorkoutName(e.target.value)}
                            placeholder="Workout name..."
                            className="h-12 rounded-xl border-2 border-muted text-base font-medium placeholder:text-muted-foreground/50 focus:border-primary transition-colors"
                        />
                    </div>
                </div>

                {/* Exercise Selection Section */}
                <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
                    {/* Selection Header */}
                    <div className="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-sm sticky top-0">
                        <span className="text-sm font-medium">
                            {selectedExercises.size === 0
                                ? 'Select exercises'
                                : `${selectedExercises.size} selected`}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSelectAll}
                                className="text-xs h-8 px-3 rounded-lg hover:bg-primary/10 hover:text-primary"
                            >
                                All
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDeselectAll}
                                className="text-xs h-8 px-3 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                            >
                                None
                            </Button>
                        </div>
                    </div>

                    {/* Exercise List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                        {planExercises.map((exercise) => {
                            const isSelected = selectedExercises.has(exercise._id);
                            const selectedSets = selectedExercises.get(exercise._id) || 0;
                            const alreadyAllocated = allocationMap.get(exercise._id) || 0;
                            const isFullyAllocated = alreadyAllocated >= exercise.sets;
                            const totalWithThis = alreadyAllocated + (isSelected ? selectedSets : 0);
                            const isOverAllocated = totalWithThis > exercise.sets;

                            return (
                                <div
                                    key={exercise._id}
                                    className={`rounded-xl transition-all ${
                                        isSelected
                                            ? 'bg-primary/10 ring-1 ring-primary/30'
                                            : isFullyAllocated
                                                ? 'bg-muted/50 opacity-60'
                                                : 'bg-background hover:bg-background/80'
                                    }`}
                                >
                                    <div
                                        onClick={() => handleToggleExercise(exercise._id, exercise)}
                                        className="flex items-center gap-3 p-3 cursor-pointer active:scale-[0.98]"
                                    >
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

                                    {/* Sets input (shown when selected) */}
                                    {isSelected && (
                                        <div className="px-3 pb-3 flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground ml-9">Sets:</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={exercise.sets}
                                                value={selectedSets}
                                                onChange={(e) => handleSetsChange(exercise._id, parseInt(e.target.value) || 0)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-20 h-8 text-center"
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                / {exercise.sets - alreadyAllocated} remaining
                                            </span>
                                            {isOverAllocated && (
                                                <AlertTriangle className="h-4 w-4 text-warning ml-auto" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-background">
                    {hasOverAllocation && (
                        <div className="flex items-center gap-2 text-warning text-sm mb-3">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Some exercises exceed their weekly allocation</span>
                        </div>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={!workoutName.trim() || selectedExercises.size === 0 || isPending}
                        className="w-full h-12 rounded-xl font-semibold text-base"
                    >
                        {isPending
                            ? 'Saving...'
                            : selectedExercises.size === 0
                                ? 'Select exercises'
                                : editingWorkout
                                    ? `Save Changes (${selectedExercises.size})`
                                    : `Create Workout (${selectedExercises.size})`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
