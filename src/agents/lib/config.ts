/**
 * Agent Library Configuration
 *
 * Loads configuration from src/agents/agents.config.ts
 * which is the single source of truth for agent library selection.
 */

import type { AgentLibraryConfig, WorkflowName } from './types';
import { agentsConfig } from '../agents.config';

// ============================================================
// CONFIGURATION LOADER
// ============================================================

/**
 * Load agent library configuration from the config file
 */
export function loadAgentLibraryConfig(): AgentLibraryConfig {
    return {
        defaultLibrary: agentsConfig.defaultLibrary,
        workflowOverrides: { ...agentsConfig.workflowOverrides },
    };
}

/**
 * Get the library name to use for a specific workflow
 *
 * @param workflow - Workflow name (optional)
 * @returns Library name to use
 */
export function getLibraryForWorkflow(workflow?: WorkflowName): string {
    const config = loadAgentLibraryConfig();

    // Check for workflow-specific override
    if (workflow && config.workflowOverrides[workflow]) {
        return config.workflowOverrides[workflow]!;
    }

    // Use default
    return config.defaultLibrary;
}

/**
 * Cached configuration instance
 */
let cachedConfig: AgentLibraryConfig | null = null;

/**
 * Get the current agent library configuration (cached)
 */
export function getAgentLibraryConfig(): AgentLibraryConfig {
    if (!cachedConfig) {
        cachedConfig = loadAgentLibraryConfig();
    }
    return cachedConfig;
}

/**
 * Clear cached configuration (for testing)
 */
export function clearConfigCache(): void {
    cachedConfig = null;
}
