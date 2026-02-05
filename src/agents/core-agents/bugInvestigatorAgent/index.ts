#!/usr/bin/env tsx
/**
 * Bug Investigator Agent
 *
 * Performs read-only investigation of bug reports to identify root causes
 * and suggest fix options. Posts investigation summary to GitHub issue
 * and sends Telegram notification for admin to choose a fix approach.
 *
 * Flow A (New Investigation):
 *   - Fetches items in "Bug Investigation" status with empty Review Status
 *   - Investigates the bug using Claude (read-only mode)
 *   - Posts investigation summary to GitHub issue (not PR)
 *   - Sends Telegram notification with fix selection UI link
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Bug Investigation" with Review Status = "Request Changes"
 *   - Reads admin feedback comments
 *   - Revises investigation based on feedback
 *   - Updates issue comment with revised investigation
 *   - Sets Review Status back to "Waiting for Review"
 *
 * Usage:
 *   yarn agent:bug-investigator                    # Process all pending
 *   yarn agent:bug-investigator --id <item-id>    # Process specific item
 *   yarn agent:bug-investigator --dry-run         # Preview without saving
 *   yarn agent:bug-investigator --stream          # Stream Claude output
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
    getLibraryForWorkflow,
    getModelForWorkflow,
    // Notifications
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    // Prompts
    buildBugInvestigationPrompt,
    buildBugInvestigationRevisionPrompt,
    buildBugInvestigationClarificationPrompt,
    // Types
    type CommonCLIOptions,
    type UsageStats,
    type BugInvestigationOutput,
    // Utils
    getBugDiagnostics,
    extractClarificationFromResult,
    handleClarificationRequest,
    // Output schemas
    BUG_INVESTIGATION_OUTPUT_FORMAT,
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
import { notifyBugInvestigationReady } from '../../shared/notifications';

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    mode: 'new' | 'feedback' | 'clarification';
}

// ============================================================
// INVESTIGATION COMMENT MARKERS
// ============================================================

const INVESTIGATION_MARKER = '<!-- BUG_INVESTIGATION_V1 -->';

/**
 * Format investigation output as a GitHub comment
 */
function formatInvestigationComment(output: BugInvestigationOutput): string {
    const confidenceEmoji = output.confidence === 'high' ? '🟢' : output.confidence === 'medium' ? '🟡' : '🔴';

    let comment = `${INVESTIGATION_MARKER}
## 🔍 Bug Investigation Report

**Root Cause Found:** ${output.rootCauseFound ? 'Yes' : 'No'}
**Confidence:** ${confidenceEmoji} ${output.confidence.charAt(0).toUpperCase() + output.confidence.slice(1)}

### Root Cause Analysis

${output.rootCauseAnalysis}

### Suggested Fix Options

`;

    // Add fix options
    for (const option of output.fixOptions) {
        const recommendedBadge = option.isRecommended ? ' ⭐ **Recommended**' : '';
        comment += `#### ${option.id}: ${option.title}${recommendedBadge}

- **Complexity:** ${option.complexity}
- **Destination:** ${option.destination === 'implement' ? 'Direct Implementation' : 'Technical Design'}
- **Files Affected:** ${option.filesAffected.length > 0 ? option.filesAffected.join(', ') : 'TBD'}

${option.description}

${option.tradeoffs ? `**Trade-offs:** ${option.tradeoffs}\n` : ''}
`;
    }

    // Add files examined
    if (output.filesExamined.length > 0) {
        comment += `### Files Examined

${output.filesExamined.map(f => `- \`${f}\``).join('\n')}

`;
    }

    // Add additional logs needed if root cause not found
    if (!output.rootCauseFound && output.additionalLogsNeeded) {
        comment += `### Additional Information Needed

${output.additionalLogsNeeded}

`;
    }

    comment += `---
_Please choose a fix option in the Telegram notification, or add a comment with feedback._`;

    return comment;
}

/**
 * Check if a comment is an investigation comment
 */
function isInvestigationComment(body: string): boolean {
    return body.includes(INVESTIGATION_MARKER);
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
    console.log(`  Mode: ${mode === 'new' ? 'New Investigation' : mode === 'feedback' ? 'Address Feedback' : 'Clarification'}`);

    // Get library and model for logging
    const library = getLibraryForWorkflow('bug-investigation');
    const model = await getModelForWorkflow('bug-investigation');

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'bug-investigation',
        phase: 'Bug Investigation',
        mode: mode === 'new' ? 'New investigation' : mode === 'feedback' ? 'Address feedback' : 'Clarification',
        issueTitle: content.title,
        issueType: 'bug',
        currentStatus: item.status,
        currentReviewStatus: item.reviewStatus,
        library,
        model,
    });

    return runWithLogContext(logCtx, async () => {
        logExecutionStart(logCtx);

        // Send "work started" notification
        if (!options.dryRun) {
            await notifyAgentStarted('Bug Investigation', content.title, issueNumber, mode, 'bug');
        }

        try {
            // Load bug diagnostics from MongoDB
            const diagnostics = await getBugDiagnostics(issueNumber);
            if (diagnostics) {
                console.log(`  🐛 Bug diagnostics loaded (category: ${diagnostics.category || 'unknown'})`);
            } else {
                console.log(`  ⚠️  No bug diagnostics found - investigating based on issue description`);
            }

            // Fetch issue comments
            const comments = await adapter.getIssueComments(issueNumber);
            const allComments = comments.map((c) => ({
                id: c.id,
                body: c.body,
                author: c.author,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            }));
            if (allComments.length > 0) {
                console.log(`  Found ${allComments.length} comment(s) on issue`);
            }

            // Find existing investigation comment if in feedback mode
            let existingInvestigation: string | null = null;
            if (mode === 'feedback') {
                const investigationComment = allComments.find(c => isInvestigationComment(c.body));
                if (investigationComment) {
                    existingInvestigation = investigationComment.body;
                    console.log('  Found existing investigation comment');
                }
            }

            let prompt: string;

            if (mode === 'new') {
                // Flow A: New investigation
                // Filter out any existing investigation comments from context
                const contextComments = allComments.filter(c => !isInvestigationComment(c.body));
                prompt = buildBugInvestigationPrompt(content, diagnostics, contextComments);
            } else if (mode === 'feedback') {
                // Flow B: Address feedback
                if (!existingInvestigation) {
                    return { success: false, error: 'No existing investigation found to revise' };
                }

                // Get feedback comments (exclude the investigation comment itself)
                const feedbackComments = allComments.filter(c => !isInvestigationComment(c.body));
                if (feedbackComments.length === 0) {
                    return { success: false, error: 'No feedback comments found' };
                }

                prompt = buildBugInvestigationRevisionPrompt(content, diagnostics, existingInvestigation, feedbackComments);
            } else {
                // Flow C: Continue after clarification
                const clarification = allComments[allComments.length - 1];

                if (!clarification) {
                    return { success: false, error: 'No clarification comment found' };
                }

                prompt = buildBugInvestigationClarificationPrompt(content, diagnostics, allComments, clarification);
            }

            // Run the agent
            console.log('');
            const progressLabel = mode === 'new'
                ? 'Investigating bug'
                : mode === 'feedback'
                ? 'Revising investigation'
                : 'Continuing with clarification';

            const result = await runAgent({
                prompt,
                stream: options.stream,
                verbose: options.verbose,
                timeout: options.timeout,
                progressLabel,
                workflow: 'bug-investigation',
                outputFormat: BUG_INVESTIGATION_OUTPUT_FORMAT,
            });

            if (!result.success || !result.content) {
                const error = result.error || 'No content generated';
                if (!options.dryRun) {
                    await notifyAgentError('Bug Investigation', content.title, issueNumber, error);
                }
                return { success: false, error };
            }

            // Check if agent needs clarification
            const clarificationRequest = extractClarificationFromResult(result);
            if (clarificationRequest) {
                console.log('  🤔 Agent needs clarification');
                return await handleClarificationRequest(
                    adapter,
                    { id: item.id, content: { number: issueNumber, title: content.title, labels: content.labels } },
                    issueNumber,
                    clarificationRequest,
                    'Bug Investigation',
                    content.title,
                    'bug',
                    options,
                    'bug-investigator'
                );
            }

            // Extract structured output
            let output: BugInvestigationOutput;

            const structuredOutput = result.structuredOutput as BugInvestigationOutput | undefined;
            if (structuredOutput && typeof structuredOutput.rootCauseAnalysis === 'string') {
                output = structuredOutput;
                console.log(`  Investigation complete: ${output.fixOptions.length} fix option(s) suggested`);
                console.log(`  Root cause found: ${output.rootCauseFound} (confidence: ${output.confidence})`);
            } else {
                // Try parsing as JSON
                try {
                    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const candidate = JSON.parse(jsonMatch[0]);
                        if (candidate && typeof candidate.rootCauseAnalysis === 'string') {
                            output = candidate as BugInvestigationOutput;
                            console.log(`  Investigation complete: ${output.fixOptions.length} fix option(s) (JSON extraction)`);
                        } else {
                            throw new Error('Invalid JSON structure');
                        }
                    } else {
                        throw new Error('No JSON found in output');
                    }
                } catch {
                    const error = 'Could not extract investigation output - agent must return structured JSON';
                    if (!options.dryRun) {
                        await notifyAgentError('Bug Investigation', content.title, issueNumber, error);
                    }
                    return { success: false, error };
                }
            }

            // Validate output
            if (!output.fixOptions || output.fixOptions.length === 0) {
                const error = 'Investigation did not produce any fix options';
                if (!options.dryRun) {
                    await notifyAgentError('Bug Investigation', content.title, issueNumber, error);
                }
                return { success: false, error };
            }

            if (options.dryRun) {
                console.log('  [DRY RUN] Would post investigation comment on issue');
                console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
                console.log('  [DRY RUN] Would send Telegram notification with fix selection link');
                console.log('\n--- Investigation Summary ---');
                console.log(`  Root cause found: ${output.rootCauseFound}`);
                console.log(`  Confidence: ${output.confidence}`);
                console.log(`  Fix options: ${output.fixOptions.length}`);
                for (const opt of output.fixOptions) {
                    console.log(`    - ${opt.id}: ${opt.title} (${opt.complexity}, → ${opt.destination})${opt.isRecommended ? ' ⭐' : ''}`);
                }
                console.log('---\n');
                return { success: true };
            }

            // Format and post investigation comment
            const investigationComment = formatInvestigationComment(output);
            const prefixedComment = addAgentPrefix('bug-investigator', investigationComment);
            await adapter.addIssueComment(issueNumber, prefixedComment);
            console.log('  Investigation comment posted on issue');
            logGitHubAction(logCtx, 'comment', 'Posted bug investigation comment');

            // Update review status
            if (adapter.hasReviewStatusField()) {
                await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);
                console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);
            }

            logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${REVIEW_STATUSES.waitingForReview}`);

            // Send Telegram notification with fix selection link
            await notifyBugInvestigationReady(
                content.title,
                issueNumber,
                output.rootCauseFound,
                output.confidence,
                output.fixOptions.length,
                output.summary,
                mode === 'feedback'
            );
            console.log('  Telegram notification sent');

            // Log execution end
            logExecutionEnd(logCtx, {
                success: true,
                toolCallsCount: 0,
                totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
                totalCost: result.usage?.totalCostUSD ?? 0,
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
                await notifyAgentError('Bug Investigation', content.title, issueNumber, errorMsg);
            }
            return { success: false, error: errorMsg };
        }
    });
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('bug-investigator')
        .description('Investigate bugs to identify root causes and suggest fix options')
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
    console.log('  Bug Investigator Agent');
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

        if (item.status === STATUSES.bugInvestigation && !item.reviewStatus) {
            mode = 'new';
        } else if (item.status === STATUSES.bugInvestigation && item.reviewStatus === REVIEW_STATUSES.requestChanges) {
            mode = 'feedback';
        } else if (item.status === STATUSES.bugInvestigation && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === STATUSES.bugInvestigation && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  ⏳ Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${STATUSES.bugInvestigation}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", or "${REVIEW_STATUSES.clarificationReceived}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode });
    } else {
        // Fetch items in Bug Investigation status
        const allBugInvestigationItems = await adapter.listItems({ status: STATUSES.bugInvestigation, limit: options.limit || 50 });

        // Flow A: New investigation (empty Review Status)
        const newItems = allBugInvestigationItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }

        // Flow B: Address feedback (Request Changes)
        if (adapter.hasReviewStatusField()) {
            const feedbackItems = allBugInvestigationItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                itemsToProcess.push({ item, mode: 'feedback' });
            }

            // Flow C: Clarification received
            const clarificationItems = allBugInvestigationItems.filter(
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
        await notifyBatchComplete('Bug Investigation', results.processed, results.succeeded, results.failed);
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
