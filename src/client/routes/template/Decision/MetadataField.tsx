/**
 * MetadataField Component
 *
 * Renders a single metadata field based on its type config.
 */

import type { MetadataFieldConfig } from '@/apis/template/agent-decision/types';

interface MetadataFieldProps {
    config: MetadataFieldConfig;
    value: string | string[];
}

const BADGE_COLORS: Record<string, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    gray: 'bg-muted text-muted-foreground',
};

function getBadgeColor(value: string, colorMap?: Record<string, string>): string {
    if (colorMap) {
        const color = colorMap[value];
        if (color && BADGE_COLORS[color]) {
            return BADGE_COLORS[color];
        }
    }
    return BADGE_COLORS.gray;
}

export function MetadataField({ config, value }: MetadataFieldProps) {
    if (config.type === 'badge') {
        const strValue = typeof value === 'string' ? value : value.join(', ');
        const colorClass = getBadgeColor(strValue, config.colorMap);
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                {strValue}
            </span>
        );
    }

    if (config.type === 'tag') {
        const strValue = typeof value === 'string' ? value : value.join(', ');
        return (
            <span className="text-xs text-muted-foreground">
                {strValue}
            </span>
        );
    }

    if (config.type === 'file-list') {
        const files = Array.isArray(value) ? value : [value];
        if (files.length === 0) return null;
        return (
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                <strong className="shrink-0">{config.label}:</strong>
                {files.map((f, i) => (
                    <span key={f}>
                        <code className="bg-muted px-1 py-0.5 rounded text-[11px] break-all">{f}</code>
                        {i < files.length - 1 && ','}
                    </span>
                ))}
            </div>
        );
    }

    // text type
    const strValue = typeof value === 'string' ? value : value.join(', ');
    return (
        <p className="text-xs text-muted-foreground italic">
            <strong>{config.label}:</strong> {strValue}
        </p>
    );
}
