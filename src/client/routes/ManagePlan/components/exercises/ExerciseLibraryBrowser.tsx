import { useState, useEffect, useRef } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { Skeleton } from '@/client/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/ui/select';
import { Search, X, Filter, ListChecks, Sparkles, List, LayoutGrid } from 'lucide-react';
import { useManagePlanStore } from '../../store';
import type { FilterSource } from '../../store';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { MultiSelectExerciseConfig } from '../../types';
import { ExerciseLibraryGrid } from './ExerciseLibraryGrid';
import { ExerciseLibraryList } from './ExerciseLibraryList';
import { MultiSelectActionBar } from './MultiSelectActionBar';

interface ExerciseLibraryBrowserProps {
    exerciseLibrary: ExerciseDefinitionClient[];
    addedExerciseIds: Set<string>;
    isLoading: boolean;
    showCreateExerciseBanner: boolean;
    onDismissBanner: () => void;
    onCreateExercise: () => void;
    onSelectExercise: (exercise: ExerciseDefinitionClient) => void;
    onEditDef: (exercise: ExerciseDefinitionClient) => void;
    onDeleteDef: (exercise: ExerciseDefinitionClient) => void;
    selectedExercises: Map<string, MultiSelectExerciseConfig>;
    onToggleMultiSelect: (exercise: ExerciseDefinitionClient) => void;
    onShowMultiConfig: () => void;
    onCancelMultiSelect: () => void;
}

const INITIAL_VISIBLE_COUNT = 50;
const LOAD_MORE_COUNT = 50;

export function ExerciseLibraryBrowser({
    exerciseLibrary,
    addedExerciseIds,
    isLoading,
    showCreateExerciseBanner,
    onDismissBanner,
    onCreateExercise,
    onSelectExercise,
    onEditDef,
    onDeleteDef,
    selectedExercises,
    onToggleMultiSelect,
    onShowMultiConfig,
    onCancelMultiSelect,
}: ExerciseLibraryBrowserProps) {
    // Persistent UI state from store
    const filterMuscle = useManagePlanStore((state) => state.filterMuscle);
    const setFilterMuscle = useManagePlanStore((state) => state.setFilterMuscle);
    const filterType = useManagePlanStore((state) => state.filterType);
    const setFilterType = useManagePlanStore((state) => state.setFilterType);
    const filterSource = useManagePlanStore((state) => state.filterSource);
    const setFilterSource = useManagePlanStore((state) => state.setFilterSource);
    const exerciseViewMode = useManagePlanStore((state) => state.exerciseViewMode);
    const setExerciseViewMode = useManagePlanStore((state) => state.setExerciseViewMode);

    // Local ephemeral state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral search filter
    const [searchQuery, setSearchQuery] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral filter UI state
    const [showFilters, setShowFilters] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral multi-select mode
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral pagination state
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

    const loadMoreRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Get unique muscle groups and exercise types for filters
    const uniqueMuscles = [...new Set(exerciseLibrary.map((ex) => ex.primaryMuscle).filter(Boolean))].sort();
    const uniqueTypes = [...new Set(exerciseLibrary.map((ex) => ex.type).filter(Boolean))].sort();

    // Filter and sort library
    const filteredLibrary = exerciseLibrary.filter((ex) => {
        if (filterSource === 'system' && !ex.isSystem) return false;
        if (filterSource === 'custom' && ex.isSystem) return false;
        if (filterMuscle !== 'all' && ex.primaryMuscle !== filterMuscle) return false;
        if (filterType !== 'all' && ex.type !== filterType) return false;
        if (searchQuery) {
            const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
            const exerciseName = ex.name.toLowerCase();
            const allWordsMatch = searchWords.every((word) => exerciseName.includes(word));
            if (!allWordsMatch) return false;
        }
        return true;
    });

    // Sort: exercises not in plan first, then alphabetically
    const sortedFilteredLibrary = [...filteredLibrary].sort((a, b) => {
        const aInPlan = addedExerciseIds.has(a._id);
        const bInPlan = addedExerciseIds.has(b._id);
        if (aInPlan !== bInPlan) return aInPlan ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    // Reset visible count when search or filters change
    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_COUNT);
    }, [searchQuery, filterMuscle, filterType, filterSource]);

    // Slice exercises to only show visible count
    const visibleExercises = sortedFilteredLibrary.slice(0, visibleCount);
    const hasMoreExercises = visibleCount < sortedFilteredLibrary.length;

    // Intersection observer for infinite scroll
    useEffect(() => {
        if (!hasMoreExercises) return;

        const currentRef = loadMoreRef.current;
        const scrollContainer = scrollContainerRef.current;
        if (!currentRef || !scrollContainer) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => prev + LOAD_MORE_COUNT);
                }
            },
            {
                root: scrollContainer,
                rootMargin: '400px',
            }
        );

        observer.observe(currentRef);

        return () => {
            observer.disconnect();
        };
    }, [hasMoreExercises, visibleCount]);

    const hasActiveFilters = filterMuscle !== 'all' || filterType !== 'all' || filterSource !== 'all';
    const selectedExerciseIds = new Set(selectedExercises.keys());

    const handleToggleMultiSelectMode = () => {
        setIsMultiSelectMode(!isMultiSelectMode);
        if (isMultiSelectMode) {
            onCancelMultiSelect();
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col px-5 py-4">
            {/* Create Custom Exercise - Compact */}
            {showCreateExerciseBanner && (
                <div className="relative mb-3">
                    <button
                        onClick={onCreateExercise}
                        className="w-full p-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center gap-2.5 group"
                    >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground">Create Custom Exercise</p>
                            <p className="text-xs text-muted-foreground truncate">Add your own exercise to the library</p>
                        </div>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismissBanner();
                        }}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                </div>
            )}

            {/* Search and Filter Row */}
            <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search exercises..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-9 rounded-xl h-10"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                    )}
                </div>
                <Button
                    variant={showFilters || hasActiveFilters ? 'secondary' : 'outline'}
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    className="rounded-xl h-10 w-10 shrink-0 relative"
                >
                    <Filter className="h-4 w-4" />
                    {hasActiveFilters && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                    )}
                </Button>
            </div>

            {/* Filters Dialog */}
            <Dialog open={showFilters} onOpenChange={setShowFilters}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Filter Exercises</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Source</Label>
                            <Select value={filterSource} onValueChange={(v) => setFilterSource(v as FilterSource)}>
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
                            <Select value={filterMuscle} onValueChange={setFilterMuscle}>
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
                            <Select value={filterType} onValueChange={setFilterType}>
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
                                onClick={() => { setFilterMuscle('all'); setFilterType('all'); setFilterSource('all'); }}
                                className="flex-1"
                            >
                                Clear Filters
                            </Button>
                        )}
                        <Button
                            onClick={() => setShowFilters(false)}
                            className="flex-1"
                        >
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                    <span className="font-medium">Filters:</span>
                    <span>
                        {[
                            filterSource === 'system' ? 'Library' : filterSource === 'custom' ? 'Custom' : null,
                            filterMuscle !== 'all' ? filterMuscle : null,
                            filterType !== 'all' ? filterType : null
                        ].filter(Boolean).join(' • ')}
                    </span>
                    <button
                        onClick={() => { setFilterSource('all'); setFilterMuscle('all'); setFilterType('all'); }}
                        className="h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                        aria-label="Clear filters"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Multi-select toggle and view mode */}
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                    {sortedFilteredLibrary.length} exercise{sortedFilteredLibrary.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center rounded-lg bg-muted p-0.5">
                        <button
                            onClick={() => setExerciseViewMode('list')}
                            className={`p-1.5 rounded-md transition-colors ${
                                exerciseViewMode === 'list'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            aria-label="List view"
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setExerciseViewMode('grid')}
                            className={`p-1.5 rounded-md transition-colors ${
                                exerciseViewMode === 'grid'
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
                        onClick={handleToggleMultiSelectMode}
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

            {/* Exercise List */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto -mx-5 px-5">
                {isLoading ? (
                    exerciseViewMode === 'grid' ? (
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
                    )
                ) : sortedFilteredLibrary.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        {searchQuery || hasActiveFilters
                            ? 'No exercises match your filters'
                            : 'No exercises found'}
                    </div>
                ) : exerciseViewMode === 'grid' ? (
                    <ExerciseLibraryGrid
                        exercises={visibleExercises}
                        addedExerciseIds={addedExerciseIds}
                        selectedExerciseIds={selectedExerciseIds}
                        isMultiSelectMode={isMultiSelectMode}
                        onSelect={onSelectExercise}
                        onMultiSelect={onToggleMultiSelect}
                        onEditDef={onEditDef}
                        onDeleteDef={onDeleteDef}
                    />
                ) : (
                    <ExerciseLibraryList
                        exercises={visibleExercises}
                        addedExerciseIds={addedExerciseIds}
                        selectedExerciseIds={selectedExerciseIds}
                        isMultiSelectMode={isMultiSelectMode}
                        onSelect={onSelectExercise}
                        onMultiSelect={onToggleMultiSelect}
                        onEditDef={onEditDef}
                        onDeleteDef={onDeleteDef}
                    />
                )}
                {/* Load more trigger for infinite scroll */}
                {hasMoreExercises && (
                    <div
                        ref={loadMoreRef}
                        className="flex justify-center py-4"
                    >
                        <span className="text-sm text-muted-foreground">
                            Loading more exercises...
                        </span>
                    </div>
                )}
            </div>

            {/* Multi-select action bar */}
            {isMultiSelectMode && selectedExercises.size > 0 && (
                <MultiSelectActionBar
                    selectedCount={selectedExercises.size}
                    onCancel={() => {
                        setIsMultiSelectMode(false);
                        onCancelMultiSelect();
                    }}
                    onConfigure={onShowMultiConfig}
                />
            )}
        </div>
    );
}
