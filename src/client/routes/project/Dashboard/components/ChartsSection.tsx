/**
 * ChartsSection Component
 *
 * Container component that organizes all 4 dashboard charts
 * in a responsive 2-column grid layout.
 */

import { FeatureRequestsChart } from './FeatureRequestsChart';
import { StatusDistributionChart } from './StatusDistributionChart';
import { AgentPerformanceChart } from './AgentPerformanceChart';
import { CostBreakdownChart } from './CostBreakdownChart';
import type { GetDashboardAnalyticsResponse } from '@/apis/template/dashboard/types';

/**
 * Props for the ChartsSection component
 */
interface ChartsSectionProps {
    /** Dashboard metrics data */
    data: GetDashboardAnalyticsResponse;
}

/**
 * Charts section displaying all dashboard charts in a grid
 */
export function ChartsSection({ data }: ChartsSectionProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Feature Requests Over Time - Line Chart */}
            <FeatureRequestsChart data={data.timeSeries?.featureRequestsByDay ?? []} />

            {/* Status Distribution - Pie Chart */}
            <StatusDistributionChart data={data.featureRequests} />

            {/* Agent Performance - Bar Chart */}
            <AgentPerformanceChart data={data.agentPerformance} />

            {/* Cost Breakdown - Stacked Bar Chart */}
            <CostBreakdownChart data={data.timeSeries?.costsByWeek} />
        </div>
    );
}
