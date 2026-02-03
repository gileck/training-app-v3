/**
 * Export to CSV Utility
 *
 * Functions for generating CSV content from dashboard data
 * and triggering browser downloads.
 */

import type { GetDashboardAnalyticsResponse } from '@/apis/dashboard/types';
import { formatDurationSeconds, formatCurrency, formatPercentage } from './mockData';

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | number | undefined): string {
    if (value === undefined || value === null) return '';
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Format date for CSV
 */
function formatDateForCSV(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
}

/**
 * Generate CSV content from dashboard metrics
 */
export function generateDashboardCSV(
    metrics: GetDashboardAnalyticsResponse,
    startDate: Date,
    endDate: Date
): string {
    const lines: string[] = [];

    // Header
    lines.push('Dashboard Analytics Export');
    lines.push(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Summary Metrics Section
    lines.push('SUMMARY METRICS');
    lines.push('Metric,Value');

    if (metrics.featureRequests) {
        lines.push(`Total Feature Requests,${metrics.featureRequests.total}`);
        lines.push(`Feature Requests - New,${metrics.featureRequests.byStatus.new || 0}`);
        lines.push(`Feature Requests - In Progress,${metrics.featureRequests.byStatus.in_progress || 0}`);
        lines.push(`Feature Requests - Done,${metrics.featureRequests.byStatus.done || 0}`);
        lines.push(`Feature Requests - Rejected,${metrics.featureRequests.byStatus.rejected || 0}`);
        lines.push(`Feature Requests Trend,${formatPercentage(metrics.featureRequests.trend)}`);
        lines.push('');
    }

    if (metrics.bugReports) {
        lines.push(`Total Bug Reports,${metrics.bugReports.total}`);
        lines.push(`Bug Reports - New,${metrics.bugReports.byStatus.new || 0}`);
        lines.push(`Bug Reports - Investigating,${metrics.bugReports.byStatus.investigating || 0}`);
        lines.push(`Bug Reports - Resolved,${metrics.bugReports.byStatus.resolved || 0}`);
        lines.push(`Bug Reports - Closed,${metrics.bugReports.byStatus.closed || 0}`);
        lines.push(`Bug Reports Trend,${formatPercentage(metrics.bugReports.trend)}`);
        lines.push('');
    }

    if (metrics.agentMetrics) {
        lines.push(`Agent Executions,${metrics.agentMetrics.totalExecutions}`);
        lines.push(`Agent Success Rate,${formatPercentage(metrics.agentMetrics.successRate)}`);
        lines.push(`Agent Avg Duration,${formatDurationSeconds(metrics.agentMetrics.avgDuration / 1000)}`);
        lines.push('');
    }

    if (metrics.costs) {
        lines.push(`Total Cost,${formatCurrency(metrics.costs.total)}`);
        lines.push(`Avg Cost Per Execution,${formatCurrency(metrics.costs.avgPerExecution)}`);
        lines.push(`Cost Trend,${formatPercentage(metrics.costs.trend)}`);
        lines.push('');

        // Cost Breakdown by Agent Type
        lines.push('COST BREAKDOWN BY AGENT TYPE');
        lines.push('Agent Type,Cost');
        Object.entries(metrics.costs.byAgentType).forEach(([agentType, cost]) => {
            lines.push(`${escapeCSV(agentType)},${formatCurrency(cost)}`);
        });
        lines.push('');
    }

    // Agent Performance
    if (metrics.agentPerformance && metrics.agentPerformance.length > 0) {
        lines.push('AGENT PERFORMANCE');
        lines.push('Agent Type,Avg Duration (s),Success Rate (%),Execution Count');
        metrics.agentPerformance.forEach((agent) => {
            lines.push(
                `${escapeCSV(agent.agentType)},${agent.avgDuration.toFixed(1)},${agent.successRate.toFixed(1)},${agent.executionCount}`
            );
        });
        lines.push('');
    }

    // Feature Requests Time Series
    if (metrics.timeSeries?.featureRequestsByDay && metrics.timeSeries.featureRequestsByDay.length > 0) {
        lines.push('FEATURE REQUESTS OVER TIME');
        lines.push('Date,Created,In Progress,Completed');
        metrics.timeSeries.featureRequestsByDay.forEach((point) => {
            lines.push(
                `${formatDateForCSV(point.date)},${point.created},${point.inProgress},${point.completed}`
            );
        });
        lines.push('');
    }

    // Costs Time Series
    if (metrics.timeSeries?.costsByWeek && metrics.timeSeries.costsByWeek.length > 0) {
        lines.push('COSTS BY WEEK');
        lines.push('Week Start,Tech Design,Implement,PR Review,Other,Total');
        metrics.timeSeries.costsByWeek.forEach((point) => {
            const total = point.techDesign + point.implement + point.prReview + point.other;
            lines.push(
                `${formatDateForCSV(point.weekStart)},${point.techDesign.toFixed(2)},${point.implement.toFixed(2)},${point.prReview.toFixed(2)},${point.other.toFixed(2)},${total.toFixed(2)}`
            );
        });
        lines.push('');
    }

    // Recent Activities
    if (metrics.activities && metrics.activities.length > 0) {
        lines.push('RECENT ACTIVITIES');
        lines.push('Timestamp,Type,Action,Title');
        metrics.activities.slice(0, 50).forEach((activity) => {
            lines.push(
                `${formatDateForCSV(activity.timestamp)},${escapeCSV(activity.type)},${escapeCSV(activity.action)},${escapeCSV(activity.title)}`
            );
        });
    }

    return lines.join('\n');
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
}

/**
 * Export dashboard data to CSV and download
 */
export function exportDashboardToCSV(
    metrics: GetDashboardAnalyticsResponse,
    startDate: Date,
    endDate: Date
): void {
    const content = generateDashboardCSV(metrics, startDate, endDate);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `dashboard-export-${dateStr}.csv`;
    downloadCSV(content, filename);
}
