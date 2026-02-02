/**
 * Get Dashboard Analytics Handler
 *
 * Queries real data from FeatureRequests and Reports collections,
 * then generates simulated agent metrics with seeded randomization.
 */

import { ObjectId } from 'mongodb';
import { ApiHandlerContext } from '@/apis/types';
import { featureRequests, reports } from '@/server/database';
import { toStringId } from '@/server/utils';
import type {
    GetDashboardAnalyticsRequest,
    GetDashboardAnalyticsResponse,
    Activity,
    FeatureRequestTimeSeriesPoint,
    CostTimeSeriesPoint,
    AgentPerformancePoint,
} from '../types';
import type { FeatureRequestStatus } from '@/server/database/collections/feature-requests/types';
import type { ReportStatus } from '@/server/database/collections/reports/types';

/**
 * Seeded random number generator for consistent mock data
 */
function seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(Math.sin(hash));
}

/**
 * Generate a seeded random number in a range
 */
function seededRandomRange(seed: string, min: number, max: number): number {
    return min + seededRandom(seed) * (max - min);
}

/**
 * Calculate trend percentage (mock)
 */
function calculateTrend(seed: string): number {
    const value = seededRandomRange(seed, -15, 25);
    return Math.round(value * 10) / 10;
}

/**
 * Generate time series data for feature requests
 */
function generateFeatureRequestTimeSeries(
    startDate: Date,
    endDate: Date,
    seed: string
): FeatureRequestTimeSeriesPoint[] {
    const points: FeatureRequestTimeSeriesPoint[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        const daySeed = `${seed}-${dateStr}`;

        points.push({
            date: dateStr,
            created: Math.floor(seededRandomRange(daySeed + '-created', 0, 5)),
            completed: Math.floor(seededRandomRange(daySeed + '-completed', 0, 3)),
            inProgress: Math.floor(seededRandomRange(daySeed + '-inprogress', 1, 4)),
        });

        current.setDate(current.getDate() + 1);
    }

    return points;
}

/**
 * Generate weekly cost time series
 */
function generateCostTimeSeries(
    startDate: Date,
    endDate: Date,
    seed: string
): CostTimeSeriesPoint[] {
    const points: CostTimeSeriesPoint[] = [];
    const current = new Date(startDate);

    // Move to start of week (Sunday)
    current.setDate(current.getDate() - current.getDay());

    while (current <= endDate) {
        const weekStr = current.toISOString().split('T')[0];
        const weekSeed = `${seed}-${weekStr}`;

        points.push({
            weekStart: weekStr,
            techDesign: Math.round(seededRandomRange(weekSeed + '-tech', 5, 20) * 100) / 100,
            implement: Math.round(seededRandomRange(weekSeed + '-impl', 15, 45) * 100) / 100,
            prReview: Math.round(seededRandomRange(weekSeed + '-pr', 2, 8) * 100) / 100,
            other: Math.round(seededRandomRange(weekSeed + '-other', 1, 5) * 100) / 100,
        });

        current.setDate(current.getDate() + 7);
    }

    return points;
}

/**
 * Generate agent performance data
 */
function generateAgentPerformance(seed: string): AgentPerformancePoint[] {
    return [
        {
            agentType: 'tech-design',
            avgDuration: Math.round(seededRandomRange(seed + '-tech-dur', 180, 240)),
            successRate: Math.round(seededRandomRange(seed + '-tech-rate', 94, 98) * 10) / 10,
            executionCount: Math.floor(seededRandomRange(seed + '-tech-count', 30, 60)),
        },
        {
            agentType: 'implement',
            avgDuration: Math.round(seededRandomRange(seed + '-impl-dur', 300, 420)),
            successRate: Math.round(seededRandomRange(seed + '-impl-rate', 91, 96) * 10) / 10,
            executionCount: Math.floor(seededRandomRange(seed + '-impl-count', 40, 80)),
        },
        {
            agentType: 'pr-review',
            avgDuration: Math.round(seededRandomRange(seed + '-pr-dur', 90, 150)),
            successRate: Math.round(seededRandomRange(seed + '-pr-rate', 95, 99) * 10) / 10,
            executionCount: Math.floor(seededRandomRange(seed + '-pr-count', 35, 70)),
        },
    ];
}

/**
 * Generate activities from real data
 */
function generateActivities(
    featureRequestDocs: Array<{ _id: ObjectId; title: string; status: string; createdAt: Date; updatedAt: Date }>,
    reportDocs: Array<{ _id: ObjectId; description?: string; errorMessage?: string; status: string; createdAt: Date; updatedAt: Date }>,
    seed: string
): Activity[] {
    const activities: Activity[] = [];

    // Add feature request activities
    for (const fr of featureRequestDocs.slice(0, 30)) {
        // Created event
        activities.push({
            id: `fr-created-${toStringId(fr._id)}`,
            type: 'feature_request',
            action: 'created',
            title: `Feature request: ${fr.title.slice(0, 50)}${fr.title.length > 50 ? '...' : ''}`,
            timestamp: fr.createdAt.toISOString(),
        });

        // Completed event if done
        if (fr.status === 'done') {
            activities.push({
                id: `fr-completed-${toStringId(fr._id)}`,
                type: 'feature_request',
                action: 'completed',
                title: `Completed: ${fr.title.slice(0, 50)}${fr.title.length > 50 ? '...' : ''}`,
                timestamp: fr.updatedAt.toISOString(),
            });
        }
    }

    // Add bug report activities
    for (const report of reportDocs.slice(0, 20)) {
        const title = report.description || report.errorMessage || 'Bug report';
        activities.push({
            id: `bug-created-${toStringId(report._id)}`,
            type: 'bug_report',
            action: 'created',
            title: `Bug report: ${title.slice(0, 50)}${title.length > 50 ? '...' : ''}`,
            timestamp: report.createdAt.toISOString(),
        });

        if (report.status === 'resolved') {
            activities.push({
                id: `bug-resolved-${toStringId(report._id)}`,
                type: 'bug_report',
                action: 'resolved',
                title: `Resolved: ${title.slice(0, 50)}${title.length > 50 ? '...' : ''}`,
                timestamp: report.updatedAt.toISOString(),
            });
        }
    }

    // Add simulated agent execution activities
    const agentTypes = ['tech-design', 'implement', 'pr-review'];
    for (let i = 0; i < 15; i++) {
        const agentSeed = `${seed}-agent-${i}`;
        const agentType = agentTypes[i % 3];
        const isSuccess = seededRandom(agentSeed + '-success') > 0.05;
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - Math.floor(seededRandomRange(agentSeed, 1, 72)));

        activities.push({
            id: `agent-${i}-${agentSeed}`,
            type: 'agent_execution',
            action: isSuccess ? 'completed' : 'failed',
            title: `${agentType} agent ${isSuccess ? 'completed' : 'failed'}`,
            timestamp: timestamp.toISOString(),
            metadata: {
                agentType,
                duration: Math.round(seededRandomRange(agentSeed + '-dur', 60, 300)),
                cost: Math.round(seededRandomRange(agentSeed + '-cost', 0.1, 0.5) * 100) / 100,
            },
        });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 50);
}

export async function getAnalytics(
    params: GetDashboardAnalyticsRequest,
    context: ApiHandlerContext
): Promise<GetDashboardAnalyticsResponse> {
    try {
        // Admin check
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        const startDate = new Date(params.startDate);
        const endDate = new Date(params.endDate);

        // Create seed for consistent mock data
        const seed = `${params.startDate}-${params.endDate}`;

        // Fetch real feature requests
        const featureRequestDocs = await featureRequests.findFeatureRequests(
            { startDate, endDate },
            'createdAt',
            'desc'
        );

        // Fetch real reports
        const reportDocs = await reports.findReports(
            { startDate, endDate },
            'createdAt',
            'desc'
        );

        // Calculate real feature request metrics
        const frByStatus: Record<FeatureRequestStatus, number> = {
            new: 0,
            in_progress: 0,
            done: 0,
            rejected: 0,
        };
        for (const fr of featureRequestDocs) {
            if (fr.status in frByStatus) {
                frByStatus[fr.status]++;
            }
        }

        // Calculate real report metrics
        const reportsByStatus: Record<ReportStatus, number> = {
            new: 0,
            investigating: 0,
            resolved: 0,
            closed: 0,
        };
        for (const report of reportDocs) {
            if (report.status in reportsByStatus) {
                reportsByStatus[report.status]++;
            }
        }

        // Generate simulated agent metrics
        const totalExecutions = Math.floor(seededRandomRange(seed + '-executions', 100, 200));
        const successRate = Math.round(seededRandomRange(seed + '-success', 93, 97) * 10) / 10;
        const avgDuration = Math.round(seededRandomRange(seed + '-duration', 180000, 360000)); // 3-6 min in ms

        // Generate simulated costs
        const totalCost = Math.round(seededRandomRange(seed + '-cost', 30, 80) * 100) / 100;
        const avgPerExecution = Math.round((totalCost / totalExecutions) * 100) / 100;

        // Generate time series
        const featureRequestsByDay = generateFeatureRequestTimeSeries(startDate, endDate, seed);
        const costsByWeek = generateCostTimeSeries(startDate, endDate, seed);

        // Generate agent performance
        const agentPerformance = generateAgentPerformance(seed);

        // Generate activities
        const activities = generateActivities(featureRequestDocs, reportDocs, seed);

        return {
            featureRequests: {
                total: featureRequestDocs.length,
                byStatus: frByStatus,
                trend: calculateTrend(seed + '-fr-trend'),
            },
            bugReports: {
                total: reportDocs.length,
                byStatus: reportsByStatus,
                trend: calculateTrend(seed + '-bug-trend'),
            },
            agentMetrics: {
                totalExecutions,
                successRate,
                avgDuration,
                successRateTrend: calculateTrend(seed + '-agent-trend'),
            },
            costs: {
                total: totalCost,
                avgPerExecution,
                byAgentType: {
                    'tech-design': Math.round(totalCost * 0.25 * 100) / 100,
                    'implement': Math.round(totalCost * 0.55 * 100) / 100,
                    'pr-review': Math.round(totalCost * 0.12 * 100) / 100,
                    'other': Math.round(totalCost * 0.08 * 100) / 100,
                },
                trend: calculateTrend(seed + '-cost-trend'),
            },
            timeSeries: {
                featureRequestsByDay,
                costsByWeek,
            },
            agentPerformance,
            activities,
        };
    } catch (error: unknown) {
        console.error('Dashboard analytics error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get dashboard analytics' };
    }
}
