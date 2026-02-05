import { Button } from '@/client/components/template/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import type { TrainingPlanClient } from '@/server/database/collections/project/trainingPlans/types';

interface DeletePlanConfirmProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan: TrainingPlanClient | null;
    onConfirm: () => void;
}

export function DeletePlanConfirm({
    open,
    onOpenChange,
    plan,
    onConfirm,
}: DeletePlanConfirmProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Plan?</DialogTitle>
                    <DialogDescription>
                        This will permanently delete &quot;{plan?.name}&quot; and all its
                        exercises. This cannot be undone.
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
