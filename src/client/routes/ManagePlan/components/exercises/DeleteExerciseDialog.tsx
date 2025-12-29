import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import type { PlanExerciseWithDefinition } from '@/apis/plan-exercises/types';

interface DeleteExerciseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exercise: PlanExerciseWithDefinition | null;
    onConfirm: () => void;
    isPending: boolean;
}

export function DeleteExerciseDialog({
    open,
    onOpenChange,
    exercise,
    onConfirm,
    isPending,
}: DeleteExerciseDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl">
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
                        className="rounded-lg"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isPending}
                        className="rounded-lg"
                    >
                        {isPending ? 'Removing...' : 'Remove'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
