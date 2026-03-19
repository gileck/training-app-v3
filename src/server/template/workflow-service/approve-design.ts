/**
 * Workflow Service — Approve Design
 *
 * Approves a design document by reading content from S3,
 * saving artifacts, and advancing status.
 * Does NOT merge the PR — the design PR stays open.
 *
 * Replaces mergeDesignPR for the new S3-backed approval flow.
 */

import { STATUSES } from '@/server/template/project-management/config';
import { readDesignFromS3, getDesignS3Key } from '@/agents/lib/design-files';
import { formatPhasesToComment, parsePhasesFromMarkdown, hasPhaseComment } from '@/agents/lib/phases';
import {
    initializeImplementationPhases,
    updateDesignArtifact,
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

export interface ApproveDesignResult extends ServiceResult {
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
 * Approve a design, save artifact, advance status, and initialize phases.
 * Does NOT merge the PR — design content is read from S3.
 *
 * 1. Reads design content from S3 (already saved at agent completion)
 * 2. If not product-dev: saves design artifact to DB + updates artifact comment
 * 3. Advances status to next phase
 * 4. If tech design: parses phases, initializes implementation phases
 * 5. Does NOT merge PR, delete branch, or modify the PR
 */
export async function approveDesign(
    issueNumber: number,
    prNumber: number,
    designType: DesignType
): Promise<ApproveDesignResult> {
    const adapter = await getInitializedAdapter();
    const designLabel = DESIGN_TYPE_LABELS[designType];

    if (logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, `${designLabel} Approval`, 'webhook');
    }

    // Save design artifact (not for product-dev)
    if (designType !== 'product-dev') {
        const isProductDesign = designType === 'product';
        const s3Key = getDesignS3Key(issueNumber, designType === 'product' ? 'product' : 'tech');
        const designArtifact = {
            type: (isProductDesign ? 'product-design' : 'tech-design') as 'product-design' | 'tech-design',
            path: s3Key,
            status: 'approved' as const,
            lastUpdated: new Date().toISOString().split('T')[0],
            prNumber,
        };
        await saveDesignArtifactToDB(issueNumber, designArtifact);
        await updateDesignArtifact(adapter, issueNumber, designArtifact);
    }

    if (logExists(issueNumber)) {
        logWebhookAction(issueNumber, 'design_approved', `${designLabel} approved (S3 flow, no merge)`, {
            prNumber,
            designType,
        });
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

        // If tech design: read from S3, parse phases and initialize
        if (designType === 'tech') {
            const techDesign = await readDesignFromS3(issueNumber, 'tech');
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
        logWebhookPhaseEnd(issueNumber, `${designLabel} Approval`, 'success', 'webhook');
    }

    void logHistory(issueNumber, 'design_approved', `${designLabel} approved`, 'admin');

    return {
        success: true,
        advancedTo,
        previousStatus: item?.status || undefined,
    };
}
