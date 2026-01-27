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

import '../../shared/loadEnv';
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
    getLibraryForWorkflow,
    getModelForWorkflow,
    // Notifications
    notifyPRReviewComplete,
    notifyPRReadyToMerge,
    notifyAgentError,
    notifyAgentStarted,
    // Types
    type CommonCLIOptions,
    // Utils
    getIssueType,
    // Agent Identity
    addAgentPrefix,
} from '../../shared';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logError,
} from '../../lib/logging';
import {
    parsePhaseString,
    extractPhasesFromTechDesign,
} from '../../lib/parsing';
import {
    parsePhasesFromComment,
} from '../../lib/phases';
import {
    extractTechDesign,
    generateCommitMessage,
    formatCommitMessageComment,
    parseArtifactComment,
    getTechDesignPath,
    updateImplementationPhaseArtifact,
} from '../../lib';
import {
    readDesignDoc,
} from '../../lib/design-files';
import { COMMIT_MESSAGE_MARKER } from '@/server/project-management/config';
import {
    createPrReviewerAgentPrompt,
    type PromptContext,
} from './createPrReviewerAgentPrompt';

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    prNumber: number;
    /**
     * Branch name retrieved FROM the open PR.
     * More reliable than regenerating (title/phase could change).
     */
    branchName: string;
    /** Phase info for multi-PR workflow */
    phaseInfo?: {
        current: number;
        total: number;
        phaseName?: string;
        phaseDescription?: string;
        phaseFiles?: string[];
    };
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
// PR FINDING
// ============================================================

// NOTE: We use adapter.findOpenPRForIssue() to find the open PR.
// This is the SAME logic used by the Implementation Agent.
//
// Why not parse PR numbers from comments?
// - Comments may contain multiple PRs (from previous phases)
// - Old merged PRs would be incorrectly selected
// - findOpenPRForIssue() searches OPEN PRs only
//
// Why get branch name from PR?
// - Branch name = f(title, phase) - could change
// - The PR itself KNOWS its actual branch name
// - Getting from PR = 100% reliable

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

    // Get library and model for logging
    const library = getLibraryForWorkflow('pr-review');
    const model = await getModelForWorkflow('pr-review');

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'pr-review',
        phase: 'PR Review',
        mode: 'Review',
        issueTitle: content.title,
        issueType,
        currentStatus: item.status,
        currentReviewStatus: item.reviewStatus,
        library,
        model,
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

        // Use branch name from the PR (retrieved via findOpenPRForIssue)
        // This is more reliable than regenerating - title/phase could have changed
        const branchName = processable.branchName;
        console.log(`  Branch: ${branchName} (from PR)`);
        if (processable.phaseInfo) {
            console.log(`  📋 Phase ${processable.phaseInfo.current}/${processable.phaseInfo.total}: ${processable.phaseInfo.phaseName || 'Unknown'}`);
        }

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
            // Fetch PR files (authoritative list from GitHub API)
            console.log('  Fetching PR files from GitHub...');
            const prFiles = await adapter.getPRFiles(prNumber);
            console.log(`  PR contains ${prFiles.length} file(s): ${prFiles.join(', ')}`);

            // Fetch all PR comments
            console.log('  Fetching PR comments...');
            const prConversationComments = await adapter.getPRComments(prNumber);
            const prReviewComments = await adapter.getPRReviewComments(prNumber);

            const totalComments = prConversationComments.length + prReviewComments.length;
            if (totalComments > 0) {
                console.log(`  Found ${prConversationComments.length} conversation comments, ${prReviewComments.length} review comments`);
            }

            // Build prompt context - pass all comments together
            const promptContext: PromptContext = {
                phaseInfo: processable.phaseInfo,
                prFiles, // Authoritative list from GitHub API
                prComments: prConversationComments.map(c => ({
                    author: c.author,
                    body: c.body,
                    createdAt: c.createdAt,
                })),
                prReviewComments: prReviewComments.map(c => ({
                    author: c.author,
                    body: c.body,
                    path: c.path,
                    line: c.line,
                })),
            };

            // Create the prompt using the dedicated prompt builder
            const prompt = createPrReviewerAgentPrompt(promptContext);

            // Run the /review slash command with context
            console.log(`\n  Running PR review...`);

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

                if (decision === 'approved') {
                    console.log(`\n  [DRY RUN] Would generate and save commit message to PR comment`);
                    console.log(`\n  [DRY RUN] Would send Telegram with Merge/Request Changes buttons`);
                }
            } else {
                // Submit official GitHub PR review (this automatically posts as a comment)
                const prefixedReview = addAgentPrefix('pr-review', reviewText);
                const reviewEvent = decision === 'approved' ? 'APPROVE' : 'REQUEST_CHANGES';
                await adapter.submitPRReview(prNumber, reviewEvent, prefixedReview);
                console.log(`  Submitted official GitHub review: ${reviewEvent}`);

                // Add status comment on issue (phase-aware)
                const phaseLabel = processable.phaseInfo
                    ? `**Phase ${processable.phaseInfo.current}/${processable.phaseInfo.total}**: `
                    : '';
                const statusEmoji = decision === 'approved' ? '✅' : '⚠️';
                const statusText = decision === 'approved'
                    ? 'PR approved - ready for merge'
                    : 'Changes requested on PR';
                const issueStatusComment = addAgentPrefix('pr-review', `${statusEmoji} ${phaseLabel}${statusText} (#${prNumber})`);
                await adapter.addIssueComment(issueNumber, issueStatusComment);
                console.log('  Status comment posted on issue');

                // Update review status
                // - If approved: set to "Approved" (agent won't pick it up again, admin can merge)
                // - If requesting changes: set to "Request Changes" (implement agent can address it)
                const newReviewStatus = decision === 'approved'
                    ? REVIEW_STATUSES.approved
                    : REVIEW_STATUSES.requestChanges;

                logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${newReviewStatus}`);
                await adapter.updateItemReviewStatus(item.id, newReviewStatus);
                console.log(`  Updated review status to: ${newReviewStatus}`);

                // Handle approval flow: generate commit message, save to PR comment, notify admin
                if (decision === 'approved') {
                    // 1. Update artifact comment to show PR is approved
                    try {
                        if (processable.phaseInfo) {
                            // Multi-phase feature
                            await updateImplementationPhaseArtifact(
                                adapter,
                                issueNumber,
                                processable.phaseInfo.current,
                                processable.phaseInfo.total,
                                processable.phaseInfo.phaseName || '',
                                'approved',
                                prNumber
                            );
                        } else {
                            // Single-phase feature - use Phase 1/1 format for consistency
                            await updateImplementationPhaseArtifact(
                                adapter,
                                issueNumber,
                                1,
                                1,
                                '',
                                'approved',
                                prNumber
                            );
                        }
                        console.log('  Updated artifact comment - PR approved');
                    } catch (error) {
                        console.warn('  Warning: Failed to update artifact comment:', error instanceof Error ? error.message : String(error));
                    }

                    // 2. Get PR info for commit message
                    const prInfo = await adapter.getPRInfo(prNumber);
                    if (prInfo) {
                        // 3. Generate commit message
                        const phaseInfoForCommit = processable.phaseInfo
                            ? { current: processable.phaseInfo.current, total: processable.phaseInfo.total }
                            : undefined;
                        const commitMsg = generateCommitMessage(prInfo, item.content, phaseInfoForCommit);
                        console.log(`  Generated commit message: ${commitMsg.title}`);

                        // 4. Save/update commit message as PR comment
                        const existingComment = await adapter.findPRCommentByMarker(prNumber, COMMIT_MESSAGE_MARKER);
                        const commentBody = formatCommitMessageComment(commitMsg.title, commitMsg.body);

                        if (existingComment) {
                            // Update existing comment (re-approval after changes)
                            await adapter.updatePRComment(prNumber, existingComment.id, commentBody);
                            console.log('  Updated commit message comment');
                        } else {
                            // Create new comment
                            await adapter.addPRComment(prNumber, commentBody);
                            console.log('  Posted commit message comment');
                        }

                        // 5. Send notification with merge/request changes buttons
                        await notifyPRReadyToMerge(
                            content.title,
                            issueNumber,
                            prNumber,
                            commitMsg,
                            issueType
                        );
                    } else {
                        // Fallback: use old notification if PR info not available
                        await notifyPRReviewComplete(content.title, issueNumber, prNumber, decision, summary, issueType);
                    }
                } else {
                    // Request changes - update artifact and notify
                    try {
                        if (processable.phaseInfo) {
                            await updateImplementationPhaseArtifact(
                                adapter,
                                issueNumber,
                                processable.phaseInfo.current,
                                processable.phaseInfo.total,
                                processable.phaseInfo.phaseName || '',
                                'changes-requested',
                                prNumber
                            );
                        } else {
                            // Single-phase feature - use Phase 1/1 format for consistency
                            await updateImplementationPhaseArtifact(
                                adapter,
                                issueNumber,
                                1,
                                1,
                                '',
                                'changes-requested',
                                prNumber
                            );
                        }
                        console.log('  Updated artifact comment - changes requested');
                    } catch (error) {
                        console.warn('  Warning: Failed to update artifact comment:', error instanceof Error ? error.message : String(error));
                    }

                    await notifyPRReviewComplete(content.title, issueNumber, prNumber, decision, summary, issueType);
                }
            }

            // Log execution end
            logExecutionEnd(logCtx, {
                success: true,
                toolCallsCount: 0, // Not tracked in UsageStats
                totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
                totalCost: result.usage?.totalCostUSD ?? 0,
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

    // Find open PRs and extract phase info from each item
    // Uses findOpenPRForIssue() - same logic as Implementation Agent
    const processableItems: ProcessableItem[] = [];
    for (const item of items) {
        if (!item.content || item.content.type !== 'Issue') {
            console.log(`⚠️  Skipping item ${item.id}: No linked issue`);
            continue;
        }

        const issueNumber = item.content.number!;

        // Find the OPEN PR for this issue (same as Implementation Agent feedback mode)
        // Returns both PR number AND branch name from the PR itself
        const openPR = await adapter.findOpenPRForIssue(issueNumber);
        if (!openPR) {
            console.log(`⚠️  Skipping issue #${issueNumber}: No open PR found`);
            continue;
        }

        const { prNumber, branchName } = openPR;
        console.log(`  Found open PR #${prNumber} on branch: ${branchName}`);

        // Check for multi-phase workflow
        let phaseInfo: ProcessableItem['phaseInfo'];
        const existingPhase = await adapter.getImplementationPhase(item.id);
        const parsed = parsePhaseString(existingPhase);

        if (parsed) {
            // Get phase details from comments or tech design
            const issueComments = await adapter.getIssueComments(issueNumber);
            const commentsList = issueComments.map(c => ({
                id: c.id,
                body: c.body,
                author: c.author,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            }));

            // Try to get phases from:
            // 1. Issue comments (most reliable - deterministic format)
            // 2. Tech design file (new system)
            // 3. Issue body (old system - fallback)
            let techDesign: string | null = null;

            // Try file-based tech design first
            const artifact = parseArtifactComment(commentsList);
            const techPath = getTechDesignPath(artifact);
            if (techPath && artifact?.techDesign?.status === 'approved') {
                techDesign = readDesignDoc(issueNumber, 'tech');
            }

            // Fallback to issue body
            if (!techDesign && item.content.body) {
                techDesign = extractTechDesign(item.content.body);
            }

            const phases = parsePhasesFromComment(commentsList) ||
                          (techDesign ? extractPhasesFromTechDesign(techDesign) : null);

            const currentPhaseDetails = phases?.find(p => p.order === parsed.current);

            phaseInfo = {
                current: parsed.current,
                total: parsed.total,
                phaseName: currentPhaseDetails?.name,
                phaseDescription: currentPhaseDetails?.description,
                phaseFiles: currentPhaseDetails?.files,
            };

            console.log(`  📋 Phase ${parsed.current}/${parsed.total}: ${currentPhaseDetails?.name || 'Unknown'}`);
        }

        processableItems.push({ item, prNumber, branchName, phaseInfo });
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

    // Note: Individual notifications are already sent for each PR review
    // (notifyAgentStarted, notifyPRReviewComplete, notifyAgentError)
    // No batch notification needed
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
