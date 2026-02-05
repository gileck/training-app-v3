import { Button } from '@/client/components/template/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import { Save, Clipboard } from 'lucide-react';
import type { TrainingPlanClient } from '@/server/database/collections/project/trainingPlans/types';

interface ExportPlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan: TrainingPlanClient | null;
    onExportAsFile: () => void;
    onCopyJson: () => void;
    isLoading?: boolean;
}

export function ExportPlanDialog({
    open,
    onOpenChange,
    plan,
    onExportAsFile,
    onCopyJson,
    isLoading = false,
}: ExportPlanDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Export Plan</DialogTitle>
                    <DialogDescription>
                        Choose how to export &quot;{plan?.name}&quot;
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <Button
                        variant="outline"
                        className="h-14 justify-start"
                        onClick={onExportAsFile}
                        disabled={isLoading}
                    >
                        <Save className="h-5 w-5 mr-3" />
                        <div className="text-left">
                            <div className="font-medium">Save as File</div>
                            <div className="text-sm text-muted-foreground">Download JSON file to your device</div>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-14 justify-start rounded-xl"
                        onClick={onCopyJson}
                        disabled={isLoading}
                    >
                        <Clipboard className="h-5 w-5 mr-3" />
                        <div className="text-left">
                            <div className="font-medium">Copy JSON</div>
                            <div className="text-sm text-muted-foreground">Copy to clipboard for pasting elsewhere</div>
                        </div>
                    </Button>
                </div>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="rounded-lg"
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
