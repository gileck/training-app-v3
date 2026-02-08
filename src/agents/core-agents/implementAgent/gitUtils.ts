import { execSync } from 'child_process';
import {
    getProjectManagementAdapter,
    git,
} from '../../shared';
import {
    generateTaskBranchName,
} from '../../lib/artifacts';
import {
    logFeatureBranch,
} from '../../lib/logging';

/**
 * Create a branch from a specific base branch
 * Used for creating phase branches from feature branch in multi-phase workflow
 */
export function createBranchFromBase(newBranch: string, baseBranch: string, issueNumber: number): void {
    const msg = `Creating branch ${newBranch} from ${baseBranch}`;
    console.log(`  🌿 ${msg}`);
    logFeatureBranch(issueNumber, msg);
    // Ensure base branch is up to date
    try {
        git(`fetch origin ${baseBranch}`, { silent: true });
    } catch {
        const fetchMsg = `Could not fetch ${baseBranch} - may not exist remotely yet`;
        console.log(`  🌿 ${fetchMsg}`);
        logFeatureBranch(issueNumber, fetchMsg);
    }
    // Create new branch from base
    git(`checkout -b ${newBranch} origin/${baseBranch}`);
}

/**
 * Create the feature branch for multi-phase workflow
 * Returns the feature branch name
 */
export async function ensureFeatureBranch(
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number,
    defaultBranch: string
): Promise<string> {
    const taskBranchName = generateTaskBranchName(issueNumber);
    const ensureMsg = `Ensuring feature branch exists: ${taskBranchName}`;
    console.log(`  🌿 ${ensureMsg}`);
    logFeatureBranch(issueNumber, ensureMsg);

    // Check if branch exists remotely
    const branchExists = await adapter.branchExists(taskBranchName);

    if (branchExists) {
        const existsMsg = `Feature branch already exists: ${taskBranchName}`;
        console.log(`  🌿 ${existsMsg}`);
        logFeatureBranch(issueNumber, existsMsg);
    } else {
        const createMsg = `Creating feature branch: ${taskBranchName} from ${defaultBranch}`;
        console.log(`  🌿 ${createMsg}`);
        logFeatureBranch(issueNumber, createMsg);
        await adapter.createBranch(taskBranchName, defaultBranch);
        const successMsg = `Feature branch created successfully`;
        console.log(`  🌿 ${successMsg}`);
        logFeatureBranch(issueNumber, successMsg);
    }

    return taskBranchName;
}

/**
 * Generate a branch name from issue number and title
 * For multi-phase features, includes the phase number
 */
export function generateBranchName(issueNumber: number, title: string, isBug: boolean = false, phaseNumber?: number): string {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes AFTER truncating
    const prefix = isBug ? 'fix' : 'feature';
    if (phaseNumber) {
        return `${prefix}/issue-${issueNumber}-phase-${phaseNumber}-${slug}`;
    }
    return `${prefix}/issue-${issueNumber}-${slug}`;
}

/**
 * Verify all commits are pushed to remote
 */
export function verifyAllPushed(branchName: string): boolean {
    try {
        // Check if there are any commits that exist locally but not on remote
        const unpushedCommits = git(`rev-list origin/${branchName}..HEAD`, { silent: true });
        return unpushedCommits.trim().length === 0;
    } catch {
        // Remote branch doesn't exist yet - commits are not pushed
        return false;
    }
}

/**
 * Pull latest from a branch
 */
export function pullBranch(branchName: string): void {
    git(`pull origin ${branchName} --rebase`);
}

/**
 * Run yarn checks:ci and return results
 * This runs BOTH TypeScript and ESLint checks, showing ALL errors at once
 *
 * CRITICAL: Uses exit code to determine success/failure, NOT output parsing.
 * Exit code 0 = success, non-zero = failure. This is the ONLY reliable way.
 */
export function runYarnChecks(): { success: boolean; output: string } {
    try {
        const output = execSync('yarn checks:ci', {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 120000,
        });
        // If execSync didn't throw, the command succeeded (exit code 0)
        return {
            success: true,
            output
        };
    } catch (error) {
        // execSync throws when command exits with non-zero code = failure
        const err = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
        const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString() || '';
        const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString() || '';
        const output = stdout + stderr || err.message || String(error);

        return {
            success: false,
            output,
        };
    }
}

/**
 * Get list of changed files compared to base branch
 * Uses origin/baseBranch...HEAD to get all files changed since branching
 */
export function getChangedFiles(baseBranch: string = 'main'): string[] {
    try {
        // Get files changed since branching from base (not uncommitted changes)
        const output = git(`diff --name-only origin/${baseBranch}...HEAD`, { silent: true });
        return output.split('\n').filter((f) => f.trim());
    } catch {
        return [];
    }
}
