/**
 * Agent Library Configuration
 *
 * Loads configuration from src/agents/agents.config.ts
 * which is the single source of truth for agent library selection.
 */

import type { AgentLibraryConfig, WorkflowName } from './types';
import { agentsConfig, type PlanSubagentConfig } from '../agents.config';

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
    // useOpus overrides everything to claude-code-sdk
    if (agentsConfig.useOpus) {
        return 'claude-code-sdk';
    }

    const config = loadAgentLibraryConfig();

    // Check for workflow-specific override
    if (workflow && config.workflowOverrides[workflow]) {
        return config.workflowOverrides[workflow]!;
    }

    // Use default
    return config.defaultLibrary;
}

/**
 * Get the model configured for a specific library
 *
 * @param libraryName - Library name (e.g., 'claude-code-sdk', 'cursor')
 * @returns Model name configured for this library, or 'unknown' if not configured
 */
export function getModelForLibrary(libraryName: string): string {
    // useOpus overrides everything to opus (Claude Opus 4.6)
    if (agentsConfig.useOpus) {
        return 'opus';
    }

    const libraryConfig = agentsConfig.libraryModels[libraryName];
    return libraryConfig?.model ?? 'unknown';
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

/**
 * Get Plan Subagent configuration
 *
 * @returns Plan Subagent config with enabled flag and timeout
 */
export function getPlanSubagentConfig(): PlanSubagentConfig {
    return agentsConfig.planSubagent;
}
