import { useState, useEffect, useRef } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { Filter } from 'lucide-react';
import { useManagePlanStore } from '../../store';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import type { MultiSelectExerciseConfig } from '../../types';
import { MultiSelectActionBar } from './MultiSelectActionBar';
import {
    CreateExerciseBanner,
    ExerciseSearchBar,
    ExerciseFilterDialog,
    ActiveFiltersBar,
    ExerciseViewControls,
    ExerciseListContainer,
} from './ExerciseLibrary';

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

    const handleClearFilters = () => {
        setFilterSource('all');
        setFilterMuscle('all');
        setFilterType('all');
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col px-5 py-4">
            {/* Create Custom Exercise Banner */}
            {showCreateExerciseBanner && (
                <CreateExerciseBanner
                    onCreateClick={onCreateExercise}
                    onDismiss={onDismissBanner}
                />
            )}

            {/* Search and Filter Row */}
            <div className="flex gap-2 mb-3">
                <ExerciseSearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                />
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
            <ExerciseFilterDialog
                open={showFilters}
                onOpenChange={setShowFilters}
                filterSource={filterSource}
                filterMuscle={filterMuscle}
                filterType={filterType}
                uniqueMuscles={uniqueMuscles}
                uniqueTypes={uniqueTypes}
                onFilterSourceChange={setFilterSource}
                onFilterMuscleChange={setFilterMuscle}
                onFilterTypeChange={setFilterType}
                hasActiveFilters={hasActiveFilters}
            />

            {/* Active Filters Summary */}
            <ActiveFiltersBar
                filterSource={filterSource}
                filterMuscle={filterMuscle}
                filterType={filterType}
                onClearFilters={handleClearFilters}
            />

            {/* Multi-select toggle and view mode */}
            <ExerciseViewControls
                viewMode={exerciseViewMode}
                onViewModeChange={setExerciseViewMode}
                isMultiSelectMode={isMultiSelectMode}
                onToggleMultiSelect={handleToggleMultiSelectMode}
                totalExercises={sortedFilteredLibrary.length}
            />

            {/* Exercise List */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto -mx-5 px-5">
                <ExerciseListContainer
                    isLoading={isLoading}
                    exercises={visibleExercises}
                    addedExerciseIds={addedExerciseIds}
                    selectedExerciseIds={selectedExerciseIds}
                    isMultiSelectMode={isMultiSelectMode}
                    viewMode={exerciseViewMode}
                    searchQuery={searchQuery}
                    hasActiveFilters={hasActiveFilters}
                    onSelect={onSelectExercise}
                    onMultiSelect={onToggleMultiSelect}
                    onEditDef={onEditDef}
                    onDeleteDef={onDeleteDef}
                />
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
