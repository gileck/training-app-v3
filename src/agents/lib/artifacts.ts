/**
 * Artifact Comment Utilities
 *
 * Provides utilities for managing design document artifacts stored as GitHub issue comments.
 * Design documents are stored as files in the repository (design-docs/issue-{N}/) and
 * referenced via a pinned artifact comment on the issue.
 *
 * Architecture:
 * - Design agents: Create PRs with design files, update artifact comment after merge
 * - Implementation agent: Read designs from files via artifact comment links
 * - This file ensures consistent marker format and reliable parsing
 */

import type { ProjectManagementAdapter } from '@/server/template/project-management/types';
import { getProjectConfig } from '@/server/template/project-management/config';

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Marker to identify artifact comments
 * Using HTML comment for invisibility + versioning for future changes
 */
export const ARTIFACT_COMMENT_MARKER = '<!-- ISSUE_ARTIFACT_V1 -->';

// ============================================================
// TYPES
// ============================================================

export interface DesignArtifact {
    type: 'product-dev' | 'product-design' | 'tech-design';
    path: string;
    status: 'pending' | 'approved';
    lastUpdated: string;
    prNumber?: number;
}

export type ImplementationStatus = 'pending' | 'in-review' | 'approved' | 'changes-requested' | 'merged';

export interface ImplementationPhaseArtifact {
    phase: number;
    totalPhases: number;
    name: string;
    status: ImplementationStatus;
    prNumber?: number;
}

export interface ImplementationArtifact {
    /** For single-phase implementations */
    status?: ImplementationStatus;
    prNumber?: number;
    /** For multi-phase implementations */
    phases?: ImplementationPhaseArtifact[];
}

export interface ArtifactComment {
    productDevelopment?: DesignArtifact;
    productDesign?: DesignArtifact;
    techDesign?: DesignArtifact;
    implementation?: ImplementationArtifact;
    /**
     * Feature branch for multi-phase implementations
     * Format: "feature/task-{issueId}"
     * Only set for multi-phase features (phases > 1)
     */
    taskBranch?: string;
}

export interface GitHubComment {
    id: number;
    body: string;
    author: string;
    createdAt: string;
    updatedAt?: string;
}

// ============================================================
// PATH HELPERS
// ============================================================

/**
 * Generate file path for design document
 * @returns Relative path from repo root: "design-docs/issue-{N}/product-design.md"
 */
export function getDesignDocPath(issueNumber: number, type: 'product-dev' | 'product' | 'tech'): string {
    const filename = type === 'product-dev'
        ? 'product-development.md'
        : type === 'product'
            ? 'product-design.md'
            : 'tech-design.md';
    return `design-docs/issue-${issueNumber}/${filename}`;
}

/**
 * Generate full GitHub blob URL for artifact comment link
 * @returns Full URL: "https://github.com/{owner}/{repo}/blob/main/design-docs/issue-{N}/..."
 */
export function getDesignDocLink(issueNumber: number, type: 'product-dev' | 'product' | 'tech'): string {
    const config = getProjectConfig();
    const path = getDesignDocPath(issueNumber, type);
    return `https://github.com/${config.github.owner}/${config.github.repo}/blob/main/${path}`;
}

/**
 * Generate branch name for design PR
 * @returns Branch name: "design/issue-{N}-product-dev", "design/issue-{N}-product", or "design/issue-{N}-tech"
 */
export function generateDesignBranchName(issueNumber: number, type: 'product-dev' | 'product' | 'tech'): string {
    return `design/issue-${issueNumber}-${type}`;
}

// ============================================================
// PARSING - Extract from comments
// ============================================================

/**
 * Find artifact comment in list of comments
 * @returns The comment containing the artifact marker, or null if not found
 */
export function findArtifactComment(comments: GitHubComment[]): GitHubComment | null {
    if (!comments || comments.length === 0) {
        return null;
    }
    return comments.find(c => c.body.includes(ARTIFACT_COMMENT_MARKER)) || null;
}

/**
 * Check if artifact comment exists
 */
export function hasArtifactComment(comments: GitHubComment[]): boolean {
    return findArtifactComment(comments) !== null;
}

/**
 * Parse artifact comment body into structured data
 * @returns Parsed artifact data, or null if no artifact comment found
 */
export function parseArtifactComment(comments: GitHubComment[]): ArtifactComment | null {
    const comment = findArtifactComment(comments);
    if (!comment) {
        return null;
    }

    const artifact: ArtifactComment = {};

    // Parse table rows for design artifacts
    // Format: | [Product Development](path) | ✅ Approved | 2026-01-25 | #456 |
    // Flexible: \s* between elements, optional whitespace around status emoji/text
    const productDevMatch = comment.body.match(
        /\|\s*\[Product Development\]\(([^)]+)\)\s*\|\s*([✅⏳])\s*\w+\s*\|\s*([^|]+?)\s*\|\s*#?(\d+)?\s*\|/
    );
    if (productDevMatch) {
        artifact.productDevelopment = {
            type: 'product-dev',
            path: productDevMatch[1],
            status: productDevMatch[2] === '✅' ? 'approved' : 'pending',
            lastUpdated: productDevMatch[3].trim(),
            prNumber: productDevMatch[4] ? parseInt(productDevMatch[4], 10) : undefined,
        };
    }

    // Format: | [Product Design](path) | ✅ Approved | 2026-01-25 | #456 |
    const productMatch = comment.body.match(
        /\|\s*\[Product Design\]\(([^)]+)\)\s*\|\s*([✅⏳])\s*\w+\s*\|\s*([^|]+?)\s*\|\s*#?(\d+)?\s*\|/
    );
    if (productMatch) {
        artifact.productDesign = {
            type: 'product-design',
            path: productMatch[1],
            status: productMatch[2] === '✅' ? 'approved' : 'pending',
            lastUpdated: productMatch[3].trim(),
            prNumber: productMatch[4] ? parseInt(productMatch[4], 10) : undefined,
        };
    }

    const techMatch = comment.body.match(
        /\|\s*\[Technical Design\]\(([^)]+)\)\s*\|\s*([✅⏳])\s*\w+\s*\|\s*([^|]+?)\s*\|\s*#?(\d+)?\s*\|/
    );
    if (techMatch) {
        artifact.techDesign = {
            type: 'tech-design',
            path: techMatch[1],
            status: techMatch[2] === '✅' ? 'approved' : 'pending',
            lastUpdated: techMatch[3].trim(),
            prNumber: techMatch[4] ? parseInt(techMatch[4], 10) : undefined,
        };
    }

    // Parse Pull Requests section (was "Implementation")
    // Format: | Phase 1/3: Name | 🎉 Merged | #458 |
    // Also supports old "Implementation" section for backward compatibility
    // Flexible: \s+ between Phase and numbers, optional colon/name, flexible whitespace
    const phaseMatches = comment.body.matchAll(
        /\|\s*Phase\s+(\d+)\s*\/\s*(\d+)(?:\s*:\s*([^|]+?))?\s*\|\s*([✅🔄⏳📝🎉])\s*([^|]+?)\s*\|\s*#?(\d+)?\s*\|/g
    );
    const phases: ImplementationPhaseArtifact[] = [];
    for (const match of phaseMatches) {
        const statusEmoji = match[4];
        let status: ImplementationStatus = 'pending';
        if (statusEmoji === '🎉') status = 'merged';
        else if (statusEmoji === '✅') status = 'approved';
        else if (statusEmoji === '🔄') status = 'in-review';
        else if (statusEmoji === '📝') status = 'changes-requested';
        else if (statusEmoji === '⏳') status = 'pending';

        phases.push({
            phase: parseInt(match[1], 10),
            totalPhases: parseInt(match[2], 10),
            name: match[3]?.trim() || '',
            status,
            prNumber: match[6] ? parseInt(match[6], 10) : undefined,
        });
    }

    if (phases.length > 0) {
        artifact.implementation = { phases };
    } else {
        // Legacy single-phase format (backward compatibility)
        // Look for old Implementation section without phases
        const singleMatch = comment.body.match(
            /## (?:Implementation|Pull Requests?)[\s\S]*?\|\s*([✅🔄⏳📝🎉])\s*([^|]+)\|\s*#?(\d+)?\s*\|/
        );
        if (singleMatch) {
            const statusEmoji = singleMatch[1];
            let status: ImplementationStatus = 'pending';
            if (statusEmoji === '🎉') status = 'merged';
            else if (statusEmoji === '✅') status = 'approved';
            else if (statusEmoji === '🔄') status = 'in-review';
            else if (statusEmoji === '📝') status = 'changes-requested';
            else if (statusEmoji === '⏳') status = 'pending';

            artifact.implementation = {
                status,
                prNumber: singleMatch[3] ? parseInt(singleMatch[3], 10) : undefined,
            };
        }
    }

    // Parse task branch (for multi-phase feature branch workflow)
    // Format: **Feature Branch:** `feature/task-123`
    const taskBranchMatch = comment.body.match(
        /\*\*Feature Branch:\*\*\s*`([^`]+)`/
    );
    if (taskBranchMatch) {
        artifact.taskBranch = taskBranchMatch[1];
    }

    // Return the artifact even if empty (for existence check)
    return artifact;
}

/**
 * Extract product design path from artifact
 * @returns File path if product design exists and is approved, null otherwise
 */
export function getProductDesignPath(artifact: ArtifactComment | null): string | null {
    if (!artifact?.productDesign) {
        return null;
    }
    return artifact.productDesign.path;
}

/**
 * Extract tech design path from artifact
 * @returns File path if tech design exists and is approved, null otherwise
 */
export function getTechDesignPath(artifact: ArtifactComment | null): string | null {
    if (!artifact?.techDesign) {
        return null;
    }
    return artifact.techDesign.path;
}

/**
 * Extract task branch from artifact
 * @returns Task branch name if set (multi-phase feature), null otherwise
 */
export function getTaskBranch(artifact: ArtifactComment | null): string | null {
    if (!artifact?.taskBranch) {
        return null;
    }
    return artifact.taskBranch;
}

/**
 * Generate task branch name for multi-phase feature (feature branch)
 *
 * This is the BASE BRANCH for all phase PRs in a multi-phase feature.
 * Phase branches are created from this branch, and phase PRs target this branch.
 * After all phases complete, a final PR is created from this branch to main.
 *
 * Naming convention:
 * - Task branch (this): "feature/task-{issueNumber}" - base for all phases
 * - Phase branches: "feature/task-{issueNumber}-phase-{N}" - individual phases
 * - Single-phase: "feature/issue-{issueNumber}-{slug}" - direct to main (different convention)
 *
 * @returns Branch name: "feature/task-{issueNumber}"
 */
export function generateTaskBranchName(issueNumber: number): string {
    return `feature/task-${issueNumber}`;
}

/**
 * Generate phase branch name for a specific phase implementation
 *
 * Phase branches are created FROM the task branch and PRs TARGET the task branch.
 * This provides isolation for each phase while accumulating changes on the feature branch.
 *
 * @param issueNumber - The GitHub issue number
 * @param phase - The phase number (must be >= 1)
 * @returns Branch name: "feature/task-{issueNumber}-phase-{phase}"
 * @throws Error if phase is less than 1
 */
export function generatePhaseBranchName(issueNumber: number, phase: number): string {
    if (phase < 1) {
        throw new Error(`Invalid phase number: ${phase}. Phase must be >= 1`);
    }
    return `feature/task-${issueNumber}-phase-${phase}`;
}

// ============================================================
// FORMATTING - Create comment body
// ============================================================

/**
 * Get status emoji and label for implementation status
 */
function getImplementationStatusDisplay(status: ImplementationStatus): { emoji: string; label: string } {
    switch (status) {
        case 'pending':
            return { emoji: '⏳', label: 'Pending' };
        case 'in-review':
            return { emoji: '🔄', label: 'In Review' };
        case 'approved':
            return { emoji: '✅', label: 'Approved' };
        case 'changes-requested':
            return { emoji: '📝', label: 'Changes Requested' };
        case 'merged':
            return { emoji: '🎉', label: 'Merged' };
        default:
            return { emoji: '⏳', label: 'Pending' };
    }
}

/**
 * Format artifact data into markdown comment
 * This is OUR deterministic code - not relying on LLM formatting.
 */
export function formatArtifactComment(artifacts: ArtifactComment): string {
    const sections: string[] = [];

    // Design Documents section
    const designRows: string[] = [];
    if (artifacts.productDevelopment) {
        const { path, status, lastUpdated, prNumber } = artifacts.productDevelopment;
        const statusEmoji = status === 'approved' ? '✅' : '⏳';
        const statusLabel = status === 'approved' ? 'Approved' : 'Pending';
        const prLink = prNumber ? `#${prNumber}` : '-';
        designRows.push(`| [Product Development](${path}) | ${statusEmoji} ${statusLabel} | ${lastUpdated} | ${prLink} |`);
    }

    if (artifacts.productDesign) {
        const { path, status, lastUpdated, prNumber } = artifacts.productDesign;
        const statusEmoji = status === 'approved' ? '✅' : '⏳';
        const statusLabel = status === 'approved' ? 'Approved' : 'Pending';
        const prLink = prNumber ? `#${prNumber}` : '-';
        designRows.push(`| [Product Design](${path}) | ${statusEmoji} ${statusLabel} | ${lastUpdated} | ${prLink} |`);
    }

    if (artifacts.techDesign) {
        const { path, status, lastUpdated, prNumber } = artifacts.techDesign;
        const statusEmoji = status === 'approved' ? '✅' : '⏳';
        const statusLabel = status === 'approved' ? 'Approved' : 'Pending';
        const prLink = prNumber ? `#${prNumber}` : '-';
        designRows.push(`| [Technical Design](${path}) | ${statusEmoji} ${statusLabel} | ${lastUpdated} | ${prLink} |`);
    }

    if (designRows.length > 0) {
        sections.push(`## Design Documents

| Document | Status | Updated | PR |
|----------|--------|---------|-----|
${designRows.join('\n')}`);
    }

    // Pull Requests section (renamed from "Implementation")
    if (artifacts.implementation) {
        const impl = artifacts.implementation;

        if (impl.phases && impl.phases.length > 0) {
            // Multi-phase format (or single-phase using Phase 1/1)
            const phaseRows = impl.phases.map(p => {
                const { emoji, label } = getImplementationStatusDisplay(p.status);
                const prLink = p.prNumber ? `#${p.prNumber}` : '-';
                // Include name if provided, otherwise just "Phase X/Y"
                const phaseName = p.name ? `Phase ${p.phase}/${p.totalPhases}: ${p.name}` : `Phase ${p.phase}/${p.totalPhases}`;
                return `| ${phaseName} | ${emoji} ${label} | ${prLink} |`;
            });

            sections.push(`## Pull Requests

| Phase | Status | PR |
|-------|--------|-----|
${phaseRows.join('\n')}`);
        } else if (impl.status) {
            // Legacy single-phase format - convert to Phase 1/1 for consistency
            const { emoji, label } = getImplementationStatusDisplay(impl.status);
            const prLink = impl.prNumber ? `#${impl.prNumber}` : '-';

            sections.push(`## Pull Requests

| Phase | Status | PR |
|-------|--------|-----|
| Phase 1/1 | ${emoji} ${label} | ${prLink} |`);
        }
    }

    // Feature Branch section (for multi-phase workflow)
    if (artifacts.taskBranch) {
        sections.push(`## Feature Branch

**Feature Branch:** \`${artifacts.taskBranch}\`

*Multi-phase feature using feature branch workflow. Phase PRs target this branch.*`);
    }

    // Return empty string if nothing to show
    if (sections.length === 0) {
        return `${ARTIFACT_COMMENT_MARKER}
## Issue Artifacts

*No artifacts yet. Design documents and implementation PRs will appear here.*

---
*Maintained by agents. Do not edit manually.*`;
    }

    return `${ARTIFACT_COMMENT_MARKER}
${sections.join('\n\n')}

---
*Maintained by agents. Do not edit manually.*`;
}

// ============================================================
// SAVING - Create/update on GitHub
// ============================================================

/**
 * Create or update artifact comment on issue
 * Finds existing artifact comment by marker and updates it, or creates new if not found
 */
export async function saveArtifactComment(
    adapter: ProjectManagementAdapter,
    issueNumber: number,
    artifacts: ArtifactComment
): Promise<void> {
    const body = formatArtifactComment(artifacts);
    if (!body) {
        console.log('  No artifacts to save');
        return;
    }

    // Try to find existing artifact comment
    const existingComment = await adapter.findIssueCommentByMarker(issueNumber, ARTIFACT_COMMENT_MARKER);

    if (existingComment) {
        // Update existing comment
        await adapter.updateIssueComment(issueNumber, existingComment.id, body);
        console.log(`  Updated artifact comment (ID: ${existingComment.id})`);
    } else {
        // Create new comment
        const commentId = await adapter.addIssueComment(issueNumber, body);
        console.log(`  Created artifact comment (ID: ${commentId})`);
    }
}

/**
 * Add or update a single design in artifact comment
 * Preserves other designs in the artifact
 */
export async function updateDesignArtifact(
    adapter: ProjectManagementAdapter,
    issueNumber: number,
    design: DesignArtifact
): Promise<void> {
    // Get existing artifacts
    const comments = await adapter.getIssueComments(issueNumber);
    const existingArtifact = parseArtifactComment(comments) || {};

    // Update the appropriate design
    if (design.type === 'product-dev') {
        existingArtifact.productDevelopment = design;
    } else if (design.type === 'product-design') {
        existingArtifact.productDesign = design;
    } else {
        existingArtifact.techDesign = design;
    }

    // Save updated artifact
    await saveArtifactComment(adapter, issueNumber, existingArtifact);
}

/**
 * Ensure artifact comment exists on issue
 * Creates an empty artifact comment if one doesn't exist
 * Useful for initializing artifact tracking when issue enters the pipeline
 */
export async function ensureArtifactComment(
    adapter: ProjectManagementAdapter,
    issueNumber: number
): Promise<void> {
    const comments = await adapter.getIssueComments(issueNumber);

    if (hasArtifactComment(comments)) {
        console.log(`  Artifact comment already exists for issue #${issueNumber}`);
        return;
    }

    // Create empty artifact comment
    const body = formatArtifactComment({});
    await adapter.addIssueComment(issueNumber, body);
    console.log(`  Created empty artifact comment for issue #${issueNumber}`);
}

/**
 * Update implementation artifact for single-phase feature
 * @param adapter Project management adapter
 * @param issueNumber Issue number
 * @param status Implementation status
 * @param prNumber PR number (optional, for when PR is created)
 */
export async function updateImplementationArtifact(
    adapter: ProjectManagementAdapter,
    issueNumber: number,
    status: ImplementationStatus,
    prNumber?: number
): Promise<void> {
    const comments = await adapter.getIssueComments(issueNumber);
    const existingArtifact = parseArtifactComment(comments) || {};

    // Update implementation (single-phase)
    existingArtifact.implementation = {
        status,
        prNumber,
    };

    await saveArtifactComment(adapter, issueNumber, existingArtifact);
}

/**
 * Update implementation artifact for a specific phase of multi-phase feature
 * @param adapter Project management adapter
 * @param issueNumber Issue number
 * @param phase Current phase number (1-indexed)
 * @param totalPhases Total number of phases
 * @param phaseName Name of the phase
 * @param status Implementation status
 * @param prNumber PR number (optional)
 */
export async function updateImplementationPhaseArtifact(
    adapter: ProjectManagementAdapter,
    issueNumber: number,
    phase: number,
    totalPhases: number,
    phaseName: string,
    status: ImplementationStatus,
    prNumber?: number
): Promise<void> {
    const comments = await adapter.getIssueComments(issueNumber);
    const existingArtifact = parseArtifactComment(comments) || {};

    // Initialize phases array if needed
    if (!existingArtifact.implementation) {
        existingArtifact.implementation = { phases: [] };
    }
    if (!existingArtifact.implementation.phases) {
        existingArtifact.implementation.phases = [];
    }

    // Find or create phase entry
    const existingPhaseIndex = existingArtifact.implementation.phases.findIndex(
        p => p.phase === phase
    );

    const phaseArtifact: ImplementationPhaseArtifact = {
        phase,
        totalPhases,
        name: phaseName,
        status,
        prNumber,
    };

    if (existingPhaseIndex >= 0) {
        existingArtifact.implementation.phases[existingPhaseIndex] = phaseArtifact;
    } else {
        existingArtifact.implementation.phases.push(phaseArtifact);
        // Sort by phase number
        existingArtifact.implementation.phases.sort((a, b) => a.phase - b.phase);
    }

    await saveArtifactComment(adapter, issueNumber, existingArtifact);
}

/**
 * Initialize all implementation phases from tech design
 * Pre-populates all phases with "pending" status when tech design is approved
 * This gives visibility into the full implementation roadmap
 *
 * @param adapter Project management adapter
 * @param issueNumber Issue number
 * @param phases Array of phases from tech design (order, name)
 */
export async function initializeImplementationPhases(
    adapter: ProjectManagementAdapter,
    issueNumber: number,
    phases: Array<{ order: number; name: string }>
): Promise<void> {
    const comments = await adapter.getIssueComments(issueNumber);
    const existingArtifact = parseArtifactComment(comments) || {};

    const totalPhases = phases.length;

    // Create all phases with pending status
    existingArtifact.implementation = {
        phases: phases.map(p => ({
            phase: p.order,
            totalPhases,
            name: p.name,
            status: 'pending' as ImplementationStatus,
            prNumber: undefined,
        })),
    };

    await saveArtifactComment(adapter, issueNumber, existingArtifact);
    console.log(`  Initialized ${totalPhases} implementation phases in artifact comment`);
}

// ============================================================
// TASK BRANCH MANAGEMENT (Multi-Phase Feature Branch Workflow)
// ============================================================

/**
 * Set task branch in artifact comment
 * Used for multi-phase features to track the feature branch
 *
 * @param adapter Project management adapter
 * @param issueNumber Issue number
 * @param taskBranch Task branch name (e.g., "feature/task-123")
 */
export async function setTaskBranch(
    adapter: ProjectManagementAdapter,
    issueNumber: number,
    taskBranch: string
): Promise<void> {
    const comments = await adapter.getIssueComments(issueNumber);
    const existingArtifact = parseArtifactComment(comments) || {};

    existingArtifact.taskBranch = taskBranch;

    await saveArtifactComment(adapter, issueNumber, existingArtifact);
    console.log(`  [LOG:FEATURE_BRANCH] Set task branch in artifact: ${taskBranch}`);
}

/**
 * Clear task branch from artifact comment
 * Used after final PR is merged and feature branch is deleted
 *
 * @param adapter Project management adapter
 * @param issueNumber Issue number
 */
export async function clearTaskBranch(
    adapter: ProjectManagementAdapter,
    issueNumber: number
): Promise<void> {
    const comments = await adapter.getIssueComments(issueNumber);
    const existingArtifact = parseArtifactComment(comments) || {};

    // Log existing artifact state for debugging
    console.log(`  [LOG:FEATURE_BRANCH] clearTaskBranch: Found ${comments.length} comments`);
    if (existingArtifact.implementation?.phases) {
        console.log(`  [LOG:FEATURE_BRANCH] clearTaskBranch: Preserving ${existingArtifact.implementation.phases.length} phases:`);
        existingArtifact.implementation.phases.forEach(p => {
            console.log(`    Phase ${p.phase}/${p.totalPhases}: ${p.status} (PR #${p.prNumber || 'none'})`);
        });
    } else {
        console.log(`  [LOG:FEATURE_BRANCH] clearTaskBranch: No implementation phases found in artifact`);
    }

    delete existingArtifact.taskBranch;

    await saveArtifactComment(adapter, issueNumber, existingArtifact);
    console.log(`  [LOG:FEATURE_BRANCH] Cleared task branch from artifact`);
}

/**
 * Get task branch from issue comments
 * Convenience function that fetches comments and extracts task branch
 *
 * @param adapter Project management adapter
 * @param issueNumber Issue number
 * @returns Task branch name if set, null otherwise
 */
export async function getTaskBranchFromIssue(
    adapter: ProjectManagementAdapter,
    issueNumber: number
): Promise<string | null> {
    const comments = await adapter.getIssueComments(issueNumber);
    const artifact = parseArtifactComment(comments);
    return getTaskBranch(artifact);
}

