#!/usr/bin/env tsx
/**
 * Technical Design Agent
 *
 * Generates Technical Design documents for GitHub Project items.
 * Creates PRs with design files instead of updating issue body directly.
 *
 * Flow A (New Design):
 *   - Fetches items in "Technical Design" status with empty Review Status
 *   - Reads the approved Product Design from issue body or file
 *   - Generates technical design using Claude (read-only mode)
 *   - Creates branch, writes design file, creates PR
 *   - Sends Telegram notification with Approve & Merge buttons
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Technical Design" with Review Status = "Request Changes"
 *   - Reads admin feedback comments
 *   - Revises technical design based on feedback
 *   - Updates existing design file and PR
 *   - Sets Review Status back to "Waiting for Review"
 *
 * Usage:
 *   yarn agent:tech-design                    # Process all pending
 *   yarn agent:tech-design --id <item-id>     # Process specific item
 *   yarn agent:tech-design --dry-run          # Preview without saving
 *   yarn agent:tech-design --stream           # Stream Claude output
 */

import '../../shared/loadEnv';
import { execSync } from 'child_process';
import { Command } from 'commander';
import {
    // Config
    STATUSES,
    REVIEW_STATUSES,
    agentConfig,
    getProjectConfig,
    // Project management
    getProjectManagementAdapter,
    type ProjectItem,
    // Claude
    runAgent,
    getLibraryForWorkflow,
    getModelForWorkflow,
    extractMarkdown,
    extractProductDesign,
    // Notifications
    notifyDesignPRReady,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    notifyAdmin,
    // Prompts
    buildTechDesignPrompt,
    buildTechDesignRevisionPrompt,
    buildTechDesignClarificationPrompt,
    buildBugTechDesignPrompt,
    buildBugTechDesignRevisionPrompt,
    // Types
    type CommonCLIOptions,
    type UsageStats,
    type TechDesignOutput,
    // Utils
    getIssueType,
    getBugDiagnostics,
    extractClarificationFromResult,
    handleClarificationRequest,
    // Output schemas
    TECH_DESIGN_OUTPUT_FORMAT,
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
    formatPhasesToComment,
    hasPhaseComment,
} from '../../lib/phases';
import {
    writeDesignDoc,
    readDesignDoc,
    getDesignDocRelativePath,
} from '../../lib/design-files';
import {
    generateDesignBranchName,
    parseArtifactComment,
    getProductDesignPath,
} from '../../lib/artifacts';

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    mode: 'new' | 'feedback' | 'clarification';
    /** Existing PR info for feedback mode */
    existingPR?: {
        prNumber: number;
        branchName: string;
    };
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
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges(): boolean {
    const status = git('status --porcelain', { silent: true });
    return status.length > 0;
}

/**
 * Check if a branch exists locally
 */
function branchExistsLocally(branchName: string): boolean {
    try {
        git(`rev-parse --verify ${branchName}`, { silent: true });
        return true;
    } catch {
        return false;
    }
}

/**
 * Checkout a branch (create if doesn't exist)
 */
function checkoutBranch(branchName: string, createFromDefault: boolean = false): void {
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
function getCurrentBranch(): string {
    return git('rev-parse --abbrev-ref HEAD', { silent: true });
}

/**
 * Commit all changes with a message
 */
function commitChanges(message: string): void {
    git('add -A');
    // Use single quotes and escape them properly to avoid shell injection
    const escapedMessage = message.replace(/'/g, "'\\''");
    git(`commit -m '${escapedMessage}'`);
}

/**
 * Push current branch to origin
 */
function pushBranch(branchName: string, force: boolean = false): void {
    const forceFlag = force ? '--force-with-lease' : '';
    git(`push -u origin ${branchName} ${forceFlag}`.trim());
}

/**
 * Get the default branch name
 */
function getDefaultBranch(): string {
    return git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
}

// ============================================================
// MAIN LOGIC
// ============================================================

async function processItem(
    processable: ProcessableItem,
    options: CommonCLIOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>
): Promise<{ success: boolean; error?: string }> {
    const { item, mode, existingPR } = processable;
    const content = item.content;

    if (!content || content.type !== 'Issue') {
        return { success: false, error: 'Item has no linked issue' };
    }

    const issueNumber = content.number!;
    console.log(`\n  Processing issue #${issueNumber}: ${content.title}`);
    console.log(`  Mode: ${mode === 'new' ? 'New Design' : mode === 'feedback' ? 'Address Feedback' : 'Clarification'}`);

    // Detect issue type and load bug diagnostics if applicable
    const issueType = getIssueType(content.labels);

    // Get library and model for logging
    const library = getLibraryForWorkflow('tech-design');
    const model = await getModelForWorkflow('tech-design');

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'tech-design',
        phase: 'Technical Design',
        mode: mode === 'new' ? 'New design' : mode === 'feedback' ? 'Address feedback' : 'Clarification',
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
            await notifyAgentStarted('Technical Design', content.title, issueNumber, mode, issueType);
        }

        // Save original branch to return to later
        const originalBranch = getCurrentBranch();

        try {
            const diagnostics = issueType === 'bug'
                ? await getBugDiagnostics(issueNumber)
                : null;

            if (issueType === 'bug') {
                console.log(`  🐛 Bug fix design (diagnostics loaded: ${diagnostics ? 'yes' : 'no'})`);

                // Warn if diagnostics are missing for a bug
                if (!diagnostics && !options.dryRun) {
                    await notifyAdmin(
                        `⚠️ <b>Warning:</b> Bug diagnostics missing\n\n` +
                        `📋 ${content.title}\n` +
                        `🔗 Issue #${issueNumber}\n\n` +
                        `The bug report does not have diagnostics (session logs, stack trace). ` +
                        `The tech design may be incomplete without this context.`
                    );
                }
            }

            // Always fetch comments - they provide context for any phase
            const comments = await adapter.getIssueComments(issueNumber);
            const issueComments = comments.map((c) => ({
                id: c.id,
                body: c.body,
                author: c.author,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            }));
            if (issueComments.length > 0) {
                console.log(`  Found ${issueComments.length} comment(s) on issue`);
            }

            // Try to get product design from file first, then fall back to issue body
            let productDesign: string | null = null;
            const artifact = parseArtifactComment(issueComments);
            const productDesignPath = getProductDesignPath(artifact);
            if (productDesignPath) {
                productDesign = readDesignDoc(issueNumber, 'product');
                if (productDesign) {
                    console.log(`  Loaded product design from file: ${productDesignPath}`);
                }
            }
            if (!productDesign) {
                // Fallback to issue body
                productDesign = extractProductDesign(content.body);
                if (productDesign) {
                    console.log(`  Loaded product design from issue body (fallback)`);
                }
            }
            if (!productDesign) {
                console.log(`  ⚠️  No product design found for issue ⚠️`);
            }

            // Check for existing tech design in file (for idempotency)
            const existingTechDesign = readDesignDoc(issueNumber, 'tech');

            let prompt: string;

            if (mode === 'new') {
                // Flow A: New design
                // Idempotency check: Skip if design file already exists
                if (existingTechDesign) {
                    console.log('  ⚠️  Technical design file already exists - skipping to avoid duplication');
                    console.log('  If you want to regenerate, use feedback mode or manually remove the existing design');
                    return { success: false, error: 'Technical design file already exists (idempotency check)' };
                }
                if (diagnostics) {
                    // Bug fix tech design
                    prompt = buildBugTechDesignPrompt(content, diagnostics, productDesign, issueComments);
                } else {
                    // Feature tech design
                    prompt = buildTechDesignPrompt(content, productDesign, issueComments);
                }
            } else if (mode === 'feedback') {
                // Flow B: Address feedback
                if (!existingTechDesign) {
                    return { success: false, error: 'No existing technical design found to revise' };
                }

                if (issueComments.length === 0) {
                    return { success: false, error: 'No feedback comments found' };
                }

                if (diagnostics) {
                    // Bug fix revision
                    prompt = buildBugTechDesignRevisionPrompt(content, diagnostics, existingTechDesign, issueComments);
                } else {
                    // Feature revision
                    prompt = buildTechDesignRevisionPrompt(content, productDesign, existingTechDesign, issueComments);
                }
            } else {
                // Flow C: Continue after clarification
                const clarification = issueComments[issueComments.length - 1];

                if (!clarification) {
                    return { success: false, error: 'No clarification comment found' };
                }

                prompt = buildTechDesignClarificationPrompt(
                    { title: content.title, number: issueNumber, body: content.body },
                    productDesign,
                    issueComments,
                    clarification
                );
            }

            // Run the agent
            console.log('');
            const progressLabel = mode === 'new'
                ? 'Generating technical design'
                : mode === 'feedback'
                ? 'Revising technical design'
                : 'Continuing with clarification';

            const result = await runAgent({
                prompt,
                stream: options.stream,
                verbose: options.verbose,
                timeout: options.timeout,
                progressLabel,
                workflow: 'tech-design',
                outputFormat: TECH_DESIGN_OUTPUT_FORMAT,
            });

            if (!result.success || !result.content) {
                const error = result.error || 'No content generated';
                if (!options.dryRun) {
                    await notifyAgentError('Technical Design', content.title, issueNumber, error);
                }
                return { success: false, error };
            }

            // Check if agent needs clarification (in both raw content and structured output)
            const clarificationRequest = extractClarificationFromResult(result);
            if (clarificationRequest) {
                console.log('  🤔 Agent needs clarification');
                return await handleClarificationRequest(
                    adapter,
                    { id: item.id, content: { number: issueNumber, title: content.title, labels: content.labels } },
                    issueNumber,
                    clarificationRequest,
                    'Technical Design',
                    content.title,
                    issueType,
                    options,
                    'tech-design'
                );
            }

            // Extract structured output (with fallback to JSON/markdown extraction)
            let design: string;
            let comment: string | undefined;

            const structuredOutput = result.structuredOutput as TechDesignOutput | undefined;
            if (structuredOutput && typeof structuredOutput.design === 'string') {
                design = structuredOutput.design;
                comment = structuredOutput.comment;
                console.log(`  Design generated: ${design.length} chars (structured output)`);
            } else {
                // Try parsing as JSON first (cursor adapter returns JSON as raw text)
                let parsed: TechDesignOutput | null = null;
                try {
                    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const candidate = JSON.parse(jsonMatch[0]);
                        if (candidate && typeof candidate.design === 'string') {
                            parsed = candidate as TechDesignOutput;
                        }
                    }
                } catch {
                    // Not valid JSON, continue to markdown extraction
                }

                if (parsed) {
                    design = parsed.design;
                    comment = parsed.comment;
                    console.log(`  Design generated: ${design.length} chars (JSON extraction)`);
                } else {
                    // Fallback: extract markdown from text output
                    const extracted = extractMarkdown(result.content);
                    if (!extracted) {
                        const error = 'Could not extract design document from output';
                        if (!options.dryRun) {
                            await notifyAgentError('Technical Design', content.title, issueNumber, error);
                        }
                        return { success: false, error };
                    }
                    design = extracted;
                    console.log(`  Design generated: ${design.length} chars (markdown extraction)`);
                }
            }

            console.log(`  Preview: ${design.slice(0, 100).replace(/\n/g, ' ')}...`);

            if (options.dryRun) {
                console.log('  [DRY RUN] Would write design to:', getDesignDocRelativePath(issueNumber, 'tech'));
                console.log('  [DRY RUN] Would create/update PR');
                console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
                if (comment) {
                    console.log('  [DRY RUN] Would post comment on PR:');
                    console.log('  ' + '='.repeat(60));
                    console.log(comment.split('\n').map(l => '  ' + l).join('\n'));
                    console.log('  ' + '='.repeat(60));
                }
                if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
                    console.log(`  [DRY RUN] Would post phases comment on PR (${structuredOutput.phases.length} phases)`);
                }
                console.log('  [DRY RUN] Would send Telegram notification with merge buttons');
                return { success: true };
            }

            // Ensure clean working directory before branch operations
            if (hasUncommittedChanges()) {
                return { success: false, error: 'Uncommitted changes detected - please commit or stash first' };
            }

            // Generate branch name and determine if we're updating existing PR
            const branchName = existingPR?.branchName || generateDesignBranchName(issueNumber, 'tech');
            const isExistingBranch = existingPR || branchExistsLocally(branchName);

            // Checkout or create branch
            if (isExistingBranch) {
                console.log(`  Checking out existing branch: ${branchName}`);
                checkoutBranch(branchName);
                // Pull latest changes
                try {
                    git(`pull origin ${branchName}`, { silent: true });
                } catch {
                    // Branch might not exist on remote yet, ignore
                }
            } else {
                console.log(`  Creating new branch: ${branchName}`);
                checkoutBranch(branchName, true);
            }

            // Write design file
            const designPath = writeDesignDoc(issueNumber, 'tech', design);
            console.log(`  Written design to: ${designPath}`);

            // Commit changes
            const commitMessage = mode === 'new'
                ? `docs: add technical design for issue #${issueNumber}`
                : `docs: update technical design for issue #${issueNumber}`;
            commitChanges(commitMessage);
            console.log(`  Committed: ${commitMessage}`);

            // Push branch
            pushBranch(branchName, mode === 'feedback');
            console.log(`  Pushed to origin/${branchName}`);

            // Log GitHub actions
            logGitHubAction(logCtx, 'branch', `${mode === 'new' ? 'Created' : 'Updated'} branch ${branchName}`);

            // Create or get PR
            let prNumber: number;
            let prUrl: string;

            if (existingPR) {
                // PR already exists, just need to update it (already done by push)
                prNumber = existingPR.prNumber;
                const projectConfig = getProjectConfig();
                prUrl = `https://github.com/${projectConfig.github.owner}/${projectConfig.github.repo}/pull/${prNumber}`;
                console.log(`  Updated existing PR #${prNumber}`);
            } else {
                // Create new PR
                const prTitle = `docs: technical design for issue #${issueNumber}`;
                const prBody = `Design document for issue #${issueNumber}

Part of #${issueNumber}

---
*Generated by Technical Design Agent*`;

                const defaultBranch = getDefaultBranch();
                const prResult = await adapter.createPullRequest(branchName, defaultBranch, prTitle, prBody);
                prNumber = prResult.number;
                prUrl = prResult.url;
                console.log(`  Created PR #${prNumber}: ${prUrl}`);
                logGitHubAction(logCtx, 'pr', `Created PR #${prNumber}`);
            }

            // Post summary comment on PR (if available)
            if (comment) {
                const prefixedComment = addAgentPrefix('tech-design', comment);
                await adapter.addPRComment(prNumber, prefixedComment);
                console.log('  Summary comment posted on PR');
                logGitHubAction(logCtx, 'comment', 'Posted design summary comment on PR');
            }

            // Post phases comment on PR for multi-PR workflow (L/XL features)
            // This provides deterministic phase storage that the implementation agent can reliably parse
            if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
                // Check if phases comment already exists (idempotency)
                const prComments = await adapter.getPRComments(prNumber);
                if (!hasPhaseComment(prComments)) {
                    const phasesComment = formatPhasesToComment(structuredOutput.phases);
                    await adapter.addPRComment(prNumber, phasesComment);
                    console.log(`  Implementation phases comment posted on PR (${structuredOutput.phases.length} phases)`);
                    logGitHubAction(logCtx, 'comment', `Posted ${structuredOutput.phases.length} implementation phases on PR`);
                } else {
                    console.log('  Phases comment already exists on PR, skipping');
                }
            }

            // Return to original branch
            checkoutBranch(originalBranch);
            console.log(`  Returned to branch: ${originalBranch}`);

            // Update review status (status stays at "Technical Design")
            if (adapter.hasReviewStatusField()) {
                await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);
                console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);
            }

            logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${REVIEW_STATUSES.waitingForReview}`);

            // Send Telegram notification with merge buttons
            await notifyDesignPRReady('tech', content.title, issueNumber, prNumber, mode === 'feedback', issueType, comment);
            console.log('  Telegram notification sent');

            // Log execution end
            logExecutionEnd(logCtx, {
                success: true,
                toolCallsCount: 0, // Not tracked in UsageStats
                totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
                totalCost: result.usage?.totalCostUSD ?? 0,
            });

            return { success: true };
        } catch (error) {
            // Ensure we return to original branch on error
            try {
                if (getCurrentBranch() !== originalBranch) {
                    checkoutBranch(originalBranch);
                }
            } catch {
                // Ignore errors when trying to checkout original branch
            }

            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`  Error: ${errorMsg}`);

            // Log error
            logError(logCtx, error instanceof Error ? error : errorMsg, true);
            logExecutionEnd(logCtx, {
                success: false,
                toolCallsCount: 0,
                totalTokens: 0,
                totalCost: 0,
            });

            if (!options.dryRun) {
                await notifyAgentError('Technical Design', content.title, issueNumber, errorMsg);
            }
            return { success: false, error: errorMsg };
        }
    });
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('tech-design')
        .description('Generate Technical Design documents for GitHub Project items')
        .option('--id <itemId>', 'Process a specific project item by ID')
        .option('--limit <number>', 'Limit number of items to process', parseInt)
        .option('--timeout <seconds>', 'Timeout per item in seconds', parseInt)
        .option('--dry-run', 'Preview without saving changes', false)
        .option('--stream', "Stream Claude's output in real-time", false)
        .option('--verbose', 'Show additional debug output', false)
        .parse(process.argv);

    const opts = program.opts();
    const options: CommonCLIOptions = {
        id: opts.id as string | undefined,
        limit: opts.limit as number | undefined,
        timeout: (opts.timeout as number | undefined) ?? agentConfig.claude.timeoutSeconds,
        dryRun: Boolean(opts.dryRun),
        verbose: Boolean(opts.verbose),
        stream: Boolean(opts.stream),
    };

    console.log('\n========================================');
    console.log('  Technical Design Agent');
    console.log('========================================');
    console.log(`  Timeout: ${options.timeout}s per item`);
    if (options.dryRun) {
        console.log('  Mode: DRY RUN (no changes will be saved)');
    }
    console.log('');

    // Initialize project management adapter
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Collect items to process
    const itemsToProcess: ProcessableItem[] = [];

    if (options.id) {
        // Process specific item
        const item = await adapter.getItem(options.id);
        if (!item) {
            console.error(`Item not found: ${options.id}`);
            process.exit(1);
        }

        // Determine mode based on current status and review status
        let mode: 'new' | 'feedback' | 'clarification';
        let existingPR: { prNumber: number; branchName: string } | undefined;

        if (item.status === STATUSES.techDesign && !item.reviewStatus) {
            mode = 'new';
        } else if (item.status === STATUSES.techDesign && item.reviewStatus === REVIEW_STATUSES.requestChanges) {
            mode = 'feedback';
            // Find existing PR for feedback mode
            const issueNumber = item.content?.number;
            if (issueNumber) {
                existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
            }
        } else if (item.status === STATUSES.techDesign && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === STATUSES.techDesign && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  ⏳ Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${STATUSES.techDesign}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", or "${REVIEW_STATUSES.clarificationReceived}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode, existingPR });
    } else {
        // Flow A: Fetch items ready for new design (Technical Design status with empty Review Status)
        const allTechDesignItems = await adapter.listItems({ status: STATUSES.techDesign, limit: options.limit || 50 });
        const newItems = allTechDesignItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }

        // Flow B: Fetch items needing revision (Technical Design status with Request Changes)
        if (adapter.hasReviewStatusField()) {
            const feedbackItems = allTechDesignItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                // Find existing PR for feedback mode
                const issueNumber = item.content?.number;
                let existingPR: { prNumber: number; branchName: string } | undefined;
                if (issueNumber) {
                    existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
                }
                itemsToProcess.push({ item, mode: 'feedback', existingPR });
            }

            // Flow C: Fetch items with clarification received
            const clarificationItems = allTechDesignItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.clarificationReceived
            );
            for (const item of clarificationItems) {
                itemsToProcess.push({ item, mode: 'clarification' });
            }
        }

        // Apply limit
        if (options.limit && itemsToProcess.length > options.limit) {
            itemsToProcess.length = options.limit;
        }
    }

    if (itemsToProcess.length === 0) {
        console.log('No items to process.');
        return;
    }

    console.log(`\nProcessing ${itemsToProcess.length} item(s)...`);

    // Track results
    const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        totalUsage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            totalCostUSD: 0,
        } as UsageStats,
    };

    // Process each item
    for (const processable of itemsToProcess) {
        results.processed++;
        const { item } = processable;
        const title = item.content?.title || 'Unknown';

        console.log(`\n----------------------------------------`);
        console.log(`[${results.processed}/${itemsToProcess.length}] ${title}`);
        console.log(`  Item ID: ${item.id}`);
        console.log(`  Status: ${item.status}`);
        if (item.reviewStatus) {
            console.log(`  Review Status: ${item.reviewStatus}`);
        }

        const result = await processItem(processable, options, adapter);

        if (result.success) {
            results.succeeded++;
        } else {
            results.failed++;
            console.error(`  Failed: ${result.error}`);
        }
    }

    // Print summary
    console.log('\n========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`  Processed: ${results.processed}`);
    console.log(`  Succeeded: ${results.succeeded}`);
    console.log(`  Failed: ${results.failed}`);
    console.log('========================================\n');

    // Send batch completion notification
    if (!options.dryRun && results.processed > 1) {
        await notifyBatchComplete('Technical Design', results.processed, results.succeeded, results.failed);
    }
}

// Run
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
