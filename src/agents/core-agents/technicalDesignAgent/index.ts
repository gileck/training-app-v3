#!/usr/bin/env tsx
/**
 * Technical Design Agent
 *
 * Generates Technical Design documents for GitHub Project items.
 *
 * Flow A (New Design):
 *   - Fetches items in "Technical Design" status with empty Review Status
 *   - Reads the approved Product Design from issue body
 *   - Generates technical design using Claude (read-only mode)
 *   - Updates issue body with design
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Technical Design" with Review Status = "Request Changes"
 *   - Reads admin feedback comments
 *   - Revises technical design based on feedback
 *   - Updates issue body with revised design
 *   - Sets Review Status back to "Waiting for Review"
 *
 * Usage:
 *   yarn agent:tech-design                    # Process all pending
 *   yarn agent:tech-design --id <item-id>     # Process specific item
 *   yarn agent:tech-design --dry-run          # Preview without saving
 *   yarn agent:tech-design --stream           # Stream Claude output
 */

import '../../shared/loadEnv';
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
    extractMarkdown,
    extractOriginalDescription,
    extractProductDesign,
    extractTechDesign,
    buildUpdatedIssueBody,
    // Notifications
    notifyTechDesignReady,
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
    extractClarification,
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

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    mode: 'new' | 'feedback' | 'clarification';
}

// ============================================================
// MAIN LOGIC
// ============================================================

async function processItem(
    processable: ProcessableItem,
    options: CommonCLIOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>
): Promise<{ success: boolean; error?: string }> {
    const { item, mode } = processable;
    const content = item.content;

    if (!content || content.type !== 'Issue') {
        return { success: false, error: 'Item has no linked issue' };
    }

    const issueNumber = content.number!;
    console.log(`\n  Processing issue #${issueNumber}: ${content.title}`);
    console.log(`  Mode: ${mode === 'new' ? 'New Design' : 'Address Feedback'}`);

    // Detect issue type and load bug diagnostics if applicable
    const issueType = getIssueType(content.labels);

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'tech-design',
        phase: 'Technical Design',
        mode: mode === 'new' ? 'New design' : mode === 'feedback' ? 'Address feedback' : 'Clarification',
        issueTitle: content.title,
        issueType,
    });

    return runWithLogContext(logCtx, async () => {
        logExecutionStart(logCtx);

        // Send "work started" notification
        if (!options.dryRun) {
            await notifyAgentStarted('Technical Design', content.title, issueNumber, mode, issueType);
        }

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

        // Extract product design (optional - may be skipped for internal/technical work or bugs)
        const productDesign = extractProductDesign(content.body);

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

        let prompt: string;

        if (mode === 'new') {
            // Flow A: New design
            // Idempotency check: Skip if design already exists
            const existingTechDesign = extractTechDesign(content.body);
            if (existingTechDesign) {
                console.log('  ⚠️  Technical design already exists in issue body - skipping to avoid duplication');
                console.log('  If you want to regenerate, use feedback mode or manually remove the existing design');
                return { success: false, error: 'Technical design already exists (idempotency check)' };
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
            const existingTechDesign = extractTechDesign(content.body);
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

        // Check if agent needs clarification
        const clarificationRequest = extractClarification(result.content);
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

        // Extract structured output (with fallback to markdown extraction)
        let design: string;
        let comment: string | undefined;

        const structuredOutput = result.structuredOutput as TechDesignOutput | undefined;
        if (structuredOutput) {
            design = structuredOutput.design;
            comment = structuredOutput.comment;
            console.log(`  Design generated: ${design.length} chars (structured output)`);
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
            console.log(`  Design generated: ${design.length} chars (fallback extraction)`);
        }

        console.log(`  Preview: ${design.slice(0, 100).replace(/\n/g, ' ')}...`);

        if (options.dryRun) {
            console.log('  [DRY RUN] Would update issue body');
            console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
            if (comment) {
                console.log('  [DRY RUN] Would post comment:');
                console.log('  ' + '='.repeat(60));
                console.log(comment.split('\n').map(l => '  ' + l).join('\n'));
                console.log('  ' + '='.repeat(60));
            }
            if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
                console.log(`  [DRY RUN] Would post phases comment (${structuredOutput.phases.length} phases)`);
            }
            console.log('  [DRY RUN] Would send notification');
            return { success: true };
        }

        // Update issue body (preserve product design)
        const originalDescription = extractOriginalDescription(content.body);
        const newBody = buildUpdatedIssueBody(originalDescription, productDesign, design);
        await adapter.updateIssueBody(issueNumber, newBody);
        console.log('  Issue body updated');

        // Post summary comment on GitHub issue (if available)
        if (comment) {
            const prefixedComment = addAgentPrefix('tech-design', comment);
            await adapter.addIssueComment(issueNumber, prefixedComment);
            console.log('  Summary comment posted');
            logGitHubAction(logCtx, 'comment', 'Posted design summary comment');
        }

        // Post phases comment for multi-PR workflow (L/XL features)
        // This provides deterministic phase storage that the implementation agent can reliably parse
        if (structuredOutput?.phases && structuredOutput.phases.length >= 2) {
            // Check if phases comment already exists (idempotency)
            if (!hasPhaseComment(issueComments)) {
                const phasesComment = formatPhasesToComment(structuredOutput.phases);
                await adapter.addIssueComment(issueNumber, phasesComment);
                console.log(`  Implementation phases comment posted (${structuredOutput.phases.length} phases)`);
                logGitHubAction(logCtx, 'comment', `Posted ${structuredOutput.phases.length} implementation phases`);
            } else {
                console.log('  Phases comment already exists, skipping');
            }
        }

        // Update review status (status stays at "Technical Design")
        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);
            console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);
        }

        // Log GitHub actions
        logGitHubAction(logCtx, 'issue_updated', `Updated issue body with technical design`);
        if (adapter.hasReviewStatusField()) {
            logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${REVIEW_STATUSES.waitingForReview}`);
        }

        // Send notification (with summary)
        await notifyTechDesignReady(content.title, issueNumber, mode === 'feedback', issueType, comment);
        console.log('  Notification sent');

        // Log execution end
        logExecutionEnd(logCtx, {
            success: true,
            toolCallsCount: 0,
            totalTokens: 0,
            totalCost: 0,
        });

        return { success: true };
        } catch (error) {
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
    console.log('Connecting to GitHub...');
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Collect items to process
    const itemsToProcess: ProcessableItem[] = [];

    if (options.id) {
        // Process specific item
        console.log(`\nFetching item: ${options.id}`);
        const item = await adapter.getItem(options.id);
        if (!item) {
            console.error(`Item not found: ${options.id}`);
            process.exit(1);
        }

        // Determine mode based on current status and review status
        let mode: 'new' | 'feedback' | 'clarification';
        if (item.status === STATUSES.techDesign && !item.reviewStatus) {
            mode = 'new';
        } else if (item.status === STATUSES.techDesign && item.reviewStatus === REVIEW_STATUSES.requestChanges) {
            mode = 'feedback';
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

        itemsToProcess.push({ item, mode });
    } else {
        // Flow A: Fetch items ready for new design (Technical Design status with empty Review Status)
        console.log(`\nFetching items in "${STATUSES.techDesign}" with empty Review Status...`);
        const allTechDesignItems = await adapter.listItems({ status: STATUSES.techDesign, limit: options.limit || 50 });
        const newItems = allTechDesignItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }
        console.log(`  Found ${newItems.length} item(s) for new design`);

        // Flow B: Fetch items needing revision (Technical Design status with Request Changes)
        if (adapter.hasReviewStatusField()) {
            console.log(`\nFetching items with Review Status "${REVIEW_STATUSES.requestChanges}"...`);
            const feedbackItems = allTechDesignItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                itemsToProcess.push({ item, mode: 'feedback' });
            }
            console.log(`  Found ${feedbackItems.length} item(s) needing revision`);

            // Flow C: Fetch items with clarification received
            console.log(`\nFetching items with Review Status "${REVIEW_STATUSES.clarificationReceived}"...`);
            const clarificationItems = allTechDesignItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.clarificationReceived
            );
            for (const item of clarificationItems) {
                itemsToProcess.push({ item, mode: 'clarification' });
            }
            console.log(`  Found ${clarificationItems.length} item(s) with clarification received`);
        }

        // Apply limit
        if (options.limit && itemsToProcess.length > options.limit) {
            itemsToProcess.length = options.limit;
        }
    }

    if (itemsToProcess.length === 0) {
        console.log('\nNo items to process.');
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
