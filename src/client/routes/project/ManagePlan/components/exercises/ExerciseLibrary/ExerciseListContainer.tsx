/**
 * Exercise List Container (Loading/Empty/Grid/List)
 */

import { Skeleton } from '@/client/components/template/ui/skeleton';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import { ExerciseLibraryGrid } from '../ExerciseLibraryGrid';
import { ExerciseLibraryList } from '../ExerciseLibraryList';

interface ExerciseListContainerProps {
    isLoading: boolean;
    exercises: ExerciseDefinitionClient[];
    addedExerciseIds: Set<string>;
    selectedExerciseIds: Set<string>;
    isMultiSelectMode: boolean;
    viewMode: 'list' | 'grid';
    searchQuery: string;
    hasActiveFilters: boolean;
    onSelect: (exercise: ExerciseDefinitionClient) => void;
    onMultiSelect: (exercise: ExerciseDefinitionClient) => void;
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
}

export function ExerciseListContainer({
    isLoading,
    exercises,
    addedExerciseIds,
    selectedExerciseIds,
    isMultiSelectMode,
    viewMode,
    searchQuery,
    hasActiveFilters,
    onSelect,
    onMultiSelect,
    onEditDef,
    onDeleteDef,
}: ExerciseListContainerProps) {
    if (isLoading) {
        return viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="rounded-xl bg-muted/50 overflow-hidden">
                        <Skeleton className="aspect-square w-full" />
                        <div className="p-3 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3">
                        <Skeleton className="h-14 w-14 rounded-lg" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (exercises.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                {searchQuery || hasActiveFilters
                    ? 'No exercises match your filters'
                    : 'No exercises found'}
            </div>
        );
    }

    if (viewMode === 'grid') {
        return (
            <ExerciseLibraryGrid
                exercises={exercises}
                addedExerciseIds={addedExerciseIds}
                selectedExerciseIds={selectedExerciseIds}
                isMultiSelectMode={isMultiSelectMode}
                onSelect={onSelect}
                onMultiSelect={onMultiSelect}
                onEditDef={onEditDef}
                onDeleteDef={onDeleteDef}
            />
        );
    }

    return (
        <ExerciseLibraryList
            exercises={exercises}
            addedExerciseIds={addedExerciseIds}
            selectedExerciseIds={selectedExerciseIds}
            isMultiSelectMode={isMultiSelectMode}
            onSelect={onSelect}
            onMultiSelect={onMultiSelect}
            onEditDef={onEditDef}
            onDeleteDef={onDeleteDef}
        />
    );
}
