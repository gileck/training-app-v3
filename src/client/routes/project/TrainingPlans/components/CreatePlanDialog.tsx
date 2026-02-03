import { useState } from 'react';
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

interface CreatePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (name: string, weeks: number) => void;
    isLoading?: boolean;
}

export function CreatePlanDialog({
    open,
    onOpenChange,
    onConfirm,
    isLoading = false,
}: CreatePlanDialogProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [planName, setPlanName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
    const [planWeeks, setPlanWeeks] = useState(8);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setPlanName('');
            setPlanWeeks(8);
        }
        onOpenChange(open);
    };

    const handleConfirm = () => {
        if (!planName.trim()) return;
        onConfirm(planName.trim(), planWeeks);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Training Plan</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="plan-name">Plan Name</Label>
                        <Input
                            id="plan-name"
                            value={planName}
                            onChange={(e) => setPlanName(e.target.value)}
                            placeholder="e.g., Push/Pull/Legs"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="plan-weeks">Duration (weeks)</Label>
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
                        {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
