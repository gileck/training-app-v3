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
    const { addSet, removeSet, completeAllSets } = useSetProgress(activePlanId, currentWeek);

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


    const handleAddSet = (exercise: ExerciseWeekProgressFromStore) => {
        if (exercise.setsCompleted >= exercise.targetSets) return;
        addSet(exercise.planExerciseId, exercise.targetSets);
    };

    const handleRemoveSet = (exercise: ExerciseWeekProgressFromStore) => {
        if (exercise.setsCompleted <= 0) return;
        removeSet(exercise.planExerciseId);
    };

    const handleCompleteAll = (exercise: ExerciseWeekProgressFromStore) => {
        completeAllSets(exercise.planExerciseId, exercise.targetSets, exercise.setsCompleted);
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
