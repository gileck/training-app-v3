import { AsyncLocalStorage } from 'async_hooks';
import type { LogContext } from './types';

/**
 * AsyncLocalStorage for log context
 */
const logContextStorage = new AsyncLocalStorage<LogContext>();

/**
 * Create a log context for an agent execution
 */
export function createLogContext(options: {
    issueNumber: number;
    workflow: 'product-design' | 'tech-design' | 'implement' | 'pr-review';
    phase: string;
    mode?: string;
    issueTitle: string;
    issueType?: 'feature' | 'bug' | 'chore' | 'docs' | 'refactor';
    /** Current GitHub Projects status (column) when agent started */
    currentStatus?: string | null;
    /** Current review status when agent started */
    currentReviewStatus?: string | null;
}): LogContext {
    return {
        ...options,
        startTime: new Date(),
    };
}

/**
 * Run a function with log context
 */
export async function runWithLogContext<T>(
    context: LogContext,
    fn: () => Promise<T>
): Promise<T> {
    return logContextStorage.run(context, fn);
}

/**
 * Get the current log context (if any)
 */
export function getCurrentLogContext(): LogContext | undefined {
    return logContextStorage.getStore();
}
