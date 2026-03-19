/**
 * Agent-Specific Types
 *
 * Types specific to the agent scripts (not shared with server code).
 * Domain types like ProjectItem are imported from @/server/template/project-management.
 */

// ============================================================
// AGENT RESULT TYPES
// ============================================================

/**
 * Usage statistics from Claude SDK
 */
export interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalCostUSD: number;
}

/**
 * Calculate total tokens including cache tokens.
 * inputTokens from the SDK already excludes cache tokens, so we must add them back.
 */
export function calcTotalTokens(usage: UsageStats | null | undefined): number {
    if (!usage) return 0;
    return (usage.inputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0) +
           (usage.cacheCreationInputTokens ?? 0) + (usage.outputTokens ?? 0);
}

/**
 * Result from running an agent
 */
export interface AgentResult {
    /** Whether the agent completed successfully */
    success: boolean;
    /** Generated content (design document, etc.) */
    content: string | null;
    /** Error message if failed */
    error?: string;
    /** Files examined during execution */
    filesExamined: string[];
    /** Usage statistics */
    usage: UsageStats | null;
    /** Execution time in seconds */
    durationSeconds: number;
}

// ============================================================
// CLI TYPES
// ============================================================

/**
 * Common CLI options shared across agent scripts
 */
export interface CommonCLIOptions {
    /** Process specific item by ID */
    id?: string;
    /** Limit number of items to process */
    limit?: number;
    /** Timeout in seconds */
    timeout: number;
    /** Don't save results, just preview */
    dryRun: boolean;
    /** Show verbose output */
    verbose: boolean;
    /** Stream Claude's output in real-time */
    stream: boolean;
}

// ============================================================
// DESIGN DOCUMENT TYPES
// ============================================================

/**
 * Parsed design document from issue body
 */
export interface DesignDocument {
    /** Design type */
    type: 'product' | 'tech';
    /** Raw markdown content */
    content: string;
    /** Generation timestamp */
    generatedAt: string | null;
    /** Iteration number (for revisions) */
    iteration: number;
}

/**
 * Issue body with parsed design sections
 */
export interface ParsedIssueBody {
    /** Original description (before any designs) */
    originalDescription: string;
    /** Product design section if present */
    productDesign: DesignDocument | null;
    /** Technical design section if present */
    techDesign: DesignDocument | null;
}

// ============================================================
// COMMENT TYPES
// ============================================================

/**
 * GitHub issue or PR comment (simplified for agents)
 */
export interface GitHubComment {
    id: number;
    body: string;
    author: string;
    createdAt: string;
    updatedAt?: string;
    /** Whether this is from the admin (for filtering feedback) */
    isFromAdmin?: boolean;
}

// ============================================================
// PROCESSING TYPES
// ============================================================

/**
 * Processing result for a single item
 */
export interface ProcessingResult {
    /** Item that was processed */
    itemId: string;
    /** Issue number if applicable */
    issueNumber?: number;
    /** Whether processing succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Agent result if available */
    agentResult?: AgentResult;
}

/**
 * Batch processing summary
 */
export interface BatchProcessingSummary {
    /** Total items processed */
    processed: number;
    /** Successful items */
    succeeded: number;
    /** Failed items */
    failed: number;
    /** Skipped items (rejected, etc.) */
    skipped: number;
    /** Total usage stats */
    totalUsage: UsageStats;
    /** Total duration in seconds */
    totalDurationSeconds: number;
}
