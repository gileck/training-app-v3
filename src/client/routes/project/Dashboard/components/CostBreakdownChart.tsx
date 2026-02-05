/**
 * CostBreakdownChart Component
 *
 * Stacked bar chart showing weekly costs by agent type.
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
import { formatWeekLabel, formatCurrency } from '../utils/mockData';
import type { CostTimeSeriesPoint } from '@/apis/template/dashboard/types';

/**
 * Props for the CostBreakdownChart component
 */
interface CostBreakdownChartProps {
    /** Weekly cost data */
    data: CostTimeSeriesPoint[] | undefined;
}

/**
 * Custom tooltip for the stacked bar chart
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

    const total = payload.reduce((sum, entry) => sum + entry.value, 0);

    return (
        <div style={tooltipStyle.contentStyle}>
            <p style={tooltipStyle.labelStyle}>{formatWeekLabel(label)}</p>
            {payload.map((entry, index) => (
                <p key={index} style={{ ...tooltipStyle.itemStyle, color: entry.color }}>
                    {entry.name}: {formatCurrency(entry.value)}
                </p>
            ))}
            <p
                style={{
                    ...tooltipStyle.itemStyle,
                    color: 'hsl(var(--foreground))',
                    fontWeight: 500,
                    marginTop: '4px',
                    paddingTop: '4px',
                    borderTop: '1px solid hsl(var(--border))',
                }}
            >
                Total: {formatCurrency(total)}
            </p>
        </div>
    );
}

/**
 * Format week label for X axis
 */
function formatXAxisLabel(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Cost breakdown stacked bar chart
 */
export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
    // Show empty state if no data
    if (!data || data.length === 0) {
        return (
            <Card className="p-4">
                <h3 className="text-lg font-medium">Cost Breakdown</h3>
                <div className="mt-4 h-48 flex items-center justify-center rounded-md bg-muted/50">
                    <span className="text-muted-foreground">No data available</span>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4">
            <h3 className="text-lg font-medium">Cost Breakdown</h3>
            <p className="text-sm text-muted-foreground">Weekly costs by agent type</p>
            <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                    >
                        <CartesianGrid
                            strokeDasharray={gridStyle.strokeDasharray}
                            stroke={gridStyle.stroke}
                            opacity={gridStyle.opacity}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="weekStart"
                            tickFormatter={formatXAxisLabel}
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={axisStyle.tick}
                            axisLine={{ stroke: axisStyle.axisLine.stroke }}
                            tickLine={{ stroke: axisStyle.tickLine.stroke }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '16px' }}
                            iconType="rect"
                            iconSize={10}
                        />
                        <Bar
                            dataKey="techDesign"
                            name="Tech Design"
                            stackId="costs"
                            fill={chartColors.techDesign}
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            dataKey="implement"
                            name="Implement"
                            stackId="costs"
                            fill={chartColors.implement}
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            dataKey="prReview"
                            name="PR Review"
                            stackId="costs"
                            fill={chartColors.prReview}
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            dataKey="other"
                            name="Other"
                            stackId="costs"
                            fill={chartColors.other}
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
