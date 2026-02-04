#!/usr/bin/env tsx
/**
 * Product Development Agent
 *
 * OPTIONAL phase that transforms vague feature ideas into concrete product specifications.
 * Generates Product Development documents (PDD) that focus on WHAT to build and WHY,
 * not HOW it looks (that's Product Design) or how to implement (that's Tech Design).
 *
 * Creates PRs with design files instead of updating issue body directly.
 *
 * Flow A (New Document):
 *   - Fetches items in "Product Development" status with empty Review Status
 *   - Generates product development document using Claude (read-only mode)
 *   - Creates branch, writes design file, creates PR
 *   - Sends Telegram notification with Approve & Merge buttons
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Product Development" with Review Status = "Request Changes"
 *   - Reads admin feedback comments
 *   - Revises product development document based on feedback
 *   - Updates existing design file and PR
 *   - Sets Review Status back to "Waiting for Review"
 *
 * IMPORTANT: This phase is OPTIONAL and only for features, not bugs.
 * Bugs skip directly to Technical Design (or Implementation).
 *
 * Usage:
 *   yarn agent:product-dev                    # Process all pending
 *   yarn agent:product-dev --id <item-id>     # Process specific item
 *   yarn agent:product-dev --dry-run          # Preview without saving
 *   yarn agent:product-dev --stream           # Stream Claude output
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
    // Notifications
    notifyDesignPRReady,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    // Prompts
    buildProductDevelopmentPrompt,
    buildProductDevelopmentRevisionPrompt,
    buildProductDevelopmentClarificationPrompt,
    // Types
    type CommonCLIOptions,
    type UsageStats,
    type ProductDevelopmentOutput,
    // Utils
    extractClarificationFromResult,
    handleClarificationRequest,
    // Output schemas
    PRODUCT_DEVELOPMENT_OUTPUT_FORMAT,
    // Agent Identity
    addAgentPrefix,
} from '../../shared';
import { getIssueType } from '../../shared/utils';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logError,
} from '../../lib/logging';
import {
    writeDesignDoc,
    readDesignDoc,
    getDesignDocRelativePath,
} from '../../lib/design-files';
import {
    generateDesignBranchName,
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
    console.log(`  Mode: ${mode === 'new' ? 'New Document' : mode === 'feedback' ? 'Address Feedback' : 'Clarification'}`);

    // Check if this is a bug - Product Development is for features only
    const issueType = getIssueType(content.labels);
    if (issueType === 'bug') {
        console.log(`  Skipping bug #${issueNumber} - Product Development is for features only`);
        console.log('  Bugs should go directly to Technical Design or Implementation');
        return { success: false, error: 'Bug reports skip Product Development phase' };
    }

    // Get library and model for logging
    const library = getLibraryForWorkflow('product-dev');
    const model = await getModelForWorkflow('product-dev');

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'product-dev',
        phase: 'Product Development',
        mode: mode === 'new' ? 'New document' : mode === 'feedback' ? 'Address feedback' : 'Clarification',
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
            await notifyAgentStarted('Product Development', content.title, issueNumber, mode, issueType);
        }

        // Save original branch to return to later
        const originalBranch = getCurrentBranch();

        try {
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

            // In feedback mode with existing PR, checkout the branch first to read existing design
            // This is needed because the design file lives on the PR branch, not main
            let alreadyOnPRBranch = false;
            if (mode === 'feedback' && existingPR) {
                // Ensure clean working directory before branch operations
                if (hasUncommittedChanges()) {
                    return { success: false, error: 'Uncommitted changes detected - please commit or stash first' };
                }
                console.log(`  Checking out PR branch to read existing design: ${existingPR.branchName}`);
                checkoutBranch(existingPR.branchName);
                // Pull latest changes
                try {
                    git(`pull origin ${existingPR.branchName}`, { silent: true });
                } catch {
                    // Branch might not exist on remote yet, ignore
                }
                alreadyOnPRBranch = true;
            }

            // Check for existing document in file (for idempotency)
            const existingDocument = readDesignDoc(issueNumber, 'product-dev');

            let prompt: string;

            if (mode === 'new') {
                // Flow A: New document
                // Idempotency check: Skip if document file already exists
                if (existingDocument) {
                    console.log('  Product development document already exists - skipping to avoid duplication');
                    console.log('  If you want to regenerate, use feedback mode or manually remove the existing document');
                    return { success: false, error: 'Product development document already exists (idempotency check)' };
                }
                prompt = buildProductDevelopmentPrompt(content, issueComments);
            } else if (mode === 'feedback') {
                // Flow B: Address feedback
                if (!existingDocument) {
                    return { success: false, error: 'No existing product development document found to revise' };
                }

                if (issueComments.length === 0) {
                    return { success: false, error: 'No feedback comments found' };
                }

                prompt = buildProductDevelopmentRevisionPrompt(content, existingDocument, issueComments);
            } else {
                // Flow C: Continue after clarification
                const clarification = issueComments[issueComments.length - 1];

                if (!clarification) {
                    return { success: false, error: 'No clarification comment found' };
                }

                prompt = buildProductDevelopmentClarificationPrompt(
                    { title: content.title, number: issueNumber, body: content.body, labels: content.labels },
                    issueComments,
                    clarification
                );
            }

            // Run the agent
            console.log('');
            const progressLabel = mode === 'new'
                ? 'Generating product development document'
                : mode === 'feedback'
                ? 'Revising product development document'
                : 'Continuing with clarification';

            const result = await runAgent({
                prompt,
                stream: options.stream,
                verbose: options.verbose,
                timeout: options.timeout,
                progressLabel,
                workflow: 'product-dev',
                outputFormat: PRODUCT_DEVELOPMENT_OUTPUT_FORMAT,
            });

            if (!result.success || !result.content) {
                const error = result.error || 'No content generated';
                if (!options.dryRun) {
                    await notifyAgentError('Product Development', content.title, issueNumber, error);
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
                    'Product Development',
                    content.title,
                    issueType,
                    options,
                    'product-dev'
                );
            }

            // Extract structured output (with fallback to JSON/markdown extraction)
            let document: string;
            let comment: string | undefined;

            const structuredOutput = result.structuredOutput as ProductDevelopmentOutput | undefined;
            if (structuredOutput && typeof structuredOutput.document === 'string') {
                document = structuredOutput.document;
                comment = structuredOutput.comment;
                console.log(`  Document generated: ${document.length} chars (structured output)`);
            } else {
                // Try parsing as JSON first (cursor adapter returns JSON as raw text)
                let parsed: ProductDevelopmentOutput | null = null;
                try {
                    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const candidate = JSON.parse(jsonMatch[0]);
                        if (candidate && typeof candidate.document === 'string') {
                            parsed = candidate as ProductDevelopmentOutput;
                        }
                    }
                } catch {
                    // Not valid JSON, continue to markdown extraction
                }

                if (parsed) {
                    document = parsed.document;
                    comment = parsed.comment;
                    console.log(`  Document generated: ${document.length} chars (JSON extraction)`);
                } else {
                    // Fallback: extract markdown from text output
                    const extracted = extractMarkdown(result.content);
                    if (!extracted) {
                        const error = 'Could not extract product development document from output';
                        if (!options.dryRun) {
                            await notifyAgentError('Product Development', content.title, issueNumber, error);
                        }
                        return { success: false, error };
                    }
                    document = extracted;
                    console.log(`  Document generated: ${document.length} chars (markdown extraction)`);
                }
            }

            console.log(`  Preview: ${document.slice(0, 100).replace(/\n/g, ' ')}...`);

            if (options.dryRun) {
                console.log('  [DRY RUN] Would write document to:', getDesignDocRelativePath(issueNumber, 'product-dev'));
                console.log('  [DRY RUN] Would create/update PR');
                console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
                if (comment) {
                    console.log('  [DRY RUN] Would post comment on PR:');
                    console.log('  ' + '='.repeat(60));
                    console.log(comment.split('\n').map(l => '  ' + l).join('\n'));
                    console.log('  ' + '='.repeat(60));
                }
                console.log('  [DRY RUN] Would send Telegram notification with merge buttons');
                return { success: true };
            }

            // Generate branch name and determine if we're updating existing PR
            const branchName = existingPR?.branchName || generateDesignBranchName(issueNumber, 'product-dev');
            const isExistingBranch = existingPR || branchExistsLocally(branchName);

            // Checkout or create branch (skip if already on PR branch from earlier checkout)
            if (!alreadyOnPRBranch) {
                // Ensure clean working directory before branch operations
                if (hasUncommittedChanges()) {
                    return { success: false, error: 'Uncommitted changes detected - please commit or stash first' };
                }

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
            }

            // Write document file
            const documentPath = writeDesignDoc(issueNumber, 'product-dev', document);
            console.log(`  Written document to: ${documentPath}`);

            // Commit changes
            const commitMessage = mode === 'new'
                ? `docs: add product development document for issue #${issueNumber}`
                : `docs: update product development document for issue #${issueNumber}`;
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
                const prTitle = `docs: product development for issue #${issueNumber}`;
                const prBody = `Product Development document for issue #${issueNumber}

This document defines WHAT to build and WHY.

Part of #${issueNumber}

---
*Generated by Product Development Agent*`;

                const defaultBranch = getDefaultBranch();
                const prResult = await adapter.createPullRequest(branchName, defaultBranch, prTitle, prBody);
                prNumber = prResult.number;
                prUrl = prResult.url;
                console.log(`  Created PR #${prNumber}: ${prUrl}`);
                logGitHubAction(logCtx, 'pr', `Created PR #${prNumber}`);
            }

            // Post summary comment on PR (if available)
            if (comment) {
                const prefixedComment = addAgentPrefix('product-dev', comment);
                await adapter.addPRComment(prNumber, prefixedComment);
                console.log('  Summary comment posted on PR');
                logGitHubAction(logCtx, 'comment', 'Posted document summary comment on PR');
            }

            // Return to original branch
            checkoutBranch(originalBranch);
            console.log(`  Returned to branch: ${originalBranch}`);

            // Update review status (status stays at "Product Development")
            if (adapter.hasReviewStatusField()) {
                await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);
                console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);
            }

            logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${REVIEW_STATUSES.waitingForReview}`);

            // Send Telegram notification with merge buttons
            await notifyDesignPRReady('product-dev', content.title, issueNumber, prNumber, mode === 'feedback', issueType, comment);
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
                await notifyAgentError('Product Development', content.title, issueNumber, errorMsg);
            }
            return { success: false, error: errorMsg };
        }
    });
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('product-development')
        .description('Generate Product Development documents for GitHub Project items (OPTIONAL phase for features)')
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
    console.log('  Product Development Agent');
    console.log('  (OPTIONAL phase for vague feature ideas)');
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

        if (item.status === STATUSES.productDevelopment && !item.reviewStatus) {
            mode = 'new';
        } else if (item.status === STATUSES.productDevelopment && item.reviewStatus === REVIEW_STATUSES.requestChanges) {
            mode = 'feedback';
            // Find existing PR for feedback mode
            const issueNumber = item.content?.number;
            if (issueNumber) {
                existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
            }
        } else if (item.status === STATUSES.productDevelopment && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === STATUSES.productDevelopment && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${STATUSES.productDevelopment}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", or "${REVIEW_STATUSES.clarificationReceived}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode, existingPR });
    } else {
        // Flow A: Fetch items ready for new document (Product Development status with empty Review Status)
        const allProductDevItems = await adapter.listItems({ status: STATUSES.productDevelopment, limit: options.limit || 50 });
        const newItems = allProductDevItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }

        // Flow B: Fetch items needing revision (Product Development status with Request Changes)
        if (adapter.hasReviewStatusField()) {
            const feedbackItems = allProductDevItems.filter(
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
            const clarificationItems = allProductDevItems.filter(
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
        await notifyBatchComplete('Product Development', results.processed, results.succeeded, results.failed);
    }
}

// Run
main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
