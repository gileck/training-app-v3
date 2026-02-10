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
import {
    // Config
    STATUSES,
    REVIEW_STATUSES,
    // Project management
    getProjectManagementAdapter,
    // Claude
    runAgent,
    getLibraryForWorkflow,
    getModelForWorkflow,
    // Notifications
    notifyAgentError,
    notifyAgentStarted,
    // Prompts
    buildBugInvestigationPrompt,
    buildBugInvestigationRevisionPrompt,
    buildBugInvestigationClarificationPrompt,
    // Types
    type BugInvestigationOutput,
    // Utils
    getBugDiagnostics,
    extractClarificationFromResult,
    handleClarificationRequest,
    // Output schemas
    BUG_INVESTIGATION_OUTPUT_FORMAT,
    // Agent Identity
    addAgentPrefix,
    // CLI & Batch
    createCLI,
    runBatch,
    type ProcessableItem,
    type CommonCLIOptions,
} from '../../shared';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logError,
} from '../../lib/logging';
import { notifyDecisionNeeded, notifyDecisionAutoSubmitted } from '../../shared/notifications';
import { formatDecisionComment, isDecisionComment as isGenericDecisionComment, saveDecisionToDB, formatDecisionSelectionComment, saveSelectionToDB } from '@/apis/template/agent-decision/utils';
import type { DecisionOption, MetadataFieldConfig, DestinationOption, RoutingConfig } from '@/apis/template/agent-decision/types';

// ============================================================
// INVESTIGATION COMMENT FORMATTING
// ============================================================

const LEGACY_INVESTIGATION_MARKER = '<!-- BUG_INVESTIGATION_V1 -->';

/** Metadata schema for bug investigation decision options */
const BUG_FIX_METADATA_SCHEMA: MetadataFieldConfig[] = [
    { key: 'complexity', label: 'Complexity', type: 'badge', colorMap: { S: 'green', M: 'yellow', L: 'orange', XL: 'red' } },
    { key: 'destination', label: 'Destination', type: 'tag' },
    { key: 'filesAffected', label: 'Files Affected', type: 'file-list' },
    { key: 'tradeoffs', label: 'Trade-offs', type: 'text' },
];

/** Custom destination options for bug fix decisions */
const BUG_FIX_DESTINATION_OPTIONS: DestinationOption[] = [
    { value: 'tech-design', label: 'Technical Design' },
    { value: 'implement', label: 'Implementation' },
];

/** Routing config: maps option metadata to project statuses */
const BUG_FIX_ROUTING: RoutingConfig = {
    metadataKey: 'destination',
    statusMap: {
        'Direct Implementation': 'Ready for development',
        'Technical Design': 'Technical Design',
    },
    customDestinationStatusMap: {
        'implement': 'Ready for development',
        'tech-design': 'Technical Design',
    },
};

/**
 * Convert bug investigation output to generic decision options
 */
function toDecisionOptions(output: BugInvestigationOutput): DecisionOption[] {
    return output.fixOptions.map(opt => ({
        id: opt.id,
        title: opt.title,
        description: opt.description,
        isRecommended: opt.isRecommended,
        metadata: {
            complexity: opt.complexity,
            destination: opt.destination === 'implement' ? 'Direct Implementation' : 'Technical Design',
            filesAffected: opt.filesAffected.length > 0 ? opt.filesAffected : [],
            ...(opt.tradeoffs ? { tradeoffs: opt.tradeoffs } : {}),
        },
    }));
}

/**
 * Build context markdown for bug investigation decision
 */
function buildDecisionContext(output: BugInvestigationOutput): string {
    const confidenceEmoji = output.confidence === 'high' ? '🟢' : output.confidence === 'medium' ? '🟡' : '🔴';
    const confidenceLabel = output.confidence.charAt(0).toUpperCase() + output.confidence.slice(1);

    let context = `**Root Cause Found:** ${output.rootCauseFound ? 'Yes' : 'No'}
**Confidence:** ${confidenceEmoji} ${confidenceLabel}

### Root Cause Analysis

${output.rootCauseAnalysis}`;

    if (output.filesExamined.length > 0) {
        context += `\n\n### Files Examined\n\n${output.filesExamined.map(f => `- \`${f}\``).join('\n')}`;
    }

    if (!output.rootCauseFound && output.additionalLogsNeeded) {
        context += `\n\n### Additional Information Needed\n\n${output.additionalLogsNeeded}`;
    }

    return context;
}

/**
 * Format investigation output as a generic agent decision comment
 */
function formatInvestigationComment(output: BugInvestigationOutput): string {
    const options = toDecisionOptions(output);
    const context = buildDecisionContext(output);

    return formatDecisionComment(
        'bug-investigator',
        'bug-fix',
        context,
        options,
        BUG_FIX_METADATA_SCHEMA,
        BUG_FIX_DESTINATION_OPTIONS,
        BUG_FIX_ROUTING
    );
}

/**
 * Check if a comment is an investigation comment (supports both old and new format)
 */
function isInvestigationComment(body: string): boolean {
    return body.includes(LEGACY_INVESTIGATION_MARKER) || isGenericDecisionComment(body);
}

// ============================================================
// MAIN LOGIC
// ============================================================

export async function processItem(
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

            // Save decision to DB
            const decisionOptions = toDecisionOptions(output);
            const decisionContext = buildDecisionContext(output);
            await saveDecisionToDB(
                issueNumber,
                'bug-investigator',
                'bug-fix',
                decisionContext,
                decisionOptions,
                BUG_FIX_METADATA_SCHEMA,
                BUG_FIX_DESTINATION_OPTIONS,
                BUG_FIX_ROUTING
            );

            // Check for auto-submit: skip admin selection for obvious fixes
            const recommendedOption = output.fixOptions.find(opt => opt.isRecommended);
            if (
                output.autoSubmit &&
                recommendedOption &&
                output.confidence === 'high' &&
                recommendedOption.complexity === 'S' &&
                recommendedOption.destination === 'implement'
            ) {
                console.log(`  Auto-submitting recommended fix: ${recommendedOption.id} (${recommendedOption.title})`);

                // Post selection comment on issue
                const selection = { selectedOptionId: recommendedOption.id };
                const selectionComment = formatDecisionSelectionComment(selection, decisionOptions);
                await adapter.addIssueComment(issueNumber, selectionComment);
                await saveSelectionToDB(issueNumber, selection);

                // Route directly to implementation via workflow service
                const targetStatus = 'Ready for development';
                const { completeAgentRun } = await import('@/server/workflow-service');
                await completeAgentRun(issueNumber, 'bug-investigation', {
                    status: targetStatus,
                    clearReviewStatus: true,
                });
                console.log(`  Item auto-routed to: ${targetStatus}`);
                console.log('  Review status cleared');

                logGitHubAction(logCtx, 'issue_updated', `Auto-submitted fix "${recommendedOption.title}" → ${targetStatus}`);

                // Send auto-submit Telegram notification
                await notifyDecisionAutoSubmitted(
                    'Bug Investigation',
                    content.title,
                    issueNumber,
                    recommendedOption.title,
                    targetStatus,
                    'bug'
                );
                console.log('  Telegram auto-submit notification sent');
            } else {
                // Normal flow: wait for admin to select an option

                // Update review status via workflow service
                const { completeAgentRun: completeRun } = await import('@/server/workflow-service');
                await completeRun(issueNumber, 'bug-investigation', {
                    reviewStatus: REVIEW_STATUSES.waitingForReview,
                });
                console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);

                // Send Telegram notification with decision selection link
                await notifyDecisionNeeded(
                    'Bug Investigation',
                    content.title,
                    issueNumber,
                    output.summary,
                    output.fixOptions.length,
                    'bug',
                    mode === 'feedback'
                );
                console.log('  Telegram notification sent');
            }

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
    const { options } = createCLI({
        name: 'bug-investigator',
        displayName: 'Bug Investigator Agent',
        description: 'Investigate bugs to identify root causes and suggest fix options',
    });

    await runBatch(
        {
            agentStatus: STATUSES.bugInvestigation,
            agentDisplayName: 'Bug Investigation',
            needsExistingPR: false,
        },
        options,
        processItem,
    );
}

// Run (skip when imported as a module in tests)
if (!process.env.VITEST) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}
