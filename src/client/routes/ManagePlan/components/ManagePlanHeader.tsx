import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/ui/alert-dialog';
import { ChevronLeft, RefreshCw, Loader2 } from 'lucide-react';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';

interface ManagePlanHeaderProps {
    plan: TrainingPlanClient;
    onBack: () => void;
    onSyncFromCloud?: () => Promise<void>;
    isSyncing?: boolean;
}

export function ManagePlanHeader({ plan, onBack, onSyncFromCloud, isSyncing }: ManagePlanHeaderProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    const handleSyncClick = () => {
        setConfirmDialogOpen(true);
    };

    const handleConfirmSync = async () => {
        setConfirmDialogOpen(false);
        await onSyncFromCloud?.();
    };

    return (
        <>
            <div className="flex items-center gap-3 mb-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-xl font-semibold">{plan.name}</h1>
                    <p className="text-sm text-muted-foreground">{plan.durationWeeks} weeks</p>
                </div>
                {onSyncFromCloud && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSyncClick}
                        disabled={isSyncing}
                        className="rounded-full"
                        title="Sync from Cloud"
                    >
                        {isSyncing ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <RefreshCw className="h-5 w-5" />
                        )}
                    </Button>
                )}
            </div>

            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sync from Cloud?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will replace your local data with the cloud version. 
                            Any unsynced changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSync}>
                            Sync from Cloud
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
