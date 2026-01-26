import { API_AGENT_LOG_PHASE } from '../index';
import type { LogPhaseRequest, LogPhaseResponse } from '../types';
import type { ApiHandlerContext } from '@/apis/types';
import { logWebhookPhaseStart, logWebhookPhaseEnd } from '@/agents/lib/logging/logger';
import { logExists } from '@/agents/lib/logging/writer';

/**
 * Log a phase start/end to an agent log file
 *
 * This endpoint allows external services (Telegram webhooks, GitHub Actions)
 * to mark phase boundaries in agent log files.
 */
export const logPhase = async (
    request: LogPhaseRequest,
    _context: ApiHandlerContext
): Promise<LogPhaseResponse> => {
    try {
        const { issueNumber, phase, type, source = 'webhook', result } = request;

        // Validate issueNumber
        if (!issueNumber || typeof issueNumber !== 'number' || issueNumber <= 0) {
            return { error: 'Invalid issue number' };
        }

        // Validate phase
        if (!phase || typeof phase !== 'string') {
            return { error: 'Invalid phase name' };
        }

        // Validate type
        if (type !== 'start' && type !== 'end') {
            return { error: 'Invalid type: must be "start" or "end"' };
        }

        // For end type, validate result
        if (type === 'end' && result && !['success', 'failed', 'skipped'].includes(result)) {
            return { error: 'Invalid result: must be "success", "failed", or "skipped"' };
        }

        // Check if log file exists (don't create new ones from external sources)
        if (!logExists(issueNumber)) {
            return { error: `Log file for issue #${issueNumber} does not exist` };
        }

        // Log the phase
        if (type === 'start') {
            logWebhookPhaseStart(issueNumber, phase, source);
        } else {
            logWebhookPhaseEnd(issueNumber, phase, result || 'success', source);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('[agent-log/phase] Error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to log phase' };
    }
};

export { API_AGENT_LOG_PHASE };
