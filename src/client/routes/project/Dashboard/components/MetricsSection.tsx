/**
 * MetricsSection Component
 *
 * Displays the 4 main metric cards (Feature Requests, Bug Reports,
 * Success Rate, Total Cost) in a responsive grid layout.
 */

import { Lightbulb, Bug, CheckCircle, DollarSign } from 'lucide-react';
import { MetricCard } from './MetricCard';
import type { GetDashboardAnalyticsResponse } from '@/apis/template/dashboard/types';
import { formatNumber } from '../utils/mockData';

/**
 * Props for the MetricsSection component
 */
interface MetricsSectionProps {
    /** Dashboard metrics data */
    data: GetDashboardAnalyticsResponse;
}

/**
 * Metrics section displaying key dashboard metrics in a grid
 */
export function MetricsSection({ data }: MetricsSectionProps) {
    // Build subtitle for feature requests
    const frSubtitle = data.featureRequests
        ? `${data.featureRequests.byStatus.new} new, ${data.featureRequests.byStatus.in_progress} in progress, ${data.featureRequests.byStatus.done} done`
        : undefined;

    // Build subtitle for bug reports
    const bugSubtitle = data.bugReports
        ? `${data.bugReports.byStatus.new} new, ${data.bugReports.byStatus.investigating} investigating, ${data.bugReports.byStatus.resolved} resolved`
        : undefined;

    // Build subtitle for agent metrics
    const agentSubtitle = data.agentMetrics
        ? `${formatNumber(data.agentMetrics.totalExecutions)} executions`
        : undefined;

    // Build subtitle for costs
    const costSubtitle = data.costs
        ? `Avg $${data.costs.avgPerExecution.toFixed(2)} per execution`
        : undefined;

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
                title="Feature Requests"
                value={data.featureRequests?.total ?? 0}
                subtitle={frSubtitle}
                trend={data.featureRequests?.trend}
                icon={<Lightbulb className="h-4 w-4 text-info" />}
                iconBgColor="bg-info/10"
            />
            <MetricCard
                title="Bug Reports"
                value={data.bugReports?.total ?? 0}
                subtitle={bugSubtitle}
                trend={data.bugReports?.trend}
                trendInverted // Lower bugs is better
                icon={<Bug className="h-4 w-4 text-destructive" />}
                iconBgColor="bg-destructive/10"
            />
            <MetricCard
                title="Success Rate"
                value={`${data.agentMetrics?.successRate ?? 0}%`}
                subtitle={agentSubtitle}
                trend={data.agentMetrics?.successRateTrend}
                icon={<CheckCircle className="h-4 w-4 text-success" />}
                iconBgColor="bg-success/10"
            />
            <MetricCard
                title="Total Cost"
                value={`$${data.costs?.total.toFixed(2) ?? '0.00'}`}
                subtitle={costSubtitle}
                trend={data.costs?.trend}
                trendInverted // Lower cost is better
                icon={<DollarSign className="h-4 w-4 text-warning" />}
                iconBgColor="bg-warning/10"
            />
        </div>
    );
}
