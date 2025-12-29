import { Button } from '@/client/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/client/components/ui/dialog';
import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';

interface DeleteWorkoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workout: SavedWorkoutWithExercises | null;
    onConfirm: () => void;
    isPending: boolean;
}

export function DeleteWorkoutDialog({
    open,
    onOpenChange,
    workout,
    onConfirm,
    isPending,
}: DeleteWorkoutDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl">
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
                        {isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
