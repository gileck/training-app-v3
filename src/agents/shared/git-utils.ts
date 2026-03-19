/**
 * Shared Git Utilities
 *
 * Thin wrappers that delegate to the GitAdapter singleton.
 * This preserves the existing import API so no consumer changes are needed.
 *
 * The indirection through GitAdapter enables E2E tests to inject a
 * MockGitAdapter (via setGitAdapter) without modifying consumer code.
 * See git-adapter.ts for the full DI pattern explanation.
 */

import { getGitAdapter } from './git-adapter';

interface GitOptions {
    cwd?: string;
    silent?: boolean;
}

export function git(command: string, options: GitOptions = {}): string {
    return getGitAdapter().git(command, options);
}

export function hasUncommittedChanges(excludePaths?: string[]): boolean {
    return getGitAdapter().hasUncommittedChanges(excludePaths);
}

export function getUncommittedChanges(excludePaths?: string[]): string {
    return getGitAdapter().getUncommittedChanges(excludePaths);
}

export function branchExistsLocally(branchName: string): boolean {
    return getGitAdapter().branchExistsLocally(branchName);
}

export function checkoutBranch(branchName: string, createFromDefault: boolean = false): void {
    return getGitAdapter().checkoutBranch(branchName, createFromDefault);
}

export function getCurrentBranch(): string {
    return getGitAdapter().getCurrentBranch();
}

export function commitChanges(message: string): void {
    return getGitAdapter().commitChanges(message);
}

export function pushBranch(branchName: string, force: boolean = false): void {
    return getGitAdapter().pushBranch(branchName, force);
}

export function getDefaultBranch(): string {
    return getGitAdapter().getDefaultBranch();
}
