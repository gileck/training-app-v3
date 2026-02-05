/**
 * StatusDistributionChart Component
 *
 * Pie chart showing the distribution of feature requests by status.
 */

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/client/components/template/ui/card';
import { chartColors, tooltipStyle } from '../utils/chartConfig';
import { getStatusDisplayName } from '../utils/mockData';
import type { FeatureRequestMetrics } from '@/apis/template/dashboard/types';

/**
 * Props for the StatusDistributionChart component
 */
interface StatusDistributionChartProps {
    /** Feature request metrics with status breakdown */
    data: FeatureRequestMetrics | undefined;
}

/**
 * Status color mapping
 */
const statusColors: Record<string, string> = {
    new: chartColors.statusNew,
    in_progress: chartColors.statusInProgress,
    done: chartColors.statusDone,
    rejected: chartColors.statusRejected,
};

/**
 * Custom tooltip for the pie chart
 */
function CustomTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: { percent: number } }>;
}) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const entry = payload[0];
    const percent = (entry.payload.percent * 100).toFixed(1);

    return (
        <div style={tooltipStyle.contentStyle}>
            <p style={tooltipStyle.labelStyle}>{entry.name}</p>
            <p style={tooltipStyle.itemStyle}>
                Count: {entry.value} ({percent}%)
            </p>
        </div>
    );
}

/**
 * Custom label renderer for pie slices
 */
function renderCustomLabel({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
}: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
}) {
    // Only show label if segment is large enough (>5%)
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="hsl(var(--background))"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={500}
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
}

/**
 * Status distribution pie chart
 */
export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
    // Show empty state if no data
    if (!data || data.total === 0) {
        return (
            <Card className="p-4">
                <h3 className="text-lg font-medium">Status Distribution</h3>
                <div className="mt-4 h-48 flex items-center justify-center rounded-md bg-muted/50">
                    <span className="text-muted-foreground">No data available</span>
                </div>
            </Card>
        );
    }

    // Transform data for pie chart
    const chartData = Object.entries(data.byStatus)
        .filter(([, value]) => value > 0)
        .map(([status, value]) => ({
            name: getStatusDisplayName(status),
            value,
            status,
        }));

    return (
        <Card className="p-4">
            <h3 className="text-lg font-medium">Status Distribution</h3>
            <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomLabel}
                            outerRadius={80}
                            innerRadius={40}
                            dataKey="value"
                            paddingAngle={2}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={statusColors[entry.status] || chartColors.muted}
                                    strokeWidth={0}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '16px' }}
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => (
                                <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                                    {value}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
