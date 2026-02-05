import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/template/ui/dialog';
import { Dumbbell } from 'lucide-react';
import type { ExerciseWeekProgress } from '@/apis/project/weekly-progress/types';

interface SaveWorkoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workoutName: string;
    onWorkoutNameChange: (name: string) => void;
    sessionExercises: ExerciseWeekProgress[];
    onSave: () => void;
    isSaving: boolean;
}

export function SaveWorkoutDialog({
    open,
    onOpenChange,
    workoutName,
    onWorkoutNameChange,
    sessionExercises,
    onSave,
    isSaving,
}: SaveWorkoutDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Save Workout</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="workout-name">Workout Name</Label>
                        <Input
                            id="workout-name"
                            value={workoutName}
                            onChange={(e) => onWorkoutNameChange(e.target.value)}
                            placeholder="Enter workout name"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">
                            {sessionExercises.length} exercises
                        </Label>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                            {sessionExercises.map((exercise) => (
                                <div
                                    key={exercise.planExerciseId}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                                        {exercise.exerciseDef.imageUrl ? (
                                            <img
                                                src={exercise.exerciseDef.imageUrl}
                                                alt=""
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="flex-1 truncate">{exercise.exerciseDef.name}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {exercise.targetSets}x{exercise.planExercise.reps}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={!workoutName.trim() || isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Workout'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
