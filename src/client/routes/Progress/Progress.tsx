import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Button } from '@/client/components/ui/button';
import { Checkbox } from '@/client/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/ui/dialog';
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
    TrendingUp,
    Dumbbell,
    BarChart3,
    ChevronDown,
    ChevronRight,
    Trash2,
    RefreshCw,
    Copy,
    Pencil,
    X,
    Check,
    Loader2,
    MoreVertical,
    Plus,
    Minus,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    useActivity,
    useActivitySummary,
    useDeleteActivity,
    useBulkDeleteActivity,
    useEditActivity,
    useDuplicateActivity,
    useAddActivity,
} from './hooks';
import { useProgressStore } from './store';
import type { DateRange, ProgressTab } from './store';
import type { ActivityLogEntry, DailySummary } from '@/apis/activity-logs/types';
import { listPlanExercises } from '@/apis/plan-exercises/client';
import { usePlans } from '@/client/features/workout/hooks';
import { useActivePlanId } from '@/client/features/workout/store';
import { useIsSessionActive } from '@/client/features/workout';
import { useQueryDefaults } from '@/client/query/defaults';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';

const dateRangeLabels: Record<DateRange, string> = {
    '7days': 'Last 7 days',
    '14days': 'Last 14 days',
    '30days': 'Last 30 days',
    '90days': 'Last 90 days',
    'all': 'All time',
};

function getDateRange(range: DateRange): { startDate?: string; endDate?: string } {
    if (range === 'all') return {};
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '7days':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '14days':
            startDate.setDate(startDate.getDate() - 14);
            break;
        case '30days':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '90days':
            startDate.setDate(startDate.getDate() - 90);
            break;
    }
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
}

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
                    // eslint-disable-next-line @next/next/no-img-element
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
                        // eslint-disable-next-line @next/next/no-img-element
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

function DaySummaryCard({ summary }: { summary: DailySummary }) {
    return (
        <Card className="rounded-xl">
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="font-semibold">{formatDate(summary.date)}</p>
                        <p className="text-sm text-muted-foreground">
                            {summary.totalExercises} exercise{summary.totalExercises !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{summary.totalSets}</p>
                        <p className="text-sm text-muted-foreground">sets</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1">
                    {summary.muscleGroups.map((muscle) => (
                        <Badge
                            key={muscle}
                            variant="outline"
                            className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)] dark:border-[hsl(210,100%,30%)] text-xs"
                        >
                            {muscle}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function DateTimePicker({
    selectedDate,
    onDateChange,
}: {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
}) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const handleDayClick = (day: number) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(viewMonth.getFullYear());
        newDate.setMonth(viewMonth.getMonth());
        newDate.setDate(day);
        onDateChange(newDate);
    };

    const handleQuickDate = (date: Date) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(date.getFullYear());
        newDate.setMonth(date.getMonth());
        newDate.setDate(date.getDate());
        onDateChange(newDate);
        setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    };

    const handleHourChange = (hour: number) => {
        const newDate = new Date(selectedDate);
        newDate.setHours(hour);
        onDateChange(newDate);
    };

    const handleMinuteChange = (minute: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMinutes(minute);
        onDateChange(newDate);
    };

    const prevMonth = () => {
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    };

    const isToday = (day: number) => {
        return today.getDate() === day &&
               today.getMonth() === viewMonth.getMonth() &&
               today.getFullYear() === viewMonth.getFullYear();
    };

    const isSelected = (day: number) => {
        return selectedDate.getDate() === day &&
               selectedDate.getMonth() === viewMonth.getMonth() &&
               selectedDate.getFullYear() === viewMonth.getFullYear();
    };

    const formatSelectedDate = () => {
        const isSelectedToday = selectedDate.toDateString() === today.toDateString();
        const isSelectedYesterday = selectedDate.toDateString() === yesterday.toDateString();

        if (isSelectedToday) return 'Today';
        if (isSelectedYesterday) return 'Yesterday';

        return selectedDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatSelectedTime = () => {
        return selectedDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Generate calendar grid
    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    return (
        <div className="space-y-4">
            {/* Tab Switcher */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl">
                <button
                    onClick={() => setActiveTab('date')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                        activeTab === 'date'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatSelectedDate()}</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('time')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                        activeTab === 'time'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <span>{formatSelectedTime()}</span>
                </button>
            </div>

            {/* Date Picker */}
            {activeTab === 'date' && (
                <div className="space-y-4">
                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleQuickDate(today)}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                                selectedDate.toDateString() === today.toDateString()
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => handleQuickDate(yesterday)}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                                selectedDate.toDateString() === yesterday.toDateString()
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                        >
                            Yesterday
                        </button>
                    </div>

                    {/* Month Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={prevMonth}
                            className="p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                            <ChevronRight className="h-5 w-5 rotate-180" />
                        </button>
                        <span className="font-semibold text-foreground">
                            {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Day Headers */}
                        {dayNames.map((day) => (
                            <div key={day} className="h-10 flex items-center justify-center text-xs font-medium text-muted-foreground">
                                {day}
                            </div>
                        ))}

                        {/* Calendar Days */}
                        {calendarDays.map((day, index) => (
                            <div key={index} className="aspect-square">
                                {day !== null && (
                                    <button
                                        onClick={() => handleDayClick(day)}
                                        className={`w-full h-full rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                                            isSelected(day)
                                                ? 'bg-primary text-primary-foreground shadow-md'
                                                : isToday(day)
                                                ? 'bg-accent text-accent-foreground ring-2 ring-primary/30'
                                                : 'hover:bg-accent text-foreground'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Time Picker */}
            {activeTab === 'time' && (
                <div className="py-4">
                    <div className="flex items-center justify-center gap-4">
                        {/* Hour Picker */}
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground mb-2 font-medium">Hour</span>
                            <div className="relative h-[180px] w-16 overflow-hidden rounded-xl bg-muted">
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 border-y border-primary/20 pointer-events-none z-10" />
                                <div
                                    className="absolute inset-0 overflow-y-auto scrollbar-hide py-[66px]"
                                    style={{ scrollSnapType: 'y mandatory' }}
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleHourChange(i)}
                                            className={`w-full h-12 flex items-center justify-center text-lg font-semibold transition-all duration-150 ${
                                                selectedDate.getHours() === i
                                                    ? 'text-primary scale-110'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                            style={{ scrollSnapAlign: 'center' }}
                                        >
                                            {i.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Separator */}
                        <span className="text-3xl font-bold text-muted-foreground mt-6">:</span>

                        {/* Minute Picker */}
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground mb-2 font-medium">Minute</span>
                            <div className="relative h-[180px] w-16 overflow-hidden rounded-xl bg-muted">
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 border-y border-primary/20 pointer-events-none z-10" />
                                <div
                                    className="absolute inset-0 overflow-y-auto scrollbar-hide py-[66px]"
                                    style={{ scrollSnapType: 'y mandatory' }}
                                >
                                    {Array.from({ length: 60 }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleMinuteChange(i)}
                                            className={`w-full h-12 flex items-center justify-center text-lg font-semibold transition-all duration-150 ${
                                                selectedDate.getMinutes() === i
                                                    ? 'text-primary scale-110'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                            style={{ scrollSnapAlign: 'center' }}
                                        >
                                            {i.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Current Selection Display */}
                    <div className="mt-6 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                            <span className="text-sm font-medium">
                                {formatSelectedDate()} at {formatSelectedTime()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditActivityDialog({
    open,
    onOpenChange,
    selectedIds,
    activities,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedIds: Set<string>;
    activities: ActivityLogEntry[];
    onSave: (date: string) => void;
}) {
    // Get the first selected activity to pre-populate date
    const selectedActivities = activities.filter((a) => selectedIds.has(a._id));
    const firstSelected = selectedActivities[0];

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [selectedDate, setSelectedDate] = useState(() => {
        if (firstSelected) {
            return new Date(firstSelected.completedAt);
        }
        return new Date();
    });

    const handleSave = () => {
        onSave(selectedDate.toISOString());
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Date & Time</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <DateTimePicker
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                    />
                    <p className="text-sm text-muted-foreground text-center mt-4">
                        {selectedIds.size === 1
                            ? 'This will update the completion time for the selected set.'
                            : `This will update the completion time for ${selectedIds.size} selected sets.`}
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddActivityDialog({
    open,
    onOpenChange,
    initialDate,
    onSave,
    isLoading,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialDate: Date;
    onSave: (planExerciseId: string, completedAt: string, numberOfSets: number) => void;
    isLoading?: boolean;
}) {
    const activePlanId = useActivePlanId();
    const { data: plansData } = usePlans();
    const queryDefaults = useQueryDefaults();

    // Fetch exercises for the active plan
    const { data: exercisesData, isLoading: exercisesLoading } = useQuery({
        queryKey: ['plan-exercises', activePlanId],
        queryFn: async () => {
            if (!activePlanId) throw new Error('No active plan');
            const response = await listPlanExercises({ planId: activePlanId });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: !!activePlanId && open,
        ...queryDefaults,
    });

    const exercises = exercisesData?.exercises || [];
    const activePlan = plansData?.plans?.find((p) => p._id === activePlanId);

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [numberOfSets, setNumberOfSets] = useState(1);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [selectedDate, setSelectedDate] = useState(initialDate);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [showTimePicker, setShowTimePicker] = useState(false);

    const selectedExercise = exercises.find((e) => e._id === selectedExerciseId);

    const handleSave = () => {
        if (selectedExerciseId) {
            onSave(selectedExerciseId, selectedDate.toISOString(), numberOfSets);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    if (!activePlanId) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Exercise</DialogTitle>
                    </DialogHeader>
                    <div className="py-8 text-center">
                        <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            No training plan selected. Please select a plan first.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Exercise</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {/* Plan Name */}
                    {activePlan && (
                        <div className="text-sm text-muted-foreground">
                            Adding to: <span className="font-medium text-foreground">{activePlan.name}</span>
                        </div>
                    )}

                    {/* Time Selection */}
                    {!showTimePicker ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Time</label>
                            <button
                                onClick={() => setShowTimePicker(true)}
                                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                            >
                                <span className="text-foreground">{formatTime(selectedDate)}</span>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Time</label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowTimePicker(false)}
                                >
                                    Done
                                </Button>
                            </div>
                            <DateTimePicker
                                selectedDate={selectedDate}
                                onDateChange={setSelectedDate}
                            />
                        </div>
                    )}

                    {/* Exercise Selection */}
                    {!showTimePicker && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Exercise</label>
                                {exercisesLoading ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3].map((i) => (
                                            <Skeleton key={i} className="h-14 w-full rounded-lg" />
                                        ))}
                                    </div>
                                ) : exercises.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        No exercises in this plan
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {exercises.map((exercise) => (
                                            <button
                                                key={exercise._id}
                                                onClick={() => setSelectedExerciseId(exercise._id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                                                    selectedExerciseId === exercise._id
                                                        ? 'bg-primary/10 ring-2 ring-primary'
                                                        : 'bg-muted hover:bg-accent'
                                                }`}
                                            >
                                                {exercise.exerciseDef.imageUrl ? (
                                                    <img
                                                        src={exercise.exerciseDef.imageUrl}
                                                        alt={exercise.exerciseDef.name}
                                                        className="w-10 h-10 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <Dumbbell className="h-5 w-5 text-primary" />
                                                    </div>
                                                )}
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium text-sm">
                                                        {exercise.exerciseDef.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {exercise.sets} sets × {exercise.reps} reps
                                                    </div>
                                                </div>
                                                {selectedExerciseId === exercise._id && (
                                                    <Check className="h-5 w-5 text-primary" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Number of Sets */}
                            {selectedExercise && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Number of Sets</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setNumberOfSets(Math.max(1, numberOfSets - 1))}
                                            disabled={numberOfSets <= 1}
                                            className="h-12 w-12 rounded-xl"
                                        >
                                            <Minus className="h-5 w-5" />
                                        </Button>
                                        <div className="flex flex-col items-center">
                                            <span className="text-3xl font-bold text-primary">
                                                {numberOfSets}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {numberOfSets === 1 ? 'set' : 'sets'}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setNumberOfSets(Math.min(20, numberOfSets + 1))}
                                            disabled={numberOfSets >= 20}
                                            className="h-12 w-12 rounded-xl"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!selectedExerciseId || isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Add {numberOfSets} {numberOfSets === 1 ? 'Set' : 'Sets'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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

function ActivityLog({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivity({ limit: 50, startDate, endDate });
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

function DailySummaries({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivitySummary({ period: 'day', startDate, endDate });
    const summaries = data?.summaries || [];

    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-xl">
                        <CardContent className="p-4">
                            <div className="flex justify-between mb-3">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                                <Skeleton className="h-10 w-10" />
                            </div>
                            <div className="flex gap-1">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // Only show empty state when data has been fetched and is truly empty
    if (summaries.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No data yet</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        Complete some workouts to see your progress
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {summaries.map((summary) => (
                <DaySummaryCard key={summary.date} summary={summary} />
            ))}
        </div>
    );
}

function StatsOverview({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivitySummary({ period: 'day', startDate, endDate });

    const totalSets = data?.totalSets ?? 0;
    const totalDays = data?.totalWorkoutDays ?? 0;
    const hasData = data !== undefined;

    // Show skeleton when loading
    if (!hasData || isLoading) {
        return (
            <div className="grid grid-cols-2 gap-3 mb-6">
                <Card className="rounded-xl">
                    <CardContent className="p-4 text-center">
                        <Skeleton className="h-9 w-12 mx-auto mb-1" />
                        <Skeleton className="h-4 w-20 mx-auto" />
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4 text-center">
                        <Skeleton className="h-9 w-12 mx-auto mb-1" />
                        <Skeleton className="h-4 w-24 mx-auto" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{totalSets}</p>
                    <p className="text-sm text-muted-foreground">Total Sets</p>
                </CardContent>
            </Card>
            <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{totalDays}</p>
                    <p className="text-sm text-muted-foreground">Workout Days</p>
                </CardContent>
            </Card>
        </div>
    );
}

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ProgressCharts({ dateRange }: { dateRange: DateRange }) {
    const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);
    const { data, isLoading } = useActivitySummary({ period: 'day', startDate, endDate });
    const summaries = data?.summaries || [];

    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return (
            <div className="space-y-4">
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <Skeleton className="h-5 w-32 mb-4" />
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Only show empty state when data has been fetched and is truly empty
    if (summaries.length === 0) {
        return (
            <Card className="rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No data for charts</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        Complete some workouts to see your progress visualized
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Prepare chart data - last 14 days
    const chartData = summaries.slice(0, 14).reverse().map((summary) => ({
        date: formatShortDate(summary.date),
        sets: summary.totalSets,
        exercises: summary.totalExercises,
    }));

    // Calculate muscle group frequency
    const muscleFrequency: Record<string, number> = {};
    summaries.forEach((summary) => {
        summary.muscleGroups.forEach((muscle) => {
            muscleFrequency[muscle] = (muscleFrequency[muscle] || 0) + 1;
        });
    });

    const muscleData = Object.entries(muscleFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([muscle, count]) => ({ muscle, count }));

    return (
        <div className="space-y-4">
            {/* Sets per day chart */}
            <Card className="rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Daily Sets (Last 14 Days)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                tickLine={{ stroke: 'hsl(var(--border))' }}
                            />
                            <YAxis 
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                tickLine={{ stroke: 'hsl(var(--border))' }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Bar 
                                dataKey="sets" 
                                fill="hsl(var(--primary))" 
                                radius={[4, 4, 0, 0]}
                                name="Sets"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Muscle groups chart */}
            {muscleData.length > 0 && (
                <Card className="rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Dumbbell className="h-4 w-4" />
                            Muscle Groups Trained
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={muscleData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis 
                                    type="number"
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    axisLine={{ stroke: 'hsl(var(--border))' }}
                                    tickLine={{ stroke: 'hsl(var(--border))' }}
                                />
                                <YAxis 
                                    type="category"
                                    dataKey="muscle" 
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    axisLine={{ stroke: 'hsl(var(--border))' }}
                                    tickLine={{ stroke: 'hsl(var(--border))' }}
                                    width={70}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Bar 
                                    dataKey="count" 
                                    fill="hsl(210, 100%, 50%)" 
                                    radius={[0, 4, 4, 0]}
                                    name="Days Trained"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function formatLastUpdated(date: Date | undefined): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Progress() {
    // Persistent UI state from store
    const activeTab = useProgressStore((state) => state.activeTab);
    const setActiveTab = useProgressStore((state) => state.setActiveTab);
    const dateRange = useProgressStore((state) => state.dateRange);
    const setDateRange = useProgressStore((state) => state.setDateRange);

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral refresh state
    const [isRefreshing, setIsRefreshing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral timestamp
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    
    const queryClient = useQueryClient();
    
    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Invalidate all activity-related queries to trigger refetch
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['activity'] }),
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] }),
        ]);
        setLastRefreshed(new Date());
        setIsRefreshing(false);
    };

    return (
        <div className="p-4 pb-20">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Progress
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Updated {formatLastUpdated(lastRefreshed)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-9 w-9 rounded-lg"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-lg">
                                <Calendar className="h-4 w-4 mr-2" />
                                {dateRangeLabels[dateRange]}
                                <ChevronDown className="h-4 w-4 ml-2" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {(Object.keys(dateRangeLabels) as DateRange[]).map((range) => (
                                <DropdownMenuItem
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={dateRange === range ? 'bg-accent' : ''}
                                >
                                    {dateRangeLabels[range]}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <StatsOverview dateRange={dateRange} />

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProgressTab)}>
                <TabsList className="w-full mb-4">
                    <TabsTrigger value="activity" className="flex-1">
                        <Activity className="h-4 w-4 mr-2" />
                        Activity
                    </TabsTrigger>
                    <TabsTrigger value="charts" className="flex-1">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Charts
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="flex-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        Summary
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-0">
                    <ActivityLog dateRange={dateRange} />
                </TabsContent>

                <TabsContent value="charts" className="mt-0">
                    <ProgressCharts dateRange={dateRange} />
                </TabsContent>

                <TabsContent value="summary" className="mt-0">
                    <DailySummaries dateRange={dateRange} />
                </TabsContent>
            </Tabs>
        </div>
    );
}


