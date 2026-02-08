/**
 * Agents Configuration
 *
 * Single source of truth for agent library and model selection.
 * Modify this file to configure which library and model each workflow uses.
 */

import type { WorkflowName } from './lib/types';

// ============================================================
// CONFIGURATION INTERFACE
// ============================================================

/**
 * Model configuration for a specific library
 */
export interface LibraryModelConfig {
    /** Default model for this library */
    model: string;
}

/**
 * Plan Subagent configuration
 */
export interface PlanSubagentConfig {
    /** Enable Plan Subagent for implementation workflow (default: true) */
    enabled: boolean;
    /** Timeout in seconds for plan generation (default: 120) */
    timeout: number;
}

/**
 * Configuration structure for agents
 */
export interface AgentsConfig {
    /** When true, ALL agents use Claude Opus 4.6 regardless of library/model config */
    useOpus: boolean;
    /** Default library to use for all workflows */
    defaultLibrary: string;
    /** Per-workflow library overrides */
    workflowOverrides: Partial<Record<WorkflowName, string>>;
    /** Model configuration per library */
    libraryModels: Record<string, LibraryModelConfig>;
    /** Plan Subagent configuration */
    planSubagent: PlanSubagentConfig;
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
 * - 'gemini' - Gemini CLI (requires @google/gemini-cli to be installed)
 * - 'openai-codex' - OpenAI Codex CLI (requires @openai/codex to be installed)
 *
 * Available models:
 * - claude-code-sdk: 'sonnet', 'opus', 'haiku'
 * - cursor: 'opus-4.5', 'sonnet-4', etc.
 * - gemini: 'gemini-3-flash-preview', 'gemini-3-pro-preview', etc.
 * - openai-codex: 'gpt-5-codex', 'gpt-5', etc.
 *
 * To use a different library for a specific workflow, add it to workflowOverrides.
 */
export const agentsConfig: AgentsConfig = {
    // When true, ALL agents use Claude Opus 4.6 (overrides all library/model settings)
    useOpus: true,

    // Default library for all workflows
    defaultLibrary: 'claude-code-sdk',

    // Per-workflow overrides
    // Uncomment to use different libraries for specific workflows
    workflowOverrides: {
        'product-design': 'cursor',
        // 'tech-design': 'claude-code-sdk',
        'implementation': 'cursor',
        // 'pr-review': 'claude-code-sdk',
    },

    // Model configuration per library
    libraryModels: {
        'claude-code-sdk': {
            model: 'sonnet',
        },
        'cursor': {
            model: 'opus-4.5',
        },
        'gemini': {
            model: 'gemini-3-flash-preview',
        },
        'openai-codex': {
            model: 'gpt-5-codex',
        },
    },

    // Plan Subagent configuration
    // Runs before implementation to create detailed step-by-step plans
    planSubagent: {
        enabled: true,    // Set to false to disable Plan Subagent
        timeout: 120,     // 2 minutes for plan generation
    },
};
