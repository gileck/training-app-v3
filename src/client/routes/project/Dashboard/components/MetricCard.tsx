/**
 * MetricCard Component
 *
 * Reusable metric card displaying a value with optional trend indicator,
 * icon, and subtitle. Used in the dashboard metrics section.
 */

import { Card } from '@/client/components/template/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/client/lib/utils';
import type { ReactNode } from 'react';

/**
 * Props for the TrendIndicator component
 */
interface TrendIndicatorProps {
    /** Trend percentage value (positive or negative) */
    value: number;
    /** If true, negative values are considered positive (e.g., for costs) */
    inverted?: boolean;
}

/**
 * Trend indicator showing up/down arrow with percentage
 */
function TrendIndicator({ value, inverted = false }: TrendIndicatorProps) {
    const isPositive = inverted ? value < 0 : value > 0;
    const Icon = value > 0 ? TrendingUp : TrendingDown;

    return (
        <span
            className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                isPositive ? 'text-success' : 'text-destructive'
            )}
        >
            <Icon className="h-3 w-3" />
            {Math.abs(value).toFixed(1)}%
        </span>
    );
}

/**
 * Props for the MetricCard component
 */
export interface MetricCardProps {
    /** Card title */
    title: string;
    /** Main value to display */
    value: string | number;
    /** Optional subtitle text */
    subtitle?: string;
    /** Optional trend percentage */
    trend?: number;
    /** If true, negative trends are shown as positive (e.g., for costs/bugs) */
    trendInverted?: boolean;
    /** Icon to display in the card */
    icon: ReactNode;
    /** Background color class for the icon container */
    iconBgColor: string;
}

/**
 * Metric card component for displaying key metrics
 */
export function MetricCard({
    title,
    value,
    subtitle,
    trend,
    trendInverted,
    icon,
    iconBgColor,
}: MetricCardProps) {
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{title}</span>
                <div
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        iconBgColor
                    )}
                >
                    {icon}
                </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{value}</span>
                {trend !== undefined && (
                    <TrendIndicator value={trend} inverted={trendInverted} />
                )}
            </div>
            {subtitle && (
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
        </Card>
    );
}
