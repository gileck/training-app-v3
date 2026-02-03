/**
 * Exercise View Controls (List/Grid + Multi-select)
 */

import { List, LayoutGrid, ListChecks } from 'lucide-react';

interface ExerciseViewControlsProps {
    viewMode: 'list' | 'grid';
    onViewModeChange: (mode: 'list' | 'grid') => void;
    isMultiSelectMode: boolean;
    onToggleMultiSelect: () => void;
    totalExercises: number;
}

export function ExerciseViewControls({
    viewMode,
    onViewModeChange,
    isMultiSelectMode,
    onToggleMultiSelect,
    totalExercises,
}: ExerciseViewControlsProps) {
    return (
        <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
                {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center rounded-lg bg-muted p-0.5">
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={`p-1.5 rounded-md transition-colors ${
                            viewMode === 'list'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        aria-label="List view"
                    >
                        <List className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={`p-1.5 rounded-md transition-colors ${
                            viewMode === 'grid'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        aria-label="Grid view"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                </div>
                {/* Multi-select toggle */}
                <button
                    onClick={onToggleMultiSelect}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isMultiSelectMode
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <ListChecks className="h-4 w-4" />
                    Multi-select
                </button>
            </div>
        </div>
    );
}
