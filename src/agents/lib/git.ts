/**
 * Git Utilities
 *
 * Shared git operations for design agents.
 * Provides functions for branch management, commits, and repository state.
 */

import { execSync } from 'child_process';

// ============================================================
// TYPES
// ============================================================

export interface GitCommandOptions {
    /** Working directory for the git command */
    cwd?: string;
    /** Suppress output (use 'pipe' for stdio) */
    silent?: boolean;
}

// ============================================================
// GIT UTILITIES
// ============================================================

/**
 * Execute a git command and return the output
 */
export function git(command: string, options: GitCommandOptions = {}): string {
    try {
        const result = execSync(`git ${command}`, {
            cwd: options.cwd || process.cwd(),
            encoding: 'utf-8',
            stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
        });
        return result.trim();
    } catch (error) {
        if (error instanceof Error && 'stderr' in error) {
            throw new Error((error as { stderr: string }).stderr || error.message);
        }
        throw error;
    }
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(): boolean {
    const status = git('status --porcelain', { silent: true });
    return status.length > 0;
}

/**
 * Check if a branch exists locally
 */
export function branchExistsLocally(branchName: string): boolean {
    try {
        git(`rev-parse --verify ${branchName}`, { silent: true });
        return true;
    } catch {
        return false;
    }
}

/**
 * Checkout a branch (create if doesn't exist)
 *
 * @param branchName - Branch name to checkout
 * @param createFromDefault - If true, creates new branch from origin/default
 */
export function checkoutBranch(branchName: string, createFromDefault: boolean = false): void {
    if (createFromDefault) {
        const defaultBranch = git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
        git(`checkout -b ${branchName} origin/${defaultBranch}`);
    } else {
        git(`checkout ${branchName}`);
    }
}

/**
 * Get current branch name
 */
export function getCurrentBranch(): string {
    return git('rev-parse --abbrev-ref HEAD', { silent: true });
}

/**
 * Commit all changes with a message
 */
export function commitChanges(message: string): void {
    git('add -A');
    // Use single quotes and escape them properly to avoid shell injection
    const escapedMessage = message.replace(/'/g, "'\\''");
    git(`commit -m '${escapedMessage}'`);
}

/**
 * Push current branch to origin
 *
 * @param branchName - Branch name to push
 * @param force - If true, uses --force-with-lease
 */
export function pushBranch(branchName: string, force: boolean = false): void {
    const forceFlag = force ? '--force-with-lease' : '';
    git(`push -u origin ${branchName} ${forceFlag}`.trim());
}

/**
 * Get the default branch name
 */
export function getDefaultBranch(): string {
    return git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
}
