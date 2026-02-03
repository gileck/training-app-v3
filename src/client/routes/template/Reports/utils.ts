/**
 * Reports Utility Functions
 */

import type { ReportClient, ReportStatus } from '@/apis/reports/types';
import { generatePerformanceSummaryFromStoredData } from '@/client/features';
import { AlertCircle, CheckCircle, Search, XCircle } from 'lucide-react';
import React from 'react';

// Types for grouped view
export interface GroupedReport {
    key: string; // error message or description
    type: 'bug' | 'error';
    count: number;
    firstOccurrence: string;
    lastOccurrence: string;
    reports: ReportClient[];
}

export const STATUS_COLORS: Record<ReportStatus, string> = {
    new: 'bg-info',
    investigating: 'bg-warning',
    resolved: 'bg-success',
    closed: 'bg-muted-foreground',
};

export const STATUS_ICONS: Record<ReportStatus, React.ReactNode> = {
    new: React.createElement(AlertCircle, { className: 'h-3 w-3' }),
    investigating: React.createElement(Search, { className: 'h-3 w-3' }),
    resolved: React.createElement(CheckCircle, { className: 'h-3 w-3' }),
    closed: React.createElement(XCircle, { className: 'h-3 w-3' }),
};

export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

/**
 * Generate performance summary from stored report data
 * Uses shared logic from boot-performance module
 */
export function generatePerformanceSummary(report: ReportClient): string | null {
    if (report.category !== 'performance') return null;
    return generatePerformanceSummaryFromStoredData(report.sessionLogs, report.performanceEntries);
}

/**
 * Group reports by error message or description
 */
export function groupReports(reports: ReportClient[]): GroupedReport[] {
    const groups = new Map<string, GroupedReport>();

    for (const report of reports) {
        // Use error message for errors, description for bugs
        const key = report.errorMessage || report.description || 'Unknown';

        if (groups.has(key)) {
            const group = groups.get(key)!;
            group.count++;
            group.reports.push(report);

            // Update first/last occurrence
            if (new Date(report.createdAt) < new Date(group.firstOccurrence)) {
                group.firstOccurrence = report.createdAt;
            }
            if (new Date(report.createdAt) > new Date(group.lastOccurrence)) {
                group.lastOccurrence = report.createdAt;
            }
        } else {
            groups.set(key, {
                key,
                type: report.type,
                count: 1,
                firstOccurrence: report.createdAt,
                lastOccurrence: report.createdAt,
                reports: [report],
            });
        }
    }

    // Sort by last occurrence (most recent first)
    return Array.from(groups.values()).sort(
        (a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
    );
}
