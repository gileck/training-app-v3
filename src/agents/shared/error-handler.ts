/**
 * Shared error handler for agent catch blocks.
 *
 * Agents have a common error-handling pattern:
 *   1. Extract error message
 *   2. console.error
 *   3. logError + logExecutionEnd
 *   4. Optional cleanup (e.g., git checkout)
 *   5. notifyAgentError (unless dry-run)
 *   6. Return { success: false, error }
 *
 * This module provides `handleAgentError()` to consolidate that logic.
 */

import {
    logError,
    logExecutionEnd,
    type LogContext,
} from '../lib/logging';
import { notifyAgentError } from './notifications';

export interface AgentErrorContext {
    /** The caught error */
    error: unknown;
    /** Logging context for the current agent run */
    logCtx: LogContext;
    /** Display name of the agent phase (e.g., "Bug Investigation", "Implementation") */
    phaseName: string;
    /** Title of the issue/content being processed */
    issueTitle: string;
    /** GitHub issue number */
    issueNumber: number;
    /** Whether this is a dry run (skips notifications) */
    dryRun: boolean;
    /** Optional cleanup to run before logging execution end (e.g., git checkout) */
    cleanup?: () => void;
}

/**
 * Standard error handler for agent catch blocks.
 *
 * Logs the error, runs optional cleanup, records execution end,
 * sends a notification (unless dry-run), and returns a failure result.
 */
export async function handleAgentError(
    ctx: AgentErrorContext
): Promise<{ success: false; error: string }> {
    const errorMsg = ctx.error instanceof Error ? ctx.error.message : String(ctx.error);
    console.error(`  Error: ${errorMsg}`);

    // Log error to agent log file
    logError(ctx.logCtx, ctx.error instanceof Error ? ctx.error : errorMsg, true);

    // Run optional cleanup (e.g., checkout back to default branch)
    if (ctx.cleanup) {
        try {
            ctx.cleanup();
        } catch {
            console.error('  Warning: Cleanup failed during error handling');
        }
    }

    // Record execution end as failed
    await logExecutionEnd(ctx.logCtx, {
        success: false,
        toolCallsCount: 0,
        totalTokens: 0,
        totalCost: 0,
    });

    // Send error notification (unless dry run)
    if (!ctx.dryRun) {
        await notifyAgentError(ctx.phaseName, ctx.issueTitle, ctx.issueNumber, errorMsg);
    }

    return { success: false, error: errorMsg };
}
