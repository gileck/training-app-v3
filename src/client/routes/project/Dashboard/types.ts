/**
 * Dashboard Types
 *
 * Types for the analytics dashboard with mock data.
 */

import type { FeatureRequestStatus } from '@/server/database/collections/feature-requests/types';
import type { ReportStatus } from '@/server/database/collections/reports/types';

/**
 * Date range preset options
 */
export type DateRangePreset = 'last7days' | 'last30days' | 'last90days' | 'allTime';

/**
 * Activity type for the activity feed
 */
export type ActivityType = 'feature_request' | 'bug_report' | 'agent_execution' | 'pr';

/**
 * Activity action
 */
export type ActivityAction = 'created' | 'approved' | 'completed' | 'failed' | 'merged' | 'resolved';

/**
 * Single activity item in the feed
 */
export interface Activity {
    id: string;
    type: ActivityType;
    action: ActivityAction;
    title: string;
    timestamp: string; // ISO string
    metadata?: {
        agentType?: string;
        duration?: number; // seconds
        cost?: number;
        status?: string;
    };
}

/**
 * Feature request metrics
 */
export interface FeatureRequestMetrics {
    total: number;
    byStatus: Record<FeatureRequestStatus, number>;
    trend: number; // percentage change vs previous period
}

/**
 * Bug report metrics
 */
export interface BugReportMetrics {
    total: number;
    byStatus: Record<ReportStatus, number>;
    trend: number; // percentage change vs previous period
}

/**
 * Agent execution metrics (simulated)
 */
export interface AgentMetrics {
    totalExecutions: number;
    successRate: number; // 0-100
    avgDuration: number; // milliseconds
    successRateTrend: number;
}

/**
 * Cost metrics (simulated)
 */
export interface CostMetrics {
    total: number;
    avgPerExecution: number;
    byAgentType: Record<string, number>;
    trend: number;
}

/**
 * Time series data point for feature requests
 */
export interface FeatureRequestTimeSeriesPoint {
    date: string; // ISO date
    created: number;
    completed: number;
    inProgress: number;
}

/**
 * Time series data point for costs
 */
export interface CostTimeSeriesPoint {
    weekStart: string; // ISO date
    techDesign: number;
    implement: number;
    prReview: number;
    other: number;
}

/**
 * Agent performance data point
 */
export interface AgentPerformancePoint {
    agentType: string;
    avgDuration: number; // seconds
    successRate: number; // 0-100
    executionCount: number;
}

/**
 * Complete dashboard metrics response
 */
export interface DashboardMetrics {
    featureRequests: FeatureRequestMetrics;
    bugReports: BugReportMetrics;
    agentMetrics: AgentMetrics;
    costs: CostMetrics;
    timeSeries: {
        featureRequestsByDay: FeatureRequestTimeSeriesPoint[];
        costsByWeek: CostTimeSeriesPoint[];
    };
    agentPerformance: AgentPerformancePoint[];
    activities: Activity[];
}

/**
 * Dashboard filter state
 */
export interface DashboardFilters {
    startDate: Date;
    endDate: Date;
    activityTypeFilter: ActivityType | 'all';
}
