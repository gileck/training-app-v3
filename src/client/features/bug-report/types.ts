/**
 * Bug Report Feature Types
 */

import type { SessionLog } from '../session-logs';

export type BugCategory = 'bug' | 'performance';

export interface BrowserInfo {
    userAgent: string;
    viewport: {
        width: number;
        height: number;
    };
    language: string;
}

export interface UserInfo {
    userId?: string;
    username?: string;
    email?: string;
}

export interface PerformanceEntryData {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
    // Additional fields for different entry types
    initiatorType?: string;
    transferSize?: number;
    encodedBodySize?: number;
    decodedBodySize?: number;
}

export interface BugReportData {
    description: string;
    screenshot?: string; // base64 encoded
    sessionLogs: SessionLog[];
    userInfo?: UserInfo;
    browserInfo: BrowserInfo;
    route: string;
    networkStatus: 'online' | 'offline';
    category?: BugCategory;
    performanceEntries?: PerformanceEntryData[];
}

