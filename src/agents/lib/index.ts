/**
 * Agent Library Factory
 *
 * Provides factory function for getting agent library adapters
 * based on configuration and workflow.
 */

import type { AgentLibraryAdapter, WorkflowName, AgentRunOptions, AgentRunResult } from './types';
import { getLibraryForWorkflow } from './config';

// Import adapters directly
import claudeCodeSDKAdapter from './adapters/claude-code-sdk';
import geminiAdapter from './adapters/gemini';
import cursorAdapter from './adapters/cursor';

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
]);

/**
 * Register an adapter constructor
 */
export function registerAdapter(name: string, constructor: AdapterConstructor): void {
    adapterRegistry.set(name, constructor);
}

/**
 * Get or create an adapter instance
 */
async function getAdapterInstance(libraryName: string): Promise<AgentLibraryAdapter> {
    // Check if adapter exists in pre-populated instances
    if (adapterInstances.has(libraryName)) {
        const adapter = adapterInstances.get(libraryName)!;

        // Initialize if needed
        if (!adapter.isInitialized()) {
            await adapter.init();
        }

        return adapter;
    }

    // Check if constructor exists in registry
    const Constructor = adapterRegistry.get(libraryName);
    if (Constructor) {
        // Create new instance
        const adapter = new Constructor();

        // Initialize if needed
        if (!adapter.isInitialized()) {
            await adapter.init();
        }

        adapterInstances.set(libraryName, adapter);
        return adapter;
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
 * @param options - Agent run options
 * @returns Agent run result
 */
export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
    const library = await getAgentLibrary(options.workflow);
    return library.run(options);
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
    hasPhaseComment,
    getPhaseCommentMarker,
} from './phases';
