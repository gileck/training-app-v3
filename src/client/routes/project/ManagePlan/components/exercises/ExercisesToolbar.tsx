/**
 * ExercisesTab Toolbar Component
 */

import { Button } from '@/client/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import { Plus, ArrowUpDown } from 'lucide-react';
import type { PlanExerciseGroupBy } from '../../store';

interface ExercisesToolbarProps {
    planExercisesCount: number;
    groupBy: PlanExerciseGroupBy;
    onGroupByChange: (value: PlanExerciseGroupBy) => void;
    isReorderMode: boolean;
    onToggleReorderMode: () => void;
    onAddClick: () => void;
    isGrouped: boolean;
}

export function ExercisesToolbar({
    planExercisesCount,
    groupBy,
    onGroupByChange,
    isReorderMode,
    onToggleReorderMode,
    onAddClick,
    isGrouped,
}: ExercisesToolbarProps) {
    return (
        <div className="flex gap-2 justify-between items-center">
            {/* Group By dropdown */}
            <div className="flex items-center gap-2">
                {planExercisesCount > 0 && (
                    <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as PlanExerciseGroupBy)}>
                        <SelectTrigger className="w-[140px] h-10 rounded-xl text-sm">
                            <SelectValue placeholder="Group by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">List All</SelectItem>
                            <SelectItem value="primaryMuscle">By Muscle</SelectItem>
                            <SelectItem value="type">By Type</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>
            {/* Add/Reorder buttons */}
            <div className="flex gap-2">
                {planExercisesCount > 1 && (
                    <Button
                        variant={isReorderMode ? 'secondary' : 'outline'}
                        size="icon"
                        onClick={onToggleReorderMode}
                        className="rounded-xl h-10 w-10"
                        disabled={isGrouped}
                    >
                        <ArrowUpDown className="h-4 w-4" />
                    </Button>
                )}
                <Button onClick={onAddClick} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Exercise
                </Button>
            </div>
        </div>
    );
}
