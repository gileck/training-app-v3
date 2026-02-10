/**
 * Design Agent Processor Factory
 *
 * Extracts the ~400-line processItem() logic shared across the 3 design agents
 * (productDesign, productDevelopment, technicalDesign) into a configurable factory.
 *
 * Each design agent configures this with its unique variation points:
 * - prompt builders, output field name, additional context loading, after-PR hooks, etc.
 *
 * The factory returns a processItem function that handles the entire flow:
 *   validate -> log -> notify -> comments -> context -> prompt -> agent -> extract
 *   -> branch -> write -> commit -> push -> PR -> comment -> status -> notify
 */

import { REVIEW_STATUSES } from './config';
import { getProjectConfig } from './config';
import type { CommonCLIOptions, GitHubComment } from './types';
import type { ProjectItemContent } from '@/server/project-management';
import { getProjectManagementAdapter } from '@/server/project-management';
import { runAgent, extractMarkdown, getLibraryForWorkflow, getModelForWorkflow } from '../lib';
import type { WorkflowName, AgentRunResult } from '../lib';
import { notifyDesignPRReady, notifyAgentError, notifyAgentStarted } from './notifications';
import { extractClarificationFromResult, handleClarificationRequest, getIssueType } from './utils';
import { addAgentPrefix, type AgentName } from './agent-identity';
import {
    writeDesignDoc,
    readDesignDoc,
    getDesignDocRelativePath,
} from '../lib/design-files';
import type { DesignDocType } from '../lib/design-files';
import { generateDesignBranchName } from '../lib/artifacts';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logError,
} from '../lib/logging';
import type { LogContext } from '../lib/logging';
import {
    git,
    hasUncommittedChanges,
    getUncommittedChanges,
    branchExistsLocally,
    checkoutBranch,
    getCurrentBranch,
    commitChanges,
    pushBranch,
    getDefaultBranch,
} from './git-utils';

import type { ProcessableItem } from './batch-processor';

// ============================================================
// TYPES
// ============================================================

type Adapter = Awaited<ReturnType<typeof getProjectManagementAdapter>>;

/** Context passed to prompt builder functions */
export interface PromptContext {
    /** The issue content (title, body, labels, number, etc.) */
    content: NonNullable<ProjectItemContent>;
    /** All issue (and optionally PR) comments */
    allComments: GitHubComment[];
    /** Additional context loaded by loadAdditionalContext (e.g., product design for tech-design) */
    additionalContext: string | null;
    /** Issue number */
    issueNumber: number;
}

/** Configuration for a design agent processor */
export interface DesignAgentConfig {
    /** Workflow identifier for runAgent and logging */
    workflow: WorkflowName;
    /** Human-readable phase name for logs/notifications (e.g., 'Product Design') */
    phaseName: string;
    /** Design file type for read/write operations */
    designType: DesignDocType;
    /** Agent identity name for comment prefixes */
    agentName: AgentName;
    /** Output format schema passed to runAgent */
    outputFormat: { type: 'json_schema'; schema: Record<string, unknown> };
    /** Field name in structured output that contains the design content (e.g., 'design' or 'document') */
    outputDesignField: string;

    /** Mode labels for logging (e.g., { new: 'New Design', feedback: 'Address Feedback' }) */
    modeLabels: {
        new: string;
        feedback: string;
        clarification: string;
    };

    /** Progress labels shown during agent execution */
    progressLabels: {
        new: string;
        feedback: string;
        clarification: string;
    };

    /** Build prompt for new design */
    buildNewPrompt: (ctx: PromptContext) => string;
    /** Build prompt for feedback/revision */
    buildFeedbackPrompt: (ctx: PromptContext & { existingDesign: string }) => string;
    /** Build prompt for clarification continuation */
    buildClarificationPrompt: (ctx: PromptContext & { clarification: GitHubComment }) => string;

    /**
     * Optional: Whether to skip bug issues. If true, bugs are rejected with an error message.
     * Default: false (processes bugs normally).
     */
    skipBugs?: boolean;
    /** Optional: Custom message when skipping bugs */
    skipBugMessage?: string;
    /** Optional: Custom error string when skipping bugs */
    skipBugError?: string;

    /**
     * Optional: Load additional context before prompt building.
     * Returns context string to include, or null.
     * Examples: techDesign loads product design, productDesign loads PDD.
     */
    loadAdditionalContext?: (ctx: {
        issueNumber: number;
        adapter: Adapter;
        content: NonNullable<ProjectItemContent>;
        allComments: GitHubComment[];
    }) => Promise<{ context: string | null; label?: string }>;

    /**
     * Optional: Hook called after PR is created/updated.
     * Example: techDesign posts phases comment.
     */
    afterPR?: (ctx: {
        prNumber: number;
        adapter: Adapter;
        structuredOutput: Record<string, unknown>;
        logCtx: LogContext;
        mode: 'new' | 'feedback' | 'clarification';
    }) => Promise<void>;

    /**
     * Optional: Sort comments after collection.
     * Default: no sort. techDesign sorts chronologically.
     */
    sortComments?: (comments: GitHubComment[]) => GitHubComment[];

    /** Optional: Extra dry-run output (e.g., techDesign logs phases info) */
    dryRunExtra?: (structuredOutput: Record<string, unknown>) => void;

    /** PR title template. Receives issueNumber. */
    prTitle: (issueNumber: number) => string;
    /** PR body template. Receives issueNumber. */
    prBody: (issueNumber: number) => string;
}

// ============================================================
// FACTORY
// ============================================================

/**
 * Creates a processItem function for a design agent.
 * The returned function handles the entire design agent flow.
 */
export function createDesignProcessor(
    config: DesignAgentConfig
): (processable: ProcessableItem, options: CommonCLIOptions, adapter: Adapter) => Promise<{ success: boolean; error?: string }> {

    return async function processItem(
        processable: ProcessableItem,
        options: CommonCLIOptions,
        adapter: Adapter
    ): Promise<{ success: boolean; error?: string }> {
        const { item, mode, existingPR } = processable;
        const content = item.content;

        if (!content || content.type !== 'Issue') {
            return { success: false, error: 'Item has no linked issue' };
        }

        const issueNumber = content.number!;
        console.log(`\n  Processing issue #${issueNumber}: ${content.title}`);
        console.log(`  Mode: ${config.modeLabels[mode]}`);

        // Check if this is a bug - optionally skip
        const issueType = getIssueType(content.labels);
        if (config.skipBugs && issueType === 'bug') {
            if (config.skipBugMessage) {
                const lines = config.skipBugMessage.split('\n');
                for (const line of lines) {
                    console.log(`  ${line}`);
                }
            }
            return { success: false, error: config.skipBugError || `Bug reports skip ${config.phaseName} by default` };
        }

        // Get library and model for logging
        const library = getLibraryForWorkflow(config.workflow);
        const model = await getModelForWorkflow(config.workflow);

        // Create log context
        const logCtx = createLogContext({
            issueNumber,
            workflow: config.workflow as LogContext['workflow'],
            phase: config.phaseName,
            mode: mode === 'new' ? `New ${config.designType === 'product-dev' ? 'document' : 'design'}`
                : mode === 'feedback' ? 'Address feedback' : 'Clarification',
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
                await notifyAgentStarted(config.phaseName, content.title, issueNumber, mode, issueType);
            }

            // Save original branch to return to later
            const originalBranch = getCurrentBranch();

            try {
                // Always fetch issue comments - they provide context for any phase
                const comments = await adapter.getIssueComments(issueNumber);
                let allComments: GitHubComment[] = comments.map((c) => ({
                    id: c.id,
                    body: c.body,
                    author: c.author,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                }));
                if (allComments.length > 0) {
                    console.log(`  Found ${allComments.length} comment(s) on issue`);
                }

                // In feedback mode with existing PR, checkout the branch first to read existing design
                // This is needed because the design file lives on the PR branch, not main
                let alreadyOnPRBranch = false;
                if (mode === 'feedback' && existingPR) {
                    // Ensure clean working directory before branch operations
                    if (hasUncommittedChanges()) {
                        const changes = getUncommittedChanges();
                        return { success: false, error: `Uncommitted changes detected - please commit or stash first\n${changes}` };
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

                    // Also fetch PR comments as potential feedback
                    const prComments = await adapter.getPRComments(existingPR.prNumber);
                    const prFeedback = prComments
                        .filter((c) => !c.body.includes('<!-- ') && !c.body.includes('ISSUE_ARTIFACT')) // Skip bot/artifact comments
                        .map((c) => ({
                            id: c.id,
                            body: `[PR Comment] ${c.body}`,
                            author: c.author,
                            createdAt: c.createdAt,
                            updatedAt: c.updatedAt,
                        }));
                    if (prFeedback.length > 0) {
                        console.log(`  Found ${prFeedback.length} feedback comment(s) on PR #${existingPR.prNumber}`);
                        allComments = [...allComments, ...prFeedback];
                    }

                    // Sort comments if configured (e.g., techDesign sorts chronologically)
                    if (config.sortComments) {
                        allComments = config.sortComments(allComments);
                    }
                }

                // Check for existing design in file (for idempotency / feedback mode)
                const existingDesign = readDesignDoc(issueNumber, config.designType);

                // Load additional context if configured
                let additionalContext: string | null = null;
                if (config.loadAdditionalContext) {
                    const result = await config.loadAdditionalContext({
                        issueNumber,
                        adapter,
                        content,
                        allComments,
                    });
                    additionalContext = result.context;
                    if (result.label) {
                        console.log(`  ${result.label}`);
                    }
                }

                let prompt: string;
                const promptCtx: PromptContext = { content, allComments, additionalContext, issueNumber };

                if (mode === 'new') {
                    // Flow A: New design
                    // Idempotency check: Skip if design file already exists
                    if (existingDesign) {
                        console.log(`  \u26A0\uFE0F  ${config.phaseName} file already exists - skipping to avoid duplication`);
                        console.log('  If you want to regenerate, use feedback mode or manually remove the existing design');
                        return { success: false, error: `${config.phaseName} file already exists (idempotency check)` };
                    }
                    prompt = config.buildNewPrompt(promptCtx);
                } else if (mode === 'feedback') {
                    // Flow B: Address feedback
                    if (!existingDesign) {
                        return { success: false, error: `No existing ${config.phaseName.toLowerCase()} found to revise` };
                    }

                    if (allComments.length === 0) {
                        return { success: false, error: 'No feedback comments found' };
                    }

                    prompt = config.buildFeedbackPrompt({ ...promptCtx, existingDesign });
                } else {
                    // Flow C: Continue after clarification
                    const clarification = allComments[allComments.length - 1];

                    if (!clarification) {
                        return { success: false, error: 'No clarification comment found' };
                    }

                    prompt = config.buildClarificationPrompt({ ...promptCtx, clarification });
                }

                // Run the agent
                console.log('');
                const progressLabel = config.progressLabels[mode];

                const result: AgentRunResult = await runAgent({
                    prompt,
                    stream: options.stream,
                    verbose: options.verbose,
                    timeout: options.timeout,
                    progressLabel,
                    workflow: config.workflow,
                    outputFormat: config.outputFormat,
                });

                if (!result.success || !result.content) {
                    const error = result.error || 'No content generated';
                    if (!options.dryRun) {
                        await notifyAgentError(config.phaseName, content.title, issueNumber, error);
                    }
                    return { success: false, error };
                }

                // Check if agent needs clarification (in both raw content and structured output)
                const clarificationRequest = extractClarificationFromResult(result);
                if (clarificationRequest) {
                    console.log('  \uD83E\uDD14 Agent needs clarification');
                    return await handleClarificationRequest(
                        adapter,
                        { id: item.id, content: { number: issueNumber, title: content.title, labels: content.labels } },
                        issueNumber,
                        clarificationRequest,
                        config.phaseName,
                        content.title,
                        issueType,
                        options,
                        config.agentName
                    );
                }

                // Extract structured output (with fallback to JSON/markdown extraction)
                let designContent: string;
                let comment: string | undefined;

                const structuredOutput = result.structuredOutput as Record<string, unknown> | undefined;
                if (structuredOutput && typeof structuredOutput[config.outputDesignField] === 'string') {
                    designContent = structuredOutput[config.outputDesignField] as string;
                    comment = structuredOutput.comment as string | undefined;
                    console.log(`  Design generated: ${designContent.length} chars (structured output)`);
                } else {
                    // Try parsing as JSON first (cursor adapter returns JSON as raw text)
                    let parsed: Record<string, unknown> | null = null;
                    try {
                        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const candidate = JSON.parse(jsonMatch[0]);
                            if (candidate && typeof candidate[config.outputDesignField] === 'string') {
                                parsed = candidate as Record<string, unknown>;
                            }
                        }
                    } catch {
                        // Not valid JSON, continue to markdown extraction
                    }

                    if (parsed) {
                        designContent = parsed[config.outputDesignField] as string;
                        comment = parsed.comment as string | undefined;
                        console.log(`  Design generated: ${designContent.length} chars (JSON extraction)`);
                    } else {
                        // Fallback: extract markdown from text output
                        const extracted = extractMarkdown(result.content);
                        if (!extracted) {
                            const error = `Could not extract ${config.phaseName.toLowerCase()} from output`;
                            if (!options.dryRun) {
                                await notifyAgentError(config.phaseName, content.title, issueNumber, error);
                            }
                            return { success: false, error };
                        }
                        designContent = extracted;
                        console.log(`  Design generated: ${designContent.length} chars (markdown extraction)`);
                    }
                }

                console.log(`  Preview: ${designContent.slice(0, 100).replace(/\n/g, ' ')}...`);

                if (options.dryRun) {
                    console.log('  [DRY RUN] Would write design to:', getDesignDocRelativePath(issueNumber, config.designType));
                    console.log('  [DRY RUN] Would create/update PR');
                    console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
                    if (comment) {
                        console.log('  [DRY RUN] Would post comment on PR:');
                        console.log('  ' + '='.repeat(60));
                        console.log(comment.split('\n').map(l => '  ' + l).join('\n'));
                        console.log('  ' + '='.repeat(60));
                    }
                    if (config.dryRunExtra && structuredOutput) {
                        config.dryRunExtra(structuredOutput);
                    }
                    console.log('  [DRY RUN] Would send Telegram notification with merge buttons');
                    return { success: true };
                }

                // Generate branch name and determine if we're updating existing PR
                const branchName = existingPR?.branchName || generateDesignBranchName(issueNumber, config.designType);
                const isExistingBranch = existingPR || branchExistsLocally(branchName);

                // Checkout or create branch (skip if already on PR branch from earlier checkout)
                if (!alreadyOnPRBranch) {
                    // Ensure clean working directory before branch operations
                    if (hasUncommittedChanges()) {
                        const changes = getUncommittedChanges();
                        return { success: false, error: `Uncommitted changes detected - please commit or stash first\n${changes}` };
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

                // Write design file
                const designPath = writeDesignDoc(issueNumber, config.designType, designContent);
                console.log(`  Written design to: ${designPath}`);

                // Commit changes
                const commitMessage = mode === 'new'
                    ? `docs: add ${config.phaseName.toLowerCase()} for issue #${issueNumber}`
                    : `docs: update ${config.phaseName.toLowerCase()} for issue #${issueNumber}`;
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
                    const defaultBranch = getDefaultBranch();
                    const prResult = await adapter.createPullRequest(
                        branchName,
                        defaultBranch,
                        config.prTitle(issueNumber),
                        config.prBody(issueNumber)
                    );
                    prNumber = prResult.number;
                    prUrl = prResult.url;
                    console.log(`  Created PR #${prNumber}: ${prUrl}`);
                    logGitHubAction(logCtx, 'pr', `Created PR #${prNumber}`);
                }

                // Post summary comment on PR (if available)
                if (comment) {
                    const prefixedComment = addAgentPrefix(config.agentName, comment);
                    await adapter.addPRComment(prNumber, prefixedComment);
                    console.log('  Summary comment posted on PR');
                    logGitHubAction(logCtx, 'comment', 'Posted design summary comment on PR');
                }

                // In feedback mode, post "Addressed Feedback" marker to help track what was addressed
                if (mode === 'feedback' && comment) {
                    const addressedMarker = `<!-- ADDRESSED_FEEDBACK_MARKER -->
**\u2705 Addressed Feedback** (${new Date().toISOString().split('T')[0]})

The design has been revised to address the feedback above. Key changes:

${comment}`;
                    await adapter.addPRComment(prNumber, addressedMarker);
                    console.log('  Addressed feedback marker posted on PR');
                    logGitHubAction(logCtx, 'comment', 'Posted addressed feedback marker on PR');
                }

                // Run after-PR hook if configured (e.g., techDesign posts phases comment)
                if (config.afterPR && structuredOutput) {
                    await config.afterPR({
                        prNumber,
                        adapter,
                        structuredOutput,
                        logCtx,
                        mode,
                    });
                }

                // Return to original branch
                checkoutBranch(originalBranch);
                console.log(`  Returned to branch: ${originalBranch}`);

                // Update review status via workflow service
                const { completeAgentRun } = await import('@/server/workflow-service');
                await completeAgentRun(issueNumber, config.designType, {
                    reviewStatus: REVIEW_STATUSES.waitingForReview,
                });
                console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);

                // Send Telegram notification with merge buttons
                await notifyDesignPRReady(config.designType, content.title, issueNumber, prNumber, mode === 'feedback', issueType, comment);
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
                    await notifyAgentError(config.phaseName, content.title, issueNumber, errorMsg);
                }
                return { success: false, error: errorMsg };
            }
        });
    };
}
