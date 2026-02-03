/**
 * Chart Configuration
 *
 * Shared configuration for recharts components including colors,
 * tooltips, and common styling. Uses CSS variables for theme support.
 */

/**
 * Chart color palette using CSS variables for theme support.
 * These colors are used consistently across all charts.
 */
export const chartColors = {
    // Primary series colors
    primary: 'hsl(var(--primary))',
    secondary: 'hsl(var(--secondary))',
    success: 'hsl(var(--success))',
    warning: 'hsl(var(--warning))',
    destructive: 'hsl(var(--destructive))',
    info: 'hsl(var(--info))',

    // Muted colors for backgrounds and secondary elements
    muted: 'hsl(var(--muted))',
    mutedForeground: 'hsl(var(--muted-foreground))',

    // Status distribution colors (for pie chart)
    statusNew: 'hsl(var(--info))',
    statusInProgress: 'hsl(var(--warning))',
    statusDone: 'hsl(var(--success))',
    statusRejected: 'hsl(var(--destructive))',

    // Agent type colors (for bar/stacked charts)
    techDesign: 'hsl(var(--primary))',
    implement: 'hsl(var(--secondary))',
    prReview: 'hsl(var(--success))',
    other: 'hsl(var(--muted-foreground))',

    // Line chart series colors
    created: 'hsl(var(--info))',
    completed: 'hsl(var(--success))',
    inProgress: 'hsl(var(--warning))',
} as const;

/**
 * Common chart margins for consistent spacing
 */
export const chartMargins = {
    default: { top: 10, right: 10, left: 0, bottom: 0 },
    withLegend: { top: 10, right: 10, left: 0, bottom: 30 },
    withAxisLabels: { top: 10, right: 10, left: 10, bottom: 20 },
} as const;

/**
 * Common animation configuration
 */
export const chartAnimation = {
    duration: 300,
    easing: 'ease-out',
} as const;

/**
 * Tooltip style configuration using theme colors
 */
export const tooltipStyle = {
    contentStyle: {
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    labelStyle: {
        color: 'hsl(var(--foreground))',
        fontWeight: 500,
        marginBottom: '4px',
    },
    itemStyle: {
        color: 'hsl(var(--muted-foreground))',
        fontSize: '12px',
        padding: '2px 0',
    },
} as const;

/**
 * Legend style configuration
 */
export const legendStyle = {
    wrapperStyle: {
        paddingTop: '16px',
    },
    iconSize: 10,
    iconType: 'circle' as const,
} as const;

/**
 * Axis style configuration
 */
export const axisStyle = {
    tick: {
        fill: 'hsl(var(--muted-foreground))',
        fontSize: 11,
    },
    axisLine: {
        stroke: 'hsl(var(--border))',
    },
    tickLine: {
        stroke: 'hsl(var(--border))',
    },
} as const;

/**
 * Grid style configuration
 */
export const gridStyle = {
    strokeDasharray: '3 3',
    stroke: 'hsl(var(--border))',
    opacity: 0.5,
} as const;
