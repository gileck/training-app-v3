/**
 * Project Management Configuration
 *
 * Status constants and configuration for the project management system.
 * These values are shared across the app (server APIs, agents, etc.)
 *
 * ============================================================
 * STATUS TRACKING DESIGN - TWO-TIER SYSTEM
 * ============================================================
 *
 * The workflow uses a TWO-TIER status system:
 *
 * 1. MongoDB (high-level): `new` → `in_progress` → `done` | `rejected`
 *    - Purpose: User-facing feature request list, basic filtering
 *    - Updated: On approval (→ in_progress) and PR merge (→ done)
 *    - Simplified view for end users
 *
 * 2. GitHub Projects (detailed): Backlog → Product Design → Tech Design →
 *    Implementation → PR Review → Done
 *    - Purpose: Agent workflow, detailed progress tracking
 *    - Source of truth for: Current workflow phase
 *    - Detailed view for agents/admins
 *
 * Why this design?
 * - MongoDB provides a simplified view for users who don't need workflow details
 * - GitHub Projects provides detailed phase tracking for agents and admins
 * - MongoDB `in_progress` spans all active workflow phases (design through implementation)
 * - This eliminates duplication and keeps each system focused on its purpose
 */

// ============================================================
// STATUSES - Same for all projects (not configurable)
// ============================================================

/**
 * Main status values (GitHub Project board columns)
 *
 * 6-column workflow:
 * - Backlog: New items, not yet started
 * - Product Design: AI generates product design, human reviews
 * - Technical Design: AI generates tech design, human reviews
 * - Implementation: AI implements and creates PR, human reviews
 * - PR Review: PR created, awaiting human review/merge
 * - Done: Completed and merged
 *
 * Review Status field tracks sub-states within each phase:
 * - (empty): Ready for AI agent to process
 * - Waiting for Review: AI finished, human needs to review
 * - Approved: Human approved, ready to advance to next phase
 * - Request Changes: Human wants revisions
 * - Rejected: Won't proceed
 */
export const STATUSES = {
    backlog: 'Backlog',
    productDesign: 'Product Design',
    techDesign: 'Technical Design',
    implementation: 'Ready for development',
    prReview: 'PR Review',
    done: 'Done',
} as const;

/**
 * Review status values (custom field for review phases)
 */
export const REVIEW_STATUSES = {
    waitingForReview: 'Waiting for Review',
    approved: 'Approved',
    requestChanges: 'Request Changes',
    rejected: 'Rejected',
    waitingForClarification: 'Waiting for Clarification',
    clarificationReceived: 'Clarification Received',
} as const;

/**
 * Custom field name for review status
 */
export const REVIEW_STATUS_FIELD = 'Review Status';

// Type helpers
export type Status = (typeof STATUSES)[keyof typeof STATUSES];
export type ReviewStatus = (typeof REVIEW_STATUSES)[keyof typeof REVIEW_STATUSES];

// ============================================================
// PROJECT CONFIG
// ============================================================

export interface ProjectConfig {
    github: {
        /** GitHub username or organization name */
        owner: string;
        /** Repository name */
        repo: string;
        /** GitHub Project number (from URL: github.com/users/{owner}/projects/{number}) */
        projectNumber: number;
        /** Whether the project is owned by a user or organization */
        ownerType: 'user' | 'org';
    };
}

/**
 * Throws an error when a required environment variable is missing
 */
function throwMissingEnvError(envVar: string): never {
    throw new Error(
        `Missing required environment variable: ${envVar}\n\n` +
        `The GitHub Projects workflow requires the following environment variables:\n` +
        `  - GITHUB_OWNER: Your GitHub username or organization\n` +
        `  - GITHUB_REPO: Your repository name\n` +
        `  - GITHUB_PROJECT_NUMBER: Your GitHub Project number\n\n` +
        `See docs/init-github-projects-workflow.md for setup instructions.`
    );
}

/**
 * Get project configuration from environment or defaults
 */
export function getProjectConfig(): ProjectConfig {
    return {
        github: {
            owner: process.env.GITHUB_OWNER || throwMissingEnvError('GITHUB_OWNER'),
            repo: process.env.GITHUB_REPO || throwMissingEnvError('GITHUB_REPO'),
            projectNumber: parseInt(
                process.env.GITHUB_PROJECT_NUMBER || throwMissingEnvError('GITHUB_PROJECT_NUMBER'),
                10
            ),
            ownerType: (process.env.GITHUB_OWNER_TYPE || 'user') as 'user' | 'org',
        },
    };
}

// ============================================================
// DERIVED VALUES
// ============================================================

/**
 * Get the GitHub repository URL
 */
export function getRepoUrl(config?: ProjectConfig): string {
    const c = config || getProjectConfig();
    return `https://github.com/${c.github.owner}/${c.github.repo}`;
}

/**
 * Get the GitHub Project URL
 */
export function getProjectUrl(config?: ProjectConfig): string {
    const c = config || getProjectConfig();
    const ownerPath = c.github.ownerType === 'user' ? 'users' : 'orgs';
    return `https://github.com/${ownerPath}/${c.github.owner}/projects/${c.github.projectNumber}`;
}

/**
 * Get issue URL
 */
export function getIssueUrl(issueNumber: number, config?: ProjectConfig): string {
    return `${getRepoUrl(config)}/issues/${issueNumber}`;
}

/**
 * Get PR URL
 */
export function getPrUrl(prNumber: number, config?: ProjectConfig): string {
    return `${getRepoUrl(config)}/pull/${prNumber}`;
}
