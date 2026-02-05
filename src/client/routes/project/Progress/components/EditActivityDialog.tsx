import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/template/ui/dialog';
import type { ActivityLogEntry } from '@/apis/project/activity-logs/types';
import { DateTimePicker } from './DateTimePicker';

export interface EditActivityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedIds: Set<string>;
    activities: ActivityLogEntry[];
    onSave: (date: string) => void;
}

export function EditActivityDialog({
    open,
    onOpenChange,
    selectedIds,
    activities,
    onSave,
}: EditActivityDialogProps) {
    // Get the first selected activity to pre-populate date
    const selectedActivities = activities.filter((a) => selectedIds.has(a._id));
    const firstSelected = selectedActivities[0];

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [selectedDate, setSelectedDate] = useState(() => {
        if (firstSelected) {
            return new Date(firstSelected.completedAt);
        }
        return new Date();
    });

    const handleSave = () => {
        onSave(selectedDate.toISOString());
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Date & Time</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <DateTimePicker
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                    />
                    <p className="text-sm text-muted-foreground text-center mt-4">
                        {selectedIds.size === 1
                            ? 'This will update the completion time for the selected set.'
                            : `This will update the completion time for ${selectedIds.size} selected sets.`}
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
