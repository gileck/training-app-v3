/**
 * PendingCard
 *
 * Card component for items awaiting approval.
 */

import { Card, CardContent } from '@/client/components/template/ui/card';
import { StatusBadge } from './StatusBadge';
import { SelectCheckbox } from './SelectCheckbox';
import { formatDate } from './utils';
import type { PendingItem } from '@/apis/template/workflow/types';

export function PendingCard({ item, onSelect, selectMode, selected, onToggleSelect }: {
    item: PendingItem;
    onSelect: (id: string) => void;
    selectMode?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}) {
    return (
        <Card
            className={`cursor-pointer hover:bg-accent/50 transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}
            onClick={() => selectMode ? onToggleSelect?.() : onSelect(item.id)}
        >
            <CardContent className="p-4">
                <div className="flex gap-3">
                    {selectMode && <SelectCheckbox selected={!!selected} />}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight line-clamp-2">
                                {item.title}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                                {formatDate(item.createdAt)}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge label={item.type === 'bug' ? 'Bug' : 'Feature'} colorKey={item.type} />
                            <StatusBadge label="Pending Approval" />
                            {item.priority && (
                                <StatusBadge label={item.priority} colorKey={item.priority} />
                            )}
                            {item.source && (
                                <StatusBadge label={`via ${item.source}`} colorKey="source" />
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
