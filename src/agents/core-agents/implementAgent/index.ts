#!/usr/bin/env tsx
/**
 * Implementation Agent
 *
 * Implements features and creates Pull Requests for GitHub Project items.
 *
 * Flow A (New Implementation):
 *   - Fetches items in "Implementation" status with empty Review Status
 *   - Creates a feature branch
 *   - Runs Claude agent with implementation prompt (WRITE mode)
 *   - Commits and pushes changes
 *   - Creates PR linking to issue
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Implementation" with Review Status = "Request Changes"
 *   - Reads PR review comments
 *   - Runs Claude agent to address feedback (WRITE mode)
 *   - Commits and pushes changes
 *   - Sets Review Status back to "Waiting for Review"
 *
 * Usage:
 *   yarn agent:implement                    # Process all pending
 *   yarn agent:implement --id <item-id>     # Process specific item
 *   yarn agent:implement --dry-run          # Preview without changes
 *   yarn agent:implement --stream           # Stream Claude output
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
    extractProductDesign,
    extractTechDesign,
    // Notifications
    notifyAgentError,
    notifyAgentStarted,
    // Types
    type GitHubComment,
    type ImplementationOutput,
    // Utils
    getIssueType,
    getBugDiagnostics,
    extractClarificationFromResult,
    handleClarificationRequest,
    // Output schemas
    IMPLEMENTATION_OUTPUT_FORMAT,
    // Git utilities (shared)
    git,
    hasUncommittedChanges,
    getUncommittedChanges,
    checkoutBranch,
    commitChanges,
    pushBranch,
    // Token calculation
    calcTotalTokens,
} from '../../shared';
import {
    getProductDesignPath,
    getTechDesignPath,
    generateTaskBranchName,
    generatePhaseBranchName,
} from '../../lib/artifacts';
import { getArtifactsFromIssue } from '../../lib/workflow-db';
import {
    readDesignDoc,
} from '../../lib/design-files';
import {
    PLAYWRIGHT_MCP_CONFIG,
    PLAYWRIGHT_TOOLS,
} from '../../lib';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logFeatureBranch,
    logError,
} from '../../lib/logging';
import { handleAgentError } from '../../shared/error-handler';
import { runAgentMain } from '../../shared/main-factory';

// Submodules
import type { ProcessableItem, ImplementOptions } from './types';
import { createBranchFromBase, generateBranchName, verifyAllPushed, pullBranch, runYarnChecks } from './gitUtils';
import { resolvePhaseInfo } from './phaseSetup';
import { buildPromptForMode, appendPhaseContext } from './promptBuilder';
import { validateAndFixChanges } from './changeValidation';
import { createImplementationPR, postFeedbackResponse } from './prManagement';
import { setupDevServer, stopDevServer } from './devServerSetup';
import { warnMissingBugDiagnostics, sendPRReadyNotification } from './notifications';

// ============================================================
// MAIN LOGIC
// ============================================================

export async function processItem(
    processable: ProcessableItem,
    options: ImplementOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    defaultBranch: string
): Promise<{ success: boolean; prNumber?: number; error?: string }> {
    const { item, mode } = processable;
    const content = item.content;

    if (!content || content.type !== 'Issue') {
        return { success: false, error: 'Item has no linked issue' };
    }

    const issueNumber = content.number!;
    console.log(`\n  Processing issue #${issueNumber}: ${content.title}`);
    console.log(`  Mode: ${mode === 'new' ? 'New Implementation' : 'Address Feedback'}`);

    // Detect issue type and load bug diagnostics if applicable
    const issueType = getIssueType(content.labels);

    // Get library and model for logging
    const library = getLibraryForWorkflow('implementation');
    const model = await getModelForWorkflow('implementation');

    // Create log context
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'implement',
        phase: 'Implementation',
        mode: mode === 'new' ? 'New implementation' : mode === 'feedback' ? 'Address feedback' : 'Clarification',
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
            await notifyAgentStarted('Implementation', content.title, issueNumber, mode, issueType);
        }

        try {
        // Check for uncommitted changes (exclude agent-logs/ since logExecutionStart already modified it)
        if (hasUncommittedChanges(['agent-logs/'])) {
            const changes = getUncommittedChanges(['agent-logs/']);
            await logExecutionEnd(logCtx, { success: false, toolCallsCount: 0, totalTokens: 0, totalCost: 0 });
            return { success: false, error: `Uncommitted changes in working directory. Please commit or stash them first.\n${changes}` };
        }

        const diagnostics = issueType === 'bug'
            ? await getBugDiagnostics(issueNumber)
            : null;

        if (issueType === 'bug') {
            console.log(`  🐛 Bug fix implementation (diagnostics loaded: ${diagnostics ? 'yes' : 'no'})`);

            // Warn if diagnostics are missing for a bug
            if (!diagnostics && !options.dryRun) {
                await warnMissingBugDiagnostics(content.title, issueNumber);
            }
        }

        // Always fetch issue comments early - they're needed for artifact comment, phase extraction, and prompts
        const allIssueComments = await adapter.getIssueComments(issueNumber);
        const issueComments: GitHubComment[] = allIssueComments.map((c) => ({
            id: c.id,
            body: c.body,
            author: c.author,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }));
        if (issueComments.length > 0) {
            console.log(`  Found ${issueComments.length} comment(s) on issue`);
        }

        // Extract designs - try files first (new system), fallback to issue body (old system)
        let productDesign: string | null = null;
        let techDesign: string | null = null;

        // Try DB-first artifact read, fallback to comment parsing
        const artifact = await getArtifactsFromIssue(adapter, issueNumber);
        if (artifact) {
            // Try to read from files
            const productPath = getProductDesignPath(artifact);
            const techPath = getTechDesignPath(artifact);

            if (productPath && artifact.productDesign?.status === 'approved') {
                productDesign = readDesignDoc(issueNumber, 'product');
                if (productDesign) {
                    console.log(`  Loaded product design from file (new system)`);
                }
            }

            if (techPath && artifact.techDesign?.status === 'approved') {
                techDesign = readDesignDoc(issueNumber, 'tech');
                if (techDesign) {
                    console.log(`  Loaded tech design from file (new system)`);
                }
            }
        }

        // Fallback to issue body for any designs not found in files (backward compatibility)
        if (!productDesign) {
            productDesign = extractProductDesign(content.body);
            if (productDesign) {
                console.log(`  Loaded product design from issue body (fallback)`);
            }
        }
        if (!techDesign) {
            techDesign = extractTechDesign(content.body);
            if (techDesign) {
                console.log(`  Loaded tech design from issue body (fallback)`);
            }
        }

        // Resolve multi-phase implementation info
        const {
            currentPhase,
            totalPhases,
            currentPhaseDetails,
            taskBranchForPhase,
        } = await resolvePhaseInfo(processable, adapter, issueNumber, issueComments, techDesign, artifact, defaultBranch, options);

        // Determine branch name:
        // - For feedback mode: use the branch name from the OPEN PR (more reliable)
        // - For new/clarification multi-phase: use phase branch naming (feature/task-{id}-phase-{N})
        // - For new/clarification single-phase: use old naming (feature/issue-{N}-{slug})
        let branchName: string;
        if (mode === 'feedback' && processable.branchName) {
            branchName = processable.branchName;
        } else if (currentPhase && totalPhases && totalPhases > 1) {
            // Multi-phase: use new naming convention
            branchName = generatePhaseBranchName(issueNumber, currentPhase);
            const phaseBranchMsg = `Using phase branch: ${branchName}`;
            console.log(`  🌿 ${phaseBranchMsg}`);
            logFeatureBranch(issueNumber, phaseBranchMsg);
        } else {
            // Single-phase: use old naming convention (unchanged)
            branchName = generateBranchName(issueNumber, content.title, issueType === 'bug', currentPhase);
        }

        if (mode === 'feedback' && processable.branchName) {
            console.log(`  Using branch from PR: ${branchName}`);
        }

        if (!techDesign && !productDesign) {
            console.log('  Note: No design documents found - implementing from issue description only');
        } else if (!techDesign) {
            console.log('  Note: No technical design found - implementing from product design and issue description');
        } else if (!productDesign) {
            console.log('  Note: No product design found - implementing from technical design only (internal work)');
        }

        // Build prompt for the appropriate mode
        let promptResult;
        try {
            promptResult = await buildPromptForMode(
                processable, adapter, content, issueNumber, issueComments,
                productDesign, techDesign, branchName, diagnostics,
            );
        } catch (error) {
            if (error instanceof Error) {
                await logExecutionEnd(logCtx, { success: false, toolCallsCount: 0, totalTokens: 0, totalCost: 0 });
                return { success: false, error: error.message };
            }
            throw error;
        }
        let { prompt } = promptResult;

        // Add phase-specific context if this is a multi-phase new implementation
        if (mode === 'new' && currentPhase && totalPhases && currentPhaseDetails) {
            prompt = appendPhaseContext(prompt, currentPhase, totalPhases, currentPhaseDetails);
        }

        // Checkout the feature branch
        console.log(`  Checking out branch: ${branchName}`);
        const branchExistsLocally = git('branch --list ' + branchName, { silent: true }).length > 0;

        if (mode === 'new' && !branchExistsLocally) {
            // For multi-phase: create phase branch from feature branch
            // For single-phase: create from default branch (unchanged)
            if (taskBranchForPhase) {
                // Multi-phase: create from feature branch
                const createPhaseMsg = `Creating phase branch from feature branch: ${taskBranchForPhase}`;
                console.log(`  🌿 ${createPhaseMsg}`);
                logFeatureBranch(issueNumber, createPhaseMsg);
                createBranchFromBase(branchName, taskBranchForPhase, issueNumber);
            } else if (currentPhase === 1 && totalPhases && totalPhases > 1) {
                // Phase 1 of multi-phase: create from the new feature branch
                const taskBranch = generateTaskBranchName(issueNumber);
                const createPhase1Msg = `Creating Phase 1 branch from feature branch: ${taskBranch}`;
                console.log(`  🌿 ${createPhase1Msg}`);
                logFeatureBranch(issueNumber, createPhase1Msg);
                createBranchFromBase(branchName, taskBranch, issueNumber);
            } else {
                // Single-phase: create from default branch (unchanged behavior)
                checkoutBranch(branchName, true);
            }
        } else {
            checkoutBranch(branchName, false);
            // Always pull latest from remote to avoid stale local branches
            try {
                pullBranch(branchName);
            } catch {
                console.log('  Note: Could not pull from remote (branch may not exist remotely yet)');
            }
        }

        // Merge latest default branch into feature branch to pick up structural changes
        // This prevents errors when main has refactored paths that the feature branch lacks
        try {
            git(`merge origin/${defaultBranch} --no-edit`, { silent: true });
            console.log(`  ✅ Merged latest ${defaultBranch} into ${branchName}`);
        } catch {
            console.log(`  Note: Could not merge ${defaultBranch} (may already be up to date or have conflicts)`);
        }

        // Run pre-work yarn checks (informational only)
        if (!options.dryRun) {
            console.log('  Running pre-work yarn checks...');
            const preChecks = runYarnChecks();
            if (!preChecks.success) {
                console.log('  ⚠️ Pre-existing issues found (continuing anyway)');
                console.log('  Output:', preChecks.output.slice(0, 500)); // Show first 500 chars
            } else {
                console.log('  ✅ Codebase is clean');
            }
        }

        // Set up dev server for local testing (if enabled)
        const devServerResult = await setupDevServer(mode, prompt, options, logCtx);
        const devServer = devServerResult.devServer;
        prompt = devServerResult.prompt;

        // Run the agent (WRITE mode)
        console.log('');
        const progressLabel = mode === 'new'
            ? 'Implementing feature'
            : mode === 'feedback'
            ? 'Addressing feedback'
            : 'Continuing with clarification';

        let result;
        try {
            result = await runAgent({
                prompt,
                stream: options.stream,
                verbose: options.verbose,
                timeout: options.timeout,
                progressLabel,
                allowWrite: true, // Enable write mode
                workflow: 'implementation',
                outputFormat: IMPLEMENTATION_OUTPUT_FORMAT,
                // Only use plan mode for new implementations, not for feedback/clarification
                shouldUsePlanMode: mode === 'new',
                // Add Playwright MCP for local testing (only if dev server is running)
                ...(devServer ? {
                    mcpServers: PLAYWRIGHT_MCP_CONFIG,
                    additionalTools: PLAYWRIGHT_TOOLS,
                } : {}),
            });
        } finally {
            // Always stop dev server if it was started
            if (devServer) {
                stopDevServer(devServer);
            }
        }

        if (!result.success) {
            const error = result.error || 'Implementation failed';
            const isTimeout = error.includes('Timed out');

            if (isTimeout) {
                // Log timeout diagnostics
                const diagnostics = result.timeoutDiagnostics;
                if (diagnostics) {
                    console.log(`  Timeout classification: ${diagnostics.classification}`);
                    console.log(`  Total tool calls: ${diagnostics.totalToolCalls}`);
                    if (diagnostics.pendingToolCall) {
                        console.log(`  Pending tool: ${diagnostics.pendingToolCall.name} -> ${diagnostics.pendingToolCall.target}`);
                    }
                    console.log(`  Last tool calls:`);
                    for (const tc of diagnostics.lastToolCalls) {
                        const ago = Math.floor((Date.now() - tc.timestamp) / 1000);
                        console.log(`    - ${tc.name} -> ${tc.target} (${ago}s ago)`);
                    }
                }

                // Capture modified files before cleanup
                let modifiedFiles = '';
                try {
                    modifiedFiles = git('diff --stat', { silent: true });
                } catch { /* ignore */ }

                // Log timeout section to agent log
                const timeoutLogContent = `\n### [LOG:TIMEOUT] Agent Timeout\n\n` +
                    `**Classification:** ${diagnostics?.classification || 'Unknown'}\n` +
                    `**Total Tool Calls:** ${diagnostics?.totalToolCalls || 0}\n` +
                    (diagnostics?.pendingToolCall ? `**Pending Tool:** ${diagnostics.pendingToolCall.name} -> ${diagnostics.pendingToolCall.target}\n` : '') +
                    `**Time Since Last Tool Call:** ${diagnostics?.timeSinceLastToolCall || 0}s\n` +
                    `**Time Since Last Response:** ${diagnostics?.timeSinceLastResponse || 0}s\n` +
                    `**Token Usage:** ${result.usage ? `${result.usage.inputTokens + result.usage.outputTokens} tokens ($${result.usage.totalCostUSD?.toFixed(4) || '0'})` : 'N/A'}\n\n` +
                    (diagnostics?.lastToolCalls.length ? `**Last Tool Calls:**\n${diagnostics.lastToolCalls.map(tc => `- ${tc.name} -> ${tc.target}`).join('\n')}\n\n` : '') +
                    (modifiedFiles ? `**Files Modified at Timeout:**\n\`\`\`\n${modifiedFiles}\n\`\`\`\n\n` : '') +
                    `**Action:** Changes discarded for clean retry\n\n`;

                // Write to agent log
                try {
                    const { appendToLog } = await import('../../lib/logging/writer');
                    appendToLog(issueNumber, timeoutLogContent);
                } catch { /* ignore logging failures */ }

                // Clean up: discard all changes for clean retry
                try {
                    git('checkout -- .', { silent: true });
                    git('clean -fd', { silent: true });
                    console.log('  Cleaned up working directory for retry');
                } catch (cleanupError) {
                    console.error('  Warning: Failed to clean up after timeout:', cleanupError);
                }
            }

            // Checkout back to default branch before failing
            git(`checkout ${defaultBranch}`);
            if (!options.dryRun) {
                await notifyAgentError('Implementation', content.title, issueNumber, error);
            }
            await logExecutionEnd(logCtx, {
                success: false,
                toolCallsCount: result.toolCallsCount ?? 0,
                totalTokens: calcTotalTokens(result.usage),
                totalCost: result.usage?.totalCostUSD ?? 0,
            });
            return { success: false, error };
        }

        // Check if agent needs clarification (in both raw content and structured output)
        const clarificationRequest = extractClarificationFromResult(result);
        if (clarificationRequest) {
            console.log('  🤔 Agent needs clarification');
            // Checkout back to default branch before pausing
            git(`checkout ${defaultBranch}`);
            await logExecutionEnd(logCtx, {
                success: false,
                toolCallsCount: result.toolCallsCount ?? 0,
                totalTokens: calcTotalTokens(result.usage),
                totalCost: result.usage?.totalCostUSD ?? 0,
            });
            return await handleClarificationRequest(
                adapter,
                { id: item.id, content: { number: issueNumber, title: content.title, labels: content.labels } },
                issueNumber,
                clarificationRequest,
                'Implementation',
                content.title,
                issueType,
                options,
                'implementor'
            );
        }

        console.log(`  Agent completed in ${result.durationSeconds}s`);

        // Extract structured output (no fallback - warn if missing)
        let prSummary: string | null = null;
        let comment: string | undefined;

        const structuredOutput = result.structuredOutput as ImplementationOutput | undefined;
        if (structuredOutput) {
            prSummary = structuredOutput.prSummary || null;
            comment = structuredOutput.comment;
            if (prSummary && comment) {
                console.log('  PR summary extracted (structured output)');
            } else {
                const missingFields = [
                    ...(!prSummary ? ['prSummary'] : []),
                    ...(!comment ? ['comment'] : []),
                ].join(', ');
                const warnMsg = `Structured output missing fields: ${missingFields}`;
                console.warn(`  ⚠️ ${warnMsg}`);
                logError(logCtx, warnMsg, false);
            }
        } else {
            const warnMsg = 'Structured output not returned by agent adapter — library may not support it';
            console.warn(`  ⚠️ ${warnMsg}`);
            logError(logCtx, warnMsg, false);
        }

        // Check if there are changes to commit
        const hasChanges = hasUncommittedChanges();
        if (!hasChanges) {
            // Agent might have already committed changes via Bash tool
            // Check if there are commits on this branch that aren't on the default branch
            console.log('  No uncommitted changes - checking for branch commits...');
            try {
                const diffOutput = git(`log ${defaultBranch}..HEAD --oneline`, { silent: true });
                if (diffOutput.trim()) {
                    console.log('  Found existing commits on branch - proceeding');
                } else {
                    console.log('  No commits on branch either');
                    git(`checkout ${defaultBranch}`);
                    await logExecutionEnd(logCtx, {
                        success: false,
                        toolCallsCount: result.toolCallsCount ?? 0,
                        totalTokens: calcTotalTokens(result.usage),
                        totalCost: result.usage?.totalCostUSD ?? 0,
                    });
                    return { success: false, error: 'Agent did not make any changes' };
                }
            } catch {
                console.log('  Could not check for branch commits');
                git(`checkout ${defaultBranch}`);
                await logExecutionEnd(logCtx, {
                    success: false,
                    toolCallsCount: result.toolCallsCount ?? 0,
                    totalTokens: calcTotalTokens(result.usage),
                    totalCost: result.usage?.totalCostUSD ?? 0,
                });
                return { success: false, error: 'Agent did not make any changes' };
            }
        }

        // Run post-work yarn checks - fix any new issues
        if (!options.dryRun) {
            await validateAndFixChanges(options);
        }

        if (options.dryRun) {
            console.log('  [DRY RUN] Would commit changes');
            console.log('  [DRY RUN] Would push to remote');
            console.log('  [DRY RUN] Would verify all commits are pushed');
            if (mode === 'new') {
                console.log('  [DRY RUN] Would create PR');
            }
            if (comment) {
                console.log(`  [DRY RUN] Would post comment on ${mode === 'new' ? 'PR' : 'PR'}:`);
                console.log('  ' + '='.repeat(60));
                console.log(comment.split('\n').map(l => '  ' + l).join('\n'));
                console.log('  ' + '='.repeat(60));
            }
            console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
            console.log('  [DRY RUN] Would send notification');
            // Discard changes and checkout back to default branch
            try {
                git('checkout -- .');
                git(`checkout ${defaultBranch}`);
            } catch (cleanupError) {
                console.error('  Warning: Failed to clean up after dry run:', cleanupError);
            }
            await logExecutionEnd(logCtx, {
                success: true,
                toolCallsCount: result.toolCallsCount ?? 0,
                totalTokens: calcTotalTokens(result.usage),
                totalCost: result.usage?.totalCostUSD ?? 0,
            });
            return { success: true };
        }

        // Re-check for uncommitted changes (fix agent or yarn checks auto-fix may have created new ones)
        const hasChangesToCommit = hasUncommittedChanges();

        // Commit changes (only if there are uncommitted changes)
        if (hasChangesToCommit) {
            const commitPrefix = issueType === 'bug' ? 'fix' : 'feat';
            const phaseLabel = currentPhase && totalPhases
                ? ` (Phase ${currentPhase}/${totalPhases})`
                : '';
            const closesOrPartOf = currentPhase && totalPhases && currentPhase < totalPhases
                ? `Part of #${issueNumber}`
                : `Closes #${issueNumber}`;
            const commitMessage = mode === 'new'
                ? `${commitPrefix}: ${content.title}${phaseLabel}\n\n${closesOrPartOf}`
                : `fix: address review feedback for #${issueNumber}`;

            console.log('  Committing changes...');
            commitChanges(commitMessage);
        } else {
            console.log('  Skipping commit (no uncommitted changes - using existing commits)');
        }

        // Push to remote (always push if there are unpushed commits)
        if (!options.skipPush) {
            if (!verifyAllPushed(branchName)) {
                console.log('  Pushing to remote...');
                pushBranch(branchName, mode === 'feedback');

                // Verify push succeeded
                console.log('  Verifying all commits are pushed...');
                if (!verifyAllPushed(branchName)) {
                    await logExecutionEnd(logCtx, {
                        success: false,
                        toolCallsCount: result.toolCallsCount ?? 0,
                        totalTokens: calcTotalTokens(result.usage),
                        totalCost: result.usage?.totalCostUSD ?? 0,
                    });
                    return { success: false, error: 'Failed to push all commits to remote. Please check network connection and try again.' };
                }
                console.log('  ✅ All commits pushed successfully');
            } else {
                console.log('  ✅ All commits already pushed');
            }
        }

        let prNumber = processable.prNumber;

        // Create PR if new implementation
        // NOTE: No idempotency check here - for new implementations, we ALWAYS create a new PR
        // Reason: In multi-phase workflows, old merged PRs from previous phases would be
        // incorrectly detected as "existing" PRs. Instead, we simply create new PRs.
        // If there's truly a duplicate (e.g., crash recovery), GitHub will return an error
        // that we can handle gracefully.
        if (mode === 'new') {
            prNumber = await createImplementationPR({
                adapter,
                issueNumber,
                issueType,
                contentTitle: content.title,
                branchName,
                prSummary,
                comment,
                currentPhase,
                totalPhases,
                currentPhaseDetails,
                logCtx,
            });
        } else {
            // Feedback mode: Add comments on both issue and PR
            if (prNumber) {
                await postFeedbackResponse({
                    adapter,
                    issueNumber,
                    prNumber,
                    comment,
                    currentPhase,
                    totalPhases,
                    logCtx,
                });
            }
        }

        // Update status to PR Review and set review status via workflow service
        const { completeAgentRun } = await import('@/server/template/workflow-service');
        await completeAgentRun(issueNumber, 'implementation', {
            status: STATUSES.prReview,
            reviewStatus: REVIEW_STATUSES.waitingForReview,
        });
        console.log(`  Status updated to: ${STATUSES.prReview}`);
        console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);

        // Log GitHub actions
        if (mode === 'new' && prNumber) {
            logGitHubAction(logCtx, 'pr_created', `Created PR #${prNumber}`);
        }
        if (adapter.hasReviewStatusField()) {
            logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${REVIEW_STATUSES.waitingForReview}`);
        }

        // Send notification (with summary)
        if (prNumber) {
            await sendPRReadyNotification(content.title, issueNumber, prNumber, mode === 'feedback', issueType, comment);
        }

        // Checkout back to default branch
        git(`checkout ${defaultBranch}`);
        console.log(`  ✅ Switched back to ${defaultBranch}`);

        // Log execution end
        await logExecutionEnd(logCtx, {
            success: true,
            toolCallsCount: result.toolCallsCount ?? 0,
            totalTokens: calcTotalTokens(result.usage),
            totalCost: result.usage?.totalCostUSD ?? 0,
        });

        return { success: true, prNumber };
        } catch (error) {
            return handleAgentError({
                error,
                logCtx,
                phaseName: 'Implementation',
                issueTitle: content.title,
                issueNumber,
                dryRun: !!options.dryRun,
                cleanup: () => git(`checkout ${defaultBranch}`),
            });
        }
    });
}

// Create and run the main function (using factory to avoid circular imports)
import { createMain } from './mainFlow';

// Run (skip when imported as a module in tests)
runAgentMain(createMain(processItem), { skipInTest: true });
