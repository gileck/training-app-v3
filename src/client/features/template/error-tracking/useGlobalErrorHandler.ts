/**
 * Global Error Handler Hook
 * 
 * Sets up global error listeners to automatically capture and report errors.
 */

import { useEffect, useRef } from 'react';
import { submitErrorReport } from '../bug-report';
import { logger } from '../session-logs';

// Track reported errors to avoid duplicates
const reportedErrors = new Set<string>();

function getErrorKey(message: string, stack?: string): string {
    return `${message}::${stack?.slice(0, 200) || ''}`;
}

/**
 * Hook to set up global error handlers
 * Should be used once at the app root level
 */
export function useGlobalErrorHandler() {
    const isSetup = useRef(false);

    useEffect(() => {
        // Prevent double setup in strict mode
        if (isSetup.current) return;
        isSetup.current = true;

        // Handle uncaught errors
        const handleError = (event: ErrorEvent) => {
            const errorKey = getErrorKey(event.message, event.error?.stack);
            
            // Skip if already reported
            if (reportedErrors.has(errorKey)) return;
            reportedErrors.add(errorKey);

            // Log to session logs
            logger.error('error-tracking', `Uncaught error: ${event.message}`, {
                meta: {
                    stack: event.error?.stack,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                },
            });

            // Submit error report
            submitErrorReport(
                event.message,
                event.error?.stack
            ).catch(() => {
                // Silently fail
            });
        };

        // Handle unhandled promise rejections
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const message = event.reason instanceof Error 
                ? event.reason.message 
                : String(event.reason);
            const stack = event.reason instanceof Error 
                ? event.reason.stack 
                : undefined;

            const errorKey = getErrorKey(message, stack);
            
            // Skip if already reported
            if (reportedErrors.has(errorKey)) return;
            reportedErrors.add(errorKey);

            // Log to session logs
            logger.error('error-tracking', `Unhandled rejection: ${message}`, {
                meta: {
                    stack,
                    reason: event.reason,
                },
            });

            // Submit error report
            submitErrorReport(
                `Unhandled Promise Rejection: ${message}`,
                stack
            ).catch(() => {
                // Silently fail
            });
        };

        // Add event listeners
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            isSetup.current = false;
        };
    }, []);
}

/**
 * Clear the reported errors cache
 * Useful for testing or resetting state
 */
export function clearReportedErrors() {
    reportedErrors.clear();
}

