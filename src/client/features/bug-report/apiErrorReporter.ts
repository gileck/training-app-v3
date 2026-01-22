import { getSessionLogs } from '@/client/features/session-logs';

/**
 * Check if we're in production environment
 * Returns false for development, test, localhost, private IPs, and Vercel previews
 */
function isProduction(): boolean {
    // Check NODE_ENV first (most reliable)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        return false;
    }

    if (typeof window === 'undefined') return false;

    const hostname = window.location.hostname;

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
        return false;
    }

    // Private IP ranges
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        return false;
    }

    // Vercel preview deployments (not production)
    // Production Vercel URLs typically include the project name without git branch info
    if (hostname.includes('.vercel.app') && hostname.includes('-git-')) {
        return false;
    }

    return true;
}

/**
 * Submit an automatic error report for API errors
 * Only submits in production environments
 */
export async function submitApiErrorReport(
    apiName: string,
    errorMessage: string,
    params?: unknown
): Promise<void> {
    // Only report in production
    if (!isProduction()) {
        return;
    }

    try {
        // Generate error key for deduplication
        const errorKey = `api:${apiName}:${errorMessage}`;

        // Get browser info
        const browserInfo = {
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            language: navigator.language,
        };

        // Get current route
        const route = window.location.pathname;

        // Get network status
        const networkStatus = navigator.onLine ? 'online' as const : 'offline' as const;

        // Get session logs (last 500 entries)
        const sessionLogs = getSessionLogs();

        // Submit report
        const response = await fetch('/api/process/reports_create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                params: {
                    type: 'error',
                    errorMessage,
                    apiName,
                    errorKey,
                    description: `API Error: ${apiName}\n\nParams: ${JSON.stringify(params, null, 2)}`,
                    sessionLogs,
                    browserInfo,
                    route,
                    networkStatus,
                },
            }),
        });

        if (!response.ok) {
            console.warn('Failed to submit API error report:', response.statusText);
        }
    } catch (error) {
        // Silently fail - don't want error reporting to cause more errors
        console.warn('Error submitting API error report:', error);
    }
}
