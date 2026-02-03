import { Button } from '@/client/components/template/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/template/ui/dialog';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';

interface DeleteWorkoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workout: PlanWorkoutClient | null;
    onConfirm: () => void;
}

export function DeleteWorkoutDialog({
    open,
    onOpenChange,
    workout,
    onConfirm,
}: DeleteWorkoutDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Workout?</DialogTitle>
                    <DialogDescription>
                        This will permanently delete &quot;{workout?.name}&quot;. This cannot be undone.
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
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
