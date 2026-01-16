import { Button } from '@/client/components/ui/button';
import { Checkbox } from '@/client/components/ui/checkbox';
import { Dumbbell, Trash2 } from 'lucide-react';
import type { ActivityLogEntry } from '@/apis/activity-logs/types';
import { formatTime } from './utils';

interface ActivityItemProps {
    activity: ActivityLogEntry;
    onDelete?: (id: string) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
}

export function ActivityItem({
    activity,
    onDelete,
    isSelectionMode = false,
    isSelected = false,
    onSelect,
}: ActivityItemProps) {
    const handleClick = () => {
        if (isSelectionMode && onSelect) {
            onSelect(activity._id);
        }
    };

    return (
        <div
            className={`flex items-center gap-3 py-3 border-b border-border/50 last:border-0 group ${
                isSelectionMode ? 'cursor-pointer' : ''
            } ${isSelected ? 'bg-primary/10' : ''}`}
            onClick={handleClick}
        >
            {isSelectionMode && (
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect?.(activity._id)}
                    className="flex-shrink-0"
                />
            )}
            <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {activity.exerciseImageUrl ? (
                    <img
                        src={activity.exerciseImageUrl}
                        alt={activity.exerciseName}
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activity.exerciseName}</p>
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
                        className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
