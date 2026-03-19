/**
 * GitHub Sync Types
 *
 * Shared types for the GitHub sync service.
 */

import type { ProjectManagementAdapter } from '@/server/template/project-management';

/**
 * Result of syncing an item to GitHub
 */
export interface SyncToGitHubResult {
    success: boolean;
    issueNumber?: number;
    issueUrl?: string;
    projectItemId?: string;
    error?: string;
}

/**
 * Options for sync operations
 */
export interface SyncOptions {
    /** Override the initial status (e.g., force Backlog instead of Bug Investigation) */
    initialStatusOverride?: string;
}

/**
 * Common fields that exist on both feature requests and bug reports after sync
 */
export interface GitHubSyncedFields {
    githubIssueUrl?: string;
    githubIssueNumber?: number;
    githubProjectItemId?: string;
}

/**
 * Issue result from creating a GitHub issue
 */
export interface IssueResult {
    number: number;
    url: string;
}

/**
 * Configuration for syncing a specific item type
 * Each item type (feature/bug) provides its own implementation of these functions
 */
export interface SyncItemConfig<T extends GitHubSyncedFields> {
    /** Get the item from the database */
    getFromDB: (id: string) => Promise<T | null>;

    /** Check if the item is already synced */
    isAlreadySynced: (item: T) => boolean;

    /** Get existing sync result if already synced */
    getExistingSyncResult: (item: T) => SyncToGitHubResult;

    /** Build the issue title */
    getTitle: (item: T) => string;

    /** Build the issue body */
    buildBody: (item: T) => string;

    /** Get labels for the issue */
    getLabels: (item: T) => string[];

    /** Update the database with GitHub fields after sync */
    updateDBWithGitHubFields: (
        id: string,
        fields: { githubIssueUrl: string; githubIssueNumber: number; githubProjectItemId: string; githubIssueTitle: string }
    ) => Promise<void>;

    /** Initial status to set after adding to project (defaults to Backlog) */
    initialStatus?: string;
}

/**
 * Configuration for approving a specific item type
 */
export interface ApproveItemConfig<T extends GitHubSyncedFields> {
    /** Get the item from the database */
    getFromDB: (id: string) => Promise<T | null>;

    /** Update status to "in progress" equivalent */
    setInProgressStatus: (id: string) => Promise<T | null>;

    /** Revert to "new" status if sync fails */
    revertToNewStatus: (id: string) => Promise<void>;

    /** Sync the item to GitHub */
    syncToGitHub: (id: string, options?: SyncOptions) => Promise<SyncToGitHubResult>;
}

/**
 * Core sync function type
 */
export type SyncItemToGitHub<T extends GitHubSyncedFields> = (
    itemId: string,
    config: SyncItemConfig<T>,
    adapter: ProjectManagementAdapter,
    options?: SyncOptions
) => Promise<SyncToGitHubResult>;
