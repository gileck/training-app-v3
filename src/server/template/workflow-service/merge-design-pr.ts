/**
 * Workflow Service — Merge Design PR
 *
 * Merges an approved design PR, saves the design artifact,
 * advances status, and initializes phases if tech design.
 * Extracted from Telegram handler so both Telegram and UI
 * share the same code path.
 */

import { STATUSES } from '@/server/template/project-management/config';
import { readDesignDoc } from '@/agents/lib/design-files';
import { formatPhasesToComment, parsePhasesFromMarkdown, hasPhaseComment } from '@/agents/lib/phases';
import {
    initializeImplementationPhases,
    updateDesignArtifact,
    getDesignDocLink,
} from '@/agents/lib';
import { saveDesignArtifactToDB, savePhasesToDB } from '@/agents/lib/workflow-db';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { getInitializedAdapter, findItemByIssueNumber, logHistory } from './utils';
import { advanceStatus } from './advance';
import type { ServiceResult } from './types';

export type DesignType = 'product-dev' | 'product' | 'tech';

export interface MergeDesignPRResult extends ServiceResult {
    advancedTo?: string;
    previousStatus?: string;
}

const DESIGN_TYPE_LABELS: Record<DesignType, string> = {
    'product-dev': 'Product Development',
    'product': 'Product Design',
    'tech': 'Technical Design',
};

const DESIGN_TYPE_TO_NEXT_PHASE: Record<DesignType, string> = {
    'product-dev': STATUSES.productDesign,
    'product': STATUSES.techDesign,
    'tech': STATUSES.implementation,
};

const NEXT_PHASE_LABELS: Record<DesignType, string> = {
    'product-dev': 'Product Design',
    'product': 'Tech Design',
    'tech': 'Implementation',
};

/**
 * Merge a design PR, save artifact, advance status, and initialize phases.
 *
 * 1. Merges the PR via adapter
 * 2. If not product-dev: saves design artifact to DB + updates artifact comment
 * 3. Advances status to next phase
 * 4. Deletes PR branch
 * 5. If tech design: reads doc, parses phases, initializes implementation phases
 */
export async function mergeDesignPR(
    issueNumber: number,
    prNumber: number,
    designType: DesignType
): Promise<MergeDesignPRResult> {
    const adapter = await getInitializedAdapter();
    const designLabel = DESIGN_TYPE_LABELS[designType];

    if (logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, `${designLabel} PR Merge`, 'webhook');
    }

    // Merge the PR
    const docType = designType === 'product-dev' ? 'product development' : designType;
    const commitTitle = `docs: ${docType} for issue #${issueNumber}`;
    const commitBody = `Approved ${docType} document.\n\nPart of #${issueNumber}`;

    await adapter.mergePullRequest(prNumber, commitTitle, commitBody);

    if (logExists(issueNumber)) {
        logWebhookAction(issueNumber, 'design_pr_merged', `${designLabel} PR #${prNumber} merged`, {
            prNumber,
            designType,
            commitTitle,
        });
    }

    // Save design artifact (not for product-dev)
    if (designType !== 'product-dev') {
        const isProductDesign = designType === 'product';
        const designArtifact = {
            type: (isProductDesign ? 'product-design' : 'tech-design') as 'product-design' | 'tech-design',
            path: getDesignDocLink(issueNumber, designType),
            status: 'approved' as const,
            lastUpdated: new Date().toISOString().split('T')[0],
            prNumber,
        };
        await saveDesignArtifactToDB(issueNumber, designArtifact);
        await updateDesignArtifact(adapter, issueNumber, designArtifact);
    }

    // Advance status to next phase
    const nextPhase = DESIGN_TYPE_TO_NEXT_PHASE[designType];
    const nextPhaseLabel = NEXT_PHASE_LABELS[designType];
    let advancedTo: string | undefined;

    const item = await findItemByIssueNumber(issueNumber);
    if (item) {
        await advanceStatus(issueNumber, nextPhase, {
            logAction: 'status_advanced',
            logDescription: `Status advanced to ${nextPhaseLabel}`,
            logMetadata: { from: item.status, to: nextPhase },
        });
        advancedTo = nextPhaseLabel;

        // Delete PR branch
        const prDetails = await adapter.getPRDetails(prNumber);
        if (prDetails?.headBranch) {
            await adapter.deleteBranch(prDetails.headBranch);
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'branch_deleted', `Branch ${prDetails.headBranch} deleted`, {
                    branch: prDetails.headBranch,
                });
            }
        }

        // If tech design: parse phases and initialize
        if (designType === 'tech') {
            const techDesign = readDesignDoc(issueNumber, 'tech');
            if (techDesign) {
                const phases = parsePhasesFromMarkdown(techDesign);
                if (phases && phases.length >= 2) {
                    const issueComments = await adapter.getIssueComments(issueNumber);
                    if (!hasPhaseComment(issueComments)) {
                        const phasesComment = formatPhasesToComment(phases);
                        await adapter.addIssueComment(issueNumber, phasesComment);
                    }

                    await savePhasesToDB(issueNumber, phases);
                    await initializeImplementationPhases(
                        adapter,
                        issueNumber,
                        phases.map(p => ({ order: p.order, name: p.name }))
                    );

                    if (logExists(issueNumber)) {
                        logWebhookAction(issueNumber, 'phases_initialized', `Initialized ${phases.length} implementation phases`, {
                            phases: phases.map(p => ({ order: p.order, name: p.name })),
                        });
                    }
                }
            }
        }
    }

    if (logExists(issueNumber)) {
        logWebhookPhaseEnd(issueNumber, `${designLabel} PR Merge`, 'success', 'webhook');
    }

    void logHistory(issueNumber, 'design_pr_merged', `${designLabel} PR #${prNumber} merged`, 'admin');

    return {
        success: true,
        advancedTo,
        previousStatus: item?.status || undefined,
    };
}
