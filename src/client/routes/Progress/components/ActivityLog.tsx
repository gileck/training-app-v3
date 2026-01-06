import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Button } from '@/client/components/ui/button';
import { Checkbox } from '@/client/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/ui/alert-dialog';
import { toast } from '@/client/components/ui/toast';
import {
    Activity,
    Calendar,
    Dumbbell,
    ChevronRight,
    Trash2,
    Copy,
    Pencil,
    X,
    Check,
    Loader2,
    MoreVertical,
    Plus,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import {
    useActivity,
    useDeleteActivity,
    useBulkDeleteActivity,
    useEditActivity,
    useDuplicateActivity,
    useAddActivity,
} from '../hooks';
import { useIsSessionActive } from '@/client/features/workout';
import type { ActivityLogEntry } from '@/apis/activity-logs/types';
import type { DateRange } from '../store';
import { EditActivityDialog } from './EditActivityDialog';
import { AddActivityDialog } from './AddActivityDialog';

// Utility functions
function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface ActivityGroup {
    type: 'single' | 'grouped';
    exerciseName: string;
    activities: ActivityLogEntry[];
    firstTime: string;
}

/**
 * Groups consecutive activities by exercise name if they are within 10 minutes of each other.
 * Non-consecutive exercises or exercises more than 10 minutes apart are not grouped.
 */
function groupConsecutiveActivities(activities: ActivityLogEntry[]): ActivityGroup[] {
    if (activities.length === 0) return [];

    const MAX_TIME_GAP_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
    const groups: ActivityGroup[] = [];
    let currentGroup: ActivityLogEntry[] = [activities[0]];

    for (let i = 1; i < activities.length; i++) {
        const current = activities[i];
        const previous = activities[i - 1];

        const currentTime = new Date(current.completedAt).getTime();
        const previousTime = new Date(previous.completedAt).getTime();
        const timeDiff = Math.abs(currentTime - previousTime);

        const sameExercise = current.exerciseName === previous.exerciseName;
        const withinTimeLimit = timeDiff <= MAX_TIME_GAP_MS;

        if (sameExercise && withinTimeLimit) {
            // Add to current group
            currentGroup.push(current);
        } else {
            // Finalize current group and start a new one
            groups.push({
                type: currentGroup.length > 1 ? 'grouped' : 'single',
                exerciseName: currentGroup[0].exerciseName,
                activities: currentGroup,
                firstTime: currentGroup[0].completedAt,
            });
            currentGroup = [current];
        }
    }

    // Don't forget to add the last group
    groups.push({
        type: currentGroup.length > 1 ? 'grouped' : 'single',
        exerciseName: currentGroup[0].exerciseName,
        activities: currentGroup,
        firstTime: currentGroup[0].completedAt,
    });

    return groups;
}

// Activity Item Component
function ActivityItem({
    activity,
    onDelete,
    isSelectionMode = false,
    isSelected = false,
    onSelect,
}: {
    activity: ActivityLogEntry;
    onDelete?: (id: string) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
}) {
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

// Grouped Activity Item Component
function GroupedActivityItem({
    group,
    onDelete,
    isSelectionMode = false,
    selectedIds,
    onSelect,
}: {
    group: ActivityGroup;
    onDelete?: (id: string) => void;
    isSelectionMode?: boolean;
    selectedIds?: Set<string>;
    onSelect?: (id: string) => void;
}) {
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

// Selection Action Bar Component
function SelectionActionBar({
    selectedCount,
    deletableCount,
    onDelete,
    onDuplicate,
    onEdit,
    onCancel,
    isDeleting,
    isDuplicating,
    isEditing,
}: {
    selectedCount: number;
    deletableCount: number;
    onDelete: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
    onCancel: () => void;
    isDeleting?: boolean;
    isDuplicating?: boolean;
    isEditing?: boolean;
}) {
    const isSingleSelection = selectedCount === 1;
    const isAnyLoading = isDeleting || isDuplicating || isEditing;
    // Move up when FloatingWorkoutBar is visible to avoid overlap
    const isWorkoutActive = useIsSessionActive();

    return (
        <div className={`fixed left-4 right-4 bg-card border border-border rounded-xl shadow-lg p-2 z-50 ${
            isWorkoutActive ? 'bottom-[150px]' : 'bottom-20'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCancel}
                        className="h-8 w-8"
                        disabled={isAnyLoading}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        {selectedCount} selected
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onEdit}
                        className="h-9 w-9"
                        disabled={isAnyLoading}
                        title="Edit date"
                    >
                        {isEditing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Pencil className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDuplicate}
                        className="h-9 w-9"
                        disabled={!isSingleSelection || isAnyLoading}
                        title={isSingleSelection ? 'Duplicate' : 'Select one item to duplicate'}
                    >
                        {isDuplicating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletableCount === 0 || isAnyLoading}
                        title="Delete"
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Main Activity Log Component
export interface ActivityLogProps {
    dateRange: DateRange;
}

export function ActivityLog({ dateRange }: ActivityLogProps) {
    const { data, isLoading } = useActivity({ period: dateRange, limit: 50 });
    const deleteActivityMutation = useDeleteActivity();
    const bulkDeleteMutation = useBulkDeleteActivity();
    const editActivityMutation = useEditActivity();
    const duplicateActivityMutation = useDuplicateActivity();
    const addActivityMutation = useAddActivity();
    const activities = data?.activities || [];

    // Selection state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral mode state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- tracks which day is in selection mode
    const [selectionDay, setSelectionDay] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral state for add dialog date
    const [addDialogDate, setAddDialogDate] = useState<Date>(new Date());

    const handleDelete = (activityId: string) => {
        deleteActivityMutation.mutate({ activityId });
    };

    const handleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleSelectDay = useCallback((dayActivities: ActivityLogEntry[]) => {
        setSelectedIds((prev) => {
            const dayIds = dayActivities.map((a) => a._id);
            const allSelected = dayIds.every((id) => prev.has(id));
            const next = new Set(prev);
            if (allSelected) {
                // Deselect all from this day
                dayIds.forEach((id) => next.delete(id));
            } else {
                // Select all from this day
                dayIds.forEach((id) => next.add(id));
            }
            return next;
        });
    }, []);

    const handleCancelSelection = () => {
        setIsSelectionMode(false);
        setSelectionDay(null);
        setSelectedIds(new Set());
    };

    const handleEnableDaySelection = (date: string) => {
        setIsSelectionMode(true);
        setSelectionDay(date);
        setSelectedIds(new Set());
    };

    const handleOpenAddDialog = (dateString: string) => {
        // Parse the date string (format: "Mon, Dec 28") and set time to now
        const now = new Date();
        const year = now.getFullYear();
        // Parse month and day from the date string
        const parts = dateString.replace(',', '').split(' ');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.indexOf(parts[1]);
        const day = parseInt(parts[2], 10);

        const selectedDate = new Date(year, monthIndex, day, now.getHours(), now.getMinutes());
        setAddDialogDate(selectedDate);
        setIsAddDialogOpen(true);
    };

    const handleAddSave = (planExerciseId: string, completedAt: string, numberOfSets: number) => {
        addActivityMutation.mutate(
            { planExerciseId, completedAt, numberOfSets },
            {
                onSuccess: () => {
                    toast.success(`Added ${numberOfSets} ${numberOfSets === 1 ? 'set' : 'sets'}`);
                    setIsAddDialogOpen(false);
                },
                onError: () => {
                    toast.error('Failed to add sets');
                },
            }
        );
    };

    // Filter out temp IDs (from optimistic updates) that don't exist in database
    const realSelectedIds = useMemo(() => {
        return Array.from(selectedIds).filter((id) => !id.startsWith('temp-'));
    }, [selectedIds]);

    const handleBulkDelete = () => {
        if (realSelectedIds.length > 0) {
            const count = realSelectedIds.length;
            bulkDeleteMutation.mutate(
                { activityIds: realSelectedIds },
                {
                    onSuccess: () => {
                        toast.success(`Deleted ${count} ${count === 1 ? 'set' : 'sets'}`);
                        setSelectedIds(new Set());
                    },
                    onError: () => {
                        toast.error('Failed to delete sets');
                    },
                }
            );
            setIsDeleteDialogOpen(false);
        }
    };

    const handleDuplicate = () => {
        if (selectedIds.size === 1) {
            const [id] = Array.from(selectedIds);
            // Find the original activity to get its date
            const originalActivity = activities.find((a) => a._id === id);
            duplicateActivityMutation.mutate(
                {
                    activityId: id,
                    completedAt: originalActivity?.completedAt, // Keep same date
                },
                {
                    onSuccess: () => {
                        toast.success('Set duplicated');
                        setSelectedIds(new Set());
                    },
                    onError: () => {
                        toast.error('Failed to duplicate set');
                    },
                }
            );
        }
    };

    const handleEditSave = (newDate: string) => {
        const ids = Array.from(selectedIds);
        let completedCount = 0;
        let errorCount = 0;

        ids.forEach((id) => {
            editActivityMutation.mutate(
                { activityId: id, completedAt: newDate },
                {
                    onSuccess: () => {
                        completedCount++;
                        if (completedCount + errorCount === ids.length) {
                            if (errorCount === 0) {
                                toast.success(
                                    ids.length === 1
                                        ? 'Date updated'
                                        : `${ids.length} dates updated`
                                );
                            } else {
                                toast.error(
                                    `Failed to update ${errorCount} of ${ids.length} items`
                                );
                            }
                            setSelectedIds(new Set());
                        }
                    },
                    onError: () => {
                        errorCount++;
                        if (completedCount + errorCount === ids.length) {
                            toast.error(
                                `Failed to update ${errorCount} of ${ids.length} items`
                            );
                            setSelectedIds(new Set());
                        }
                    },
                }
            );
        });
    };

    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Only show empty state when data has been fetched and is truly empty
    if (activities.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        Complete some sets to see your activity log
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Group activities by date
    const groupedByDate = activities.reduce((acc, activity) => {
        const date = formatDate(activity.completedAt);
        if (!acc[date]) acc[date] = [];
        acc[date].push(activity);
        return acc;
    }, {} as Record<string, ActivityLogEntry[]>);

    return (
        <>
            <div className="space-y-4">
                {Object.entries(groupedByDate).map(([date, dayActivities]) => {
                    // Group consecutive exercises within each day
                    const groupedActivities = groupConsecutiveActivities(dayActivities);
                    const dayIds = dayActivities.map((a) => a._id);
                    const allDaySelected = dayIds.every((id) => selectedIds.has(id));
                    const someDaySelected = dayIds.some((id) => selectedIds.has(id));

                    const isDayInSelectionMode = isSelectionMode && selectionDay === date;

                    return (
                        <Card key={date} className="rounded-xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        {isDayInSelectionMode && (
                                            <Checkbox
                                                checked={allDaySelected}
                                                onCheckedChange={() => handleSelectDay(dayActivities)}
                                                className="flex-shrink-0"
                                                {...(someDaySelected && !allDaySelected ? { 'data-state': 'indeterminate' } : {})}
                                            />
                                        )}
                                        <Calendar className="h-4 w-4" />
                                        {date}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="text-primary font-semibold">
                                            {dayActivities.length} {dayActivities.length === 1 ? 'set' : 'sets'}
                                        </span>
                                        {!isSelectionMode && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenAddDialog(date)}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleEnableDaySelection(date)}>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Select
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {groupedActivities.map((group, index) => (
                                    <GroupedActivityItem
                                        key={`${group.exerciseName}-${group.firstTime}-${index}`}
                                        group={group}
                                        onDelete={handleDelete}
                                        isSelectionMode={isDayInSelectionMode}
                                        selectedIds={selectedIds}
                                        onSelect={handleSelect}
                                    />
                                ))}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Selection Action Bar */}
            {isSelectionMode && (
                <SelectionActionBar
                    selectedCount={selectedIds.size}
                    deletableCount={realSelectedIds.length}
                    onDelete={() => setIsDeleteDialogOpen(true)}
                    onDuplicate={handleDuplicate}
                    onEdit={() => setIsEditDialogOpen(true)}
                    onCancel={handleCancelSelection}
                    isDeleting={bulkDeleteMutation.isPending}
                    isDuplicating={duplicateActivityMutation.isPending}
                    isEditing={editActivityMutation.isPending}
                />
            )}

            {/* Edit Dialog */}
            <EditActivityDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                selectedIds={selectedIds}
                activities={activities}
                onSave={handleEditSave}
            />

            {/* Add Activity Dialog */}
            <AddActivityDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                initialDate={addDialogDate}
                onSave={handleAddSave}
                isLoading={addActivityMutation.isPending}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {realSelectedIds.length} {realSelectedIds.length === 1 ? 'set' : 'sets'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected {realSelectedIds.length === 1 ? 'set' : 'sets'}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
