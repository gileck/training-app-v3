/**
 * Session Logs Types
 * 
 * Types for the session logging system that captures
 * application events for debugging and bug reporting.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type NetworkStatus = 'online' | 'offline';

export interface SessionLog {
    id: string;
    timestamp: string;
    level: LogLevel;
    feature: string;
    message: string;
    meta?: Record<string, unknown>;
    route?: string;
    networkStatus: NetworkStatus;
    performanceTime?: number; // performance.now() - time from session start in ms
}

export interface ApiLogMeta extends Record<string, unknown> {
    apiName: string;
    type: 'request' | 'response';
    params?: unknown;
    response?: unknown;
    duration?: number;
    cached?: boolean;
    error?: string;
}

export interface ApiLog extends SessionLog {
    feature: 'api';
    meta: ApiLogMeta;
}

export type AnyLog = SessionLog | ApiLog;

