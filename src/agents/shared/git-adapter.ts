/**
 * GitAdapter — interface + singleton for dependency injection.
 *
 * Abstraction kept for E2E test mockability. The MockGitAdapter (in
 * src/agents/tests/e2e/mocks/mock-git-adapter.ts) is injected via
 * setGitAdapter() during test setup, allowing E2E tests to run without
 * real git operations. All 7+ E2E test suites depend on this pattern.
 *
 * Production code uses the DefaultGitAdapter (wraps execSync).
 * Consumer code should import from git-utils.ts (thin wrappers) rather
 * than using getGitAdapter() directly.
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
