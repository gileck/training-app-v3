/**
 * Project Management Types
 *
 * Domain types and adapter interface for the project management abstraction layer.
 * Uses GitHub-style naming but designed to be implementation-agnostic.
 */

import type { Status, ReviewStatus } from './config';

// ============================================================
// LINKED PR TYPES (used by adapter internally)
// These are adapter-internal types, not exposed via API
// ============================================================

export interface LinkedPullRequest {
    number: number;
    url: string;
    title: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    mergedAt?: string;
}

/**
 * GitHub Issue Details (returned by adapter)
 * Note: linkedPullRequests is for internal adapter use.
 * The API layer adds artifacts parsed from comments.
 */
export interface GitHubIssueDetails {
    number: number;
    title: string;
    body: string;
    url: string;
    state: 'OPEN' | 'CLOSED';
    linkedPullRequests: LinkedPullRequest[];
}

// ============================================================
// DOMAIN TYPES
// ============================================================

/**
 * Project item (card on the board)
 */
export interface ProjectItem {
    /** Project item ID */
    id: string;
    /** Current status value */
    status: Status | null;
    /** Current review status value (custom field) */
    reviewStatus: ReviewStatus | null;
    /** The linked issue or draft */
    content: ProjectItemContent | null;
    /** All field values for this item */
    fieldValues: ProjectItemFieldValue[];
}

/**
 * Content linked to a project item
 */
export interface ProjectItemContent {
    /** Content type */
    type: 'Issue' | 'DraftIssue' | 'PullRequest';
    /** Node ID for API operations */
    id: string;
    /** Issue/PR number */
    number?: number;
    /** Title */
    title: string;
    /** Body/description */
    body: string;
    /** URL */
    url?: string;
    /** State */
    state?: 'OPEN' | 'CLOSED';
    /** Labels */
    labels?: string[];
    /** Repository owner */
    repoOwner?: string;
    /** Repository name */
    repoName?: string;
}

/**
 * Field value on a project item
 */
export interface ProjectItemFieldValue {
    fieldId: string;
    fieldName: string;
    value: string | null;
    optionId?: string;
}

/**
 * Comment on an issue or PR
 */
export interface ProjectItemComment {
    id: number;
    body: string;
    author: string;
    createdAt: string;
    updatedAt?: string;
}

/**
 * PR review comment (specific to PRs, includes file/line info)
 */
export interface PRReviewComment {
    id: number;
    body: string;
    author: string;
    path?: string;
    line?: number;
    createdAt: string;
}

/**
 * Result from creating an issue
 */
export interface CreateIssueResult {
    number: number;
    nodeId: string;
    url: string;
}

/**
 * Result from creating a pull request
 */
export interface CreatePRResult {
    number: number;
    url: string;
}

/**
 * Project field information
 */
export interface ProjectField {
    id: string;
    name: string;
    dataType: string;
    options?: ProjectFieldOption[];
}

/**
 * Single select field option
 */
export interface ProjectFieldOption {
    id: string;
    name: string;
    description?: string;
    color?: string;
}

/**
 * Options for listing project items
 */
export interface ListItemsOptions {
    /** Filter by status */
    status?: string;
    /** Filter by review status */
    reviewStatus?: string;
    /** Maximum number of items to return */
    limit?: number;
}

// ============================================================
// ADAPTER INTERFACE
// ============================================================

/**
 * Project Management Adapter Interface
 *
 * Abstracts project management operations. Currently implemented for GitHub Projects V2,
 * but designed to support other systems (Jira, ClickUp, etc.) in the future.
 */
export interface ProjectManagementAdapter {
    // --------------------------------------------------------
    // Initialization
    // --------------------------------------------------------

    /**
     * Initialize the adapter (authenticate, fetch project metadata, etc.)
     */
    init(): Promise<void>;

    /**
     * Check if the adapter has been initialized
     */
    isInitialized(): boolean;

    // --------------------------------------------------------
    // Project Items
    // --------------------------------------------------------

    /**
     * List project items with optional filters
     */
    listItems(options?: ListItemsOptions): Promise<ProjectItem[]>;

    /**
     * Get a single project item by ID
     */
    getItem(itemId: string): Promise<ProjectItem | null>;

    // --------------------------------------------------------
    // Status Management
    // --------------------------------------------------------

    /**
     * Get available status options
     */
    getAvailableStatuses(): Promise<string[]>;

    /**
     * Get available review status options
     */
    getAvailableReviewStatuses(): Promise<string[]>;

    /**
     * Check if the review status field exists
     */
    hasReviewStatusField(): boolean;

    /**
     * Update the status of a project item
     */
    updateItemStatus(itemId: string, status: string): Promise<void>;

    /**
     * Update the review status of a project item
     */
    updateItemReviewStatus(itemId: string, reviewStatus: string): Promise<void>;

    /**
     * Clear the review status of a project item
     */
    clearItemReviewStatus(itemId: string): Promise<void>;

    // --------------------------------------------------------
    // Implementation Phase (Multi-PR Workflow)
    // --------------------------------------------------------

    /**
     * Check if the implementation phase field exists
     */
    hasImplementationPhaseField(): boolean;

    /**
     * Get the current implementation phase for an item
     * Returns format "X/N" (e.g., "1/3" for phase 1 of 3) or null if not set
     */
    getImplementationPhase(itemId: string): Promise<string | null>;

    /**
     * Set the implementation phase for an item
     * @param value Format "X/N" (e.g., "1/3" for phase 1 of 3)
     */
    setImplementationPhase(itemId: string, value: string): Promise<void>;

    /**
     * Clear the implementation phase for an item
     */
    clearImplementationPhase(itemId: string): Promise<void>;

    // --------------------------------------------------------
    // Issues
    // --------------------------------------------------------

    /**
     * Create a new issue
     */
    createIssue(title: string, body: string, labels?: string[]): Promise<CreateIssueResult>;

    /**
     * Update an issue's body
     */
    updateIssueBody(issueNumber: number, body: string): Promise<void>;

    /**
     * Add a comment to an issue
     */
    addIssueComment(issueNumber: number, body: string): Promise<number>;

    /**
     * Get comments on an issue
     */
    getIssueComments(issueNumber: number): Promise<ProjectItemComment[]>;

    /**
     * Get full issue details including body and linked PRs
     */
    getIssueDetails(issueNumber: number): Promise<GitHubIssueDetails | null>;

    /**
     * Add an issue to the project board
     */
    addIssueToProject(issueNodeId: string): Promise<string>;

    /**
     * Find an issue comment by marker
     * @returns Comment with id and body, or null if not found
     */
    findIssueCommentByMarker(issueNumber: number, marker: string): Promise<{
        id: number;
        body: string;
    } | null>;

    /**
     * Update an existing issue comment
     */
    updateIssueComment(issueNumber: number, commentId: number, body: string): Promise<void>;

    // --------------------------------------------------------
    // Pull Requests
    // --------------------------------------------------------

    /**
     * Create a pull request
     */
    createPullRequest(
        head: string,
        base: string,
        title: string,
        body: string,
        reviewers?: string[]
    ): Promise<CreatePRResult>;

    /**
     * Get review comments on a PR (inline code comments)
     */
    getPRReviewComments(prNumber: number): Promise<PRReviewComment[]>;

    /**
     * Get conversation comments on a PR (general comments, not inline)
     */
    getPRComments(prNumber: number): Promise<ProjectItemComment[]>;

    /**
     * Get the list of files changed in a PR (from GitHub API)
     * This is the authoritative list of what's actually in the PR
     */
    getPRFiles(prNumber: number): Promise<string[]>;

    /**
     * Add a comment to a PR
     */
    addPRComment(prNumber: number, body: string): Promise<number>;

    /**
     * Request reviewers for a PR
     */
    requestPRReviewers(prNumber: number, reviewers: string[]): Promise<void>;

    /**
     * Submit an official PR review (approve/request changes/comment)
     */
    submitPRReview(
        prNumber: number,
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
        body: string
    ): Promise<void>;

    /**
     * Get PR details including state (open/closed), merged status, and head branch
     * Returns null if PR doesn't exist
     */
    getPRDetails(prNumber: number): Promise<{ state: 'open' | 'closed'; merged: boolean; headBranch: string } | null>;

    /**
     * Merge a pull request using squash merge
     * @returns The merge commit SHA
     */
    mergePullRequest(
        prNumber: number,
        commitTitle: string,
        commitMessage: string
    ): Promise<string>;

    /**
     * Get the merge commit SHA for a merged pull request
     */
    getMergeCommitSha(prNumber: number): Promise<string | null>;

    /**
     * Create a revert PR for a previously merged commit
     * @param mergeCommitSha The SHA of the merge commit to revert
     * @param originalPrNumber The original PR number that was merged
     * @param issueNumber The issue number associated with the PR
     * @returns The revert PR details, or null if revert failed
     */
    createRevertPR(
        mergeCommitSha: string,
        originalPrNumber: number,
        issueNumber: number
    ): Promise<{ prNumber: number; url: string } | null>;

    /**
     * Find a PR comment by marker and return its body
     * Returns null if not found
     */
    findPRCommentByMarker(prNumber: number, marker: string): Promise<{
        id: number;
        body: string;
    } | null>;

    /**
     * Update an existing PR comment
     */
    updatePRComment(prNumber: number, commentId: number, body: string): Promise<void>;

    /**
     * Get PR info for commit message generation
     */
    getPRInfo(prNumber: number): Promise<{
        title: string;
        body: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        commits: number;
    } | null>;

    /**
     * Find the open PR for an issue.
     *
     * For feedback mode (Request Changes), finds the currently open PR
     * to push fixes to. Returns both PR number AND branch name (from the PR itself).
     *
     * Why get branch from PR?
     * - Branch name depends on title + phase - regenerating may fail if these changed
     * - The PR itself knows its actual branch name - use that!
     *
     * @returns PR number and branch name, or null if no open PR found
     */
    findOpenPRForIssue(issueNumber: number): Promise<{ prNumber: number; branchName: string } | null>;

    // --------------------------------------------------------
    // Branches
    // --------------------------------------------------------

    /**
     * Get the default branch of the repository
     */
    getDefaultBranch(): Promise<string>;

    /**
     * Create a new branch from the default branch (or specified base branch)
     * @param branchName - Name of the new branch to create
     * @param baseBranch - Optional base branch to create from (defaults to default branch)
     */
    createBranch(branchName: string, baseBranch?: string): Promise<void>;

    /**
     * Check if a branch exists
     */
    branchExists(branchName: string): Promise<boolean>;

    /**
     * Delete a branch from the repository
     * Used to clean up feature branches after PR merge
     */
    deleteBranch(branchName: string): Promise<void>;

    // --------------------------------------------------------
    // Project Fields (for advanced use)
    // --------------------------------------------------------

    /**
     * Get all project fields
     */
    getProjectFields(): Promise<ProjectField[]>;

    // --------------------------------------------------------
    // File Operations
    // --------------------------------------------------------

    /**
     * Create or update a file in the repository via GitHub Contents API
     * Used for committing log files from Vercel serverless functions
     *
     * @param path - File path relative to repo root (e.g., "agent-logs/issue-42.md")
     * @param content - File content (will be base64 encoded)
     * @param message - Commit message
     */
    createOrUpdateFileContents(path: string, content: string, message: string): Promise<void>;
}
