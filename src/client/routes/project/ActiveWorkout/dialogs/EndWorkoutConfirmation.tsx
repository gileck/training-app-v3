import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/template/ui/alert-dialog';

interface EndWorkoutConfirmationProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planWorkoutId: string | null;
    onConfirm: () => void;
}

export function EndWorkoutConfirmation({
    open,
    onOpenChange,
    planWorkoutId,
    onConfirm,
}: EndWorkoutConfirmationProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>End Workout?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {planWorkoutId === null && 'This workout is not saved. '}
                        Are you sure you want to end this workout?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        End Workout
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
