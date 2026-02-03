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
    extractProductDesign,
    extractTechDesign,
    // Notifications
    notifyPRReady,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    notifyAdmin,
    // Prompts
    buildImplementationPrompt,
    buildPRRevisionPrompt,
    buildImplementationClarificationPrompt,
    buildBugImplementationPrompt,
    // Types
    type CommonCLIOptions,
    type GitHubComment,
    type ImplementationOutput,
    type ImplementationPhase,
    // Utils
    getIssueType,
    getBugDiagnostics,
    extractClarificationFromResult,
    handleClarificationRequest,
    // Output schemas
    IMPLEMENTATION_OUTPUT_FORMAT,
    // Agent Identity
    addAgentPrefix,
} from '../../shared';
import {
    extractPhasesFromTechDesign,
    parsePhaseString,
} from '../../lib/parsing';
import {
    parsePhasesFromComment,
} from '../../lib/phases';
import {
    parseArtifactComment,
    getProductDesignPath,
    getTechDesignPath,
    getTaskBranch,
    generateTaskBranchName,
    generatePhaseBranchName,
    updateImplementationPhaseArtifact,
    setTaskBranch,
} from '../../lib/artifacts';
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

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    mode: 'new' | 'feedback' | 'clarification';
    prNumber?: number;
    /**
     * Branch name for feedback mode.
     * For feedback mode, this is retrieved FROM the open PR (not regenerated).
     * This is more reliable than regenerating because:
     * - Title could have changed
     * - Phase number could be wrong
     * - The PR itself knows its actual branch name
     */
    branchName?: string;
    /** Phase info for multi-PR workflow */
    phaseInfo?: {
        current: number;
        total: number;
        phases: ImplementationPhase[];
    };
}

interface ImplementOptions extends CommonCLIOptions {
    skipPush?: boolean;
    skipPull?: boolean;
    skipLocalTest?: boolean;
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
 * Create a branch from a specific base branch
 * Used for creating phase branches from feature branch in multi-phase workflow
 */
function createBranchFromBase(newBranch: string, baseBranch: string, issueNumber: number): void {
    const msg = `Creating branch ${newBranch} from ${baseBranch}`;
    console.log(`  🌿 ${msg}`);
    logFeatureBranch(issueNumber, msg);
    // Ensure base branch is up to date
    try {
        git(`fetch origin ${baseBranch}`, { silent: true });
    } catch {
        const fetchMsg = `Could not fetch ${baseBranch} - may not exist remotely yet`;
        console.log(`  🌿 ${fetchMsg}`);
        logFeatureBranch(issueNumber, fetchMsg);
    }
    // Create new branch from base
    git(`checkout -b ${newBranch} origin/${baseBranch}`);
}

/**
 * Create the feature branch for multi-phase workflow
 * Returns the feature branch name
 */
async function ensureFeatureBranch(
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number,
    defaultBranch: string
): Promise<string> {
    const taskBranchName = generateTaskBranchName(issueNumber);
    const ensureMsg = `Ensuring feature branch exists: ${taskBranchName}`;
    console.log(`  🌿 ${ensureMsg}`);
    logFeatureBranch(issueNumber, ensureMsg);

    // Check if branch exists remotely
    const branchExists = await adapter.branchExists(taskBranchName);

    if (branchExists) {
        const existsMsg = `Feature branch already exists: ${taskBranchName}`;
        console.log(`  🌿 ${existsMsg}`);
        logFeatureBranch(issueNumber, existsMsg);
    } else {
        const createMsg = `Creating feature branch: ${taskBranchName} from ${defaultBranch}`;
        console.log(`  🌿 ${createMsg}`);
        logFeatureBranch(issueNumber, createMsg);
        await adapter.createBranch(taskBranchName, defaultBranch);
        const successMsg = `Feature branch created successfully`;
        console.log(`  🌿 ${successMsg}`);
        logFeatureBranch(issueNumber, successMsg);
    }

    return taskBranchName;
}

/**
 * Generate a branch name from issue number and title
 * For multi-phase features, includes the phase number
 */
function generateBranchName(issueNumber: number, title: string, isBug: boolean = false, phaseNumber?: number): string {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes AFTER truncating
    const prefix = isBug ? 'fix' : 'feature';
    if (phaseNumber) {
        return `${prefix}/issue-${issueNumber}-phase-${phaseNumber}-${slug}`;
    }
    return `${prefix}/issue-${issueNumber}-${slug}`;
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
 * Verify all commits are pushed to remote
 */
function verifyAllPushed(branchName: string): boolean {
    try {
        // Check if there are any commits that exist locally but not on remote
        const unpushedCommits = git(`rev-list origin/${branchName}..HEAD`, { silent: true });
        return unpushedCommits.trim().length === 0;
    } catch {
        // If the remote branch doesn't exist yet, that's expected for new branches
        // The push command would have failed if there was an issue
        return true;
    }
}

/**
 * Pull latest from a branch
 */
function pullBranch(branchName: string): void {
    git(`pull origin ${branchName} --rebase`);
}

/**
 * Run yarn checks:ci and return results
 * This runs BOTH TypeScript and ESLint checks, showing ALL errors at once
 *
 * CRITICAL: Uses exit code to determine success/failure, NOT output parsing.
 * Exit code 0 = success, non-zero = failure. This is the ONLY reliable way.
 */
function runYarnChecks(): { success: boolean; output: string } {
    try {
        const output = execSync('yarn checks:ci', {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 120000,
        });
        // If execSync didn't throw, the command succeeded (exit code 0)
        return {
            success: true,
            output
        };
    } catch (error) {
        // execSync throws when command exits with non-zero code = failure
        const err = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
        const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString() || '';
        const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString() || '';
        const output = stdout + stderr || err.message || String(error);

        return {
            success: false,
            output,
        };
    }
}

/**
 * Get list of changed files compared to base branch
 * Uses origin/baseBranch...HEAD to get all files changed since branching
 */
function getChangedFiles(baseBranch: string = 'main'): string[] {
    try {
        // Get files changed since branching from base (not uncommitted changes)
        const output = git(`diff --name-only origin/${baseBranch}...HEAD`, { silent: true });
        return output.split('\n').filter((f) => f.trim());
    } catch {
        return [];
    }
}

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
        // Check for uncommitted changes
        if (hasUncommittedChanges()) {
            return { success: false, error: 'Uncommitted changes in working directory. Please commit or stash them first.' };
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

        // Try artifact comment first (new file-based system)
        const artifact = parseArtifactComment(issueComments);
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

        // Check for multi-phase implementation (L/XL features)
        // Need to check phase for ALL modes to generate correct branch name
        let phaseInfo = processable.phaseInfo;
        let currentPhase: number | undefined;
        let totalPhases: number | undefined;
        let currentPhaseDetails: ImplementationPhase | undefined;

        // First, check if phase tracking already exists in GitHub project
        const existingPhase = await adapter.getImplementationPhase(item.id);
        const parsed = parsePhaseString(existingPhase);

        // Track task branch for multi-phase workflow
        let taskBranchForPhase: string | null = null;

        if (parsed) {
            // Phase tracking exists - use it for all modes
            currentPhase = parsed.current;
            totalPhases = parsed.total;
            const multiPhaseMsg = `Multi-phase feature: Phase ${currentPhase}/${totalPhases}`;
            console.log(`  🌿 ${multiPhaseMsg}`);
            logFeatureBranch(issueNumber, multiPhaseMsg);

            // Try to get phase details from comments first (reliable), then fallback to markdown
            const parsedPhases = parsePhasesFromComment(issueComments) ||
                                 (techDesign ? extractPhasesFromTechDesign(techDesign) : null);
            if (parsedPhases) {
                currentPhaseDetails = parsedPhases.find(p => p.order === currentPhase);
                phaseInfo = {
                    current: currentPhase,
                    total: totalPhases,
                    phases: parsedPhases,
                };

                // Log which method was used
                if (parsePhasesFromComment(issueComments)) {
                    console.log('  Phases loaded from comment (reliable)');
                } else {
                    console.log('  Phases loaded from markdown (fallback)');
                }
            }

            // Get task branch from artifact for continuing phases (Phase 2+)
            if (mode === 'new' && currentPhase > 1) {
                taskBranchForPhase = getTaskBranch(artifact);
                if (taskBranchForPhase) {
                    const retrievedMsg = `Retrieved task branch from artifact: ${taskBranchForPhase}`;
                    console.log(`  🌿 ${retrievedMsg}`);
                    logFeatureBranch(issueNumber, retrievedMsg);
                } else {
                    console.warn(`  ⚠️ Task branch not found in artifact for Phase ${currentPhase}/${totalPhases}`);
                    console.warn(`  Expected: Task branch should have been set in Phase 1`);
                    logFeatureBranch(issueNumber, `WARNING: Task branch not found in artifact for Phase ${currentPhase}/${totalPhases}`);
                    // Fallback: try to generate the expected branch name
                    taskBranchForPhase = generateTaskBranchName(issueNumber);
                    const fallbackMsg = `Using generated task branch name: ${taskBranchForPhase}`;
                    console.log(`  🌿 ${fallbackMsg}`);
                    logFeatureBranch(issueNumber, fallbackMsg);
                }
            }
        } else if (mode === 'new' && !phaseInfo) {
            // No existing phase - check if we should start multi-phase (only for new implementations)
            // Try comment first, fallback to markdown
            const parsedPhases = parsePhasesFromComment(issueComments) ||
                                 (techDesign ? extractPhasesFromTechDesign(techDesign) : null);

            if (parsedPhases && parsedPhases.length >= 2) {
                // Start new multi-phase implementation
                currentPhase = 1;
                totalPhases = parsedPhases.length;
                const detectedMsg = `Detected multi-phase feature: ${totalPhases} phases`;
                console.log(`  🌿 ${detectedMsg}`);
                logFeatureBranch(issueNumber, detectedMsg);

                // Log which method was used
                if (parsePhasesFromComment(issueComments)) {
                    console.log('  Phases loaded from comment (reliable)');
                } else {
                    console.log('  Phases loaded from markdown (fallback)');
                }

                // Set phase tracking in GitHub project
                if (!options.dryRun && adapter.hasImplementationPhaseField()) {
                    await adapter.setImplementationPhase(item.id, `${currentPhase}/${totalPhases}`);
                    console.log(`  Set Implementation Phase to: ${currentPhase}/${totalPhases}`);
                }

                // Create feature branch for multi-phase workflow (NEW)
                if (!options.dryRun) {
                    const taskBranchName = await ensureFeatureBranch(adapter, issueNumber, defaultBranch);
                    // Store task branch in artifact comment for future phases to reference
                    await setTaskBranch(adapter, issueNumber, taskBranchName);
                    const storedMsg = `Feature branch stored in artifact: ${taskBranchName}`;
                    console.log(`  🌿 ${storedMsg}`);
                    logFeatureBranch(issueNumber, storedMsg);
                }

                // Get current phase details
                currentPhaseDetails = parsedPhases.find(p => p.order === currentPhase);
                phaseInfo = {
                    current: currentPhase,
                    total: totalPhases,
                    phases: parsedPhases,
                };
            }
        } else if (phaseInfo) {
            // Phase info passed in (from previous processing)
            currentPhase = phaseInfo.current;
            totalPhases = phaseInfo.total;
            currentPhaseDetails = phaseInfo.phases.find(p => p.order === currentPhase);
            console.log(`  📋 Continuing phase ${currentPhase}/${totalPhases}`);
        }

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

        let prompt: string;
        let prReviewComments: Array<{ path?: string; line?: number; body: string; author: string }> = [];

        if (mode === 'new') {
            // Flow A: New implementation
            // Check if branch already exists
            const branchExistsRemotely = await adapter.branchExists(branchName);
            if (branchExistsRemotely) {
                console.log(`  Branch ${branchName} already exists, will use it`);
            }

            if (diagnostics) {
                // Bug fix implementation
                prompt = buildBugImplementationPrompt(content, diagnostics, productDesign, techDesign, branchName, issueComments);
            } else {
                // Feature implementation
                prompt = buildImplementationPrompt(content, productDesign, techDesign, branchName, issueComments);
            }

            // Add phase-specific context if this is a multi-phase implementation
            if (currentPhase && totalPhases && currentPhaseDetails) {
                const phaseContext = `

## IMPORTANT: Multi-Phase Implementation

This is **Phase ${currentPhase} of ${totalPhases}**: ${currentPhaseDetails.name}

**Phase Description:** ${currentPhaseDetails.description}

**Files for this phase:**
${currentPhaseDetails.files.map(f => `- ${f}`).join('\n')}

**CRITICAL Instructions:**
1. ONLY implement what's described for Phase ${currentPhase}
2. Do NOT implement features from later phases
3. Each phase will be a separate PR that gets reviewed and merged
4. Make sure this phase is independently mergeable and testable
5. Future phases will build on top of this work

${currentPhase > 1 ? `\n**Note:** This builds on previous phases that have already been merged.` : ''}
`;
                prompt = prompt + phaseContext;
            }

            // Local testing instructions are added later after dev server is started
        } else if (mode === 'feedback') {
            // Flow B: Address feedback
            if (!processable.prNumber) {
                return { success: false, error: 'No PR number available for feedback mode' };
            }

            // Fetch PR review comments (inline code comments)
            const prReviewCommentsRaw = await adapter.getPRReviewComments(processable.prNumber);
            prReviewComments = prReviewCommentsRaw.map((c) => ({
                path: c.path,
                line: c.line,
                body: c.body,
                author: c.author,
            }));

            // Fetch PR conversation comments (general comments on the PR)
            const prConversationComments = await adapter.getPRComments(processable.prNumber);
            const prComments: GitHubComment[] = prConversationComments.map((c) => ({
                id: c.id,
                body: c.body,
                author: c.author,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            }));

            const totalFeedback = issueComments.length + prReviewComments.length + prComments.length;
            if (totalFeedback === 0) {
                return { success: false, error: 'No feedback comments found' };
            }

            console.log(`  Found ${issueComments.length} issue comments, ${prComments.length} PR comments, ${prReviewComments.length} PR review comments`);

            // Combine issue comments and PR comments for the prompt
            const allComments = [...issueComments, ...prComments];
            prompt = buildPRRevisionPrompt(content, productDesign, techDesign, allComments, prReviewComments);
        } else {
            // Flow C: Continue after clarification
            const clarification = issueComments[issueComments.length - 1];

            if (!clarification) {
                return { success: false, error: 'No clarification comment found' };
            }

            prompt = buildImplementationClarificationPrompt(
                { title: content.title, number: issueNumber, body: content.body },
                productDesign,
                techDesign,
                branchName,
                issueComments,
                clarification
            );
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

                // Add local testing instructions with the dev server URL
                // Language is deliberately soft - if MCP tools fail, agent can still complete
                const localTestContext = `

## LOCAL TESTING (Optional but Recommended)

A dev server is running at: **${devServer.url}**

After implementing the feature and running \`yarn checks\`, try to verify your implementation using Playwright MCP tools if they are available:

1. **Navigate to the app**: Use \`mcp__playwright__browser_navigate\` to go to ${devServer.url}
2. **Take a snapshot**: Use \`mcp__playwright__browser_snapshot\` to see the page structure
3. **Test the feature**: Interact with the feature you implemented
4. **Verify it works**: Confirm the expected behavior occurs
5. **Close browser**: Use \`mcp__playwright__browser_close\` when done

**Playwright MCP Tools (if available):**
- \`mcp__playwright__browser_navigate\` - Navigate to URLs
- \`mcp__playwright__browser_snapshot\` - Capture page DOM/accessibility tree
- \`mcp__playwright__browser_click\` - Click elements
- \`mcp__playwright__browser_type\` - Type text into inputs
- \`mcp__playwright__browser_close\` - Close browser

**IMPORTANT:**
- The dev server is already running - do NOT run \`yarn dev\`
- The browser runs in headless mode (no visible window)
- Focus on happy-path verification only
- **If MCP tools fail or are unavailable, proceed without local testing** - this is not a blocker
- If you can test and it passes, include test results in your PR summary
- If you cannot test (tools unavailable), mention that in PR summary
`;
                prompt = prompt + localTestContext;
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
            // In feedback mode, agent might have already committed changes (via yarn checks auto-fix)
            // or changes might have been pushed in a previous run
            // Check if there are commits on this branch that aren't on the default branch
            if (mode === 'feedback') {
                console.log('  No uncommitted changes (feedback mode - checking for pushed commits)');
                try {
                    const diffOutput = git(`log ${defaultBranch}..HEAD --oneline`, { silent: true });
                    if (diffOutput.trim()) {
                        console.log('  Found existing commits on branch - proceeding to update Review Status');
                        // Skip commit/push steps but continue to update Review Status
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
            } else {
                // New implementation mode - must have changes
                console.log('  No changes to commit');
                git(`checkout ${defaultBranch}`);
                return { success: false, error: 'Agent did not make any changes' };
            }
        }

        // Run post-work yarn checks - fix any new issues
        if (!options.dryRun) {
            console.log('  Running post-work yarn checks...');
            const postChecks = runYarnChecks();
            if (!postChecks.success) {
                console.log('  ⚠️ Issues found - asking Claude to fix...');

                // Run Claude to fix the issues (skip plan mode - this is a simple fix task)
                const fixResult = await runAgent({
                    prompt: `The following yarn checks errors need to be fixed:\n\n${postChecks.output}\n\nFix these issues in the codebase. Only fix the issues shown above, do not make any other changes.`,
                    stream: options.stream,
                    verbose: options.verbose,
                    timeout: options.timeout,
                    progressLabel: 'Fixing yarn checks issues',
                    allowWrite: true,
                    workflow: 'implementation',
                    shouldUsePlanMode: false,
                });

                if (!fixResult.success) {
                    console.error('  ⚠️ Could not auto-fix issues - continuing anyway');
                } else {
                    // Re-run checks to verify
                    const recheck = runYarnChecks();
                    if (recheck.success) {
                        console.log('  ✅ Issues fixed');
                    } else {
                        console.log('  ⚠️ Some issues may remain - continuing anyway');
                    }
                }
            } else {
                console.log('  ✅ No new issues introduced');
            }
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

        // Commit changes (only if there are uncommitted changes)
        if (hasChanges) {
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

            // Push to remote
            if (!options.skipPush) {
                console.log('  Pushing to remote...');
                pushBranch(branchName, mode === 'feedback');

                // Verify all commits are pushed
                console.log('  Verifying all commits are pushed...');
                if (!verifyAllPushed(branchName)) {
                    return { success: false, error: 'Failed to push all commits to remote. Please check network connection and try again.' };
                }
                console.log('  ✅ All commits pushed successfully');
            }
        } else {
            console.log('  Skipping commit (no uncommitted changes - using existing commits)');
            // Verify existing commits are already pushed
            if (!options.skipPush) {
                console.log('  Verifying existing commits are pushed...');
                if (!verifyAllPushed(branchName)) {
                    console.log('  ⚠️ Warning: Some commits may not be pushed to remote');
                }
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
            console.log('  Creating pull request...');
            const repoDefaultBranch = await adapter.getDefaultBranch();

            // Determine base branch for PR:
            // - Multi-phase: target the feature branch
            // - Single-phase: target the default branch (unchanged)
            let prBaseBranch: string;
            if (currentPhase && totalPhases && totalPhases > 1) {
                // Multi-phase: PR targets feature branch
                prBaseBranch = generateTaskBranchName(issueNumber);
                const prTargetMsg = `PR will target feature branch: ${branchName} → ${prBaseBranch}`;
                console.log(`  🌿 ${prTargetMsg}`);
                logFeatureBranch(issueNumber, prTargetMsg);
            } else {
                // Single-phase: PR targets default branch (unchanged)
                prBaseBranch = repoDefaultBranch;
            }

                // Get list of changed files for PR description
                const changedFiles = getChangedFiles(prBaseBranch);
                const filesList = changedFiles.length > 0
                    ? changedFiles.map((f) => `- ${f}`).join('\n')
                    : 'No files changed';

                // Build commit-message-ready PR title and body
                // PR title will be the squash merge commit title
                const prPrefix = issueType === 'bug' ? 'fix' : 'feat';
                const phaseLabel = currentPhase && totalPhases
                    ? ` (Phase ${currentPhase}/${totalPhases})`
                    : '';
                const prTitle = `${prPrefix}: ${content.title}${phaseLabel}`;

                // Everything before the --- separator will be included in squash merge commit body
                // Use the agent's PR summary if available, otherwise fall back to generic text
                let prBodyAboveSeparator: string;

                // Phase info header for multi-phase features
                const phaseHeader = currentPhase && totalPhases && currentPhaseDetails
                    ? `## Phase ${currentPhase}/${totalPhases}: ${currentPhaseDetails.name}

${currentPhaseDetails.description}

`
                    : '';

                if (prSummary) {
                    prBodyAboveSeparator = `${phaseHeader}${prSummary}

${currentPhase && totalPhases && currentPhase === totalPhases ? `Closes #${issueNumber}` : `Part of #${issueNumber}`}`;
                } else {
                    // No structured output summary - use minimal description
                    // (Agent adapter may not support structured output)
                    const issueRef = currentPhase && totalPhases && currentPhase === totalPhases
                        ? `Closes #${issueNumber}`
                        : `Part of #${issueNumber}`;
                    prBodyAboveSeparator = `${phaseHeader}See issue #${issueNumber} for details.

${issueRef}`;
                }

                const prBody = `${prBodyAboveSeparator}

---

**Files changed:**
${filesList}

**Test plan:**
- \`yarn checks\` passes ✅
- Manual testing completed ✅

See issue #${issueNumber} for full context, product design, and technical design.

*Generated by Implementation Agent*`;

                // Get admin username from config to request review
                const adminUsername = getProjectConfig().github.owner;

                const pr = await adapter.createPullRequest(
                    branchName,
                    prBaseBranch,
                    prTitle,
                    prBody,
                    [adminUsername] // Request review from admin
                );
                prNumber = pr.number;
                console.log(`  Created PR #${prNumber}: ${pr.url}`);

                // Log PR targeting for multi-phase
                if (currentPhase && totalPhases && totalPhases > 1) {
                    const prCreatedMsg = `Phase ${currentPhase}/${totalPhases} PR #${prNumber} targets feature branch`;
                    console.log(`  🌿 ${prCreatedMsg}`);
                    logFeatureBranch(issueNumber, prCreatedMsg);
                }

                // Update artifact comment with implementation PR
                try {
                    if (currentPhase && totalPhases && currentPhaseDetails) {
                        // Multi-phase feature
                        await updateImplementationPhaseArtifact(
                            adapter,
                            issueNumber,
                            currentPhase,
                            totalPhases,
                            currentPhaseDetails.name,
                            'in-review',
                            prNumber
                        );
                    } else {
                        // Single-phase feature - use Phase 1/1 format for consistency
                        await updateImplementationPhaseArtifact(
                            adapter,
                            issueNumber,
                            1,
                            1,
                            '', // No name for single-phase
                            'in-review',
                            prNumber
                        );
                    }
                    console.log('  Updated artifact comment with PR link');
                } catch (error) {
                    // Non-fatal error - PR is still created successfully
                    console.warn('  Warning: Failed to update artifact comment:', error instanceof Error ? error.message : String(error));
                }

                // Trigger Claude Code review
                try {
                    console.log('  Triggering Claude Code review...');
                    const reviewInstructions = `@claude please review this PR

**Review Guidelines:**
- Request changes if there are ANY Minor Issues, Suggestions, or Improvements
- Only approve if there are absolutely ZERO Minor Issues, ZERO Suggestions, and ZERO Improvements recommended
- Never approve a PR that has minor suggestions, minor improvements, or minor issues - these should all trigger "Request Changes"
- All issues, suggestions, and improvements must be within the context of the task/PR scope - do not request changes for unrelated code or out-of-scope improvements`;
                    await adapter.addPRComment(prNumber, reviewInstructions);
                    console.log('  ✅ Claude Code review triggered');
                } catch (error) {
                    // Non-fatal error - PR is still created successfully
                    console.warn('  Warning: Failed to trigger Claude Code review:', error instanceof Error ? error.message : String(error));
                }

                // Add status comment on issue (phase-aware)
                const phasePrefix = currentPhase && totalPhases
                    ? `**Phase ${currentPhase}/${totalPhases}**: `
                    : '';
                const phaseName = currentPhaseDetails?.name ? ` - ${currentPhaseDetails.name}` : '';
                const prLinkComment = addAgentPrefix('implementor', `📋 ${phasePrefix}Opening PR #${prNumber}${phaseName}`);
                await adapter.addIssueComment(issueNumber, prLinkComment);

                // Post summary comment on PR (if available)
                if (comment) {
                    const prefixedComment = addAgentPrefix('implementor', comment);
                    await adapter.addPRComment(prNumber, prefixedComment);
                    console.log('  Summary comment posted on PR');
                    logGitHubAction(logCtx, 'comment', 'Posted implementation summary comment on PR');
                }
        } else {
            // Feedback mode: Add comments on both issue and PR
            if (prNumber) {
                // Add status comment on issue (phase-aware)
                const feedbackPhasePrefix = currentPhase && totalPhases
                    ? `**Phase ${currentPhase}/${totalPhases}**: `
                    : '';
                const issueStatusComment = addAgentPrefix('implementor', `🔧 ${feedbackPhasePrefix}Addressed feedback on PR #${prNumber} - ready for re-review`);
                await adapter.addIssueComment(issueNumber, issueStatusComment);

                // Use structured output comment if available, otherwise warn
                let feedbackComment: string | undefined;
                if (comment) {
                    feedbackComment = comment;
                } else {
                    console.warn('  ⚠️ No comment in structured output for feedback response');
                }
                // Post feedback comment on PR if available
                const reReviewInstructions = `

**Review Guidelines:**
- Request changes if there are ANY Minor Issues, Suggestions, or Improvements
- Only approve if there are absolutely ZERO Minor Issues, ZERO Suggestions, and ZERO Improvements recommended
- Never approve a PR that has minor suggestions, minor improvements, or minor issues - these should all trigger "Request Changes"
- All issues, suggestions, and improvements must be within the context of the task/PR scope - do not request changes for unrelated code or out-of-scope improvements`;

                if (feedbackComment) {
                    const prefixedComment = addAgentPrefix('implementor', feedbackComment);
                    // Add @claude to trigger Claude GitHub App to re-review the fixes
                    const commentWithReviewRequest = `${prefixedComment}\n\n@claude please review the changes${reReviewInstructions}`;
                    await adapter.addPRComment(prNumber, commentWithReviewRequest);
                    console.log('  Feedback response comment posted on PR (with @claude review request)');
                    logGitHubAction(logCtx, 'comment', 'Posted feedback response on PR with @claude review request');
                } else {
                    // Still trigger @claude review even without detailed comment
                    await adapter.addPRComment(prNumber, `@claude please review the changes${reReviewInstructions}`);
                    console.log('  Review request posted on PR (no detailed comment available)');
                }
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
        if (prNumber) {
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
    const program = new Command();

    program
        .name('implement')
        .description('Implement features and create PRs for GitHub Project items')
        .option('--id <itemId>', 'Process a specific project item by ID')
        .option('--limit <number>', 'Limit number of items to process', parseInt)
        .option('--timeout <seconds>', 'Timeout per item in seconds', parseInt)
        .option('--dry-run', 'Preview without making changes', false)
        .option('--stream', "Stream Claude's output in real-time", false)
        .option('--verbose', 'Show additional debug output', false)
        .option('--skip-push', 'Skip pushing to remote (for testing)', false)
        .option('--skip-pull', 'Skip pulling latest changes from master', false)
        .option('--skip-local-test', 'Skip local testing with Playwright MCP', false)
        .parse(process.argv);

    const opts = program.opts();
    const options: ImplementOptions = {
        id: opts.id as string | undefined,
        limit: opts.limit as number | undefined,
        timeout: (opts.timeout as number | undefined) ?? agentConfig.claude.timeoutSeconds,
        dryRun: Boolean(opts.dryRun),
        verbose: Boolean(opts.verbose),
        stream: Boolean(opts.stream),
        skipPush: Boolean(opts.skipPush),
        skipPull: Boolean(opts.skipPull),
        skipLocalTest: Boolean(opts.skipLocalTest),
    };

    console.log('\n========================================');
    console.log('  Implementation Agent');
    console.log('========================================');
    console.log(`  Timeout: ${options.timeout}s per item`);
    if (options.dryRun) {
        console.log('  Mode: DRY RUN (no changes will be saved)');
    }
    console.log('');

    // Check for uncommitted changes before starting
    if (hasUncommittedChanges()) {
        console.error('Error: Uncommitted changes in working directory.');
        console.error('Please commit or stash your changes before running this agent.');
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
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
