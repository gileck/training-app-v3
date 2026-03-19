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
 *
 * Processing Pipeline:
 *   1.  Validate input         — Ensure item has a linked issue; optionally skip bugs
 *   2.  Initialize logging     — Create LogContext, call logExecutionStart()
 *   3.  Send start notification— notifyAgentStarted() (skipped in dry-run)
 *   4.  Load comments          — Fetch issue comments; in feedback/post-selection mode
 *                                 also fetch PR comments and checkout the PR branch
 *   5.  Check idempotency      — In 'new' mode, skip if design file already exists
 *   6.  Load additional context— Hook for agent-specific context (e.g., product design
 *                                 loads PDD, tech design loads product design doc)
 *   7.  Determine mode & build — Select prompt builder based on mode (new, feedback,
 *       prompt                    clarification, post-selection) and construct prompt
 *   8.  Pre-agent branch setup — When allowWrite is enabled, create/checkout branch
 *                                 BEFORE running agent so file writes land on the
 *                                 design branch instead of main
 *   9.  Run agent              — Execute via library adapter (runAgent)
 *   10. Validate agent writes  — If allowWrite + allowedWritePaths, verify no files
 *                                 were written outside permitted directories
 *   11. Handle clarification   — If agent requests clarification, delegate to
 *                                 handleClarificationRequest() and return early
 *   12. Extract output         — Parse structured output / JSON / markdown fallback
 *                                 to get designContent and optional summary comment
 *   13. Branch & commit        — Create/checkout branch (if not done in step 8),
 *                                 write design doc, commit, push
 *   14. Create / update PR     — Open new PR or rely on push to update existing PR
 *   15. Post PR comments       — Summary comment, addressed-feedback marker (in
 *                                 feedback mode)
 *   16. After-PR hook          — Agent-specific post-PR logic (e.g., tech design
 *                                 posts phases comment, product design creates
 *                                 decision/mock)
 *   17. Save to S3             — Persist design content to S3 for cross-machine access
 *   18. Update status          — Call completeAgentRun() to set review status
 *   19. Send notification      — Telegram notification (default or agent-overridden)
 *   20. Log execution end      — Record success, token usage, and cost
 */

import { REVIEW_STATUSES } from './config';
import { getProjectConfig } from './config';
import type { CommonCLIOptions, GitHubComment } from './types';
import { calcTotalTokens } from './types';
import type { ProjectItemContent } from '@/server/template/project-management';
import { getProjectManagementAdapter } from '@/server/template/project-management';
import { runAgent, extractMarkdown, getLibraryForWorkflow, getModelForWorkflow } from '../lib';
import type { WorkflowName, AgentRunResult } from '../lib';
import { notifyDesignPRReady, notifyAgentError, notifyAgentStarted } from './notifications';
import { extractClarificationFromResult, handleClarificationRequest, getIssueType } from './utils';
import { addAgentPrefix, type AgentName } from './agent-identity';
import { progress } from './console';
import {
    writeDesignDoc,
    readDesignDoc,
    getDesignDocRelativePath,
    saveDesignToS3,
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

import type { ProcessableItem, ProcessMode } from './batch-processor';

// ============================================================
// TYPES
// ============================================================

type Adapter = Awaited<ReturnType<typeof getProjectManagementAdapter>>;

type OutputFormat = { type: 'json_schema'; schema: Record<string, unknown> };

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
    /** Output format schema passed to runAgent. Can be a function of mode for mode-dependent schemas. */
    outputFormat: OutputFormat | ((mode: ProcessMode) => OutputFormat);
    /** Field name in structured output that contains the design content (e.g., 'design' or 'document'). Can be a function of mode. Returns undefined/null to skip design extraction. */
    outputDesignField?: string | ((mode: ProcessMode) => string | undefined);

    /** Mode labels for logging (e.g., { new: 'New Design', feedback: 'Address Feedback' }) */
    modeLabels: Record<string, string>;

    /** Progress labels shown during agent execution */
    progressLabels: Record<string, string>;

    /**
     * Optional: Allow the agent to write files (e.g., mock pages).
     * When true, the branch is created BEFORE running the agent so
     * file writes land on the design branch, not main.
     * Can be a function of mode (e.g., allow writes only for 'new').
     */
    allowWrite?: boolean | ((mode: ProcessMode) => boolean);

    /**
     * Optional: Restrict agent file writes to these path prefixes.
     * Only checked when allowWrite is true. After the agent runs,
     * any new/modified files outside these prefixes cause a failure.
     * Example: ['src/pages/design-mocks/']
     */
    allowedWritePaths?: string[];

    /** Build prompt for new design */
    buildNewPrompt: (ctx: PromptContext) => string;
    /** Build prompt for feedback/revision */
    buildFeedbackPrompt: (ctx: PromptContext & { existingDesign: string }) => string;
    /** Build prompt for clarification continuation */
    buildClarificationPrompt: (ctx: PromptContext & { clarification: GitHubComment }) => string;
    /** Build prompt for post-selection (Phase 2: write design for chosen mock) */
    buildPostSelectionPrompt?: (ctx: PromptContext & { chosenOption: { title: string; description: string }; mockSource: string | null }) => string;

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
     * Example: techDesign posts phases comment, productDesign generates mock page and creates decision.
     */
    afterPR?: (ctx: {
        prNumber: number;
        adapter: Adapter;
        structuredOutput: Record<string, unknown>;
        logCtx: LogContext;
        mode: ProcessMode;
        issueNumber: number;
        content: NonNullable<ProjectItemContent>;
        issueType: 'bug' | 'feature';
        comment: string | undefined;
    }) => Promise<void>;

    /**
     * Optional: Override the default notification after PR creation.
     * When provided, this is called INSTEAD OF notifyDesignPRReady.
     * Example: productDesign sends decision-needed notification with preview URLs.
     * Return true to suppress the default notification, false to also send it.
     */
    overrideNotification?: (ctx: {
        prNumber: number;
        issueNumber: number;
        content: NonNullable<ProjectItemContent>;
        issueType: 'bug' | 'feature';
        mode: ProcessMode;
        comment: string | undefined;
    }) => Promise<boolean>;

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

    /**
     * Optional: Return the reviewStatus to set after agent completes.
     * Default: Waiting for Review.
     */
    getCompletionReviewStatus?: (mode: ProcessMode, hasDesignContent: boolean) => string;
}

// ============================================================
// FACTORY
// ============================================================

/**
 * Creates a processItem function for a design agent.
 *
 * @param config - Agent-specific configuration that customizes the shared pipeline.
 *   Key fields:
 *   - workflow / phaseName / agentName — identity and logging
 *   - designType — which design doc type to read/write (product-dev, product-design, tech-design)
 *   - buildNewPrompt / buildFeedbackPrompt / buildClarificationPrompt — mode-specific prompt builders
 *   - outputFormat / outputDesignField — how to parse the agent's response
 *   - allowWrite / allowedWritePaths — opt-in file-write permission for the agent
 *   - loadAdditionalContext — hook to inject extra context before prompt building
 *   - afterPR — hook for post-PR actions (e.g., posting phases, creating decisions)
 *   - overrideNotification — hook to replace the default Telegram notification
 *
 * @returns An async function with signature:
 *   (processable: ProcessableItem, options: CommonCLIOptions, adapter: Adapter) =>
 *     Promise<{ success: boolean; error?: string }>
 *   This function handles the full pipeline from validation through notification.
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

        // ============================================================
        // STAGE 1: VALIDATE INPUT
        // ============================================================

        if (!content || content.type !== 'Issue') {
            return { success: false, error: 'Item has no linked issue' };
        }

        const issueNumber = content.number!;
        console.log('');
        progress(`Processing issue #${issueNumber}: ${content.title}`);
        progress(`Mode: ${config.modeLabels[mode] ?? mode}`);

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

        // ============================================================
        // STAGE 2: INITIALIZE LOGGING
        // ============================================================

        const library = getLibraryForWorkflow(config.workflow);
        const model = await getModelForWorkflow(config.workflow);
        const logCtx = createLogContext({
            issueNumber,
            workflow: config.workflow as LogContext['workflow'],
            phase: config.phaseName,
            mode: mode === 'new' ? `New ${config.designType === 'product-dev' ? 'document' : 'design'}`
                : mode === 'feedback' ? 'Address feedback'
                : mode === 'post-selection' ? 'Post-selection design'
                : 'Clarification',
            issueTitle: content.title,
            issueType,
            currentStatus: item.status,
            currentReviewStatus: item.reviewStatus,
            library,
            model,
        });

        return runWithLogContext(logCtx, async () => {
            logExecutionStart(logCtx);

            // ============================================================
            // STAGE 3: SEND START NOTIFICATION
            // ============================================================

            if (!options.dryRun) {
                await notifyAgentStarted(config.phaseName, content.title, issueNumber, mode, issueType);
            }

            // Save original branch to return to later
            const originalBranch = getCurrentBranch();

            try {
                // ============================================================
                // STAGE 4: LOAD COMMENTS
                // ============================================================
                const comments = await adapter.getIssueComments(issueNumber);
                let allComments: GitHubComment[] = comments.map((c) => ({
                    id: c.id,
                    body: c.body,
                    author: c.author,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                }));
                if (allComments.length > 0) {
                    progress(`Found ${allComments.length} comment(s) on issue`);
                }

                // In feedback/post-selection mode with existing PR, checkout the branch first
                // This is needed because the design file lives on the PR branch, not main
                let alreadyOnPRBranch = false;
                if ((mode === 'feedback' || mode === 'post-selection') && existingPR) {
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

                // ============================================================
                // STAGE 5: CHECK IDEMPOTENCY (existing design)
                // ============================================================

                const existingDesign = readDesignDoc(issueNumber, config.designType);

                // ============================================================
                // STAGE 6: LOAD ADDITIONAL CONTEXT
                // ============================================================
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

                // ============================================================
                // STAGE 7: DETERMINE MODE & BUILD PROMPT
                // ============================================================

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
                } else if (mode === 'post-selection') {
                    // Flow D: Post-selection (Phase 2 — write design for chosen mock)
                    if (!config.buildPostSelectionPrompt) {
                        return { success: false, error: 'post-selection mode requires buildPostSelectionPrompt config' };
                    }

                    // Read the chosen option from MongoDB decision
                    const { getDecisionFromDB } = await import('@/apis/template/agent-decision/utils');
                    const decision = await getDecisionFromDB(issueNumber, content.title);
                    if (!decision) {
                        return { success: false, error: 'No decision found in DB for post-selection' };
                    }

                    // Find the selected option from DB
                    const { getSelectionFromDB } = await import('@/apis/template/agent-decision/utils');
                    const selection = await getSelectionFromDB(issueNumber);
                    if (!selection?.selectedOptionId) {
                        return { success: false, error: 'No selection found in DB for post-selection' };
                    }

                    // Handle custom solution vs predefined option
                    let chosenTitle: string;
                    let chosenDescription: string;
                    let mockOptionId: string | null = null;

                    if (selection.selectedOptionId === 'custom') {
                        chosenTitle = 'Custom Solution';
                        chosenDescription = selection.customSolution || 'Custom solution (no details provided)';
                    } else {
                        const chosenOption = decision.options.find(o => o.id === selection.selectedOptionId);
                        if (!chosenOption) {
                            return { success: false, error: `Selected option "${selection.selectedOptionId}" not found in decision options` };
                        }
                        chosenTitle = chosenOption.title;
                        chosenDescription = chosenOption.description;
                        mockOptionId = chosenOption.id;
                    }

                    // Try to read the chosen mock source file from the branch
                    let mockSource: string | null = null;
                    if (mockOptionId) {
                        try {
                            const fs = await import('fs');
                            const path = await import('path');
                            const mockPath = path.default.join(process.cwd(), `src/pages/design-mocks/components/issue-${issueNumber}-${mockOptionId}.tsx`);
                            if (fs.default.existsSync(mockPath)) {
                                mockSource = fs.default.readFileSync(mockPath, 'utf-8');
                                console.log(`  Read chosen mock source: ${mockPath} (${mockSource.length} chars)`);
                            }
                        } catch {
                            // Mock source is optional — proceed without it
                        }
                    }

                    console.log(`  Chosen option: "${chosenTitle}" (${selection.selectedOptionId})`);
                    prompt = config.buildPostSelectionPrompt({
                        ...promptCtx,
                        chosenOption: { title: chosenTitle, description: chosenDescription },
                        mockSource,
                    });
                } else {
                    // Flow C: Continue after clarification
                    const clarification = allComments[allComments.length - 1];

                    if (!clarification) {
                        return { success: false, error: 'No clarification comment found' };
                    }

                    prompt = config.buildClarificationPrompt({ ...promptCtx, clarification });
                }

                // ============================================================
                // STAGE 8: PRE-AGENT BRANCH SETUP (when allowWrite enabled)
                // ============================================================
                const resolvedOutputFormat = typeof config.outputFormat === 'function'
                    ? config.outputFormat(mode)
                    : config.outputFormat;
                const resolvedAllowWrite = typeof config.allowWrite === 'function'
                    ? config.allowWrite(mode)
                    : (config.allowWrite ?? false);

                // When allowWrite is enabled, create/checkout the branch BEFORE running
                // the agent so that file writes (e.g., mock pages) land on the design
                // branch instead of main.
                const branchName = existingPR?.branchName || generateDesignBranchName(issueNumber, config.designType);
                let earlyBranchCreated = false;

                if (resolvedAllowWrite && !alreadyOnPRBranch && !options.dryRun) {
                    const isExistingBranch = existingPR || branchExistsLocally(branchName);

                    if (hasUncommittedChanges()) {
                        const changes = getUncommittedChanges();
                        return { success: false, error: `Uncommitted changes detected - please commit or stash first\n${changes}` };
                    }

                    if (isExistingBranch) {
                        console.log(`  Checking out existing branch: ${branchName}`);
                        checkoutBranch(branchName);
                        try {
                            git(`pull origin ${branchName}`, { silent: true });
                        } catch {
                            // Branch might not exist on remote yet, ignore
                        }
                    } else {
                        console.log(`  Creating new branch: ${branchName}`);
                        checkoutBranch(branchName, true);
                    }
                    earlyBranchCreated = true;
                }

                // ============================================================
                // STAGE 9: RUN AGENT
                // ============================================================

                console.log('');
                const progressLabel = config.progressLabels[mode] ?? `Processing ${mode}`;

                const result: AgentRunResult = await runAgent({
                    prompt,
                    stream: options.stream,
                    verbose: options.verbose,
                    timeout: options.timeout,
                    progressLabel,
                    workflow: config.workflow,
                    outputFormat: resolvedOutputFormat,
                    allowWrite: resolvedAllowWrite,
                    allowedWritePaths: config.allowedWritePaths,
                });

                if (!result.success || !result.content) {
                    const error = result.error || 'No content generated';
                    if (!options.dryRun) {
                        await notifyAgentError(config.phaseName, content.title, issueNumber, error);
                    }
                    return { success: false, error };
                }

                // ============================================================
                // STAGE 10: VALIDATE AGENT WRITES
                // ============================================================
                if (resolvedAllowWrite && config.allowedWritePaths && config.allowedWritePaths.length > 0 && earlyBranchCreated) {
                    const uncommitted = getUncommittedChanges();
                    if (uncommitted) {
                        const changedFiles = uncommitted.split('\n').filter(l => l.trim());
                        const violations = changedFiles.filter(file => {
                            // Extract the file path (git status format: "?? path" or " M path" etc.)
                            const filePath = file.replace(/^[\s?MADRCU!]+\s*/, '').trim();
                            if (!filePath) return false;
                            return !config.allowedWritePaths!.some(allowed => filePath.startsWith(allowed));
                        });
                        if (violations.length > 0) {
                            const violationMsg = `Agent wrote files outside allowed paths: ${violations.join(', ')}. Allowed: ${config.allowedWritePaths.join(', ')}`;
                            console.warn(`  Warning: ${violationMsg}`);
                            logError(logCtx, violationMsg, false);
                            // Revert unauthorized changes
                            git('checkout -- .', { silent: true });
                            console.warn('  Reverted unauthorized file changes');
                        }
                    }
                }

                // ============================================================
                // STAGE 11: HANDLE CLARIFICATION
                // ============================================================
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

                // ============================================================
                // STAGE 12: EXTRACT OUTPUT
                // ============================================================
                let designContent: string | null = null;
                let comment: string | undefined;

                const structuredOutput = result.structuredOutput as Record<string, unknown> | undefined;
                const designField = typeof config.outputDesignField === 'function'
                    ? config.outputDesignField(mode)
                    : config.outputDesignField;

                if (designField) {
                    // Standard path: extract design content from output
                    if (structuredOutput && typeof structuredOutput[designField] === 'string') {
                        designContent = structuredOutput[designField] as string;
                        comment = structuredOutput.comment as string | undefined;
                        console.log(`  Design generated: ${designContent.length} chars (structured output)`);
                    } else {
                        // Try parsing as JSON first (cursor adapter returns JSON as raw text)
                        let parsed: Record<string, unknown> | null = null;
                        try {
                            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const candidate = JSON.parse(jsonMatch[0]);
                                if (candidate && typeof candidate[designField] === 'string') {
                                    parsed = candidate as Record<string, unknown>;
                                }
                            }
                        } catch {
                            // Not valid JSON, continue to markdown extraction
                        }

                        if (parsed) {
                            designContent = parsed[designField] as string;
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
                } else {
                    // No design field (e.g., Phase 1 mocks-only) — just extract comment
                    comment = structuredOutput?.comment as string | undefined;
                    if (!comment) {
                        try {
                            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const candidate = JSON.parse(jsonMatch[0]);
                                comment = candidate?.comment as string | undefined;
                            }
                        } catch {
                            // ignore
                        }
                    }
                    console.log(`  No design field — mocks-only output`);
                }

                // Determine completion review status
                const hasDesignContent = designContent !== null && designContent.length > 0;
                const completionReviewStatus = config.getCompletionReviewStatus
                    ? config.getCompletionReviewStatus(mode, hasDesignContent)
                    : REVIEW_STATUSES.waitingForReview;

                if (options.dryRun) {
                    if (hasDesignContent) {
                        console.log('  [DRY RUN] Would write design to:', getDesignDocRelativePath(issueNumber, config.designType));
                    }
                    console.log('  [DRY RUN] Would create/update PR');
                    console.log(`  [DRY RUN] Would set Review Status to ${completionReviewStatus}`);
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

                // ============================================================
                // STAGE 13: BRANCH, WRITE DESIGN, COMMIT, PUSH
                // ============================================================
                if (!alreadyOnPRBranch && !earlyBranchCreated) {
                    const isExistingBranch = existingPR || branchExistsLocally(branchName);

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

                // Write design file (only when design content exists)
                if (designContent) {
                    const designPath = writeDesignDoc(issueNumber, config.designType, designContent);
                    console.log(`  Written design to: ${designPath}`);
                }

                // Commit changes (design doc and/or agent-written mock files)
                const commitMessage = mode === 'new'
                    ? `docs: add ${config.phaseName.toLowerCase()} for issue #${issueNumber}`
                    : mode === 'post-selection'
                    ? `docs: add ${config.phaseName.toLowerCase()} design doc for issue #${issueNumber}`
                    : `docs: update ${config.phaseName.toLowerCase()} for issue #${issueNumber}`;
                commitChanges(commitMessage);
                console.log(`  Committed: ${commitMessage}`);

                // Push branch
                pushBranch(branchName, mode === 'feedback' || mode === 'post-selection');
                console.log(`  Pushed to origin/${branchName}`);

                // Log GitHub actions
                logGitHubAction(logCtx, 'branch', `${mode === 'new' ? 'Created' : 'Updated'} branch ${branchName}`);

                // ============================================================
                // STAGE 14: CREATE / UPDATE PR
                // ============================================================

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

                // ============================================================
                // STAGE 15: POST PR COMMENTS
                // ============================================================
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

                // ============================================================
                // STAGE 16: AFTER-PR HOOK
                // ============================================================
                if (config.afterPR && structuredOutput) {
                    await config.afterPR({
                        prNumber,
                        adapter,
                        structuredOutput,
                        logCtx,
                        mode,
                        issueNumber,
                        content,
                        issueType,
                        comment,
                    });
                }

                // ============================================================
                // STAGE 17: SAVE TO S3
                // ============================================================
                if (designContent) {
                    try {
                        await saveDesignToS3(issueNumber, config.designType, designContent);
                        console.log(`  Design saved to S3: design-docs/issue-${issueNumber}/`);
                    } catch (s3Error) {
                        const s3ErrMsg = `Failed to save design to S3 (non-fatal): ${s3Error instanceof Error ? s3Error.message : String(s3Error)}`;
                        console.warn(`  Warning: ${s3ErrMsg}`);
                        logError(logCtx, s3ErrMsg, false);
                    }
                }

                // Return to original branch
                checkoutBranch(originalBranch);
                console.log(`  Returned to branch: ${originalBranch}`);

                // ============================================================
                // STAGE 18: UPDATE STATUS
                // ============================================================
                const { completeAgentRun } = await import('@/server/template/workflow-service');
                await completeAgentRun(issueNumber, config.designType, {
                    reviewStatus: completionReviewStatus,
                });
                console.log(`  Review Status updated to: ${completionReviewStatus}`);

                // ============================================================
                // STAGE 19: SEND NOTIFICATION
                // ============================================================
                let notificationOverridden = false;
                if (config.overrideNotification) {
                    notificationOverridden = await config.overrideNotification({
                        prNumber,
                        issueNumber,
                        content,
                        issueType,
                        mode,
                        comment,
                    });
                }
                if (!notificationOverridden) {
                    await notifyDesignPRReady(config.designType, content.title, issueNumber, prNumber, mode === 'feedback', issueType, comment);
                }
                console.log('  Telegram notification sent');

                // ============================================================
                // STAGE 20: LOG EXECUTION END
                // ============================================================

                await logExecutionEnd(logCtx, {
                    success: true,
                    toolCallsCount: result.toolCallsCount ?? 0,
                    totalTokens: calcTotalTokens(result.usage),
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
                await logExecutionEnd(logCtx, {
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
