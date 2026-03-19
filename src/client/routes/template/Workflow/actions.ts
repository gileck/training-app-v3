/**
 * Workflow Action Availability
 *
 * Pure function that determines which actions are available
 * for a given workflow item based on its current state.
 */

import type { WorkflowItem, WorkflowActionType } from '@/apis/template/workflow/types';

export interface AvailableAction {
    action: WorkflowActionType;
    label: string;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
    needsConfirmation?: boolean;
    confirmMessage?: string;
    meta?: Record<string, unknown>;
}

/**
 * Get available actions for a workflow item based on its current status and review status.
 */
export function getAvailableActions(item: WorkflowItem): AvailableAction[] {
    const actions: AvailableAction[] = [];
    const { status, reviewStatus, prData } = item;

    if (!status) return actions;

    const designPhases = [
        'Product Development',
        'Product Design',
        'Bug Investigation',
        'Technical Design',
    ];

    // Design review actions (approve/changes/reject)
    if (designPhases.includes(status) && reviewStatus === 'Waiting for Review') {
        actions.push({
            action: 'review-approve',
            label: 'Approve',
            variant: 'default',
        });
        actions.push({
            action: 'review-changes',
            label: 'Request Changes',
            variant: 'outline',
            needsConfirmation: true,
            confirmMessage: 'Request changes on this design? The agent will need to revise.',
        });
        actions.push({
            action: 'review-reject',
            label: 'Reject',
            variant: 'destructive',
            needsConfirmation: true,
            confirmMessage: 'Reject this item? This will stop further progress.',
        });

        // Choose Recommended (for Bug Investigation and Product Design with pending decision)
        if ((status === 'Bug Investigation' || status === 'Product Design') && prData?.hasPendingDecision) {
            actions.push({
                action: 'choose-recommended',
                label: 'Choose Recommended',
                variant: 'secondary',
            });
        }
    }

    // Request changes on implementation PR
    if (status === 'PR Review' && reviewStatus === 'Waiting for Review' && prData?.currentPrNumber) {
        actions.push({
            action: 'request-changes-pr',
            label: 'Request Changes on PR',
            variant: 'outline',
            needsConfirmation: true,
            confirmMessage: 'Request changes on the implementation PR? The implementor will need to revise.',
        });
    }

    // Merge design PR (design phases with open design PR)
    if (designPhases.includes(status) && prData?.designPrs?.length) {
        const designPr = prData.designPrs[prData.designPrs.length - 1];
        // Map DB type ('product-design'/'tech-design') to service type ('product'/'tech')
        const designTypeMap: Record<string, string> = {
            'product-dev': 'product-dev',
            'product-design': 'product',
            'tech-design': 'tech',
        };
        const designType = designTypeMap[designPr.type] || designPr.type;
        actions.push({
            action: 'approve-design',
            label: 'Approve Design',
            variant: 'default',
            needsConfirmation: true,
            confirmMessage: `Approve design and advance to the next phase?`,
            meta: { prNumber: designPr.prNumber, designType },
        });
        actions.push({
            action: 'request-changes-design-pr',
            label: 'Request Changes on Design PR',
            variant: 'outline',
            needsConfirmation: true,
            confirmMessage: `Request changes on design PR #${designPr.prNumber}? The agent will revise.`,
            meta: { prNumber: designPr.prNumber, designType },
        });
    }

    // Merge implementation PR (PR Review with open PR)
    if (status === 'PR Review' && prData?.currentPrNumber) {
        actions.push({
            action: 'merge-pr',
            label: 'Merge PR',
            variant: 'default',
            needsConfirmation: true,
            confirmMessage: `Merge implementation PR #${prData.currentPrNumber}?`,
        });
    }

    // Merge final PR (Final Review with final PR number)
    if (status === 'Final Review' && prData?.finalPrNumber) {
        actions.push({
            action: 'merge-final-pr',
            label: 'Merge Final PR',
            variant: 'default',
            needsConfirmation: true,
            confirmMessage: `Merge final PR #${prData.finalPrNumber} to main? This will mark the feature as Done.`,
            meta: { prNumber: prData.finalPrNumber },
        });
    }

    // Clarification received
    if (reviewStatus === 'Waiting for Clarification') {
        actions.push({
            action: 'clarification-received',
            label: 'Clarification Received',
            variant: 'default',
        });
    }

    // Revert merged PR (when a merged PR is tracked and item is not Done)
    if (prData?.lastMergedPrNumber && status !== 'Done') {
        actions.push({
            action: 'revert-pr',
            label: 'Revert Merge',
            variant: 'destructive',
            needsConfirmation: true,
            confirmMessage: `Revert PR #${prData.lastMergedPrNumber}? This will create a revert PR and set status to Request Changes.`,
            meta: { prNumber: prData.lastMergedPrNumber, phase: prData.lastMergedPrPhase },
        });
    }

    // Merge revert PR (when a pending revert PR exists)
    if (prData?.revertPrNumber) {
        actions.push({
            action: 'merge-revert-pr',
            label: 'Merge Revert PR',
            variant: 'default',
            needsConfirmation: true,
            confirmMessage: `Merge revert PR #${prData.revertPrNumber}? This will undo the changes on main.`,
            meta: { prNumber: prData.revertPrNumber },
        });
    }

    // Mark done (any active item, not already done)
    if (status !== 'Done') {
        actions.push({
            action: 'mark-done',
            label: 'Mark Done',
            variant: 'outline',
            needsConfirmation: true,
            confirmMessage: 'Mark this item as Done? This will close the workflow.',
        });
    }

    return actions;
}
