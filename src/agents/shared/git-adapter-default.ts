/**
 * DefaultGitAdapter — real implementation wrapping execSync.
 *
 * All logic moved from git-utils.ts into class methods.
 */

import { execSync } from 'child_process';
import type { GitAdapter } from './git-adapter';

export class DefaultGitAdapter implements GitAdapter {
    git(command: string, options: { cwd?: string; silent?: boolean } = {}): string {
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

    hasUncommittedChanges(excludePaths?: string[]): boolean {
        const status = this.git('status --porcelain', { silent: true });
        if (!excludePaths || excludePaths.length === 0) {
            return status.length > 0;
        }
        const lines = status.split('\n').filter(line => line.trim().length > 0);
        const relevantLines = lines.filter(line => {
            const filePath = line.slice(3);
            return !excludePaths.some(exclude => filePath.startsWith(exclude));
        });
        return relevantLines.length > 0;
    }

    getUncommittedChanges(excludePaths?: string[]): string {
        const status = this.git('status --porcelain', { silent: true });
        if (!excludePaths || excludePaths.length === 0) {
            return status;
        }
        const lines = status.split('\n').filter(line => line.trim().length > 0);
        const relevantLines = lines.filter(line => {
            const filePath = line.slice(3);
            return !excludePaths.some(exclude => filePath.startsWith(exclude));
        });
        return relevantLines.join('\n');
    }

    branchExistsLocally(branchName: string): boolean {
        try {
            this.git(`rev-parse --verify ${branchName}`, { silent: true });
            return true;
        } catch {
            return false;
        }
    }

    checkoutBranch(branchName: string, createFromDefault: boolean = false): void {
        if (createFromDefault) {
            const defaultBranch = this.git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
            this.git(`checkout -b ${branchName} origin/${defaultBranch}`);
        } else {
            this.git(`checkout ${branchName}`);
        }
    }

    getCurrentBranch(): string {
        return this.git('rev-parse --abbrev-ref HEAD', { silent: true });
    }

    commitChanges(message: string): void {
        this.git('add -A');
        const escapedMessage = message.replace(/'/g, "'\\''");
        this.git(`commit -m '${escapedMessage}'`);
    }

    pushBranch(branchName: string, force: boolean = false): void {
        const forceFlag = force ? '--force-with-lease' : '';
        this.git(`push -u origin ${branchName} ${forceFlag}`.trim());
    }

    getDefaultBranch(): string {
        return this.git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
    }
}
