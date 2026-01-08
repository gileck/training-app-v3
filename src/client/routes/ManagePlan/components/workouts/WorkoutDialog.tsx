import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import { Check, Dumbbell } from 'lucide-react';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';

interface WorkoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingWorkout: PlanWorkoutClient | null;
    planExercises: PlanExerciseWithDefinition[];
    onSave: (name: string, exerciseIds: Set<string>) => void;
    isPending: boolean;
}

export function WorkoutDialog({
    open,
    onOpenChange,
    editingWorkout,
    planExercises,
    onSave,
    isPending,
}: WorkoutDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [workoutName, setWorkoutName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection
    const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());

    // Reset form when dialog opens or editingWorkout changes
    useEffect(() => {
        if (open) {
            if (editingWorkout) {
                setWorkoutName(editingWorkout.name);
                // Select exercises that are in this workout's items
                const workoutPlanExerciseIds = new Set(
                    editingWorkout.items.map((item) => item.planExerciseId)
                );
                // Only include IDs that still exist in planExercises
                const validIds = planExercises
                    .filter((pe) => workoutPlanExerciseIds.has(pe._id))
                    .map((pe) => pe._id);
                setSelectedExercises(new Set(validIds));
            } else {
                setWorkoutName('');
                setSelectedExercises(new Set());
            }
        }
    }, [open, editingWorkout, planExercises]);

    const handleToggleExercise = (exerciseId: string) => {
        setSelectedExercises((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(exerciseId)) {
                newSet.delete(exerciseId);
            } else {
                newSet.add(exerciseId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        setSelectedExercises(new Set(planExercises.map((ex) => ex._id)));
    };

    const handleDeselectAll = () => {
        setSelectedExercises(new Set());
    };

    const handleSave = () => {
        if (!workoutName.trim() || selectedExercises.size === 0) return;
        onSave(workoutName.trim(), selectedExercises);
    };

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
                            return (
                                <div
                                    key={exercise._id}
                                    onClick={() => handleToggleExercise(exercise._id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                                        isSelected
                                            ? 'bg-primary/10 ring-1 ring-primary/30'
                                            : 'bg-background hover:bg-background/80'
                                    }`}
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
                                        <p className="text-sm text-muted-foreground">
                                            {exercise.sets} × {exercise.reps}
                                            {exercise.weight > 0 && ` · ${exercise.weight}kg`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-background">
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
