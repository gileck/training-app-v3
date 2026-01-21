/**
 * Agent Library Configuration
 *
 * Manages agent library selection via environment variables.
 * Supports global defaults and per-workflow overrides.
 */

import type { AgentLibraryConfig, WorkflowName } from './types';

// ============================================================
// ENVIRONMENT VARIABLE KEYS
// ============================================================

const ENV_KEYS = {
    defaultLibrary: 'AGENT_DEFAULT_LIBRARY',
    productDesign: 'AGENT_PRODUCT_DESIGN_LIBRARY',
    techDesign: 'AGENT_TECH_DESIGN_LIBRARY',
    implementation: 'AGENT_IMPLEMENTATION_LIBRARY',
    prReview: 'AGENT_PR_REVIEW_LIBRARY',
} as const;

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

/**
 * Default library configuration
 */
const DEFAULT_CONFIG: AgentLibraryConfig = {
    defaultLibrary: 'claude-code-sdk',
    workflowOverrides: {},
};

// ============================================================
// CONFIGURATION LOADER
// ============================================================

/**
 * Load agent library configuration from environment variables
 */
export function loadAgentLibraryConfig(): AgentLibraryConfig {
    const config: AgentLibraryConfig = {
        defaultLibrary: process.env[ENV_KEYS.defaultLibrary] || DEFAULT_CONFIG.defaultLibrary,
        workflowOverrides: {},
    };

    // Load workflow-specific overrides
    const workflowEnvMap: Record<WorkflowName, string> = {
        'product-design': ENV_KEYS.productDesign,
        'tech-design': ENV_KEYS.techDesign,
        'implementation': ENV_KEYS.implementation,
        'pr-review': ENV_KEYS.prReview,
    };

    for (const [workflow, envKey] of Object.entries(workflowEnvMap)) {
        const value = process.env[envKey];
        if (value) {
            config.workflowOverrides[workflow as WorkflowName] = value;
        }
    }

    return config;
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
