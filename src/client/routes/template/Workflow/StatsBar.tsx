/**
 * StatsBar
 *
 * Summary stats bar showing counts per status.
 */

const STATUS_DOT_CLASS: Record<string, string> = {
    'Pending Approval': 'bg-warning',
    'Backlog': 'bg-secondary',
    'Product Development': 'bg-secondary',
    'Product Design': 'bg-secondary',
    'Bug Investigation': 'bg-destructive',
    'Technical Design': 'bg-primary',
    'Ready for development': 'bg-warning',
    'PR Review': 'bg-primary',
    'Final Review': 'bg-primary',
    'Done': 'bg-success',
};

const DEFAULT_DOT_CLASS = 'bg-muted-foreground';

export function StatsBar({ pendingCount, statusCounts }: {
    pendingCount: number;
    statusCounts: { status: string; count: number }[];
}) {
    const total = pendingCount + statusCounts.reduce((sum, s) => sum + s.count, 0);
    if (total === 0) return null;

    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
            {pendingCount > 0 && (
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span>Pending {pendingCount}</span>
                </span>
            )}
            {statusCounts.map(({ status, count }) => (
                <span
                    key={status}
                    className="flex items-center gap-1"
                >
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT_CLASS[status] || DEFAULT_DOT_CLASS}`} />
                    <span>{status} {count}</span>
                </span>
            ))}
        </div>
    );
}
