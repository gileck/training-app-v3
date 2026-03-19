/**
 * Agent Library Factory
 *
 * Provides factory function for getting agent library adapters
 * based on configuration and workflow.
 */

import type { AgentLibraryAdapter, WorkflowName, AgentRunOptions, AgentRunResult } from './types';
import { getLibraryForWorkflow, getPlanSubagentConfig } from './config';
import {
    getCurrentLogContext,
    logError,
    logExecutionStart,
    logExecutionEnd,
    logTokenUsage,
    type LogContext,
} from './logging';
import { buildPlanSubagentPrompt } from '@/agents/shared/prompts';
import { calcTotalTokens } from '@/agents/shared/types';

// Import adapters directly
import claudeCodeSDKAdapter from './adapters/claude-code-sdk';
import geminiAdapter from './adapters/gemini';
import cursorAdapter from './adapters/cursor';
import openaiCodexAdapter from './adapters/openai-codex';

// Fallback library when primary library fails to initialize
const FALLBACK_LIBRARY = 'claude-code-sdk';

// Forward declarations for adapters (will be imported dynamically)
type AdapterConstructor = new () => AgentLibraryAdapter;

// ============================================================
// ADAPTER REGISTRY
// ============================================================

/**
 * Registry of available adapter constructors
 */
const adapterRegistry = new Map<string, AdapterConstructor>();

/**
 * Singleton adapter instances (pre-populated with imported adapters)
 */
const adapterInstances = new Map<string, AgentLibraryAdapter>([
    [claudeCodeSDKAdapter.name, claudeCodeSDKAdapter],
    [geminiAdapter.name, geminiAdapter],
    [cursorAdapter.name, cursorAdapter],
    [openaiCodexAdapter.name, openaiCodexAdapter],
]);

/**
 * Register an adapter constructor
 */
export function registerAdapter(name: string, constructor: AdapterConstructor): void {
    adapterRegistry.set(name, constructor);
}

/**
 * Try to initialize an adapter, returning success status
 */
async function tryInitAdapter(adapter: AgentLibraryAdapter): Promise<{ success: boolean; error?: string; wasAlreadyInitialized?: boolean }> {
    if (adapter.isInitialized()) {
        return { success: true, wasAlreadyInitialized: true };
    }

    try {
        await adapter.init();
        return { success: true, wasAlreadyInitialized: false };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Log successful adapter initialization
 */
function logAdapterInitSuccess(adapter: AgentLibraryAdapter, wasAlreadyInitialized: boolean): void {
    if (wasAlreadyInitialized) {
        // Don't log if already initialized (avoid duplicate logs)
        return;
    }
    console.log(`  ✓ Initialized agent library: ${adapter.name} (model: ${adapter.model})`);
}

/**
 * Log adapter initialization failure and fallback
 */
function logAdapterFallback(
    originalLibrary: string,
    fallbackLibrary: string,
    error: string
): void {
    const logCtx = getCurrentLogContext();

    // Console warning (always shown)
    console.warn(`\n  ⚠️  Failed to initialize ${originalLibrary}: ${error}`);
    console.warn(`  ⚠️  Falling back to ${fallbackLibrary}\n`);

    // Log to issue log if context is available
    if (logCtx) {
        logError(logCtx, `Library init failed: ${originalLibrary} - ${error}. Falling back to ${fallbackLibrary}`, false);
    }
}

/**
 * Get or create an adapter instance with fallback support
 */
async function getAdapterInstance(libraryName: string): Promise<AgentLibraryAdapter> {
    // Check if adapter exists in pre-populated instances
    if (adapterInstances.has(libraryName)) {
        const adapter = adapterInstances.get(libraryName)!;

        // Try to initialize
        const initResult = await tryInitAdapter(adapter);

        if (initResult.success) {
            logAdapterInitSuccess(adapter, initResult.wasAlreadyInitialized ?? false);
            return adapter;
        }

        // Init failed - try fallback if this isn't already the fallback
        if (libraryName !== FALLBACK_LIBRARY) {
            logAdapterFallback(libraryName, FALLBACK_LIBRARY, initResult.error!);
            return getAdapterInstance(FALLBACK_LIBRARY);
        }

        // Fallback also failed - this is fatal
        throw new Error(`Failed to initialize fallback library ${FALLBACK_LIBRARY}: ${initResult.error}`);
    }

    // Check if constructor exists in registry
    const Constructor = adapterRegistry.get(libraryName);
    if (Constructor) {
        // Create new instance
        const adapter = new Constructor();

        // Try to initialize
        const initResult = await tryInitAdapter(adapter);

        if (initResult.success) {
            logAdapterInitSuccess(adapter, initResult.wasAlreadyInitialized ?? false);
            adapterInstances.set(libraryName, adapter);
            return adapter;
        }

        // Init failed - try fallback if this isn't already the fallback
        if (libraryName !== FALLBACK_LIBRARY) {
            logAdapterFallback(libraryName, FALLBACK_LIBRARY, initResult.error!);
            return getAdapterInstance(FALLBACK_LIBRARY);
        }

        // Fallback also failed - this is fatal
        throw new Error(`Failed to initialize fallback library ${FALLBACK_LIBRARY}: ${initResult.error}`);
    }

    // Adapter not found
    const available = Array.from(adapterInstances.keys()).concat(Array.from(adapterRegistry.keys()));
    throw new Error(
        `Unknown agent library: ${libraryName}. ` +
        `Available: ${available.join(', ')}`
    );
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Get the agent library adapter for a specific workflow
 *
 * @param workflow - Workflow name (optional)
 * @returns Agent library adapter
 */
export async function getAgentLibrary(workflow?: WorkflowName): Promise<AgentLibraryAdapter> {
    const libraryName = getLibraryForWorkflow(workflow);
    return getAdapterInstance(libraryName);
}

/**
 * Run an agent using the appropriate library for the workflow
 *
 * This is the main entry point for running agents with the abstraction layer.
 *
 * For implementation workflows with libraries that support plan mode (claude-code-sdk, cursor),
 * this function internally runs a Plan subagent before the main implementation to create a
 * detailed implementation plan. This is fully encapsulated - callers don't need to know
 * about the two-step process.
 *
 * @param options - Agent run options
 * @returns Agent run result
 */
export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
    const library = await getAgentLibrary(options.workflow);
    const planConfig = getPlanSubagentConfig();

    // For implementation workflow with libraries that support plan mode, run Plan subagent first
    // This creates a detailed implementation plan before the main implementation
    const supportsPlanMode = library.capabilities.planMode === true;

    // planModeEnabled: from config - CAN plan mode be used?
    const planModeEnabled = planConfig.enabled && supportsPlanMode;

    // shouldUsePlanMode: from runtime options - SHOULD plan mode be used for this run?
    // Defaults to true (backward compatible), set to false for feedback/clarification modes
    const shouldUsePlanMode = options.shouldUsePlanMode !== false;

    const shouldRunPlanSubagent =
        planModeEnabled &&
        shouldUsePlanMode &&
        options.workflow === 'implementation' &&
        options.allowWrite;

    if (shouldRunPlanSubagent) {
        const planResult = await runImplementationPlanSubagent(library, options, planConfig.timeout);
        if (planResult.plan) {
            // Augment the prompt with the detailed implementation plan
            const enhancedPrompt = `${options.prompt}

---

## Detailed Implementation Plan (from codebase exploration)

The following plan was created by exploring the codebase. Follow these steps to implement the feature:

${planResult.plan}

---

Follow the plan above while implementing. Adjust as needed based on actual code you encounter.`;
            console.log(` 🚀 Starting implementation agent...`);
            const result = await library.run({ ...options, prompt: enhancedPrompt });
            console.log(`  ✅ Implementation agent completed:
                inputTokens: ${result?.usage?.inputTokens},
                outputTokens: ${result?.usage?.outputTokens},
                cost: ${result?.usage?.totalCostUSD},
                duration: ${result.durationSeconds}s
            `);
            return result;
        }
        // If plan generation failed, proceed without it
        console.log('  ⚠️ Plan subagent did not generate a plan, proceeding without it');
    } else if (planModeEnabled && !shouldUsePlanMode && options.workflow === 'implementation') {
        // Log when plan subagent is explicitly disabled (e.g., for feedback/clarification modes)
        console.log('  📋 Plan subagent skipped (shouldUsePlanMode: false)');
    }

    console.log(` 🚀 Starting ${options.workflow || 'agent'}...`);
    const result = await library.run(options);
    console.log(`  ✅ ${options.workflow || 'Agent'} completed:
        inputTokens: ${result?.usage?.inputTokens},
        outputTokens: ${result?.usage?.outputTokens},
        cost: ${result?.usage?.totalCostUSD},
        duration: ${result.durationSeconds}s
    `);
    return result;
}

/**
 * Run a Plan subagent to create a detailed implementation plan
 *
 * This is an internal function used by runAgent for implementation workflows.
 * It uses the library's plan mode if supported (cursor --mode=plan), or falls
 * back to read-only tools (claude-code-sdk) to explore the codebase and
 * generate a step-by-step implementation plan.
 *
 * @param library - The agent library adapter
 * @param options - Original agent run options
 * @param timeout - Timeout in seconds for plan generation
 * @returns Plan result with the generated plan
 */
async function runImplementationPlanSubagent(
    library: AgentLibraryAdapter,
    options: AgentRunOptions,
    timeout: number
): Promise<{ plan: string | null; error?: string }> {
    const usesPlanMode = library.capabilities.planMode === true;
    const planMechanism = usesPlanMode ? '--mode=plan' : 'read-only tools';

    console.log(`  📋 Running Plan subagent (${library.name}, ${planMechanism})...`);

    // Get parent log context and create plan subagent context
    const parentCtx = getCurrentLogContext();
    const planCtx: LogContext | null = parentCtx ? {
        ...parentCtx,
        phase: 'Plan Subagent',
        startTime: new Date(),
        library: library.name,
        model: library.model,
    } : null;

    // Log execution start for plan subagent phase
    if (planCtx) {
        logExecutionStart(planCtx);
    }

    console.log(` 🏁 Creating implementation plan... ${timeout ? `(timeout: ${timeout}s)` : ''}`);

    // Build the plan prompt using the dedicated prompt builder
    const planPrompt = buildPlanSubagentPrompt(options.prompt);

    // NOTE: We don't call logPrompt here because the adapter will log it.
    // The adapter logs with the correct model name and tools.

    try {
        // Use planMode if library supports it (cursor), otherwise use read-only tools (claude-code-sdk)
        const result = await library.run({
            prompt: planPrompt,
            // For libraries with plan mode (cursor): use planMode flag
            // For libraries without (claude-code-sdk): use read-only tools
            ...(usesPlanMode
                ? { planMode: true }
                : { allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch'] }
            ),
            allowWrite: false,
            stream: true,
            verbose: false,
            timeout,
            progressLabel: 'Creating implementation plan',
        });

        console.log(`  ☑️ Implementation plan generation completed in ${result.durationSeconds}s`);

        // Log token usage if available
        if (planCtx && result.usage) {
            logTokenUsage(planCtx, {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                cost: result.usage.totalCostUSD,
                cacheReadInputTokens: result.usage.cacheReadInputTokens,
                cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
            });
        }

        // Calculate totals for summary
        const totalTokens = calcTotalTokens(result.usage);
        const totalCost = result.usage?.totalCostUSD || 0;
        const toolCallsCount = result.toolCallsCount ?? result.filesExamined?.length ?? 0;

        if (result.success && result.content) {
            console.log(`  ✅ Plan subagent completed successfully:
                inputTokens: ${result?.usage?.inputTokens},
                outputTokens: ${result?.usage?.outputTokens},
                cost: ${result?.usage?.totalCostUSD},
                duration: ${result.durationSeconds}s
            `);

            // Log execution end with success
            if (planCtx) {
                await logExecutionEnd(planCtx, {
                    success: true,
                    toolCallsCount,
                    totalTokens,
                    totalCost,
                });
            }

            return { plan: result.content };
        }

        const errorMsg = result.error || 'No plan generated';

        // Log execution end with failure
        if (planCtx) {
            logError(planCtx, errorMsg, false);
            await logExecutionEnd(planCtx, {
                success: false,
                toolCallsCount,
                totalTokens,
                totalCost,
            });
        }

        return { plan: null, error: errorMsg };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`  ⚠️ Plan subagent failed: ${errorMsg}`);

        // Log error and execution end
        if (planCtx) {
            logError(planCtx, errorMsg, false);
            await logExecutionEnd(planCtx, {
                success: false,
                toolCallsCount: 0,
                totalTokens: 0,
                totalCost: 0,
            });
        }

        return { plan: null, error: errorMsg };
    }
}

/**
 * Get the model name for a specific workflow
 *
 * @param workflow - Workflow name (optional)
 * @returns Model name used by the library for this workflow
 */
export async function getModelForWorkflow(workflow?: WorkflowName): Promise<string> {
    const library = await getAgentLibrary(workflow);
    return library.model;
}

/**
 * Dispose all adapter instances
 */
export async function disposeAllAdapters(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const adapter of adapterInstances.values()) {
        promises.push(adapter.dispose());
    }

    await Promise.all(promises);
    adapterInstances.clear();
}

// ============================================================
// RE-EXPORTS
// ============================================================

// Re-export types
export type {
    AgentLibraryAdapter,
    AgentLibraryCapabilities,
    AgentLibraryConfig,
    AgentRunOptions,
    AgentRunResult,
    WorkflowName,
    MCPServerConfig,
} from './types';

// Re-export configuration functions
export {
    getAgentLibraryConfig,
    getLibraryForWorkflow,
    loadAgentLibraryConfig,
    clearConfigCache,
} from './config';

// Re-export parsing functions
export {
    extractMarkdown,
    extractJSON,
    extractReview,
    parseReviewDecision,
    extractOriginalDescription,
    extractProductDesign,
    extractTechDesign,
    buildUpdatedIssueBody,
    DESIGN_MARKERS,
    // Phase extraction for multi-PR workflow (fallback - prefer phases.ts functions)
    extractPhasesFromTechDesign,
    parsePhaseString,
    isLargeFeature,
    type ParsedPhase,
} from './parsing';

// Re-export phase serialization/deserialization (primary method for multi-PR workflow)
export {
    formatPhasesToComment,
    parsePhasesFromComment,
    parsePhasesFromMarkdown,
    hasPhaseComment,
    getPhaseCommentMarker,
} from './phases';

// Re-export commit message utilities (for PR merge flow)
export {
    generateCommitMessage,
    formatCommitMessageComment,
    parseCommitMessageComment,
    type PRInfo,
    type CommitMessageResult,
    type PhaseInfo,
} from './commitMessage';

// Re-export artifact comment utilities (for design document workflow)
export {
    ARTIFACT_COMMENT_MARKER,
    type DesignArtifact,
    type ArtifactComment,
    type ImplementationStatus,
    type ImplementationArtifact,
    type ImplementationPhaseArtifact,
    getDesignDocPath,
    getDesignDocLink,
    generateDesignBranchName,
    findArtifactComment,
    hasArtifactComment,
    parseArtifactComment,
    getProductDesignPath,
    getTechDesignPath,
    formatArtifactComment,
    saveArtifactComment,
    updateDesignArtifact,
    ensureArtifactComment,
    updateImplementationArtifact,
    updateImplementationPhaseArtifact,
    initializeImplementationPhases,
    // Task branch utilities (for feature branch workflow)
    getTaskBranch,
    generateTaskBranchName,
    generatePhaseBranchName,
    setTaskBranch,
    clearTaskBranch,
    getTaskBranchFromIssue,
} from './artifacts';

// Re-export design file utilities
export {
    getDesignDocFullPath,
    getDesignDocRelativePath,
    getIssueDesignDir,
    writeDesignDoc,
    readDesignDoc,
    readDesignDocAsync,
    designDocExists,
    deleteDesignDoc,
    deleteIssueDesignDir,
    // S3 design storage
    getDesignS3Key,
    saveDesignToS3,
    readDesignFromS3,
    deleteDesignFromS3,
} from './design-files';

// Re-export dev server management utilities
export {
    startDevServer,
    waitForServer,
    stopDevServer,
    getRandomPort,
    type DevServerState,
    type StartDevServerOptions,
} from './devServer';

// Re-export Playwright MCP configuration
export {
    PLAYWRIGHT_MCP_CONFIG,
    PLAYWRIGHT_TOOLS,
    isPlaywrightMCPAvailable,
} from './playwright-mcp';
