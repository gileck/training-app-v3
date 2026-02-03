import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/template/ui/dialog';

interface RestManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    restTimerDuration: number;
    customRest: string;
    onCustomRestChange: (value: string) => void;
    restError: string | null;
    onSelectRest: (seconds: number) => void;
    onSaveCustomRest: () => void;
}

export function RestManagementDialog({
    open,
    onOpenChange,
    restTimerDuration,
    customRest,
    onCustomRestChange,
    restError,
    onSelectRest,
    onSaveCustomRest,
}: RestManagementDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Manage Rest Time</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[60, 90, 120].map((seconds) => (
                            <Button
                                key={seconds}
                                variant={restTimerDuration === seconds ? 'default' : 'outline'}
                                className="h-10"
                                onClick={() => onSelectRest(seconds)}
                            >
                                {seconds}s
                            </Button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="custom-rest">Custom (seconds)</Label>
                        <Input
                            id="custom-rest"
                            type="number"
                            min={5}
                            value={customRest}
                            onChange={(e) => onCustomRestChange(e.target.value)}
                            placeholder="e.g. 75"
                        />
                        {restError && <p className="text-sm text-destructive">{restError}</p>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onSaveCustomRest} disabled={!customRest.trim()}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
