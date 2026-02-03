/**
 * FeatureRequestsChart Component
 *
 * Line chart showing feature requests over time with three series:
 * created, completed, and in-progress.
 */

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Card } from '@/client/components/ui/card';
import { chartColors, tooltipStyle, gridStyle, axisStyle } from '../utils/chartConfig';
import { formatChartDate } from '../utils/mockData';
import type { FeatureRequestTimeSeriesPoint } from '@/apis/dashboard/types';

/**
 * Props for the FeatureRequestsChart component
 */
interface FeatureRequestsChartProps {
    /** Time series data for feature requests */
    data: FeatureRequestTimeSeriesPoint[];
}

/**
 * Custom tooltip for the line chart
 */
function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}) {
    if (!active || !payload || !label) {
        return null;
    }

    return (
        <div style={tooltipStyle.contentStyle}>
            <p style={tooltipStyle.labelStyle}>{formatChartDate(label)}</p>
            {payload.map((entry, index) => (
                <p key={index} style={{ ...tooltipStyle.itemStyle, color: entry.color }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
}

/**
 * Feature requests over time line chart
 */
export function FeatureRequestsChart({ data }: FeatureRequestsChartProps) {
    // Show empty state if no data
    if (!data || data.length === 0) {
        return (
            <Card className="p-4">
                <h3 className="text-lg font-medium">Feature Requests Over Time</h3>
                <div className="mt-4 h-48 flex items-center justify-center rounded-md bg-muted/50">
                    <span className="text-muted-foreground">No data available</span>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4">
            <h3 className="text-lg font-medium">Feature Requests Over Time</h3>
            <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                    >
                        <CartesianGrid
                            strokeDasharray={gridStyle.strokeDasharray}
                            stroke={gridStyle.stroke}
                            opacity={gridStyle.opacity}
                        />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatChartDate}
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                            interval="preserveStartEnd"
                            minTickGap={40}
                        />
                        <YAxis
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '16px' }}
                            iconType="circle"
                            iconSize={8}
                        />
                        <Line
                            type="monotone"
                            dataKey="created"
                            name="Created"
                            stroke={chartColors.created}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="completed"
                            name="Completed"
                            stroke={chartColors.completed}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="inProgress"
                            name="In Progress"
                            stroke={chartColors.inProgress}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
