import { useState, useEffect } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

interface EditPlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan: TrainingPlanClient | null;
    onConfirm: (planId: string, name: string, weeks: number) => void;
    isLoading?: boolean;
}

export function EditPlanDialog({
    open,
    onOpenChange,
    plan,
    onConfirm,
    isLoading = false,
}: EditPlanDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [planName, setPlanName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [planWeeks, setPlanWeeks] = useState(8);

    // Sync form with plan when dialog opens
    useEffect(() => {
        if (plan) {
            setPlanName(plan.name);
            setPlanWeeks(plan.durationWeeks);
        }
    }, [plan]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setPlanName('');
            setPlanWeeks(8);
        }
        onOpenChange(open);
    };

    const handleConfirm = () => {
        if (!plan || !planName.trim()) return;
        onConfirm(plan._id, planName.trim(), planWeeks);
    };

    const showWeeksWarning = plan && planWeeks < plan.durationWeeks;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Training Plan</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-plan-name">Plan Name</Label>
                        <Input
                            id="edit-plan-name"
                            value={planName}
                            onChange={(e) => setPlanName(e.target.value)}
                            placeholder="e.g., Push/Pull/Legs"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-plan-weeks">Duration (weeks)</Label>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setPlanWeeks((w) => Math.max(1, w - 1))}
                                disabled={planWeeks <= 1}
                            >
                                -
                            </Button>
                            <span className="w-12 text-center font-semibold text-lg">
                                {planWeeks}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setPlanWeeks((w) => Math.min(52, w + 1))}
                                disabled={planWeeks >= 52}
                            >
                                +
                            </Button>
                        </div>
                        {showWeeksWarning && (
                            <p className="text-sm text-warning">
                                Warning: Reducing weeks may result in loss of progress data for removed weeks.
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!planName.trim() || isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
