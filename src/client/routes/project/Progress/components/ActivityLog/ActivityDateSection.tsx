import { Card, CardHeader, CardTitle, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Checkbox } from '@/client/components/project/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import { Calendar, MoreVertical, Plus, Check } from 'lucide-react';
import type { ActivityLogEntry } from '@/apis/project/activity-logs/types';
import { GroupedActivityItem } from './GroupedActivityItem';
import { groupConsecutiveActivities } from './utils';

interface ActivityDateSectionProps {
    date: string;
    dayActivities: ActivityLogEntry[];
    isSelectionMode: boolean;
    isDayInSelectionMode: boolean;
    selectedIds: Set<string>;
    onDelete: (id: string) => void;
    onSelect: (id: string) => void;
    onSelectDay: (dayActivities: ActivityLogEntry[]) => void;
    onEnableSelection: (date: string) => void;
    onOpenAddDialog: (date: string) => void;
}

export function ActivityDateSection({
    date,
    dayActivities,
    isSelectionMode,
    isDayInSelectionMode,
    selectedIds,
    onDelete,
    onSelect,
    onSelectDay,
    onEnableSelection,
    onOpenAddDialog,
}: ActivityDateSectionProps) {
    const groupedActivities = groupConsecutiveActivities(dayActivities);
    const dayIds = dayActivities.map((a) => a._id);
    const allDaySelected = dayIds.every((id) => selectedIds.has(id));
    const someDaySelected = dayIds.some((id) => selectedIds.has(id));

    return (
        <Card className="rounded-xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        {isDayInSelectionMode && (
                            <Checkbox
                                checked={allDaySelected}
                                onCheckedChange={() => onSelectDay(dayActivities)}
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
                                    <DropdownMenuItem onClick={() => onOpenAddDialog(date)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEnableSelection(date)}>
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
                        onDelete={onDelete}
                        isSelectionMode={isDayInSelectionMode}
                        selectedIds={selectedIds}
                        onSelect={onSelect}
                    />
                ))}
            </CardContent>
        </Card>
    );
}
