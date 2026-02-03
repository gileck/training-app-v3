/**
 * AgentPerformanceChart Component
 *
 * Bar chart comparing agent types by average duration and success rate.
 */

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Card } from '@/client/components/template/ui/card';
import { chartColors, tooltipStyle, gridStyle, axisStyle } from '../utils/chartConfig';
import { getAgentDisplayName, formatDurationSeconds } from '../utils/mockData';
import type { AgentPerformancePoint } from '@/apis/dashboard/types';

/**
 * Props for the AgentPerformanceChart component
 */
interface AgentPerformanceChartProps {
    /** Agent performance data */
    data: AgentPerformancePoint[] | undefined;
}

/**
 * Custom tooltip for the bar chart
 */
function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; dataKey: string }>;
    label?: string;
}) {
    if (!active || !payload || !label) {
        return null;
    }

    return (
        <div style={tooltipStyle.contentStyle}>
            <p style={tooltipStyle.labelStyle}>{label}</p>
            {payload.map((entry, index) => {
                const value =
                    entry.dataKey === 'avgDuration'
                        ? formatDurationSeconds(entry.value)
                        : `${entry.value.toFixed(1)}%`;
                return (
                    <p key={index} style={tooltipStyle.itemStyle}>
                        {entry.name}: {value}
                    </p>
                );
            })}
        </div>
    );
}

/**
 * Agent performance comparison bar chart
 */
export function AgentPerformanceChart({ data }: AgentPerformanceChartProps) {
    // Show empty state if no data
    if (!data || data.length === 0) {
        return (
            <Card className="p-4">
                <h3 className="text-lg font-medium">Agent Performance</h3>
                <div className="mt-4 h-48 flex items-center justify-center rounded-md bg-muted/50">
                    <span className="text-muted-foreground">No data available</span>
                </div>
            </Card>
        );
    }

    // Transform data for chart
    const chartData = data.map((point) => ({
        ...point,
        name: getAgentDisplayName(point.agentType),
    }));

    return (
        <Card className="p-4">
            <h3 className="text-lg font-medium">Agent Performance</h3>
            <p className="text-sm text-muted-foreground">
                Average duration and success rate by agent type
            </p>
            <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                        barGap={4}
                    >
                        <CartesianGrid
                            strokeDasharray={gridStyle.strokeDasharray}
                            stroke={gridStyle.stroke}
                            opacity={gridStyle.opacity}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="name"
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                        />
                        <YAxis
                            yAxisId="duration"
                            orientation="left"
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                            tickFormatter={(value) => `${Math.round(value / 60)}m`}
                            label={{
                                value: 'Duration',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                            }}
                        />
                        <YAxis
                            yAxisId="rate"
                            orientation="right"
                            domain={[0, 100]}
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                            tickFormatter={(value) => `${value}%`}
                            label={{
                                value: 'Success %',
                                angle: 90,
                                position: 'insideRight',
                                style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                            }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '16px' }}
                            iconType="rect"
                            iconSize={10}
                        />
                        <Bar
                            yAxisId="duration"
                            dataKey="avgDuration"
                            name="Avg Duration"
                            fill={chartColors.primary}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                        <Bar
                            yAxisId="rate"
                            dataKey="successRate"
                            name="Success Rate"
                            fill={chartColors.success}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
