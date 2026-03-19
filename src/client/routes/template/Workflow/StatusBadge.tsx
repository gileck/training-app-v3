/**
 * StatusBadge
 *
 * Theme-aware badge using shadcn Badge with semantic color mapping.
 */

import { Badge } from '@/client/components/template/ui/badge';
import type { BadgeProps } from '@/client/components/template/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const BADGE_VARIANT_MAP: Record<string, BadgeVariant> = {
    // Type
    feature: 'default',
    bug: 'destructive',
    task: 'secondary',
    // Pipeline status
    'Pending Approval': 'warning',
    'Backlog': 'secondary',
    'Product Development': 'secondary',
    'Product Design': 'secondary',
    'Bug Investigation': 'destructive',
    'Technical Design': 'default',
    'Ready for development': 'warning',
    'PR Review': 'default',
    'Final Review': 'default',
    'Done': 'success',
    // Review status
    'Waiting for Review': 'warning',
    'Approved': 'success',
    'Request Changes': 'warning',
    'Rejected': 'destructive',
    'Waiting for Clarification': 'warning',
    'Clarification Received': 'default',
    // Priority
    critical: 'destructive',
    high: 'warning',
    medium: 'default',
    low: 'secondary',
    // Size
    XS: 'outline',
    S: 'secondary',
    M: 'default',
    L: 'warning',
    XL: 'destructive',
    // Complexity
    High: 'destructive',
    Medium: 'warning',
    Low: 'success',
    // Source
    source: 'outline',
    // Domain
    domain: 'outline',
};

const DEFAULT_VARIANT: BadgeVariant = 'secondary';

export function StatusBadge({ label, colorKey }: { label: string; colorKey?: string }) {
    const variant = BADGE_VARIANT_MAP[colorKey || label] || DEFAULT_VARIANT;
    return (
        <Badge variant={variant}>
            {label}
        </Badge>
    );
}
