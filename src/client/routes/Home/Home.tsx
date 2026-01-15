import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Dumbbell,
    Calendar,
    LayoutGrid,
    List,
    Settings2,
    ChevronDown,
    ChevronUp,
    Bookmark,
    Zap,
    X,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useRouter } from '../../router';
import {
    useWorkoutStore,
    useCurrentWeek,
    useActivePlanId,
    useViewMode,
    useActiveTab,
    useSyncActivePlan,
    // Selection mode
    useSelectedExerciseIds,
    useIsSelectionMode,
    useToggleSelection,
    useClearSelection,
    // Active workout session
    useStartSession,
    useSetPlanWorkoutId,
    useSetPlanWorkoutName,
    useIsSessionActive,
    // Expanded workout
    useExpandedWorkoutId,
    useSetExpandedWorkoutId,
} from '@/client/features/workout';
import type { WorkoutTab } from '@/client/features/workout';
import {
    useLoadPlan,
    useLoadWeekProgress,
    useWeekProgressFromStoreData,
    usePlanLoading,
    useSetProgress,
    useWeekWorkoutSets,
    type ExerciseWeekProgressFromStore,
} from '@/client/features/plan-data';
import { usePlanWorkouts } from '@/client/features/plan-workouts';
import { ExerciseDetails } from '@/client/components/ExerciseDetails/ExerciseDetails';
import { ExerciseCardGrid, ExerciseCardList, PlanWorkoutCard } from './components';

export function Home() {
    const { navigate } = useRouter();

    // Workout store state
    const currentWeek = useCurrentWeek();
    const activePlanId = useActivePlanId();
    const viewMode = useViewMode();
    const activeTab = useActiveTab();
    const setWeek = useWorkoutStore((state) => state.setWeek);
    const setViewMode = useWorkoutStore((state) => state.setViewMode);
    const setActiveTab = useWorkoutStore((state) => state.setActiveTab);

    // Sync active plan from server
    const { activePlan, plans, isLoading: plansLoading, plansData } = useSyncActivePlan();

    // Load plan data into store (local-first)
    useLoadPlan(activePlanId, currentWeek);
    useLoadWeekProgress(activePlanId, currentWeek);
    const storeLoading = usePlanLoading(activePlanId);

    // Week progress from store (local-first)
    const weekData = useWeekProgressFromStoreData(activePlanId, currentWeek);

    // Set progress actions (unified store + activity logging)
    const { addSet, removeSet } = useSetProgress(activePlanId, currentWeek);

    // Selection mode state
    const selectedExerciseIds = useSelectedExerciseIds();
    const isSelectionMode = useIsSelectionMode();
    const toggleSelection = useToggleSelection();
    const clearSelection = useClearSelection();

    // Active workout session
    const startSession = useStartSession();
    const setPlanWorkoutId = useSetPlanWorkoutId();
    const setPlanWorkoutName = useSetPlanWorkoutName();
    const isWorkoutActive = useIsSessionActive();

    // Plan workouts data (scoped to active plan)
    const { data: planWorkoutsData, isLoading: planWorkoutsLoading } = usePlanWorkouts(activePlanId);

    // Workout-specific sets for all workouts in the current week
    const weekWorkoutSets = useWeekWorkoutSets(activePlanId, currentWeek);

    // Detect mobile viewport (matches Tailwind's sm: breakpoint at 640px)
    // Used to position selection bar above the bottom navbar on mobile
    const isMobile = useMemo(() => {
        return typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false;
    }, []);
    const planWorkoutsList = planWorkoutsData?.workouts || [];

    // Expanded workout state (persisted in store)
    const expandedWorkoutId = useExpandedWorkoutId();
    const setExpandedWorkoutId = useSetExpandedWorkoutId();

    // Local UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [completedExpanded, setCompletedExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exerciseDetailsOpen, setExerciseDetailsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [selectedExerciseForDetails, setSelectedExerciseForDetails] = useState<ExerciseWeekProgressFromStore | null>(null);

    const exercises = weekData?.exercises || [];
    const incompleteExercises = exercises.filter((e) => !e.isDone);
    const completedExercises = exercises.filter((e) => e.isDone);

    const totalSets = weekData?.totalSets || 0;
    const completedSets = weekData?.completedSets || 0;
    const progressPercent = weekData?.progressPercent || 0;

    const handlePrevWeek = () => {
        if (currentWeek > 1) {
            setWeek(currentWeek - 1);
        }
    };

    const handleNextWeek = () => {
        if (activePlan && currentWeek < activePlan.durationWeeks) {
            setWeek(currentWeek + 1);
        }
    };

    // =========================================================================
    // AUTO-FILL SET ALLOCATION LOGIC
    // =========================================================================
    //
    // Strategy: When a user adds/removes sets from the Exercise Tab or an ad-hoc
    // workout (not a saved workout), we automatically assign sets to workouts
    // WITHOUT prompting the user.
    //
    // - ADDING SETS: Fill workouts in order (first → last) until each reaches
    //   its allocated capacity, then move to the next workout.
    //   Example: Exercise has 10 sets split into Workout A (5) and Workout B (5).
    //   First 5 sets go to Workout A, next 5 go to Workout B.
    //
    // - REMOVING SETS: Remove from last workout first (last → first), reversing
    //   the add order for intuitive LIFO behavior.
    //   Example: If Workout A has 5/5 and Workout B has 3/5, removing a set
    //   decrements Workout B first (to 2/5).
    //
    // - If exercise is not in any saved workout, workoutId is null and only
    //   the total weekly progress is updated (no per-workout tracking).
    //
    // =========================================================================

    /**
     * Find the first workout with remaining capacity for an exercise.
     * Used when ADDING sets - fills workouts in order (first to last).
     *
     * @returns workoutId of first workout with capacity, or null if:
     *   - Exercise is not in any saved workout
     *   - All workouts are already at full capacity
     */
    const getFirstWorkoutWithCapacity = (exerciseId: string): string | null => {
        // Step 1: Get all saved workouts that include this exercise
        const containingWorkouts = planWorkoutsList.filter((workout) =>
            workout.items.some((item) => item.planExerciseId === exerciseId)
        );

        // No workouts contain this exercise - return null (only total will be updated)
        if (containingWorkouts.length === 0) return null;

        // Step 2: Iterate through workouts in order to find first with capacity
        for (const workout of containingWorkouts) {
            const item = workout.items.find((i) => i.planExerciseId === exerciseId);
            if (!item) continue;

            // Get how many sets this workout should have for this exercise
            // item.sets = per-workout allocation (e.g., 5 sets for this workout)
            // Falls back to exercise's total weekly sets if no specific allocation
            const exercise = exercises.find((e) => e.planExerciseId === exerciseId);
            const allocatedSets = item.sets ?? exercise?.targetSets ?? 0;

            // Get how many sets have already been completed in THIS workout
            const completedInWorkout = weekWorkoutSets[workout._id]?.[exerciseId] ?? 0;

            // If there's room in this workout, assign the new set here
            if (completedInWorkout < allocatedSets) {
                return workout._id;
            }
            // Otherwise, continue to check the next workout
        }

        // All workouts are at capacity - return null (only total will be updated)
        return null;
    };

    /**
     * Find the last workout with completed sets for an exercise.
     * Used when REMOVING sets - removes from last workout first (LIFO order).
     *
     * @returns workoutId of last workout with sets, or null if:
     *   - Exercise is not in any saved workout
     *   - No workout has any completed sets for this exercise
     */
    const getLastWorkoutWithSets = (exerciseId: string): string | null => {
        // Step 1: Get all saved workouts that include this exercise
        const containingWorkouts = planWorkoutsList.filter((workout) =>
            workout.items.some((item) => item.planExerciseId === exerciseId)
        );

        // No workouts contain this exercise - return null (only total will be updated)
        if (containingWorkouts.length === 0) return null;

        // Step 2: Iterate through workouts in REVERSE order to find last with sets
        // This ensures LIFO behavior: last workout to receive sets loses them first
        for (let i = containingWorkouts.length - 1; i >= 0; i--) {
            const workout = containingWorkouts[i];
            const completedInWorkout = weekWorkoutSets[workout._id]?.[exerciseId] ?? 0;

            // If this workout has any completed sets, remove from here
            if (completedInWorkout > 0) {
                return workout._id;
            }
            // Otherwise, continue checking earlier workouts
        }

        // No workout has any sets to remove - return null (only total will be updated)
        return null;
    };

    /**
     * Handle adding a set from the Exercise Tab or ad-hoc workout.
     * Uses auto-fill logic to assign to the first workout with capacity.
     */
    const handleAddSet = (exercise: ExerciseWeekProgressFromStore) => {
        // Guard: Don't exceed the exercise's total weekly target
        if (exercise.setsCompleted >= exercise.targetSets) return;

        // Find the first workout with remaining capacity for this exercise
        // If null, the set will only be added to the total (not tracked per-workout)
        const workoutId = getFirstWorkoutWithCapacity(exercise.planExerciseId);

        // addSet updates both:
        // 1. Total weekly progress (weekProgress[week][exerciseId].setsCompleted)
        // 2. Per-workout progress if workoutId is provided (workoutSets[week][workoutId][exerciseId])
        addSet(exercise.planExerciseId, exercise.targetSets, workoutId ?? undefined);
    };

    /**
     * Handle removing a set from the Exercise Tab or ad-hoc workout.
     * Uses reverse order (LIFO) to remove from the last workout first.
     */
    const handleRemoveSet = (exercise: ExerciseWeekProgressFromStore) => {
        // Guard: Can't remove below zero
        if (exercise.setsCompleted <= 0) return;

        // Find the last workout that has sets for this exercise
        // If null, only the total will be decremented (not tracked per-workout)
        const workoutId = getLastWorkoutWithSets(exercise.planExerciseId);

        // removeSet updates both:
        // 1. Total weekly progress (weekProgress[week][exerciseId].setsCompleted)
        // 2. Per-workout progress if workoutId is provided (workoutSets[week][workoutId][exerciseId])
        removeSet(exercise.planExerciseId, workoutId ?? undefined);
    };

    /**
     * Handle completing all remaining sets for an exercise.
     * Uses the same auto-fill logic as handleAddSet to distribute sets across workouts.
     *
     * Note: We track allocations locally because React state won't update between
     * loop iterations (batched updates). This mirrors the auto-fill logic but
     * accounts for sets we're adding within this same call.
     */
    const handleCompleteAll = (exercise: ExerciseWeekProgressFromStore) => {
        const remainingSets = exercise.targetSets - exercise.setsCompleted;
        if (remainingSets <= 0) return;

        const exerciseId = exercise.planExerciseId;

        // Get workouts containing this exercise (same as getFirstWorkoutWithCapacity)
        const containingWorkouts = planWorkoutsList.filter((workout) =>
            workout.items.some((item) => item.planExerciseId === exerciseId)
        );

        // If exercise isn't in any workout, just add sets without workout tracking
        if (containingWorkouts.length === 0) {
            for (let i = 0; i < remainingSets; i++) {
                addSet(exerciseId, exercise.targetSets, undefined);
            }
            return;
        }

        // Track allocations locally to account for sets we're adding in this loop
        // (React state won't update between iterations due to batching)
        const localAllocations: Record<string, number> = {};
        for (const workout of containingWorkouts) {
            localAllocations[workout._id] = weekWorkoutSets[workout._id]?.[exerciseId] ?? 0;
        }

        // Distribute remaining sets across workouts using auto-fill logic
        for (let i = 0; i < remainingSets; i++) {
            // Find first workout with capacity (same logic as getFirstWorkoutWithCapacity)
            let targetWorkoutId: string | undefined;
            for (const workout of containingWorkouts) {
                const item = workout.items.find((it) => it.planExerciseId === exerciseId);
                if (!item) continue;

                const ex = exercises.find((e) => e.planExerciseId === exerciseId);
                const allocatedSets = item.sets ?? ex?.targetSets ?? 0;
                const completedInWorkout = localAllocations[workout._id];

                if (completedInWorkout < allocatedSets) {
                    targetWorkoutId = workout._id;
                    break;
                }
            }

            // Add the set
            addSet(exerciseId, exercise.targetSets, targetWorkoutId);

            // Update local tracking so next iteration knows about this allocation
            if (targetWorkoutId) {
                localAllocations[targetWorkoutId]++;
            }
        }
    };

    const handleOpenExerciseDetails = (exercise: ExerciseWeekProgressFromStore) => {
        setSelectedExerciseForDetails(exercise);
        setExerciseDetailsOpen(true);
    };

    const getMotivationalMessage = (percent: number) => {
        if (percent === 0) return "Let's get started! 💪";
        if (percent < 25) return 'Great start!';
        if (percent < 50) return 'Keep pushing!';
        if (percent < 75) return 'Halfway there! 🔥';
        if (percent < 100) return 'Almost done!';
        return 'Week complete! 🏆';
    };

    // Start workout with selected exercises
    // planWorkoutId/planWorkoutName are set when starting from a saved plan-workout
    const handleStartWorkout = (
        exercisesToStart?: ExerciseWeekProgressFromStore[],
        planWorkoutId?: string | null,
        planWorkoutName?: string | null
    ) => {
        const workoutExercises = exercisesToStart ||
            (selectedExerciseIds.length > 0
                ? exercises.filter((ex) => selectedExerciseIds.includes(ex.planExerciseId))
                : exercises);

        if (workoutExercises.length === 0) return;

        startSession(workoutExercises);
        setPlanWorkoutId(planWorkoutId || null);
        setPlanWorkoutName(planWorkoutName || null);
        clearSelection();
        navigate('/active-workout');
    };

    // =========================================================================
    // UNIFIED LOADING STATE
    // =========================================================================
    // Show ONE loading skeleton for ALL initial data fetching to avoid flicker.
    // This covers: plans loading, week progress loading, or any missing data.
    // Only proceed to content when we have ALL required data.
    
    const isInitialLoading = 
        // Plans haven't loaded yet
        (plansLoading || plansData === undefined) ||
        // Plans loaded with active plan, but store data hasn't loaded yet
        (activePlanId && activePlan && (storeLoading || weekData === null));

    if (isInitialLoading) {
        return (
            <div className="p-4 pb-20 space-y-4">
                {/* Week Navigator Skeleton */}
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="text-center space-y-2">
                                <Skeleton className="h-6 w-32 mx-auto" />
                                <Skeleton className="h-4 w-24 mx-auto" />
                            </div>
                            <Skeleton className="h-10 w-10 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-full rounded-full mb-2" />
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </CardContent>
                </Card>

                {/* Exercise Cards Skeleton */}
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-2xl border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex gap-4 mb-3">
                                <Skeleton className="h-20 w-20 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/4" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // No plan selected - only show AFTER we know plans have loaded (plansData is defined)
    if (!activePlanId || !activePlan) {
        return (
            <div className="p-4 pb-20 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            {plans.length === 0 ? 'No training plans' : 'No active plan'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            {plans.length === 0
                                ? 'Create a training plan to start tracking your workouts'
                                : 'Set a plan as active to start tracking'}
                        </p>
                        <Button onClick={() => navigate('/training-plans')}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {plans.length === 0 ? 'Create Plan' : 'View Plans'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 pb-20 space-y-4">
            {/* Week Navigator + Progress */}
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <CardContent className="relative p-4 space-y-4">
                    {/* Week Navigation */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevWeek}
                            disabled={currentWeek <= 1}
                            className="h-10 w-10 rounded-full"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="text-center">
                            <p className="text-xl font-bold tracking-tight">
                                WEEK {currentWeek} / {activePlan.durationWeeks}
                            </p>
                            <button
                                onClick={() => navigate(`/training-plans/${activePlan._id}`)}
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mx-auto"
                            >
                                {activePlan.name}
                                <Settings2 className="h-3 w-3" />
                            </button>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextWeek}
                            disabled={currentWeek >= activePlan.durationWeeks}
                            className="h-10 w-10 rounded-full"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Progress */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Weekly Progress</p>
                            <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${progressPercent >= 100
                                        ? 'bg-success'
                                        : 'bg-gradient-to-r from-primary to-primary/80'
                                    }`}
                                style={{ width: `${Math.min(progressPercent, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                            <p className="text-sm text-muted-foreground">
                                Sets: {completedSets}/{totalSets}
                            </p>
                            <p className="text-sm font-medium">{getMotivationalMessage(progressPercent)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkoutTab)} className="w-full">
                <div className="flex items-center justify-between gap-2">
                    <TabsList className="bg-muted p-1 rounded-xl flex-1">
                        <TabsTrigger value="exercises" className="flex-1 rounded-lg text-sm font-medium">
                            Exercises
                        </TabsTrigger>
                        <TabsTrigger value="workouts" className="flex-1 rounded-lg text-sm font-medium">
                            Workouts
                        </TabsTrigger>
                    </TabsList>

                    {/* View Toggle */}
                    <div className="bg-muted rounded-lg p-1 flex gap-1">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            className="h-8 w-8 p-0 rounded-md"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="h-8 w-8 p-0 rounded-md"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Exercises Tab Content */}
                <TabsContent value="exercises" className="mt-4 space-y-4">
                    {/* No exercises */}
                    {exercises.length === 0 && (
                        <Card className="rounded-2xl border-0 shadow-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No exercises in this plan</h3>
                                <p className="text-sm text-muted-foreground mb-4 text-center">
                                    Add exercises to start tracking your workouts
                                </p>
                                <Button onClick={() => navigate(`/training-plans/${activePlanId}`)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Exercises
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Incomplete Exercises */}
                    {incompleteExercises.length > 0 && (
                        <div className="space-y-3">
                            {incompleteExercises.map((exercise) =>
                                viewMode === 'grid' ? (
                                    <ExerciseCardGrid
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => handleAddSet(exercise)}
                                        onRemoveSet={() => handleRemoveSet(exercise)}
                                        onCompleteAll={() => handleCompleteAll(exercise)}
                                        onOpenDetails={() => handleOpenExerciseDetails(exercise)}
                                        isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                        onSelect={() => toggleSelection(exercise.planExerciseId)}
                                    />
                                ) : (
                                    <ExerciseCardList
                                        key={exercise.planExerciseId}
                                        exercise={exercise}
                                        onAddSet={() => handleAddSet(exercise)}
                                        onRemoveSet={() => handleRemoveSet(exercise)}
                                        onCompleteAll={() => handleCompleteAll(exercise)}
                                        onOpenDetails={() => handleOpenExerciseDetails(exercise)}
                                        isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                        onSelect={() => toggleSelection(exercise.planExerciseId)}
                                    />
                                )
                            )}
                        </div>
                    )}

                    {/* Completed Exercises Section */}
                    {completedExercises.length > 0 && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setCompletedExpanded(!completedExpanded)}
                                className="flex items-center justify-between w-full py-2 text-left"
                            >
                                <span className="text-sm font-medium text-muted-foreground">
                                    Completed Exercises ({completedExercises.length})
                                </span>
                                {completedExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </button>

                            {completedExpanded && (
                                <div className="space-y-3">
                                    {completedExercises.map((exercise) =>
                                        viewMode === 'grid' ? (
                                            <ExerciseCardGrid
                                                key={exercise.planExerciseId}
                                                exercise={exercise}
                                                onAddSet={() => handleAddSet(exercise)}
                                                onRemoveSet={() => handleRemoveSet(exercise)}
                                                onCompleteAll={() => { }}
                                                onOpenDetails={() => handleOpenExerciseDetails(exercise)}
                                                isComplete
                                                isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                                onSelect={() => toggleSelection(exercise.planExerciseId)}
                                            />
                                        ) : (
                                            <ExerciseCardList
                                                key={exercise.planExerciseId}
                                                exercise={exercise}
                                                onAddSet={() => handleAddSet(exercise)}
                                                onRemoveSet={() => handleRemoveSet(exercise)}
                                                onCompleteAll={() => { }}
                                                onOpenDetails={() => handleOpenExerciseDetails(exercise)}
                                                isComplete
                                                isSelected={selectedExerciseIds.includes(exercise.planExerciseId)}
                                                onSelect={() => toggleSelection(exercise.planExerciseId)}
                                            />
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Selection Bar - shows when exercises are selected */}
                {isSelectionMode && selectedExerciseIds.length > 0 && (
                    <div
                        className="fixed left-0 right-0 p-4 bg-card/95 backdrop-blur-lg border-t z-50"
                        style={{
                            // On mobile, position above the BottomNavBar which includes safe-area-inset-bottom
                            // BottomNavBar height: pt-1 (4px) + h-14 (56px) + paddingBottom (safe-area + 4px) = 64px + safe-area
                            // When FloatingWorkoutBar is active, add ~70px more to avoid overlap
                            // On desktop (≥640px), bottom nav is hidden, so use bottom: 0 (or 70px if workout active)
                            bottom: isMobile
                                ? isWorkoutActive
                                    ? 'calc(134px + env(safe-area-inset-bottom, 0px))'
                                    : 'calc(64px + env(safe-area-inset-bottom, 0px))'
                                : isWorkoutActive ? '70px' : 0,
                        }}
                    >
                        <div className="flex items-center gap-3 max-w-lg mx-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearSelection}
                                className="h-10 w-10 rounded-full"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                            <div className="flex-1">
                                <p className="text-sm font-medium">
                                    {selectedExerciseIds.length} exercise{selectedExerciseIds.length !== 1 ? 's' : ''} selected
                                </p>
                            </div>
                            <Button
                                onClick={() => handleStartWorkout()}
                                className="h-12 px-6 rounded-xl bg-success text-success-foreground shadow-lg shadow-success/30"
                            >
                                <Zap className="mr-2 h-5 w-5" />
                                Start Workout
                            </Button>
                        </div>
                    </div>
                )}

                {/* Workouts Tab Content */}
                <TabsContent value="workouts" className="mt-4 space-y-4">
                    {/* Create Workout Button */}
                    <Button
                        onClick={() => navigate(`/training-plans/${activePlanId}?tab=workouts`)}
                        variant="outline"
                        className="w-full h-12 rounded-xl"
                    >
                        <Settings2 className="mr-2 h-5 w-5" />
                        Manage Workouts
                    </Button>

                    {/* Loading State - show skeleton when loading without cached data */}
                    {(planWorkoutsLoading || planWorkoutsData === undefined) && (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <Card key={i} className="rounded-xl border-0 shadow-sm">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-2">
                                                <Skeleton className="h-5 w-32" />
                                                <Skeleton className="h-4 w-20" />
                                            </div>
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Empty State - only show when data loaded AND truly empty */}
                    {planWorkoutsData !== undefined && planWorkoutsList.length === 0 && (
                        <Card className="rounded-2xl border-0 shadow-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Saved Workouts</h3>
                                <p className="text-sm text-muted-foreground text-center mb-4">
                                    Create workouts from your exercises to quickly start sessions
                                </p>
                                <Button
                                    onClick={() => navigate(`/training-plans/${activePlanId}?tab=workouts`)}
                                    className="rounded-xl"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Workout
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Plan Workouts List */}
                    {planWorkoutsData !== undefined && planWorkoutsList.length > 0 && (
                        <div className="space-y-3">
                            {planWorkoutsList.map((workout) => (
                                <PlanWorkoutCard
                                    key={workout._id}
                                    workout={workout}
                                    exercises={exercises}
                                    workoutSets={weekWorkoutSets[workout._id] || {}}
                                    isExpanded={expandedWorkoutId === workout._id}
                                    onToggleExpand={() => setExpandedWorkoutId(
                                        expandedWorkoutId === workout._id ? null : workout._id
                                    )}
                                    onStart={() => {
                                        // Map plan workout items to exercises using week data
                                        const exerciseMap = new Map(
                                            exercises.map((ex) => [ex.planExerciseId, ex])
                                        );
                                        const workoutExercises: ExerciseWeekProgressFromStore[] = workout.items
                                            .map((item) => exerciseMap.get(item.planExerciseId))
                                            .filter((ex): ex is ExerciseWeekProgressFromStore => ex !== undefined);

                                        if (workoutExercises.length === 0) return;

                                        // Start from saved plan-workout: pass planWorkoutId and name
                                        handleStartWorkout(workoutExercises, workout._id, workout.name);
                                    }}
                                    onAddSet={handleAddSet}
                                    onRemoveSet={handleRemoveSet}
                                    onCompleteAll={handleCompleteAll}
                                    onOpenDetails={handleOpenExerciseDetails}
                                    selectedExerciseIds={selectedExerciseIds}
                                    onToggleSelection={toggleSelection}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Exercise Details Sheet */}
            <ExerciseDetails
                exercise={selectedExerciseForDetails?.exerciseDef || null}
                open={exerciseDetailsOpen}
                onOpenChange={setExerciseDetailsOpen}
                sets={selectedExerciseForDetails?.targetSets}
                reps={selectedExerciseForDetails?.planExercise.reps}
                weight={selectedExerciseForDetails?.planExercise.weight}
                durationSeconds={selectedExerciseForDetails?.planExercise.durationSeconds}
                comments={selectedExerciseForDetails?.planExercise.comments}
                planId={activePlanId || undefined}
                weekNumber={currentWeek}
            />
        </div>
    );
}
