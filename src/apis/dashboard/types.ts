/**
 * Dashboard API Types
 *
 * Request/response types for the dashboard analytics API.
 */

import type { FeatureRequestStatus } from '@/server/database/collections/feature-requests/types';
import type { ReportStatus } from '@/server/database/collections/reports/types';

// ============================================================================
// Activity Types
// ============================================================================

export type ActivityType = 'feature_request' | 'bug_report' | 'agent_execution' | 'pr';
export type ActivityAction = 'created' | 'approved' | 'completed' | 'failed' | 'merged' | 'resolved';

export interface Activity {
    id: string;
    type: ActivityType;
    action: ActivityAction;
    title: string;
    timestamp: string;
    metadata?: {
        agentType?: string;
        duration?: number;
        cost?: number;
        status?: string;
    };
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface FeatureRequestMetrics {
    total: number;
    byStatus: Record<FeatureRequestStatus, number>;
    trend: number;
}

export interface BugReportMetrics {
    total: number;
    byStatus: Record<ReportStatus, number>;
    trend: number;
}

export interface AgentMetrics {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    successRateTrend: number;
}

export interface CostMetrics {
    total: number;
    avgPerExecution: number;
    byAgentType: Record<string, number>;
    trend: number;
}

export interface FeatureRequestTimeSeriesPoint {
    date: string;
    created: number;
    completed: number;
    inProgress: number;
}

export interface CostTimeSeriesPoint {
    weekStart: string;
    techDesign: number;
    implement: number;
    prReview: number;
    other: number;
}

export interface AgentPerformancePoint {
    agentType: string;
    avgDuration: number;
    successRate: number;
    executionCount: number;
}

// ============================================================================
// API Request/Response
// ============================================================================

export interface GetDashboardAnalyticsRequest {
    startDate: string; // ISO string
    endDate: string; // ISO string
}

export interface GetDashboardAnalyticsResponse {
    featureRequests?: FeatureRequestMetrics;
    bugReports?: BugReportMetrics;
    agentMetrics?: AgentMetrics;
    costs?: CostMetrics;
    timeSeries?: {
        featureRequestsByDay: FeatureRequestTimeSeriesPoint[];
        costsByWeek: CostTimeSeriesPoint[];
    };
    agentPerformance?: AgentPerformancePoint[];
    activities?: Activity[];
    error?: string;
}
