/**
 * Workflow DB Helpers
 *
 * DB-first read helpers and dual-write utilities for workflow artifacts.
 * These functions depend on MongoDB and must NOT be re-exported through the
 * agents/lib barrel (index.ts) to avoid pulling MongoDB into client bundles.
 *
 * Import directly: import { ... } from '@/agents/lib/workflow-db';
 */

import type { ProjectManagementAdapter } from '@/server/template/project-management/types';
import type { ImplementationPhase } from '../shared/output-schemas';
import type { CommitMessageResult } from './commitMessage';
import {
    getArtifacts as getArtifactsFromDB,
    updateDesignArtifactInDB,
    setPhases,
    updatePhaseStatus,
    setTaskBranchInDB,
    clearTaskBranchInDB,
    getCommitMessageFromDB,
    setCommitMessage as setCommitMessageInDB,
} from '@/server/database/collections/template/workflow-items';
import type {
    DesignArtifactRecord,
    ImplementationStatus,
    PhaseArtifactRecord,
    WorkflowItemArtifacts,
} from '@/server/database/collections/template/workflow-items/types';
import type {
    ArtifactComment,
    DesignArtifact,
} from './artifacts';
import { parseArtifactComment } from './artifacts';

// ============================================================
// DB-FIRST READS (with comment-parsing fallback)
// ============================================================

/**
 * Get artifacts for an issue, reading from DB first with comment-parsing fallback.
 *
 * - If the workflow item has an `artifacts` field in MongoDB, converts it to ArtifactComment format.
 * - Otherwise falls back to parsing the GitHub issue comment (for existing items without DB artifacts).
 */
export async function getArtifactsFromIssue(
    adapter: ProjectManagementAdapter,
    issueNumber: number
): Promise<ArtifactComment> {
    // 1. Try DB (with graceful fallback on failure)
    try {
        const dbArtifacts = await getArtifactsFromDB(issueNumber);
        if (dbArtifacts) {
            return convertDBArtifactsToComment(dbArtifacts);
        }
    } catch (error) {
        console.warn(`Failed to read artifacts from DB for issue #${issueNumber}, falling back to comments:`, error);
    }

    // 2. Fallback to comment parsing
    const comments = await adapter.getIssueComments(issueNumber);
    return parseArtifactComment(comments) || {};
}

/**
 * Get phases from DB (if available).
 * Returns null if no phases in DB, allowing caller to use existing comment/markdown fallback.
 */
export async function getPhasesFromDB(issueNumber: number): Promise<ImplementationPhase[] | null> {
    try {
        const dbArtifacts = await getArtifactsFromDB(issueNumber);
        if (dbArtifacts?.phases && dbArtifacts.phases.length >= 2) {
            return dbArtifacts.phases.map(p => ({
                order: p.order,
                name: p.name,
                description: p.description,
                files: p.files,
                estimatedSize: p.estimatedSize,
            }));
        }
    } catch (error) {
        console.warn(`Failed to read phases from DB for issue #${issueNumber}:`, error);
    }
    return null;
}

/**
 * Get commit message from DB (if available).
 * Returns null if not in DB, allowing caller to use existing comment fallback.
 */
export async function getCommitMessage(
    issueNumber: number,
    prNumber: number
): Promise<CommitMessageResult | null> {
    try {
        const record = await getCommitMessageFromDB(issueNumber, prNumber);
        if (record) {
            return { title: record.title, body: record.body };
        }
    } catch (error) {
        console.warn(`Failed to read commit message from DB for issue #${issueNumber} PR #${prNumber}:`, error);
    }
    return null;
}

// ============================================================
// DB WRITES (called at callsites alongside existing comment writes)
// ============================================================

/**
 * Save a design artifact to DB.
 * Maps DesignArtifact (domain type) to DesignArtifactRecord (DB type).
 * The `satisfies` check ensures field additions to either type cause a compile error.
 */
export async function saveDesignArtifactToDB(
    issueNumber: number,
    design: DesignArtifact
): Promise<void> {
    const dbRecord = {
        type: design.type,
        path: design.path,
        status: design.status,
        lastUpdated: design.lastUpdated,
        prNumber: design.prNumber,
    } satisfies DesignArtifactRecord;
    await updateDesignArtifactInDB(issueNumber, dbRecord);
}

/**
 * Save implementation phases to DB.
 * Accepts ImplementationPhase[] (shared output schema type) and maps to PhaseArtifactRecord[] (DB type).
 */
export async function savePhasesToDB(
    issueNumber: number,
    phases: (Pick<ImplementationPhase, 'order' | 'name'> & Partial<Pick<ImplementationPhase, 'description' | 'files' | 'estimatedSize'>>)[]
): Promise<void> {
    const dbPhases: PhaseArtifactRecord[] = phases.map(p => ({
        order: p.order,
        name: p.name,
        description: p.description || '',
        files: p.files || [],
        estimatedSize: p.estimatedSize || 'S',
        status: 'pending' as const,
    }));
    await setPhases(issueNumber, dbPhases);
}

/**
 * Update a phase status in DB.
 */
export async function savePhaseStatusToDB(
    issueNumber: number,
    phase: number,
    status: ImplementationStatus,
    prNumber?: number
): Promise<void> {
    await updatePhaseStatus(issueNumber, phase, { status, prNumber });
}

/**
 * Save task branch to DB.
 */
export async function saveTaskBranchToDB(
    issueNumber: number,
    branch: string
): Promise<void> {
    await setTaskBranchInDB(issueNumber, branch);
}

/**
 * Clear task branch from DB.
 */
export async function clearTaskBranchFromDB(
    issueNumber: number
): Promise<void> {
    await clearTaskBranchInDB(issueNumber);
}

/**
 * Save commit message to DB.
 */
export async function saveCommitMessage(
    issueNumber: number,
    prNumber: number,
    title: string,
    body: string
): Promise<void> {
    await setCommitMessageInDB(issueNumber, prNumber, title, body);
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Convert DB WorkflowItemArtifacts to ArtifactComment format
 */
function convertDBArtifactsToComment(
    dbArtifacts: WorkflowItemArtifacts
): ArtifactComment {
    const artifact: ArtifactComment = {};

    if (dbArtifacts.designs) {
        for (const design of dbArtifacts.designs) {
            const designArtifact: DesignArtifact = {
                type: design.type,
                path: design.path,
                status: design.status,
                lastUpdated: design.lastUpdated,
                prNumber: design.prNumber,
            };
            if (design.type === 'product-dev') {
                artifact.productDevelopment = designArtifact;
            } else if (design.type === 'product-design') {
                artifact.productDesign = designArtifact;
            } else {
                artifact.techDesign = designArtifact;
            }
        }
    }

    if (dbArtifacts.phases && dbArtifacts.phases.length > 0) {
        const totalPhases = dbArtifacts.phases.length;
        artifact.implementation = {
            phases: dbArtifacts.phases.map(p => ({
                phase: p.order,
                totalPhases,
                name: p.name,
                status: p.status,
                prNumber: p.prNumber,
            })),
        };
    }

    if (dbArtifacts.taskBranch) {
        artifact.taskBranch = dbArtifacts.taskBranch;
    }

    return artifact;
}
