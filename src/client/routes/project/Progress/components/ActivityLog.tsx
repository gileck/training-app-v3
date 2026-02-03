import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/template/ui/alert-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { Activity } from 'lucide-react';
import {
    useActivity,
    useDeleteActivity,
    useBulkDeleteActivity,
    useEditActivity,
    useDuplicateActivity,
    useAddActivity,
} from '../hooks';
import type { ActivityLogEntry } from '@/apis/activity-logs/types';
import type { DateRange } from '../store';
import { EditActivityDialog } from './EditActivityDialog';
import { AddActivityDialog } from './AddActivityDialog';
import { SelectionActionBar, ActivityDateSection, formatDate } from './ActivityLog/index';

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
                    const isDayInSelectionMode = isSelectionMode && selectionDay === date;

                    return (
                        <ActivityDateSection
                            key={date}
                            date={date}
                            dayActivities={dayActivities}
                            isSelectionMode={isSelectionMode}
                            isDayInSelectionMode={isDayInSelectionMode}
                            selectedIds={selectedIds}
                            onDelete={handleDelete}
                            onSelect={handleSelect}
                            onSelectDay={handleSelectDay}
                            onEnableSelection={handleEnableDaySelection}
                            onOpenAddDialog={handleOpenAddDialog}
                        />
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
