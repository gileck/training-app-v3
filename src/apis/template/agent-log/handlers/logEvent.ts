import { API_AGENT_LOG_EVENT } from '../index';
import type { LogEventRequest, LogEventResponse } from '../types';
import type { ApiHandlerContext } from '@/apis/types';
import { logExternalEvent } from '@/agents/lib/logging/logger';
import { logExists } from '@/agents/lib/logging/writer';

/**
 * Log an external event to an agent log file
 *
 * This endpoint allows external services (Telegram webhooks, GitHub Actions)
 * to write to agent log files.
 */
export const logEvent = async (
    request: LogEventRequest,
    _context: ApiHandlerContext
): Promise<LogEventResponse> => {
    try {
        const { issueNumber, event } = request;

        // Validate issueNumber
        if (!issueNumber || typeof issueNumber !== 'number' || issueNumber <= 0) {
            return { error: 'Invalid issue number' };
        }

        // Validate event
        if (!event || !event.source || !event.action) {
            return { error: 'Invalid event: source and action are required' };
        }

        // Check if log file exists (don't create new ones from external sources)
        if (!logExists(issueNumber)) {
            return { error: `Log file for issue #${issueNumber} does not exist` };
        }

        // Log the event
        logExternalEvent(issueNumber, event);

        return { success: true };
    } catch (error: unknown) {
        console.error('[agent-log/event] Error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to log event' };
    }
};

export { API_AGENT_LOG_EVENT };
