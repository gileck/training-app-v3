/**
 * Bug Report Hooks
 * 
 * Hooks for submitting bug reports.
 */

import { useMutation } from '@tanstack/react-query';
import { createReport } from '@/apis/reports/client';
import { getSessionLogs } from '../session-logs';
import { useUser } from '../auth';
import { useRouter } from '@/client/router';
import type { BrowserInfo, UserInfo, BugCategory, PerformanceEntryData } from './types';
import type { CreateReportRequest } from '@/apis/reports/types';

/**
 * Get current browser information
 */
function getBrowserInfo(): BrowserInfo {
    if (typeof window === 'undefined') {
        return {
            userAgent: 'unknown',
            viewport: { width: 0, height: 0 },
            language: 'unknown',
        };
    }

    return {
        userAgent: navigator.userAgent,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        language: navigator.language,
    };
}

/**
 * Get current network status
 */
function getNetworkStatus(): 'online' | 'offline' {
    if (typeof navigator !== 'undefined') {
        return navigator.onLine ? 'online' : 'offline';
    }
    return 'online';
}

/**
 * Get performance entries for performance bug reports
 */
function getPerformanceEntries(): PerformanceEntryData[] {
    if (typeof performance === 'undefined') {
        return [];
    }

    try {
        const entries = performance.getEntries();
        return entries.map(entry => {
            const base: PerformanceEntryData = {
                name: entry.name,
                entryType: entry.entryType,
                startTime: Math.round(entry.startTime),
                duration: Math.round(entry.duration),
                // Type-safe access to optional properties
                initiatorType: 'initiatorType' in entry ? (entry as PerformanceResourceTiming).initiatorType : undefined,
                transferSize: 'transferSize' in entry ? (entry as PerformanceResourceTiming).transferSize : undefined,
                encodedBodySize: 'encodedBodySize' in entry ? (entry as PerformanceResourceTiming).encodedBodySize : undefined,
                decodedBodySize: 'decodedBodySize' in entry ? (entry as PerformanceResourceTiming).decodedBodySize : undefined,
            };
            
            // Add navigation timing specific fields
            if (entry.entryType === 'navigation') {
                const nav = entry as PerformanceNavigationTiming;
                base.domainLookupStart = Math.round(nav.domainLookupStart);
                base.domainLookupEnd = Math.round(nav.domainLookupEnd);
                base.connectStart = Math.round(nav.connectStart);
                base.connectEnd = Math.round(nav.connectEnd);
                base.requestStart = Math.round(nav.requestStart);
                base.responseStart = Math.round(nav.responseStart);
                base.responseEnd = Math.round(nav.responseEnd);
                base.domInteractive = Math.round(nav.domInteractive);
                base.domComplete = Math.round(nav.domComplete);
            }
            
            return base;
        });
    } catch {
        return [];
    }
}

interface SubmitBugReportParams {
    description: string;
    screenshot?: string;
    category?: BugCategory;
}

/**
 * Hook for submitting bug reports
 */
export function useSubmitBugReport() {
    const user = useUser();
    const { currentPath } = useRouter();

    return useMutation({
        mutationFn: async ({ description, screenshot, category = 'bug' }: SubmitBugReportParams) => {
            const sessionLogs = getSessionLogs();
            const browserInfo = getBrowserInfo();
            const networkStatus = getNetworkStatus();

            const userInfo: UserInfo | undefined = user ? {
                userId: user.id,
                username: user.username,
                email: user.email,
            } : undefined;

            // For performance reports, include performance entries (summary is generated on display)
            const performanceEntries = category === 'performance' ? getPerformanceEntries() : undefined;

            const reportData: CreateReportRequest = {
                type: 'bug',
                description,
                screenshot,
                sessionLogs,
                userInfo,
                browserInfo,
                route: currentPath,
                networkStatus,
                category,
                performanceEntries,
            };

            const result = await createReport(reportData);
            
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            return result.data;
        },
    });
}

interface SubmitErrorReportParams {
    errorMessage: string;
    stackTrace?: string;
}

/**
 * Hook for submitting error reports (used by error tracking)
 */
export function useSubmitErrorReport() {
    const user = useUser();
    const { currentPath } = useRouter();

    return useMutation({
        mutationFn: async ({ errorMessage, stackTrace }: SubmitErrorReportParams) => {
            const sessionLogs = getSessionLogs();
            const browserInfo = getBrowserInfo();
            const networkStatus = getNetworkStatus();

            const userInfo: UserInfo | undefined = user ? {
                userId: user.id,
                username: user.username,
                email: user.email,
            } : undefined;

            // Generate error key for deduplication
            const errorKey = generateRuntimeErrorKey(errorMessage, stackTrace);

            const reportData: CreateReportRequest = {
                type: 'error',
                errorMessage,
                stackTrace,
                errorKey,
                sessionLogs,
                userInfo,
                browserInfo,
                route: currentPath,
                networkStatus,
            };

            const result = await createReport(reportData);

            if (result.data.error) {
                throw new Error(result.data.error);
            }

            return result.data;
        },
    });
}

/**
 * Check if we're running in production environment
 * Returns false for development, test, localhost, private IPs, and Vercel previews
 */
function isProductionEnvironment(): boolean {
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
    if (hostname.includes('.vercel.app') && hostname.includes('-git-')) {
        return false;
    }

    return true;
}

/**
 * Generate error key for runtime error deduplication
 */
function generateRuntimeErrorKey(errorMessage: string, stackTrace?: string): string {
    const stackPrefix = stackTrace?.slice(0, 200) || '';
    return `runtime:${errorMessage}:${stackPrefix}`;
}

/**
 * Standalone function to submit error report (for global error handler)
 * Only reports errors in production environment
 */
export async function submitErrorReport(errorMessage: string, stackTrace?: string) {
    // Skip error reporting in development/localhost
    if (!isProductionEnvironment()) {
        console.debug('[Error Tracking] Skipping error report in development:', errorMessage);
        return;
    }

    // Import dynamically to avoid circular dependencies
    const { useAuthStore } = await import('../auth');

    const sessionLogs = getSessionLogs();
    const browserInfo = getBrowserInfo();
    const networkStatus = getNetworkStatus();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

    const user = useAuthStore.getState().user;
    const userInfo: UserInfo | undefined = user ? {
        userId: user.id,
        username: user.username,
        email: user.email,
    } : undefined;

    // Generate error key for deduplication
    const errorKey = generateRuntimeErrorKey(errorMessage, stackTrace);

    const reportData: CreateReportRequest = {
        type: 'error',
        errorMessage,
        stackTrace,
        errorKey,
        sessionLogs,
        userInfo,
        browserInfo,
        route: currentPath,
        networkStatus,
    };

    try {
        await createReport(reportData);
    } catch (error) {
        // Silently fail - we don't want error reporting to cause more errors
        console.error('Failed to submit error report:', error);
    }
}

