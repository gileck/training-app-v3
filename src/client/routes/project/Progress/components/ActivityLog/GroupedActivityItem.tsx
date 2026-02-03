import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Checkbox } from '@/client/components/template/ui/checkbox';
import { Dumbbell, ChevronRight, Trash2 } from 'lucide-react';
import type { ActivityGroup } from './utils';
import { formatTime } from './utils';
import { ActivityItem } from './ActivityItem';

interface GroupedActivityItemProps {
    group: ActivityGroup;
    onDelete?: (id: string) => void;
    isSelectionMode?: boolean;
    selectedIds?: Set<string>;
    onSelect?: (id: string) => void;
}

export function GroupedActivityItem({
    group,
    onDelete,
    isSelectionMode = false,
    selectedIds,
    onSelect,
}: GroupedActivityItemProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral expand/collapse state
    const [isExpanded, setIsExpanded] = useState(false);
    const firstActivity = group.activities[0];

    // Single activity - no grouping UI
    if (group.type === 'single') {
        return (
            <ActivityItem
                activity={firstActivity}
                onDelete={onDelete}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds?.has(firstActivity._id) ?? false}
                onSelect={onSelect}
            />
        );
    }

    // Check if all activities in group are selected
    const allSelected = group.activities.every((a) => selectedIds?.has(a._id));
    const someSelected = group.activities.some((a) => selectedIds?.has(a._id));

    const handleGroupSelect = () => {
        if (onSelect) {
            // If all selected, deselect all; otherwise select all
            group.activities.forEach((a) => onSelect(a._id));
        }
    };

    // Grouped activities
    return (
        <div className={`border-b border-border/50 last:border-0 ${someSelected ? 'bg-primary/5' : ''}`}>
            {/* Collapsed header */}
            <button
                onClick={() => {
                    if (isSelectionMode) {
                        handleGroupSelect();
                    } else {
                        setIsExpanded(!isExpanded);
                    }
                }}
                className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/50 transition-colors rounded-lg -mx-2 px-2"
            >
                {isSelectionMode && (
                    <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleGroupSelect}
                        className="flex-shrink-0"
                        // Show indeterminate state when some but not all are selected
                        {...(someSelected && !allSelected ? { 'data-state': 'indeterminate' } : {})}
                    />
                )}
            <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {firstActivity.exerciseImageUrl ? (
                    <img
                        src={firstActivity.exerciseImageUrl}
                        alt={firstActivity.exerciseName}
                        className="h-full w-full object-contain"
                    />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center">
                            <Dumbbell className="h-5 w-5 text-muted-foreground" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                    <p className="font-medium truncate">
                        {group.exerciseName}
                    </p>
                    <span className="text-muted-foreground flex-shrink-0">(x{group.activities.length})</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right text-sm text-muted-foreground">
                        <p>{formatTime(group.firstTime)}</p>
                    </div>
                    {!isSelectionMode && (
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    )}
                </div>
            </button>

            {/* Expanded content - show in selection mode or when expanded */}
            {(isExpanded || isSelectionMode) && (
                <div className={`pl-4 border-l-2 border-muted ${isSelectionMode ? 'ml-9' : 'ml-5'} mb-2`}>
                    {group.activities.map((activity) => (
                        <div
                            key={activity._id}
                            className={`flex items-center gap-3 py-2 group cursor-pointer ${
                                selectedIds?.has(activity._id) ? 'bg-primary/10' : ''
                            }`}
                            onClick={() => isSelectionMode && onSelect?.(activity._id)}
                        >
                            {isSelectionMode && (
                                <Checkbox
                                    checked={selectedIds?.has(activity._id) ?? false}
                                    onCheckedChange={() => onSelect?.(activity._id)}
                                    className="flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{activity.exerciseName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right text-sm text-muted-foreground">
                                    <p>{formatTime(activity.completedAt)}</p>
                                </div>
                                {!isSelectionMode && onDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(activity._id);
                                        }}
                                        className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
