/**
 * WorkflowActionButtons
 *
 * Renders context-appropriate action buttons for a workflow item.
 * Uses getAvailableActions() to determine which buttons to show.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { useWorkflowAction } from './hooks';
import { getAvailableActions } from './actions';
import type { WorkflowItem, WorkflowActionType } from '@/apis/template/workflow/types';
import type { AvailableAction } from './actions';

export function WorkflowActionButtons({
    item,
    onActionComplete,
}: {
    item: WorkflowItem;
    onActionComplete?: () => void;
}) {
    const actions = getAvailableActions(item);
    const workflowAction = useWorkflowAction();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog state
    const [confirmAction, setConfirmAction] = useState<AvailableAction | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral loading state for tracking active button
    const [activeAction, setActiveAction] = useState<WorkflowActionType | null>(null);

    if (actions.length === 0 || !item.content?.number) return null;

    const issueNumber = item.content.number;

    const handleAction = async (action: AvailableAction) => {
        if (action.needsConfirmation) {
            setConfirmAction(action);
            return;
        }
        await executeAction(action.action, action.meta);
    };

    const undoableActions: WorkflowActionType[] = ['review-changes', 'review-reject', 'request-changes-pr'];

    const executeAction = async (actionType: WorkflowActionType, meta?: Record<string, unknown>) => {
        setActiveAction(actionType);
        const actionTimestamp = Date.now();
        try {
            const result = await workflowAction.mutateAsync({
                action: actionType,
                issueNumber,
                ...meta,
            });
            if (undoableActions.includes(actionType)) {
                toast.success(result.message || 'Action completed', {
                    duration: 30000,
                    actions: [{
                        label: 'Undo',
                        onClick: () => {
                            workflowAction.mutate({
                                action: 'undo-action',
                                issueNumber,
                                originalAction: actionType,
                                timestamp: actionTimestamp,
                            });
                        },
                    }],
                });
            } else {
                toast.success(result.message || 'Action completed');
            }
            onActionComplete?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActiveAction(null);
            setConfirmAction(null);
        }
    };

    const isDisabled = activeAction !== null;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                    <Button
                        key={action.action}
                        variant={action.variant}
                        size="sm"
                        disabled={isDisabled}
                        onClick={() => handleAction(action)}
                    >
                        {activeAction === action.action && (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        {action.label}
                    </Button>
                ))}
            </div>

            {confirmAction && (
                <ConfirmDialog
                    open={!!confirmAction}
                    onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
                    title={confirmAction.label}
                    description={confirmAction.confirmMessage || `Are you sure you want to ${confirmAction.label.toLowerCase()}?`}
                    confirmText={activeAction ? 'Processing...' : confirmAction.label}
                    onConfirm={() => executeAction(confirmAction.action, confirmAction.meta)}
                    variant={confirmAction.variant === 'destructive' ? 'destructive' : undefined}
                />
            )}
        </>
    );
}
