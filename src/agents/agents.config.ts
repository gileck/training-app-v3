/**
 * Agents Configuration
 *
 * Single source of truth for agent library selection.
 * Modify this file to configure which library each workflow uses.
 */

import type { WorkflowName } from './lib/types';

// ============================================================
// CONFIGURATION INTERFACE
// ============================================================

/**
 * Configuration structure for agents
 */
export interface AgentsConfig {
    /** Default library to use for all workflows */
    defaultLibrary: string;
    /** Per-workflow library overrides */
    workflowOverrides: Partial<Record<WorkflowName, string>>;
}

// ============================================================
// AGENT LIBRARY CONFIGURATION
// ============================================================

/**
 * Agent library configuration
 *
 * Available libraries:
 * - 'claude-code-sdk' - Claude Code SDK (default, fully implemented)
 * - 'cursor' - Cursor CLI (requires cursor-agent CLI to be installed)
 * - 'gemini' - Google Gemini (stub, not yet implemented)
 *
 * To use a different library for a specific workflow, add it to workflowOverrides.
 */
export const agentsConfig: AgentsConfig = {
    // Default library for all workflows
    defaultLibrary: 'claude-code-sdk',

    // Per-workflow overrides
    // Uncomment to use different libraries for specific workflows
    workflowOverrides: {
        // 'product-design': 'claude-code-sdk',
        // 'tech-design': 'claude-code-sdk',
        // 'implementation': 'cursor',
        // 'pr-review': 'claude-code-sdk',
    },
};
