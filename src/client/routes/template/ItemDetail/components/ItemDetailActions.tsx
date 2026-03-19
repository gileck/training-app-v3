import { useState } from 'react';
import { CheckCircle, Trash2, Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/template/ui/select';
import type { ItemType } from '../hooks';

const ALL_STATUSES = [
    'Backlog',
    'Product Development',
    'Product Design',
    'Bug Investigation',
    'Technical Design',
    'Ready for development',
    'PR Review',
    'Final Review',
    'Done',
] as const;

const FEATURE_ROUTING_OPTIONS = [
    { label: 'Product Development', status: 'Product Development' },
    { label: 'Product Design', status: 'Product Design' },
    { label: 'Technical Design', status: 'Technical Design' },
    { label: 'Ready for Development', status: 'Ready for development' },
    { label: 'Backlog', status: 'Backlog' },
];

const BUG_ROUTING_OPTIONS = [
    { label: 'Product Design', status: 'Product Design' },
    { label: 'Technical Design', status: 'Technical Design' },
    { label: 'Ready for Development', status: 'Ready for development' },
    { label: 'Backlog', status: 'Backlog' },
];

interface ItemDetailActionsProps {
    isNew: boolean;
    isAlreadySynced: boolean;
    isApproving: boolean;
    isDeleting: boolean;
    isRouting: boolean;
    showRoutingDialog: boolean;
    routingItemType: ItemType;
    onApprove: () => Promise<void>;
    onDelete: () => Promise<void>;
    onRoute: (status: string) => Promise<void>;
    onSkipRouting: () => void;
    onStatusChange?: (status: string) => Promise<void>;
}

export function ItemDetailActions({
    isNew,
    isAlreadySynced,
    isApproving,
    isDeleting,
    isRouting,
    showRoutingDialog,
    routingItemType,
    onApprove,
    onDelete,
    onRoute,
    onSkipRouting,
    onStatusChange,
}: ItemDetailActionsProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal open state
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal open state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleApprove = async () => {
        await onApprove();
        setShowApproveDialog(false);
    };

    const handleDelete = async () => {
        await onDelete();
        setShowDeleteDialog(false);
    };

    const routingOptions = routingItemType === 'feature' ? FEATURE_ROUTING_OPTIONS : BUG_ROUTING_OPTIONS;

    return (
        <>
            {/* Move to dropdown — shown for synced items */}
            {isAlreadySynced && onStatusChange && (
                <div className="flex items-center gap-2 mb-4">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                        value=""
                        onValueChange={(value) => onStatusChange(value)}
                    >
                        <SelectTrigger className="h-9 text-sm flex-1">
                            <SelectValue placeholder="Move to..." />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Action buttons - fixed bottom bar on mobile */}
            <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 sm:relative sm:border-0 sm:p-0 sm:mt-6">
                <div className="flex gap-3 sm:justify-start">
                    {isNew && !isAlreadySynced && (
                        <Button
                            className="flex-1 sm:flex-initial"
                            onClick={() => setShowApproveDialog(true)}
                            disabled={isApproving || isDeleting}
                        >
                            {isApproving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                            )}
                            Approve
                        </Button>
                    )}
                    {!isAlreadySynced && (
                        <Button
                            variant="destructive"
                            className="flex-1 sm:flex-initial"
                            onClick={() => setShowDeleteDialog(true)}
                            disabled={isApproving || isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            {/* Bottom spacer to prevent content from being hidden behind fixed bar on mobile */}
            <div className="h-16 sm:hidden" />

            {/* Confirmation dialogs */}
            <ConfirmDialog
                open={showApproveDialog}
                onOpenChange={setShowApproveDialog}
                title="Approve Item"
                description="This will create a GitHub issue and sync the item. Continue?"
                confirmText={isApproving ? 'Approving...' : 'Approve'}
                onConfirm={handleApprove}
            />
            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Item"
                description="This will permanently delete this item from the database. This action cannot be undone."
                confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                onConfirm={handleDelete}
                variant="destructive"
            />

            {/* Routing dialog — shown after successful approve when needsRouting */}
            <Dialog open={showRoutingDialog} onOpenChange={(open) => { if (!open) onSkipRouting(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Route to Workflow Phase</DialogTitle>
                        <DialogDescription>
                            Where should this item start in the workflow?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 py-2">
                        {routingOptions.map((option) => (
                            <Button
                                key={option.status}
                                variant="outline"
                                className="justify-start"
                                disabled={isRouting}
                                onClick={() => onRoute(option.status)}
                            >
                                {isRouting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onSkipRouting}
                            disabled={isRouting}
                        >
                            Skip (stay in Backlog)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
