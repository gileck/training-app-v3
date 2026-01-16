import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/ui/dialog';
import { Dumbbell } from 'lucide-react';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

interface SupersetSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionExercises: ExerciseWeekProgress[];
    supersetSelection: string[];
    onToggleSelection: (planExerciseId: string) => void;
    supersetError: string | null;
    onSave: () => void;
}

export function SupersetSelectionDialog({
    open,
    onOpenChange,
    sessionExercises,
    supersetSelection,
    onToggleSelection,
    supersetError,
    onSave,
}: SupersetSelectionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Choose Super Set Exercises</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {sessionExercises.map((exercise) => {
                        const selected = supersetSelection.includes(exercise.planExerciseId);
                        const disabled = !selected && supersetSelection.length >= 2;
                        return (
                            <Button
                                key={exercise.planExerciseId}
                                variant={selected ? 'default' : 'outline'}
                                className="w-full justify-between h-auto py-3"
                                disabled={disabled}
                                onClick={() => onToggleSelection(exercise.planExerciseId)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border/40">
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
                                    <div className="text-left">
                                        <p className="text-sm font-semibold">{exercise.exerciseDef.name}</p>
                                        <p
                                            className={`text-xs ${
                                                selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                            }`}
                                        >
                                            {exercise.targetSets} sets · {exercise.planExercise.reps} reps
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className={`text-xs ${
                                        selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                    }`}
                                >
                                    {selected ? 'Selected' : disabled ? 'Limit reached' : 'Tap to select'}
                                </span>
                            </Button>
                        );
                    })}
                </div>
                {supersetError && <p className="text-sm text-destructive">{supersetError}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onSave} disabled={supersetSelection.length !== 2}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
