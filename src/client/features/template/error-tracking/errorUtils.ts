/**
 * Error Utilities
 *
 * Shared helpers for classifying, cleaning, and formatting errors.
 */

/** Check if an error is a network/connectivity error */
export function isNetworkError(error: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
    if (error instanceof TypeError) return true;
    const msg = getErrorMessage(error).toLowerCase();
    return (
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('offline') ||
        msg.includes('timeout') ||
        msg.includes('unavailable')
    );
}

/** Strip the "Failed to call {api}:" prefix that apiClient adds */
export function cleanErrorMessage(error: unknown): string {
    const msg = getErrorMessage(error);
    return msg.replace(/^Failed to call [^:]+:\s*/i, '');
}

/** Return a human-friendly message based on error type */
export function getUserFriendlyMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    const msg = getErrorMessage(error).toLowerCase();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return 'You appear to be offline. Please check your connection and try again.';
    }
    if (error instanceof TypeError) {
        return 'Connection error. Please check your network and try again.';
    }
    if (msg.includes('timeout')) {
        return 'The request timed out. Please try again.';
    }
    if (msg.includes('413') || msg.includes('body exceeded') || msg.includes('1mb limit')) {
        return 'The request was too large. Try reducing the size of your input.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
        return 'Connection error. Please check your network and try again.';
    }

    return fallback;
}

/** Build a copyable string with message + stack trace */
export function formatErrorForCopy(error: unknown): string {
    const message = getErrorMessage(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const details = getErrorDetails(error);

    let text = `Error: ${message}`;
    if (details) {
        text += `\n\nDetails:\n${details}`;
    }
    if (stack) {
        text += `\n\nStack Trace:\n${stack}`;
    }
    return text;
}

/** Extract the message string from any error-like value */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
}

/** Extract errorDetails if attached to the Error object by apiClient */
function getErrorDetails(error: unknown): string | undefined {
    if (error instanceof Error && 'errorDetails' in error) {
        return String((error as Error & { errorDetails?: string }).errorDetails);
    }
    return undefined;
}
