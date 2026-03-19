/**
 * WorkflowCard
 *
 * Card component for pipeline workflow items. Includes StatusStepper.
 */

import { Github } from 'lucide-react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { StatusBadge } from './StatusBadge';
import { SelectCheckbox } from './SelectCheckbox';
import { formatDate } from './utils';
import type { WorkflowItem } from '@/apis/template/workflow/types';

export function WorkflowCard({ item, onSelect, selectMode, selected, onToggleSelect }: {
    item: WorkflowItem;
    onSelect: (id: string) => void;
    selectMode?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}) {
    const navId = item.sourceId || item.id;
    const typeLabel = item.type === 'bug' ? 'Bug' : item.type === 'task' ? 'Task' : 'Feature';
    const ghUrl = item.content?.url;
    return (
        <Card
            className={`cursor-pointer hover:bg-accent/50 transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}
            onClick={() => selectMode ? onToggleSelect?.() : onSelect(navId)}
        >
            <CardContent className="p-4">
                <div className="flex gap-3">
                    {selectMode && <SelectCheckbox selected={!!selected} />}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight line-clamp-2">
                                {item.content?.title || 'Untitled'}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {item.implementationPhase && (
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Phase {item.implementationPhase}
                                    </span>
                                )}
                                {item.createdAt && (
                                    <span className="text-xs text-muted-foreground">
                                        {formatDate(item.createdAt)}
                                    </span>
                                )}
                                {item.content?.number && (
                                    <span className="text-xs text-muted-foreground">
                                        #{item.content.number}
                                    </span>
                                )}
                                {ghUrl && (
                                    <a
                                        href={ghUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        title="Open GitHub issue"
                                    >
                                        <Github className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        </div>
                        {item.createdBy && (
                            <span className="text-xs text-muted-foreground">
                                opened by {item.createdBy}
                            </span>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge label={typeLabel} colorKey={item.type} />
                            {item.priority && <StatusBadge label={item.priority} colorKey={item.priority} />}
                            {item.domain && <StatusBadge label={item.domain} colorKey="domain" />}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
