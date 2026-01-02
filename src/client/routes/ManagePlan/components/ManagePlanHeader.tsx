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
import { ChevronLeft, RefreshCw, Loader2, AlertTriangle, Upload, Cloud } from 'lucide-react';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';
import type { PlanConflict } from '@/client/features/plan-data';
import { SyncConflictDialog } from './SyncConflictDialog';

interface ManagePlanHeaderProps {
    plan: TrainingPlanClient;
    onBack: () => void;
    onSyncFromCloud?: () => Promise<void>;
    onForceSyncToServer?: () => Promise<void>;
    isSyncing?: boolean;
    conflict?: PlanConflict | null;
}

export function ManagePlanHeader({ 
    plan, 
    onBack, 
    onSyncFromCloud, 
    onForceSyncToServer,
    isSyncing,
    conflict,
}: ManagePlanHeaderProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

    const handleSyncClick = () => {
        setConfirmDialogOpen(true);
    };

    const handleConfirmSync = async () => {
        setConfirmDialogOpen(false);
        await onSyncFromCloud?.();
    };

    const handleConflictIndicatorClick = () => {
        setConflictDialogOpen(true);
    };

    const handleSyncAnyway = async () => {
        setConflictDialogOpen(false);
        await onForceSyncToServer?.();
    };

    const handleConflictSyncFromCloud = async () => {
        setConflictDialogOpen(false);
        await onSyncFromCloud?.();
    };

    const handleConflictCancel = () => {
        setConflictDialogOpen(false);
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
                
                {/* Conflict indicator */}
                {conflict && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleConflictIndicatorClick}
                        className="rounded-full text-warning hover:text-warning hover:bg-warning/10"
                        title="Sync conflict - click to resolve"
                    >
                        <AlertTriangle className="h-5 w-5" />
                    </Button>
                )}
                
                {/* Sync from cloud button */}
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

            {/* Conflict banner when conflict is active */}
            {conflict && (
                <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                    <div className="flex items-center gap-2 text-warning mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium text-sm">Sync conflict detected</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                        This plan was modified on another device. Choose how to resolve:
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncAnyway}
                            disabled={isSyncing}
                            className="flex-1 gap-1"
                        >
                            <Upload className="h-3 w-3" />
                            Keep Mine
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleConflictSyncFromCloud}
                            disabled={isSyncing}
                            className="flex-1 gap-1"
                        >
                            <Cloud className="h-3 w-3" />
                            Use Cloud
                        </Button>
                    </div>
                </div>
            )}

            {/* Standard sync from cloud confirmation dialog */}
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

            {/* Conflict resolution dialog */}
            <SyncConflictDialog
                open={conflictDialogOpen}
                conflict={conflict ?? null}
                onSyncAnyway={handleSyncAnyway}
                onSyncFromCloud={handleConflictSyncFromCloud}
                onCancel={handleConflictCancel}
                isSyncing={isSyncing}
            />
        </>
    );
}
