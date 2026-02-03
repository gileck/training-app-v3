/**
 * Exercise Filter Dialog
 */

import { Button } from '@/client/components/template/ui/button';
import { Label } from '@/client/components/template/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/template/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/template/ui/select';
import type { FilterSource } from '../../../store';

interface ExerciseFilterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filterSource: FilterSource;
    filterMuscle: string;
    filterType: string;
    uniqueMuscles: string[];
    uniqueTypes: string[];
    onFilterSourceChange: (value: FilterSource) => void;
    onFilterMuscleChange: (value: string) => void;
    onFilterTypeChange: (value: string) => void;
    hasActiveFilters: boolean;
}

export function ExerciseFilterDialog({
    open,
    onOpenChange,
    filterSource,
    filterMuscle,
    filterType,
    uniqueMuscles,
    uniqueTypes,
    onFilterSourceChange,
    onFilterMuscleChange,
    onFilterTypeChange,
    hasActiveFilters,
}: ExerciseFilterDialogProps) {
    const handleClearFilters = () => {
        onFilterMuscleChange('all');
        onFilterTypeChange('all');
        onFilterSourceChange('all');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Filter Exercises</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label>Source</Label>
                        <Select value={filterSource} onValueChange={(v) => onFilterSourceChange(v as FilterSource)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="system">Library</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Muscle Group</Label>
                        <Select value={filterMuscle} onValueChange={onFilterMuscleChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Muscles" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[40vh]">
                                <SelectItem value="all">All Muscles</SelectItem>
                                {uniqueMuscles.map((muscle) => (
                                    <SelectItem key={muscle} value={muscle} className="truncate">
                                        {muscle}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Exercise Type</Label>
                        <Select value={filterType} onValueChange={onFilterTypeChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[40vh]">
                                <SelectItem value="all">All Types</SelectItem>
                                {uniqueTypes.map((type) => (
                                    <SelectItem key={type} value={type} className="truncate">
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="flex-row gap-2">
                    {hasActiveFilters && (
                        <Button
                            variant="outline"
                            onClick={handleClearFilters}
                            className="flex-1"
                        >
                            Clear Filters
                        </Button>
                    )}
                    <Button
                        onClick={() => onOpenChange(false)}
                        className="flex-1"
                    >
                        Apply
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
