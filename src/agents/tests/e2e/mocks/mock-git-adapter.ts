/**
 * MockGitAdapter — in-memory git adapter for E2E tests.
 *
 * All methods are no-ops returning sensible defaults.
 * Use setImplementationAgentRan() to control hasUncommittedChanges().
 */

import type { GitAdapter } from '@/agents/shared/git-adapter';

export class MockGitAdapter implements GitAdapter {
    private _implementationAgentRan = false;

    git(): string {
        return '';
    }

    hasUncommittedChanges(excludePaths?: string[]): boolean {
        // With excludePaths: checking for pre-existing uncommitted changes -> always false (clean)
        if (excludePaths && excludePaths.length > 0) return false;
        // Without excludePaths: checking if agent made changes -> true only after implementation runs
        return this._implementationAgentRan;
    }

    getUncommittedChanges(): string {
        return this._implementationAgentRan ? 'M src/file.ts' : '';
    }

    branchExistsLocally(): boolean {
        return false;
    }

    checkoutBranch(): void {}

    getCurrentBranch(): string {
        return 'main';
    }

    commitChanges(): void {}

    pushBranch(): void {}

    getDefaultBranch(): string {
        return 'main';
    }

    // Test helpers
    setImplementationAgentRan(value: boolean): void {
        this._implementationAgentRan = value;
    }

    reset(): void {
        this._implementationAgentRan = false;
    }
}
