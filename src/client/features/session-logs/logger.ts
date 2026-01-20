/**
 * Session Logger Utility
 * 
 * Provides a simple API for logging events throughout the application.
 * Logs are stored in the session logs store for bug reporting.
 * 
 * Console output is disabled by default (only warn/error shown).
 * To enable console logs, call from browser console:
 *   window.enableLogs()           // Enable all logs
 *   window.enableLogs('api')      // Enable only 'api' feature logs
 *   window.enableLogs(['api', 'todos'])  // Enable multiple features
 *   window.disableLogs()          // Disable console logs
 */

import { useSessionLogsStore } from './store';
import type { LogLevel, ApiLogMeta } from './types';

function getCurrentRoute(): string | undefined {
    if (typeof window !== 'undefined') {
        return window.location.pathname;
    }
    return undefined;
}

// Maximum size for logged data (1KB keeps bug reports manageable)
const MAX_LOG_DATA_SIZE = 1024;

/**
 * Sanitize data for logging
 * - Removes base64 image data (always)
 * - Limits total data size to prevent bloat
 * - Allows small JSON for debugging
 */
function sanitizeLogData(data: unknown): unknown {
    if (data === null || data === undefined) {
        return data;
    }

    // First pass: remove base64 images and sensitive data
    const cleaned = removeBase64Images(data);

    // Second pass: check total size after stringifying
    try {
        const serialized = JSON.stringify(cleaned);
        const sizeBytes = serialized.length;

        // If under limit, return the cleaned data
        if (sizeBytes <= MAX_LOG_DATA_SIZE) {
            return cleaned;
        }

        // If over limit, return summary instead
        const sizeKB = Math.round(sizeBytes / 1024);
        return `[Data too large for logs - ${sizeKB}KB]`;
    } catch {
        // If we can't serialize (circular refs, etc), return placeholder
        return '[Data not serializable]';
    }
}

/**
 * Remove base64 image data from objects
 */
function removeBase64Images(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(removeBase64Images);
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        // Detect and remove base64 image data
        if (typeof value === 'string' && value.startsWith('data:image/')) {
            const sizeKB = Math.round(value.length / 1024);
            cleaned[key] = `[Image ${sizeKB}KB]`;
        }
        // Recursively clean nested objects
        else if (value && typeof value === 'object') {
            cleaned[key] = removeBase64Images(value);
        }
        else {
            cleaned[key] = value;
        }
    }

    return cleaned;
}

interface LogOptions {
    meta?: Record<string, unknown>;
    route?: string;
}

/**
 * Console logging configuration
 */
interface ConsoleLogConfig {
    enabled: boolean;
    features: string[] | null; // null = all features, array = only these features
    minLevel: LogLevel; // minimum level to show
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Default: only show warn/error in console
const consoleLogConfig: ConsoleLogConfig = {
    enabled: true,
    features: null,
    minLevel: 'warn',
};

/**
 * Check if a log should be printed to console
 */
function shouldLogToConsole(level: LogLevel, feature: string): boolean {
    if (!consoleLogConfig.enabled) return false;
    if (LOG_LEVELS[level] < LOG_LEVELS[consoleLogConfig.minLevel]) return false;
    if (consoleLogConfig.features !== null && !consoleLogConfig.features.includes(feature)) return false;
    return true;
}

/**
 * Enable console logging
 * @param features - Optional feature filter (string or array of strings)
 */
function enableLogs(features?: string | string[]): void {
    consoleLogConfig.minLevel = 'debug';
    if (features) {
        consoleLogConfig.features = Array.isArray(features) ? features : [features];
        console.log(`[Logger] Console logs enabled for features: ${consoleLogConfig.features.join(', ')}`);
    } else {
        consoleLogConfig.features = null;
        console.log('[Logger] Console logs enabled for all features');
    }
}

/**
 * Disable console logging (except warn/error)
 */
function disableLogs(): void {
    consoleLogConfig.minLevel = 'warn';
    consoleLogConfig.features = null;
    console.log('[Logger] Console logs disabled (warn/error only)');
}

/**
 * Get current log configuration
 */
function getLogConfig(): ConsoleLogConfig {
    return { ...consoleLogConfig };
}

/**
 * Print existing logs to console
 * @param filter - Optional feature filter (string or array of strings)
 * @param limit - Optional limit on number of logs to show (default: all)
 */
function printLogs(filter?: string | string[], limit?: number): void {
    const logs = useSessionLogsStore.getState().getLogs();
    const features = filter ? (Array.isArray(filter) ? filter : [filter]) : null;
    
    let filteredLogs = features 
        ? logs.filter(log => features.includes(log.feature))
        : logs;
    
    if (limit && limit > 0) {
        filteredLogs = filteredLogs.slice(-limit);
    }
    
    console.group(`[Logger] Session Logs (${filteredLogs.length}${features ? ` filtered by: ${features.join(', ')}` : ''})`);
    
    filteredLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const perfTime = log.performanceTime !== undefined ? `+${log.performanceTime}ms` : '';
        const prefix = `[${time}] [${perfTime}] [${log.level.toUpperCase()}] [${log.feature}]`;
        
        const consoleFn = log.level === 'error' ? console.error 
            : log.level === 'warn' ? console.warn 
            : console.log;
        
        consoleFn(prefix, log.message, log.meta ?? '');
    });
    
    console.groupEnd();
}

// Expose functions globally for console access
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).enableLogs = enableLogs;
    (window as unknown as Record<string, unknown>).disableLogs = disableLogs;
    (window as unknown as Record<string, unknown>).getLogConfig = getLogConfig;
    (window as unknown as Record<string, unknown>).printLogs = printLogs;
    (window as unknown as Record<string, unknown>).getSessionLogs = () => useSessionLogsStore.getState().getLogs();
}

/**
 * Core logging function
 */
function log(level: LogLevel, feature: string, message: string, options?: LogOptions): void {
    const addLog = useSessionLogsStore.getState().addLog;
    
    addLog({
        level,
        feature,
        message,
        meta: options?.meta,
        route: options?.route ?? getCurrentRoute(),
    });

    // Log to console based on config
    if (shouldLogToConsole(level, feature)) {
        const consoleFn = level === 'error' ? console.error 
            : level === 'warn' ? console.warn 
            : level === 'debug' ? console.debug 
            : console.log;
        
        consoleFn(`[${feature}] ${message}`, options?.meta ?? '');
    }
}

/**
 * Logger API
 * 
 * Usage:
 * ```typescript
 * import { logger } from '@/client/features/session-logs';
 * 
 * logger.info('auth', 'User logged in', { userId: '123' });
 * logger.error('api', 'Request failed', { endpoint: '/users' });
 * ```
 */
export const logger = {
    debug: (feature: string, message: string, options?: LogOptions) => 
        log('debug', feature, message, options),
    
    info: (feature: string, message: string, options?: LogOptions) => 
        log('info', feature, message, options),
    
    warn: (feature: string, message: string, options?: LogOptions) => 
        log('warn', feature, message, options),
    
    error: (feature: string, message: string, options?: LogOptions) => 
        log('error', feature, message, options),

    /**
     * Log an API request
     */
    apiRequest: (apiName: string, params?: unknown) => {
        const addLog = useSessionLogsStore.getState().addLog;
        
        // Sanitize params to remove large data like screenshots
        const sanitizedParams = sanitizeLogData(params);
        
        addLog({
            level: 'info',
            feature: 'api',
            message: `API Request: ${apiName}`,
            meta: {
                apiName,
                type: 'request',
                params: sanitizedParams,
            } as ApiLogMeta,
            route: getCurrentRoute(),
        });

        if (shouldLogToConsole('info', 'api')) {
            console.log(`[api] Request: ${apiName}`, sanitizedParams ?? '');
        }
    },

    /**
     * Log an API response
     */
    apiResponse: (
        apiName: string, 
        response: unknown, 
        options?: { duration?: number; cached?: boolean; error?: string }
    ) => {
        const addLog = useSessionLogsStore.getState().addLog;
        const level: LogLevel = options?.error ? 'error' : 'info';
        
        // Sanitize response to remove large data
        const sanitizedResponse = options?.error ? undefined : sanitizeLogData(response);
        
        addLog({
            level,
            feature: 'api',
            message: options?.error 
                ? `API Error: ${apiName}` 
                : `API Response: ${apiName}`,
            meta: {
                apiName,
                type: 'response',
                response: sanitizedResponse,
                duration: options?.duration,
                cached: options?.cached,
                error: options?.error,
            } as ApiLogMeta,
            route: getCurrentRoute(),
        });

        if (shouldLogToConsole(level, 'api')) {
            if (options?.error) {
                console.error(`[api] Error: ${apiName}`, options.error);
            } else {
                console.log(
                    `[api] Response: ${apiName}`,
                    options?.cached ? '(cached)' : '',
                    options?.duration ? `${options.duration}ms` : '',
                    sanitizedResponse
                );
            }
        }
    },
};

/**
 * Get all logs from the store (for bug reports)
 */
export function getSessionLogs() {
    return useSessionLogsStore.getState().getLogs();
}

/**
 * Clear all logs
 */
export function clearSessionLogs() {
    useSessionLogsStore.getState().clearLogs();
}

