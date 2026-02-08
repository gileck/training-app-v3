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
    agentConfig,
    // Project management
    getProjectManagementAdapter,
    // Claude
    runAgent,
    getLibraryForWorkflow,
    getModelForWorkflow,
    extractProductDesign,
    extractTechDesign,
    // Notifications
    notifyPRReady,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    notifyAdmin,
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
    // CLI
    createCLI,
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
    isPlaywrightMCPAvailable,
    startDevServer,
    stopDevServer,
    type DevServerState,
} from '../../lib';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logGitHubAction,
    logError,
    logFeatureBranch,
} from '../../lib/logging';

// Submodules
import type { ProcessableItem, ImplementOptions } from './types';
import { createBranchFromBase, generateBranchName, verifyAllPushed, pullBranch, runYarnChecks } from './gitUtils';
import { resolvePhaseInfo } from './phaseSetup';
import { buildPromptForMode, appendPhaseContext, appendLocalTestingContext } from './promptBuilder';
import { validateAndFixChanges } from './changeValidation';
import { createImplementationPR, postFeedbackResponse } from './prManagement';

// ============================================================
// MAIN LOGIC
// ============================================================

async function processItem(
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
            return { success: false, error: `Uncommitted changes in working directory. Please commit or stash them first.\n${changes}` };
        }

        const diagnostics = issueType === 'bug'
            ? await getBugDiagnostics(issueNumber)
            : null;

        if (issueType === 'bug') {
            console.log(`  🐛 Bug fix implementation (diagnostics loaded: ${diagnostics ? 'yes' : 'no'})`);

            // Warn if diagnostics are missing for a bug
            if (!diagnostics && !options.dryRun) {
                await notifyAdmin(
                    `⚠️ <b>Warning:</b> Bug diagnostics missing\n\n` +
                    `📋 ${content.title}\n` +
                    `🔗 Issue #${issueNumber}\n\n` +
                    `The bug report does not have diagnostics (session logs, stack trace). ` +
                    `The implementation may be incomplete without this context.`
                );
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
            if (mode === 'feedback' || mode === 'clarification') {
                // Pull latest changes
                try {
                    pullBranch(branchName);
                } catch {
                    console.log('  Note: Could not pull from remote (branch may not exist remotely yet)');
                }
            }
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

        // Determine if local testing is enabled for this run
        // Check: config enabled + not skipped + new mode + Playwright MCP available
        const playwrightAvailable = isPlaywrightMCPAvailable();
        const enableLocalTesting = agentConfig.localTesting.enabled &&
            !options.skipLocalTest &&
            mode === 'new' &&
            playwrightAvailable;

        if (agentConfig.localTesting.enabled && !options.skipLocalTest && mode === 'new' && !playwrightAvailable) {
            const mcpWarning = 'Local testing disabled: @playwright/mcp not installed. To enable: yarn add -D @playwright/mcp';
            console.log(`  ⚠️ ${mcpWarning}`);
            // Log to issue logger (non-fatal)
            logError(logCtx, mcpWarning, false);
        }

        // Start dev server for local testing (if enabled)
        let devServer: DevServerState | null = null;
        if (enableLocalTesting && !options.dryRun) {
            console.log('\n  🧪 Starting dev server for local testing...');
            try {
                devServer = await startDevServer({
                    cwd: process.cwd(),
                    startupTimeout: agentConfig.localTesting.devServerStartupTimeout,
                });

                // Health check: verify dev server isn't serving error pages
                try {
                    const healthResponse = await fetch(devServer.url);
                    const body = await healthResponse.text();
                    const buildErrorPatterns = [
                        'Module not found',
                        'Cannot find module',
                        'Build Error',
                        'Compilation Error',
                        'SyntaxError',
                        'Internal Server Error',
                    ];
                    const hasError = buildErrorPatterns.some(pattern => body.includes(pattern));
                    if (hasError) {
                        console.log('  ⚠️ Dev server has build errors — skipping visual verification');
                        stopDevServer(devServer);
                        devServer = null;
                    }
                } catch {
                    console.log('  ⚠️ Dev server health check failed — skipping visual verification');
                    if (devServer) {
                        stopDevServer(devServer);
                        devServer = null;
                    }
                }

                // Only add local testing context if dev server is healthy
                if (devServer) {
                    prompt = appendLocalTestingContext(prompt, devServer.url);
                }
            } catch (error) {
                const devServerError = `Failed to start dev server: ${error instanceof Error ? error.message : String(error)}`;
                console.log(`  ⚠️ ${devServerError}`);
                console.log('  Continuing without local testing...');
                // Log to issue logger (non-fatal - implementation continues)
                logError(logCtx, `Local testing skipped: ${devServerError}`, false);
            }
        }

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
            return { success: false, error };
        }

        // Check if agent needs clarification (in both raw content and structured output)
        const clarificationRequest = extractClarificationFromResult(result);
        if (clarificationRequest) {
            console.log('  🤔 Agent needs clarification');
            // Checkout back to default branch before pausing
            git(`checkout ${defaultBranch}`);
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
                console.warn('  ⚠️ Structured output returned but missing fields:');
                if (!prSummary) console.warn('    - prSummary is missing');
                if (!comment) console.warn('    - comment is missing');
            }
        } else {
            console.warn('  ⚠️ Structured output not returned by agent adapter');
            console.warn('    Agent library may not support structured output');
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
                    return { success: false, error: 'Agent did not make any changes' };
                }
            } catch {
                console.log('  Could not check for branch commits');
                git(`checkout ${defaultBranch}`);
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

        // Update status to PR Review and set review status
        await adapter.updateItemStatus(item.id, STATUSES.prReview);
        console.log(`  Status updated to: ${STATUSES.prReview}`);
        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);
            console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);
        }

        // Log GitHub actions
        if (mode === 'new' && prNumber) {
            logGitHubAction(logCtx, 'pr_created', `Created PR #${prNumber}`);
        }
        if (adapter.hasReviewStatusField()) {
            logGitHubAction(logCtx, 'issue_updated', `Set Review Status to ${REVIEW_STATUSES.waitingForReview}`);
        }

        // Send notification (with summary)
        if (prNumber) {
            await notifyPRReady(content.title, issueNumber, prNumber, mode === 'feedback', issueType, comment);
            console.log('  Notification sent');
        }

        // Checkout back to default branch
        git(`checkout ${defaultBranch}`);
        console.log(`  ✅ Switched back to ${defaultBranch}`);

        // Log execution end
        logExecutionEnd(logCtx, {
            success: true,
            toolCallsCount: 0, // Not tracked in UsageStats
            totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
            totalCost: result.usage?.totalCostUSD ?? 0,
        });

        return { success: true, prNumber };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`  Error: ${errorMsg}`);

            // Log error
            logError(logCtx, error instanceof Error ? error : errorMsg, true);

            // Try to checkout back to default branch
            try {
                git(`checkout ${defaultBranch}`);
            } catch {
                console.error('  Warning: Could not checkout back to default branch');
            }

            // Log execution end
            logExecutionEnd(logCtx, {
                success: false,
                toolCallsCount: 0,
                totalTokens: 0,
                totalCost: 0,
            });

            if (!options.dryRun) {
                await notifyAgentError('Implementation', content.title, issueNumber, errorMsg);
            }
            return { success: false, error: errorMsg };
        }
    });
}

async function main(): Promise<void> {
    const { options: baseOptions, extra } = createCLI({
        name: 'implement',
        displayName: 'Implementation Agent',
        description: 'Implement features and create PRs for GitHub Project items',
        additionalOptions: [
            { flag: '--skip-push', description: 'Skip pushing to remote (for testing)', defaultValue: false },
            { flag: '--skip-pull', description: 'Skip pulling latest changes from master', defaultValue: false },
            { flag: '--skip-local-test', description: 'Skip local testing with Playwright MCP', defaultValue: false },
        ],
    });
    const options: ImplementOptions = {
        ...baseOptions,
        skipPush: Boolean(extra.skipPush),
        skipPull: Boolean(extra.skipPull),
        skipLocalTest: Boolean(extra.skipLocalTest),
    };

    // Check for uncommitted changes before starting
    if (hasUncommittedChanges()) {
        console.error('Error: Uncommitted changes in working directory.');
        console.error('Please commit or stash your changes before running this agent.');
        console.error('Uncommitted files:\n' + getUncommittedChanges());
        process.exit(1);
    }

    // Get default branch and ensure we're on it
    let defaultBranch: string;
    try {
        defaultBranch = git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
        console.log(`Switching to ${defaultBranch}...`);
        git(`checkout ${defaultBranch}`, { silent: true });
        console.log(`  ✅ On ${defaultBranch}`);
    } catch (error) {
        console.error('Error: Failed to checkout default branch.');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }

    // Pull latest (unless --skip-pull is specified)
    if (!options.skipPull) {
        console.log(`Pulling latest from ${defaultBranch}...`);
        try {
            git(`pull origin ${defaultBranch}`, { silent: true });
            console.log(`  ✅ On latest ${defaultBranch}`);
        } catch (error) {
            console.error('Error: Failed to pull latest.');
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    } else {
        console.log('⚠️  Skipping git pull (--skip-pull specified)');
    }

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
        let prNumber: number | undefined;
        let branchName: string | undefined;

        if (item.status === STATUSES.implementation && !item.reviewStatus) {
            mode = 'new';
        } else if (
            (item.status === STATUSES.implementation || item.status === STATUSES.prReview) &&
            item.reviewStatus === REVIEW_STATUSES.requestChanges
        ) {
            mode = 'feedback';
            // Find the open PR and get both PR number AND branch name from it
            // Getting branch from PR is more reliable than regenerating (title/phase could change)
            const openPR = await adapter.findOpenPRForIssue(item.content?.number || 0);
            if (openPR) {
                prNumber = openPR.prNumber;
                branchName = openPR.branchName;
            }
        } else if (item.status === STATUSES.implementation && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === STATUSES.implementation && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  ⏳ Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${STATUSES.implementation}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", or "${REVIEW_STATUSES.clarificationReceived}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode, prNumber, branchName });
    } else {
        // Flow A: Fetch items ready for implementation (Implementation status with empty Review Status)
        // For new implementations, we ALWAYS create a new PR (no idempotency check needed)
        const allImplementationItems = await adapter.listItems({ status: STATUSES.implementation, limit: options.limit || 50 });
        const newItems = allImplementationItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }

        // Flow B: Fetch items needing revision (Implementation or PR Review status with Request Changes)
        // For feedback mode, we find the OPEN PR and get its branch name directly from the PR
        // This is more reliable than regenerating the branch name (title/phase could have changed)
        if (adapter.hasReviewStatusField()) {
            const feedbackItems = allImplementationItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                const openPR = await adapter.findOpenPRForIssue(item.content?.number || 0);
                if (openPR) {
                    itemsToProcess.push({
                        item,
                        mode: 'feedback',
                        prNumber: openPR.prNumber,
                        branchName: openPR.branchName,
                    });
                }
            }

            // Also fetch PR Review items with Request Changes
            const prReviewItems = await adapter.listItems({ status: STATUSES.prReview, limit: options.limit || 50 });
            const prFeedbackItems = prReviewItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of prFeedbackItems) {
                const openPR = await adapter.findOpenPRForIssue(item.content?.number || 0);
                if (openPR) {
                    itemsToProcess.push({
                        item,
                        mode: 'feedback',
                        prNumber: openPR.prNumber,
                        branchName: openPR.branchName,
                    });
                }
            }

            // Flow C: Fetch items with clarification received
            const clarificationItems = allImplementationItems.filter(
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

        const result = await processItem(processable, options, adapter, defaultBranch);

        if (result.success) {
            results.succeeded++;
            if (result.prNumber) {
                console.log(`  PR: #${result.prNumber}`);
            }
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
        await notifyBatchComplete('Implementation', results.processed, results.succeeded, results.failed);
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
