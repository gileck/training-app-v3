import { Button } from '@/client/components/template/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/template/ui/dialog';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';

interface DeleteExerciseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exercise: PlanExerciseWithDefinition | null;
    onConfirm: () => void;
}

export function DeleteExerciseDialog({
    open,
    onOpenChange,
    exercise,
    onConfirm,
}: DeleteExerciseDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Remove Exercise?</DialogTitle>
                    <DialogDescription>
                        This will remove &quot;{exercise?.exerciseDef.name}&quot; from
                        your plan and delete all progress data for this exercise.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        Remove
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
