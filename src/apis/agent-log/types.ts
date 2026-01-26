/**
 * Agent Log API Types
 *
 * Types for the agent-log API endpoints.
 */

// Source of external log events
export type ExternalLogSource = 'webhook' | 'github_action' | 'telegram' | 'external';

// External log event data
export interface ExternalLogEvent {
    source: ExternalLogSource;
    action: string;
    details?: string;
    metadata?: Record<string, unknown>;
}

// Log event request
export interface LogEventRequest {
    issueNumber: number;
    event: ExternalLogEvent;
}

export interface LogEventResponse {
    success?: boolean;
    error?: string;
}

// Log phase request
export interface LogPhaseRequest {
    issueNumber: number;
    phase: string;
    type: 'start' | 'end';
    source?: ExternalLogSource;
    result?: 'success' | 'failed' | 'skipped';
}

export interface LogPhaseResponse {
    success?: boolean;
    error?: string;
}
