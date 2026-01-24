/**
 * Project Management Types
 *
 * Domain types and adapter interface for the project management abstraction layer.
 * Uses GitHub-style naming but designed to be implementation-agnostic.
 */

import type { Status, ReviewStatus } from './config';
import type {
    LinkedPullRequest,
    GitHubIssueDetails,
} from '@/apis/feature-requests/types';

// Re-export types from API to avoid duplication
export type { LinkedPullRequest, GitHubIssueDetails };

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
     * Get PR details including state (open/closed) and merged status
     * Returns null if PR doesn't exist
     */
    getPRDetails(prNumber: number): Promise<{ state: 'open' | 'closed'; merged: boolean } | null>;

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
     * Create a new branch from the default branch
     */
    createBranch(branchName: string): Promise<void>;

    /**
     * Check if a branch exists
     */
    branchExists(branchName: string): Promise<boolean>;

    // --------------------------------------------------------
    // Project Fields (for advanced use)
    // --------------------------------------------------------

    /**
     * Get all project fields
     */
    getProjectFields(): Promise<ProjectField[]>;
}
