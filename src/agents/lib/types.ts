/**
 * Agent Library Abstraction Types
 *
 * Defines the adapter interface for swappable AI agent libraries
 * (Claude Code SDK, Cursor, Gemini, etc.)
 */

import type { UsageStats } from '../shared/types';

// ============================================================
// WORKFLOW TYPES
// ============================================================

/**
 * Available workflow names for library selection
 */
export type WorkflowName = 'product-dev' | 'product-design' | 'tech-design' | 'bug-investigation' | 'implementation' | 'pr-review' | 'code-review';

// ============================================================
// AGENT LIBRARY ADAPTER INTERFACE
// ============================================================

/**
 * Capabilities supported by an agent library
 */
export interface AgentLibraryCapabilities {
    /** Supports streaming output */
    streaming: boolean;
    /** Supports file read operations */
    fileRead: boolean;
    /** Supports file write operations */
    fileWrite: boolean;
    /** Supports web fetching */
    webFetch: boolean;
    /** Supports custom tool configuration */
    customTools: boolean;
    /** Supports timeout configuration */
    timeout: boolean;
    /** Supports plan mode for creating implementation plans */
    planMode?: boolean;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

/**
 * Options for running an agent
 */
export interface AgentRunOptions {
    /** Prompt to send to the agent */
    prompt: string;
    /** Tools to allow (default: read-only tools) */
    allowedTools?: string[];
    /** Whether to allow write operations */
    allowWrite?: boolean;
    /** Whether to stream output */
    stream?: boolean;
    /** Whether to show verbose output */
    verbose?: boolean;
    /** Timeout in seconds */
    timeout?: number;
    /** Custom label for progress indicator */
    progressLabel?: string;
    /** Workflow name (for library selection) */
    workflow?: WorkflowName;
    /** Enable Claude Code slash commands (requires settingSources: ['project']) */
    useSlashCommands?: boolean;
    /** Output format for structured responses (JSON schema) */
    outputFormat?: {
        type: 'json_schema';
        schema: Record<string, unknown>;
    };
    /** Run in plan mode (read-only exploration to create implementation plan) */
    planMode?: boolean;
    /** MCP servers to connect to (e.g., Playwright MCP for browser automation) */
    mcpServers?: Record<string, MCPServerConfig>;
    /** Additional tools to allow (added to default tools) */
    additionalTools?: string[];
    /** Maximum number of agent turns (overrides default) */
    maxTurns?: number;
    /** Whether to use plan mode for this run (default: true). Set to false for feedback/clarification modes. */
    shouldUsePlanMode?: boolean;
}

/**
 * Result from running an agent
 */
export interface AgentRunResult {
    /** Whether the agent completed successfully */
    success: boolean;
    /** Generated content */
    content: string | null;
    /** Error message if failed */
    error?: string;
    /** Files examined during execution */
    filesExamined: string[];
    /** Usage statistics */
    usage: UsageStats | null;
    /** Execution time in seconds */
    durationSeconds: number;
    /** Structured output when outputFormat is specified */
    structuredOutput?: unknown;
}

/**
 * Adapter interface for agent libraries
 *
 * Each AI provider (Claude, Cursor, Gemini) implements this interface
 * to provide a consistent API for running agents.
 */
export interface AgentLibraryAdapter {
    /** Library name (e.g., "claude-code-sdk", "cursor", "gemini") */
    readonly name: string;

    /** LLM model used by this adapter (e.g., "sonnet", "opus-4.5", "gemini-pro") */
    readonly model: string;

    /** Library capabilities */
    readonly capabilities: AgentLibraryCapabilities;

    /**
     * Initialize the library (if needed)
     */
    init(): Promise<void>;

    /**
     * Check if the library is initialized
     */
    isInitialized(): boolean;

    /**
     * Run an agent with the given options
     */
    run(options: AgentRunOptions): Promise<AgentRunResult>;

    /**
     * Dispose/cleanup the library
     */
    dispose(): Promise<void>;
}

// ============================================================
// LIBRARY CONFIGURATION
// ============================================================

/**
 * Configuration for agent library selection
 */
export interface AgentLibraryConfig {
    /** Default library to use */
    defaultLibrary: string;
    /** Per-workflow library overrides */
    workflowOverrides: Partial<Record<WorkflowName, string>>;
}
