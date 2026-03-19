/**
 * KanbanBoard
 *
 * Horizontal scrollable board view with columns per pipeline status.
 * Falls back to list view on mobile (< sm breakpoint).
 */

import { useMemo } from 'react';
import { Badge } from '@/client/components/template/ui/badge';
import { WorkflowCard } from './WorkflowCard';
import { PIPELINE_STATUSES } from './constants';
import type { WorkflowItem } from '@/apis/template/workflow/types';

export function KanbanBoard({ items, onSelectItem }: {
    items: WorkflowItem[];
    onSelectItem: (id: string) => void;
}) {
    const columns = useMemo(() => {
        const byStatus = new Map<string, WorkflowItem[]>();
        for (const item of items) {
            const status = item.status || 'Unknown';
            const existing = byStatus.get(status);
            if (existing) existing.push(item);
            else byStatus.set(status, [item]);
        }

        const result: { status: string; items: WorkflowItem[] }[] = [];
        for (const status of [...PIPELINE_STATUSES, 'Done']) {
            const statusItems = byStatus.get(status);
            if (statusItems && statusItems.length > 0) {
                result.push({ status, items: statusItems });
                byStatus.delete(status);
            }
        }
        for (const [status, statusItems] of byStatus) {
            result.push({ status, items: statusItems });
        }
        return result;
    }, [items]);

    if (columns.length === 0) {
        return <div className="text-sm text-muted-foreground">No workflow items found.</div>;
    }

    return (
        <div className="overflow-x-auto -mx-4 px-4 pb-4">
            <div className="flex gap-4 min-w-max">
                {columns.map(({ status, items: colItems }) => (
                    <div key={status} className="min-w-[280px] max-w-[320px] flex-shrink-0">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                                {status}
                            </h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {colItems.length}
                            </Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                            {colItems.map((item) => (
                                <WorkflowCard
                                    key={item.id}
                                    item={item}
                                    onSelect={onSelectItem}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
