/**
 * GitAdapter — interface + singleton for dependency injection.
 *
 * Production code uses the DefaultGitAdapter (wraps execSync).
 * Tests inject a MockGitAdapter via setGitAdapter().
 */

export interface GitAdapter {
    git(command: string, options?: { cwd?: string; silent?: boolean }): string;
    hasUncommittedChanges(excludePaths?: string[]): boolean;
    getUncommittedChanges(excludePaths?: string[]): string;
    branchExistsLocally(branchName: string): boolean;
    checkoutBranch(branchName: string, createFromDefault?: boolean): void;
    getCurrentBranch(): string;
    commitChanges(message: string): void;
    pushBranch(branchName: string, force?: boolean): void;
    getDefaultBranch(): string;
}

let adapter: GitAdapter | null = null;

export function getGitAdapter(): GitAdapter {
    if (!adapter) {
        // Lazy-load to avoid circular dependency
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DefaultGitAdapter } = require('./git-adapter-default');
        adapter = new DefaultGitAdapter() as GitAdapter;
    }
    return adapter as GitAdapter;
}

export function setGitAdapter(newAdapter: GitAdapter): void {
    adapter = newAdapter;
}

export function resetGitAdapter(): void {
    adapter = null;
}
