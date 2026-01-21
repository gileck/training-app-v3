#!/usr/bin/env tsx
/**
 * PR Review Agent
 *
 * Reviews Pull Requests for GitHub Project items using Claude Code slash commands.
 *
 * Flow:
 *   - Fetches items in "PR Review" status with Review Status = "Waiting for Review"
 *   - Extracts PR number from issue comments
 *   - Checks out the feature branch locally
 *   - Runs /pr-review slash command via Claude agent
 *   - Posts structured review comment on PR
 *   - Updates Review Status accordingly
 *   - Checks out back to main branch
 *
 * Usage:
 *   yarn agent:pr-review                    # Process all pending
 *   yarn agent:pr-review --id <item-id>     # Process specific item
 *   yarn agent:pr-review --dry-run          # Preview without changes
 *   yarn agent:pr-review --stream           # Stream Claude output
 */

import './shared/loadEnv';
import { execSync } from 'child_process';
import { Command } from 'commander';
import {
    // Config
    STATUSES,
    REVIEW_STATUSES,
    agentConfig,
    // Project management
    getProjectManagementAdapter,
    type ProjectItem,
    // Claude
    runAgent,
    extractReview,
    parseReviewDecision,
    // Notifications
    notifyPRReviewComplete,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    // Types
    type CommonCLIOptions,
    // Utils
    getIssueType,
} from './shared';

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    prNumber: number;
}

interface PRReviewOptions extends CommonCLIOptions {
    skipCheckout?: boolean;
}

// ============================================================
// GIT UTILITIES
// ============================================================

/**
 * Execute a git command and return the output
 */
function git(command: string, options: { cwd?: string; silent?: boolean } = {}): string {
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
 * Get current branch name
 */
function getCurrentBranch(): string {
    return git('branch --show-current', { silent: true });
}

/**
 * Checkout a branch
 */
function checkoutBranch(branchName: string): void {
    git(`checkout ${branchName}`);
}

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges(): boolean {
    const status = git('status --porcelain', { silent: true });
    return status.length > 0;
}

// ============================================================
// PR EXTRACTION
// ============================================================

/**
 * Extract PR number from issue comments
 */
async function extractPRNumber(
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number
): Promise<number | null> {
    const comments = await adapter.getIssueComments(issueNumber);

    // Look for PR link in comments (format: "PR: #123" or "Created PR #123")
    for (const comment of comments) {
        const match = comment.body.match(/(?:PR:|Created PR|Pull Request)\s*#(\d+)/i);
        if (match) {
            return parseInt(match[1], 10);
        }
    }

    return null;
}

/**
 * Generate a branch name from issue number and title (same as implement.ts)
 */
function generateBranchName(issueNumber: number, title: string, isBug: boolean = false): string {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
    const prefix = isBug ? 'fix' : 'feature';
    return `${prefix}/issue-${issueNumber}-${slug}`;
}

// ============================================================
// MAIN LOGIC
// ============================================================

async function processItem(
    processable: ProcessableItem,
    options: PRReviewOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    _defaultBranch: string
): Promise<{ success: boolean; decision?: 'approved' | 'request_changes'; error?: string }> {
    const { item, prNumber } = processable;
    const content = item.content;

    if (!content || content.type !== 'Issue') {
        return { success: false, error: 'Item has no linked issue' };
    }

    const issueNumber = content.number!;
    console.log(`\n  Processing issue #${issueNumber}: ${content.title}`);
    console.log(`  PR: #${prNumber}`);

    const issueType = getIssueType(content.labels);

    // Send "work started" notification
    if (!options.dryRun) {
        await notifyAgentStarted('PR Review', content.title, issueNumber, 'new', issueType);
    }

    try {
        // Check for uncommitted changes
        if (hasUncommittedChanges()) {
            return { success: false, error: 'Uncommitted changes in working directory. Please commit or stash them first.' };
        }

        // Generate branch name (same logic as implement.ts)
        const branchName = generateBranchName(issueNumber, content.title, issueType === 'bug');
        console.log(`  Branch: ${branchName}`);

        // Remember current branch
        const originalBranch = getCurrentBranch();

        if (!options.skipCheckout) {
            // Checkout the feature branch
            console.log(`  Checking out branch: ${branchName}`);
            try {
                checkoutBranch(branchName);
            } catch {
                // Try fetching first if checkout fails
                console.log('  Branch not found locally, fetching from remote...');
                git(`fetch origin ${branchName}:${branchName}`, { silent: true });
                checkoutBranch(branchName);
            }
        }

        try {
            // Run the /pr-review slash command
            console.log(`\n  Running PR review...`);
            const result = await runAgent({
                prompt: '/pr-review',
                useSlashCommands: true,
                allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
                stream: options.stream,
                verbose: options.verbose,
                timeout: agentConfig.claude.timeoutSeconds,
                progressLabel: 'Reviewing PR',
            });

            if (!result.success) {
                return { success: false, error: result.error || 'Review failed' };
            }

            // Extract review content
            const reviewContent = extractReview(result.content || '');
            if (!reviewContent) {
                return { success: false, error: 'Could not extract review content from agent output' };
            }

            // Parse decision
            const decision = parseReviewDecision(reviewContent);
            if (!decision) {
                return { success: false, error: 'Could not parse review decision (expected APPROVED or REQUEST_CHANGES)' };
            }

            console.log(`  Review decision: ${decision === 'approved' ? 'APPROVED ✓' : 'REQUEST CHANGES'}`);

            // Preview mode: show what would be posted
            if (options.dryRun) {
                console.log('\n  [DRY RUN] Would post review comment:');
                console.log('  ' + '='.repeat(60));
                console.log(reviewContent.split('\n').map(l => '  ' + l).join('\n'));
                console.log('  ' + '='.repeat(60));
                console.log(`\n  [DRY RUN] Would update review status to: ${decision === 'approved' ? 'Approved' : 'Request Changes'}`);
            } else {
                // Post review comment on PR
                await adapter.addPRComment(prNumber, reviewContent);
                console.log('  Posted review comment on PR');

                // Update review status
                const newReviewStatus = decision === 'approved'
                    ? REVIEW_STATUSES.approved
                    : REVIEW_STATUSES.requestChanges;

                await adapter.updateItemReviewStatus(item.id, newReviewStatus);
                console.log(`  Updated review status to: ${newReviewStatus}`);

                // Send notification
                await notifyPRReviewComplete(content.title, issueNumber, prNumber, decision, issueType);
            }

            return { success: true, decision };
        } finally {
            // Always checkout back to original branch
            if (!options.skipCheckout) {
                console.log(`  Checking out back to: ${originalBranch}`);
                checkoutBranch(originalBranch);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  Error: ${errorMessage}`);

        if (!options.dryRun) {
            await notifyAgentError('PR Review', content.title, issueNumber, errorMessage);
        }

        return { success: false, error: errorMessage };
    }
}

// ============================================================
// BATCH PROCESSING
// ============================================================

async function run(options: PRReviewOptions): Promise<void> {
    console.log('PR Review Agent');
    console.log('================\n');

    if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    const adapter = await getProjectManagementAdapter();

    // Get default branch
    const defaultBranch = git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');

    // Fetch items in "PR Review" with "Waiting for Review" status
    const filter = options.id
        ? { id: options.id }
        : { status: STATUSES.prReview, reviewStatus: REVIEW_STATUSES.waitingForReview };

    const items = await adapter.listItems(filter);

    if (items.length === 0) {
        if (options.id) {
            console.log(`No item found with ID: ${options.id}`);
        } else {
            console.log('No items pending PR review');
        }
        return;
    }

    console.log(`Found ${items.length} item(s) to review\n`);

    // Extract PR numbers from each item
    const processableItems: ProcessableItem[] = [];
    for (const item of items) {
        if (!item.content || item.content.type !== 'Issue') {
            console.log(`⚠️  Skipping item ${item.id}: No linked issue`);
            continue;
        }

        const prNumber = await extractPRNumber(adapter, item.content.number!);
        if (!prNumber) {
            console.log(`⚠️  Skipping issue #${item.content.number}: No PR found`);
            continue;
        }

        processableItems.push({ item, prNumber });
    }

    if (processableItems.length === 0) {
        console.log('No items with PRs to review');
        return;
    }

    // Process items
    const results: Array<{ item: ProjectItem; success: boolean; decision?: string; error?: string }> = [];
    const startTime = Date.now();

    for (const processable of processableItems) {
        const result = await processItem(processable, options, adapter, defaultBranch);
        results.push({
            item: processable.item,
            success: result.success,
            decision: result.decision,
            error: result.error,
        });

        // Add delay between items to avoid rate limits
        if (processableItems.indexOf(processable) < processableItems.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const approved = results.filter((r) => r.decision === 'approved').length;
    const requestedChanges = results.filter((r) => r.decision === 'request_changes').length;

    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Total: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`  - Approved: ${approved}`);
    console.log(`  - Requested Changes: ${requestedChanges}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${durationSeconds}s`);

    if (failed > 0) {
        console.log('\nFailed items:');
        for (const result of results.filter((r) => !r.success)) {
            console.log(`  - ${result.item.content?.title || result.item.id}: ${result.error}`);
        }
    }

    // Send batch notification
    if (!options.dryRun && results.length > 0) {
        await notifyBatchComplete('PR Review', results.length, successful, failed);
    }
}

// ============================================================
// CLI
// ============================================================

const program = new Command();

program
    .name('pr-review')
    .description('Review Pull Requests for GitHub Project items')
    .option('--id <item-id>', 'Process specific item by ID')
    .option('--dry-run', 'Preview without making changes')
    .option('--stream', 'Stream Claude output')
    .option('--verbose', 'Show verbose output')
    .option('--skip-checkout', 'Skip git checkout operations (for testing)')
    .action(async (options: PRReviewOptions) => {
        try {
            await run(options);
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    });

program.parse();
