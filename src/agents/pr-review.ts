#!/usr/bin/env tsx
/**
 * PR Review Agent
 *
 * Reviews Pull Requests for GitHub Project items using Claude Code native /review command.
 *
 * Flow:
 *   - Fetches items in "PR Review" status with Review Status = "Waiting for Review"
 *   - Extracts PR number from issue comments
 *   - Checks out the feature branch locally
 *   - Fetches all PR comments (conversation + inline review comments)
 *   - Runs native /review slash command with PR comments as context
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
    // Notifications
    notifyPRReviewComplete,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    // Types
    type CommonCLIOptions,
    // Utils
    getIssueType,
    // Agent Identity
    addAgentPrefix,
} from './shared';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logError,
} from './lib/logging';

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

interface PRReviewOutput {
    decision: 'approved' | 'request_changes';
    summary: string;
    reviewText: string;
}

// ============================================================
// OUTPUT FORMAT
// ============================================================

const PR_REVIEW_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            decision: {
                type: 'string',
                enum: ['approved', 'request_changes'],
            },
            summary: {
                type: 'string',
                description: '1-2 sentence summary of the review',
            },
            reviewText: {
                type: 'string',
                description: 'Full review content to post as PR comment',
            },
        },
        required: ['decision', 'summary', 'reviewText'],
    },
};

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
        .slice(0, 40)
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes AFTER truncating
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

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'pr-review',
        phase: 'PR Review',
        mode: 'Review',
        issueTitle: content.title,
        issueType,
    });

    return runWithLogContext(logCtx, async () => {
        logExecutionStart(logCtx);

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
            // Fetch all PR comments
            console.log('  Fetching PR comments...');
            const prConversationComments = await adapter.getPRComments(prNumber);
            const prReviewComments = await adapter.getPRReviewComments(prNumber);

            const totalComments = prConversationComments.length + prReviewComments.length;
            if (totalComments > 0) {
                const claudeCommentCount = prConversationComments.filter(c => c.author.toLowerCase() === 'claude').length;
                console.log(`  Found ${prConversationComments.length} conversation comments (${claudeCommentCount} from Claude Code), ${prReviewComments.length} review comments`);
            }

            // Build context with PR comments
            let contextPrompt = '';

            // Separate Claude Code comments from other comments
            const claudeComments = prConversationComments.filter(c => c.author.toLowerCase() === 'claude');
            const otherComments = prConversationComments.filter(c => c.author.toLowerCase() !== 'claude');

            // Add Claude Code's feedback as optional guidance (if exists)
            if (claudeComments.length > 0) {
                contextPrompt += '## Claude Code Review (Optional Guidance)\n\n';
                contextPrompt += 'Claude Code has provided the following feedback as additional guidance:\n\n';
                for (const comment of claudeComments) {
                    contextPrompt += `${comment.body}\n\n`;
                }
                contextPrompt += '**Note**: Claude Code feedback is advisory. You are the final authority on approval decisions. ';
                contextPrompt += 'Consider Claude\'s input but you may override if his concerns don\'t align with project guidelines or priorities.\n\n';
                contextPrompt += '---\n\n';
            }

            // Add other conversation comments
            if (otherComments.length > 0) {
                contextPrompt += '## Other PR Comments\n\n';
                contextPrompt += 'The following comments have been posted on the PR:\n\n';
                for (const comment of otherComments) {
                    contextPrompt += `**${comment.author}** (${new Date(comment.createdAt).toLocaleDateString()}):\n`;
                    contextPrompt += `${comment.body}\n\n`;
                }
                contextPrompt += '---\n\n';
            }

            // Add inline review comments
            if (prReviewComments.length > 0) {
                contextPrompt += '## PR Review Comments (Inline Code Comments)\n\n';
                contextPrompt += 'The following inline comments have been posted on specific code:\n\n';
                for (const comment of prReviewComments) {
                    contextPrompt += `**${comment.author}** on \`${comment.path}:${comment.line}\`:\n`;
                    contextPrompt += `${comment.body}\n\n`;
                }
                contextPrompt += '---\n\n';
            }

            if (contextPrompt) {
                contextPrompt += '## Your Role and Authority\n\n';
                contextPrompt += '**You are the FINAL AUTHORITY on this PR review.** Your decision determines the status.\n\n';
                contextPrompt += 'If Claude Code provided feedback above:\n';
                contextPrompt += '- Treat it as helpful advisory input\n';
                contextPrompt += '- You may override his suggestions if they conflict with project priorities\n';
                contextPrompt += '- You may approve even if Claude requested changes (if you determine they\'re not necessary)\n';
                contextPrompt += '- Use your judgment based on project guidelines\n\n';
                contextPrompt += '## Instructions\n\n';
                contextPrompt += 'Review this PR and make your final decision. ';
                contextPrompt += 'Provide your review decision (APPROVED or REQUEST_CHANGES) and detailed feedback.\n\n';
                contextPrompt += '**IMPORTANT**: Check compliance with project guidelines in `.cursor/rules/`:\n';
                contextPrompt += '- TypeScript guidelines (`.cursor/rules/typescript-guidelines.mdc`)\n';
                contextPrompt += '- React patterns (`.cursor/rules/react-component-organization.mdc`, `.cursor/rules/react-hook-organization.mdc`)\n';
                contextPrompt += '- State management (`.cursor/rules/state-management-guidelines.mdc`)\n';
                contextPrompt += '- UI/UX patterns (`.cursor/rules/ui-design-guidelines.mdc`, `.cursor/rules/shadcn-usage.mdc`)\n';
                contextPrompt += '- File organization (`.cursor/rules/feature-based-structure.mdc`)\n';
                contextPrompt += '- API patterns (`.cursor/rules/client-server-communications.mdc`)\n';
                contextPrompt += '- Comprehensive checklist (`.cursor/rules/app-guidelines-checklist.mdc`)\n\n';
            }

            // Run the /review slash command with context
            console.log(`\n  Running PR review...`);

            // JSON output instructions to append after /review
            const outputInstructions = `

After completing the review, provide your response as structured JSON with these fields:
- decision: either "approved" or "request_changes"
- summary: 1-2 sentence summary of the review
- reviewText: the full review content to post as PR comment`;

            let prompt: string;
            if (contextPrompt) {
                prompt = `${contextPrompt}/review${outputInstructions}`;
            } else {
                // No PR comments, but still provide guidelines
                prompt = `## Instructions

Review this PR and check compliance with project guidelines in \`.cursor/rules/\`:
- TypeScript guidelines (\`.cursor/rules/typescript-guidelines.mdc\`)
- React patterns (\`.cursor/rules/react-component-organization.mdc\`, \`.cursor/rules/react-hook-organization.mdc\`)
- State management (\`.cursor/rules/state-management-guidelines.mdc\`)
- UI/UX patterns (\`.cursor/rules/ui-design-guidelines.mdc\`, \`.cursor/rules/shadcn-usage.mdc\`)
- File organization (\`.cursor/rules/feature-based-structure.mdc\`)
- API patterns (\`.cursor/rules/client-server-communications.mdc\`)
- Comprehensive checklist (\`.cursor/rules/app-guidelines-checklist.mdc\`)

/review${outputInstructions}`;
            }

            const result = await runAgent({
                prompt,
                useSlashCommands: true,
                allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
                stream: options.stream,
                verbose: options.verbose,
                timeout: agentConfig.claude.timeoutSeconds,
                progressLabel: 'Reviewing PR',
                workflow: 'pr-review',
                outputFormat: PR_REVIEW_OUTPUT_FORMAT,
            });

            if (!result.success) {
                return { success: false, error: result.error || 'Review failed' };
            }

            // Extract structured output
            const output = result.structuredOutput as PRReviewOutput | undefined;
            if (!output) {
                return { success: false, error: 'No structured output from review' };
            }

            const { decision, summary, reviewText } = output;

            console.log(`  Review decision: ${decision === 'approved' ? 'APPROVED ✓' : 'REQUEST CHANGES'}`);

            // Preview mode: show what would be posted
            if (options.dryRun) {
                console.log('\n  [DRY RUN] Would post review comment:');
                console.log('  ' + '='.repeat(60));
                console.log(reviewText.split('\n').map(l => '  ' + l).join('\n'));
                console.log('  ' + '='.repeat(60));
                console.log(`\n  [DRY RUN] Summary: ${summary}`);
                console.log(`\n  [DRY RUN] Would submit official GitHub review: ${decision === 'approved' ? 'APPROVE' : 'REQUEST_CHANGES'}`);
                console.log(`\n  [DRY RUN] Would update review status to: ${decision === 'approved' ? 'Approved' : 'Request Changes'}`);
            } else {
                // Submit official GitHub PR review (this automatically posts as a comment)
                const prefixedReview = addAgentPrefix('pr-review', reviewText);
                const reviewEvent = decision === 'approved' ? 'APPROVE' : 'REQUEST_CHANGES';
                await adapter.submitPRReview(prNumber, reviewEvent, prefixedReview);
                console.log(`  Submitted official GitHub review: ${reviewEvent}`);

                // Update review status
                // - If approved: set to "Approved" (agent won't pick it up again, admin can merge)
                // - If requesting changes: set to "Request Changes" (implement agent can address it)
                const newReviewStatus = decision === 'approved'
                    ? REVIEW_STATUSES.approved
                    : REVIEW_STATUSES.requestChanges;

                logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${newReviewStatus}`);
                await adapter.updateItemReviewStatus(item.id, newReviewStatus);
                console.log(`  Updated review status to: ${newReviewStatus}`);

                // Send notification
                await notifyPRReviewComplete(content.title, issueNumber, prNumber, decision, summary, issueType);
            }

            // Log execution end
            logExecutionEnd(logCtx, {
                success: true,
                toolCallsCount: 0,
                totalTokens: 0,
                totalCost: 0,
            });

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

        // Log error
        logError(logCtx, error instanceof Error ? error : errorMessage, true);
        logExecutionEnd(logCtx, {
            success: false,
            toolCallsCount: 0,
            totalTokens: 0,
            totalCost: 0,
        });

        if (!options.dryRun) {
            await notifyAgentError('PR Review', content.title, issueNumber, errorMessage);
        }

        return { success: false, error: errorMessage };
    }
    });
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

    console.log('Connecting to GitHub...');
    const adapter = getProjectManagementAdapter();
    await adapter.init();

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
