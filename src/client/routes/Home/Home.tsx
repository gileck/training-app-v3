import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Minus,
    CheckCheck,
    Check,
    Info,
    Dumbbell,
    Calendar,
    LayoutGrid,
    List,
    Settings2,
    ChevronDown,
    ChevronUp,
    Play,
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
    usePlanDataStore,
    syncPlanToServer,
    usePlanLoading,
    type ExerciseWeekProgressFromStore,
} from '@/client/features/plan-data';
import { useAddActivity, useDeleteRecentActivity } from './hooks';
import { usePlanWorkouts } from '@/client/features/plan-workouts';
import type { PlanWorkoutClient } from '@/apis/plan-workouts/types';
import { ExerciseDetails } from '@/client/components/ExerciseDetails/ExerciseDetails';

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

    // Store actions for updating sets
    const incrementSet = usePlanDataStore((s) => s.incrementSet);
    const decrementSet = usePlanDataStore((s) => s.decrementSet);
    const completeAllSets = usePlanDataStore((s) => s.completeAllSets);

    // Activity log mutations
    const addActivityMutation = useAddActivity();
    const deleteRecentActivityMutation = useDeleteRecentActivity();

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
        if (!activePlanId || exercise.setsCompleted >= exercise.targetSets) return;

        // Update store (local-first)
        incrementSet(activePlanId, currentWeek, exercise.planExerciseId, exercise.targetSets);
        syncPlanToServer(activePlanId);

        // Create activity log
        addActivityMutation.mutate({
            planExerciseId: exercise.planExerciseId,
            completedAt: new Date().toISOString(),
            numberOfSets: 1,
        });
    };

    const handleRemoveSet = (exercise: ExerciseWeekProgressFromStore) => {
        if (!activePlanId || exercise.setsCompleted <= 0) return;

        // Update store (local-first)
        decrementSet(activePlanId, currentWeek, exercise.planExerciseId);
        syncPlanToServer(activePlanId);

        // Try to delete most recent activity log - ignore silently if none exists
        deleteRecentActivityMutation.mutate({
            planExerciseId: exercise.planExerciseId,
            date: new Date().toISOString().split('T')[0],
        });
    };

    const handleCompleteAll = (exercise: ExerciseWeekProgressFromStore) => {
        if (!activePlanId) return;

        const remaining = exercise.targetSets - exercise.setsCompleted;
        if (remaining > 0) {
            // Update store (local-first)
            completeAllSets(activePlanId, currentWeek, exercise.planExerciseId, exercise.targetSets);
            syncPlanToServer(activePlanId);

            // Create activity logs for remaining sets
            addActivityMutation.mutate({
                planExerciseId: exercise.planExerciseId,
                completedAt: new Date().toISOString(),
                numberOfSets: remaining,
            });
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

// Exercise Card Components
interface ExerciseCardProps {
    exercise: ExerciseWeekProgressFromStore;
    onAddSet: () => void;
    onRemoveSet: () => void;
    onCompleteAll: () => void;
    onOpenDetails: () => void;
    isComplete?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}

function ExerciseCardGrid({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    isComplete,
    isSelected,
    onSelect,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    const handleCardClick = (e: React.MouseEvent) => {
        // Only trigger selection if clicking the card background, not buttons
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect?.();
    };

    return (
        <Card
            onClick={handleCardClick}
            className={`rounded-2xl border-0 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isComplete ? 'border-2 border-success/50 bg-success/5' : ''
                } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <CardContent className="p-4">
                <div className="flex gap-4 mb-3">
                    {/* Image with completion/selection badge */}
                    <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden">
                        {exercise.exerciseDef.imageUrl ? (
                            <img
                                src={exercise.exerciseDef.imageUrl}
                                alt={exercise.exerciseDef.name}
                                className="w-full h-full object-contain"
                            />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {/* Selection badge (takes priority over completion badge) */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
                            </div>
                        )}
                        {/* Completion badge (only shows if not selected) */}
                        {isComplete && !isSelected && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-sm">
                                <Check className="h-4 w-4 text-success-foreground" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-lg truncate">{exercise.exerciseDef.name}</h3>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-full text-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDetails();
                                }}
                            >
                                <Info className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {exercise.planExercise.reps} reps
                            {exercise.planExercise.weight > 0 && ` • ${exercise.planExercise.weight}kg`}
                        </p>
                        <p className={`text-base font-semibold mt-1 ${isComplete ? 'text-success' : ''}`}>
                            Sets: {exercise.setsCompleted}/{exercise.targetSets}
                            {isComplete && ' ✓'}
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${isComplete
                                ? 'bg-success'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Badge
                        variant="outline"
                        className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                    >
                        {exercise.exerciseDef.primaryMuscle}
                    </Badge>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className="h-11 w-11 rounded-full border-2 active:scale-95 transition-transform"
                        >
                            <Minus className="h-5 w-5" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={onAddSet}
                            disabled={exercise.setsCompleted >= exercise.targetSets}
                            className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 active:scale-95 transition-transform"
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                        {!isComplete && (
                            <Button
                                size="icon"
                                onClick={onCompleteAll}
                                className="h-11 w-11 rounded-full bg-success shadow-lg shadow-success/30 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-6 w-6" />
                            </Button>
                        )}
                        {isComplete && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-full text-success border-2 border-success/50 bg-success/10"
                                disabled
                            >
                                <CheckCheck className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ExerciseCardList({
    exercise,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    isComplete,
    isSelected,
    onSelect,
}: ExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    const handleCardClick = (e: React.MouseEvent) => {
        // Only trigger selection if clicking the card background, not buttons
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect?.();
    };

    return (
        <Card
            onClick={handleCardClick}
            className={`rounded-xl border-0 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isComplete ? 'border-2 border-success/50 bg-success/5' : ''
                } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Image with completion/selection badge - clickable to open details */}
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenDetails();
                            }}
                            className="w-12 h-12 rounded-lg bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        >
                            {exercise.exerciseDef.imageUrl ? (
                                <img
                                    src={exercise.exerciseDef.imageUrl}
                                    alt={exercise.exerciseDef.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                        </button>
                        {/* Selection badge (takes priority) */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                            </div>
                        )}
                        {/* Completion badge (only if not selected) */}
                        {isComplete && !isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-success-foreground" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{exercise.exerciseDef.name}</h3>
                        <p className={`text-sm ${isComplete ? 'text-success' : 'text-muted-foreground'}`}>
                            {exercise.setsCompleted}/{exercise.targetSets} sets{isComplete && ' ✓'}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className={`h-9 w-9 rounded-full active:scale-95 transition-transform ${
                                isComplete ? 'text-destructive border-destructive/50 hover:bg-destructive/10' : ''
                            }`}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={onAddSet}
                            disabled={exercise.setsCompleted >= exercise.targetSets}
                            className="h-9 w-9 rounded-full active:scale-95 transition-transform"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        {!isComplete && (
                            <Button
                                size="icon"
                                onClick={onCompleteAll}
                                className="h-9 w-9 rounded-full bg-success hover:bg-success/90 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${isComplete
                                ? 'bg-success'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// Plan Workout Card Component
interface PlanWorkoutCardProps {
    workout: PlanWorkoutClient;
    exercises: ExerciseWeekProgressFromStore[];
    onStart: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    // Exercise action handlers
    onAddSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onRemoveSet: (exercise: ExerciseWeekProgressFromStore) => void;
    onCompleteAll: (exercise: ExerciseWeekProgressFromStore) => void;
    onOpenDetails: (exercise: ExerciseWeekProgressFromStore) => void;
    selectedExerciseIds: string[];
    onToggleSelection: (exerciseId: string) => void;
}

function PlanWorkoutCard({
    workout,
    exercises,
    onStart,
    isExpanded,
    onToggleExpand,
    onAddSet,
    onRemoveSet,
    onCompleteAll,
    onOpenDetails,
    selectedExerciseIds,
    onToggleSelection,
}: PlanWorkoutCardProps) {
    // Create a map for quick lookup of exercises by planExerciseId
    const exerciseMap = new Map(exercises.map((ex) => [ex.planExerciseId, ex]));

    // Resolve workout items to exercises with definitions
    const resolvedExercises = workout.items
        .map((item) => exerciseMap.get(item.planExerciseId))
        .filter((ex): ex is ExerciseWeekProgressFromStore => ex !== undefined);

    // Calculate workout progress
    const totalSets = resolvedExercises.reduce((sum, ex) => sum + ex.targetSets, 0);
    const completedSets = resolvedExercises.reduce((sum, ex) => sum + Math.min(ex.setsCompleted, ex.targetSets), 0);
    const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
    const isWorkoutComplete = totalSets > 0 && completedSets >= totalSets;

    return (
        <Card className={`rounded-xl border-0 shadow-sm overflow-hidden ${isWorkoutComplete ? 'ring-2 ring-success/50' : ''}`}>
            <CardContent className="p-0">
                {/* Header - clickable to expand */}
                <div
                    className="p-4 cursor-pointer active:bg-muted/50 transition-colors"
                    onClick={onToggleExpand}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base truncate">{workout.name}</h3>
                                    {isWorkoutComplete && (
                                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1 px-1.5 py-0 text-xs">
                                            <CheckCheck className="h-3 w-3" />
                                            Done
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{resolvedExercises.length} exercise{resolvedExercises.length !== 1 ? 's' : ''}</span>
                                    {totalSets > 0 && (
                                        <>
                                            <span className="text-muted-foreground/50">•</span>
                                            <span className={completedSets > 0 ? (isWorkoutComplete ? 'text-success' : 'text-primary') : ''}>
                                                {completedSets}/{totalSets} sets
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStart();
                            }}
                            disabled={resolvedExercises.length === 0}
                            className={`h-10 w-10 rounded-full shadow-lg ${
                                isWorkoutComplete
                                    ? 'bg-success text-success-foreground shadow-success/25'
                                    : 'bg-primary text-primary-foreground shadow-primary/25'
                            }`}
                        >
                            {isWorkoutComplete ? <CheckCheck className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>
                    </div>
                    {/* Progress bar */}
                    {totalSets > 0 && (
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    isWorkoutComplete
                                        ? 'bg-success'
                                        : 'bg-gradient-to-r from-primary to-primary/80'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Expandable exercise list - reuses ExerciseCardList for consistency */}
                {isExpanded && (
                    <div className="border-t bg-muted/30 p-3 space-y-2">
                        {resolvedExercises.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No exercises found (they may have been removed from the plan)
                            </div>
                        ) : (
                            resolvedExercises.map((ex) => {
                                const isExerciseDone = ex.isDone || ex.setsCompleted >= ex.targetSets;
                                return (
                                    <ExerciseCardList
                                        key={ex.planExerciseId}
                                        exercise={ex}
                                        onAddSet={() => onAddSet(ex)}
                                        onRemoveSet={() => onRemoveSet(ex)}
                                        onCompleteAll={() => onCompleteAll(ex)}
                                        onOpenDetails={() => onOpenDetails(ex)}
                                        isComplete={isExerciseDone}
                                        isSelected={selectedExerciseIds.includes(ex.planExerciseId)}
                                        onSelect={() => onToggleSelection(ex.planExerciseId)}
                                    />
                                );
                            })
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
