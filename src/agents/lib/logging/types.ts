/**
 * Log context for agent execution
 */
export interface LogContext {
    issueNumber: number;
    workflow: 'product-design' | 'tech-design' | 'implement' | 'pr-review';
    phase: string;
    mode?: string;
    issueTitle: string;
    issueType?: 'feature' | 'bug' | 'chore' | 'docs' | 'refactor';
    startTime: Date;
}

/**
 * Tool usage information
 */
export interface ToolUsage {
    name: string;
    input: unknown;
    output?: unknown;
    timestamp: Date;
    duration?: number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cost?: number;
    timestamp: Date;
}

/**
 * Status transition information
 */
export interface StatusTransition {
    from: string;
    to: string;
    timestamp: Date;
}

/**
 * GitHub action information
 */
export interface GitHubAction {
    action: 'comment' | 'pr_created' | 'issue_updated' | 'label_added' | 'branch' | 'pr';
    details: string;
    timestamp: Date;
}

/**
 * Error information
 */
export interface ErrorInfo {
    message: string;
    stack?: string;
    isFatal: boolean;
    timestamp: Date;
}

/**
 * Execution result summary
 */
export interface ExecutionSummary {
    duration: number;
    toolCallsCount: number;
    totalTokens: number;
    totalCost: number;
    success: boolean;
}

/**
 * Phase cost data for cumulative summary
 */
export interface PhaseData {
    name: string;
    duration: number;
    toolCallsCount: number;
    totalTokens: number;
    totalCost: number;
}
