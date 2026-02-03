/**
 * Sync Conflict Dialog
 * 
 * Shown when a sync conflict is detected (server has newer changes).
 * User can choose to:
 * 1. Sync Anyway - Override server with local changes
 * 2. Sync from Cloud - Discard local, use server data
 * 3. Cancel - Decide later (pauses sync)
 */

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from '@/client/components/ui/alert-dialog';
import { Button } from '@/client/components/ui/button';
import { AlertTriangle, Cloud, Upload, X } from 'lucide-react';
import type { PlanConflict } from '@/client/features/project/plan-data';

interface SyncConflictDialogProps {
    open: boolean;
    conflict: PlanConflict | null;
    onSyncAnyway: () => void;
    onSyncFromCloud: () => void;
    onCancel: () => void;
    isSyncing?: boolean;
}

/**
 * Format a timestamp for display
 */
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return `Today at ${date.toLocaleTimeString(undefined, { 
            hour: 'numeric', 
            minute: '2-digit' 
        })}`;
    } else if (diffDays === 1) {
        return `Yesterday at ${date.toLocaleTimeString(undefined, { 
            hour: 'numeric', 
            minute: '2-digit' 
        })}`;
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
    }
}

export function SyncConflictDialog({
    open,
    conflict,
    onSyncAnyway,
    onSyncFromCloud,
    onCancel,
    isSyncing = false,
}: SyncConflictDialogProps) {
    if (!conflict) return null;

    return (
        <AlertDialog open={open}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-5 w-5" />
                        Sync Conflict Detected
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <p>
                                This plan was modified on another device.
                            </p>
                            <div className="bg-muted rounded-md p-3 text-sm">
                                <span className="text-muted-foreground">Server last synced:</span>{' '}
                                <span className="font-medium text-foreground">
                                    {formatDate(conflict.serverLastSyncedAt)}
                                </span>
                            </div>
                            <p className="text-muted-foreground">
                                Choose how to resolve this conflict:
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="flex flex-col gap-2 py-2">
                    <Button
                        variant="default"
                        className="w-full justify-start gap-2"
                        onClick={onSyncAnyway}
                        disabled={isSyncing}
                    >
                        <Upload className="h-4 w-4" />
                        <div className="text-left">
                            <div>Sync Anyway</div>
                            <div className="text-xs font-normal opacity-70">
                                Keep my local changes, overwrite server
                            </div>
                        </div>
                    </Button>
                    
                    <Button
                        variant="secondary"
                        className="w-full justify-start gap-2"
                        onClick={onSyncFromCloud}
                        disabled={isSyncing}
                    >
                        <Cloud className="h-4 w-4" />
                        <div className="text-left">
                            <div>Sync from Cloud</div>
                            <div className="text-xs font-normal opacity-70">
                                Discard my changes, use server data
                            </div>
                        </div>
                    </Button>
                </div>
                
                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                        <Button 
                            variant="ghost" 
                            onClick={onCancel}
                            disabled={isSyncing}
                            className="gap-2"
                        >
                            <X className="h-4 w-4" />
                            Decide Later
                        </Button>
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
