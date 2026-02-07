import { useState } from 'react';
import { CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';

interface ItemDetailActionsProps {
    isNew: boolean;
    isAlreadySynced: boolean;
    isApproving: boolean;
    isDeleting: boolean;
    onApprove: () => Promise<void>;
    onDelete: () => Promise<void>;
}

export function ItemDetailActions({
    isNew,
    isAlreadySynced,
    isApproving,
    isDeleting,
    onApprove,
    onDelete,
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

    return (
        <>
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
        </>
    );
}
