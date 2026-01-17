import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';
import { WorkoutNameEditor } from './WorkoutDialog/WorkoutNameEditor';
import { ExercisesTab } from './WorkoutDialog/ExercisesTab';
import { SetsTab } from './WorkoutDialog/SetsTab';

interface WorkoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingWorkout: PlanWorkoutClient | null;
    planExercises: PlanExerciseWithDefinition[];
    planWorkouts: PlanWorkoutClient[];
    onSave: (name: string, items: Array<{ planExerciseId: string; order: number; sets?: number }>) => void;
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
    // Map of planExerciseId -> sets (undefined means use exercise's weekly sets)
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection with sets
    const [selectedExercises, setSelectedExercises] = useState<Map<string, number | undefined>>(new Map());
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [activeTab, setActiveTab] = useState<'exercises' | 'sets'>('exercises');

    // Calculate allocated sets per exercise across all workouts (excluding current editing workout)
    const allocationMap = useMemo(() => {
        const allocations = new Map<string, number>();
        const editingWorkoutId = editingWorkout?._id ? String(editingWorkout._id) : null;

        for (const workout of planWorkouts) {
            // Skip current workout when editing - use String() for robust comparison
            const workoutId = String(workout._id);
            if (editingWorkoutId && workoutId === editingWorkoutId) continue;

            for (const item of workout.items) {
                // Use item.sets if defined, otherwise use exercise's weekly sets
                const exercise = planExercises.find(pe => pe._id === item.planExerciseId);
                const sets = item.sets ?? exercise?.sets ?? 0;
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
                const exerciseMap = new Map<string, number | undefined>();
                for (const item of editingWorkout.items) {
                    // Only include IDs that still exist in planExercises
                    const exercise = planExercises.find(pe => pe._id === item.planExerciseId);
                    if (exercise) {
                        // Use item.sets if defined, otherwise use exercise's weekly sets as default
                        exerciseMap.set(item.planExerciseId, item.sets ?? exercise.sets);
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
                // Default to remaining sets (0 if fully allocated in other workouts)
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
        const newMap = new Map<string, number | undefined>();
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
            if (alreadyAllocated + (sets ?? exercise.sets) > exercise.sets) {
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

                    {/* Workout Name Editor */}
                    <div className="mt-4">
                        <WorkoutNameEditor
                            value={workoutName}
                            onChange={setWorkoutName}
                            placeholder="Workout name..."
                        />
                    </div>
                </div>

                {/* Tabbed Interface */}
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as 'exercises' | 'sets')}
                    className="flex-1 flex flex-col min-h-0"
                >
                    <div className="px-6 pt-2 pb-0">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="exercises">
                                Exercises {selectedExercises.size > 0 && `(${selectedExercises.size})`}
                            </TabsTrigger>
                            <TabsTrigger value="sets">
                                Sets {selectedExercises.size > 0 && `(${selectedExercises.size})`}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="exercises" className="mt-2 flex-1 flex flex-col min-h-0">
                        <ExercisesTab
                            planExercises={planExercises}
                            selectedExercises={selectedExercises}
                            allocationMap={allocationMap}
                            onToggleExercise={handleToggleExercise}
                            onSelectAll={handleSelectAll}
                            onDeselectAll={handleDeselectAll}
                        />
                    </TabsContent>

                    <TabsContent value="sets" className="mt-2 flex-1 flex flex-col min-h-0">
                        <SetsTab
                            planExercises={planExercises}
                            selectedExercises={selectedExercises}
                            allocationMap={allocationMap}
                            onSetsChange={handleSetsChange}
                        />
                    </TabsContent>
                </Tabs>

                {/* Footer */}
                <div className="p-4 border-t bg-background">
                    {hasOverAllocation && (
                        <div className="flex items-center gap-2 text-sm mb-3 rounded-lg p-2.5 border border-border/50 text-[oklch(0.47_0.14_51.32)] dark:text-[oklch(0.70_0.14_51.32)]">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">Some exercises exceed their weekly allocation</span>
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
