import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Label } from '@/client/components/ui/label';
import { Switch } from '@/client/components/ui/switch';
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
    Timer,
    Square,
    Clock,
    SkipForward,
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
    useWeekProgress,
    useUpdateSets,
    // Selection mode
    useSelectedExerciseIds,
    useIsSelectionMode,
    useToggleSelection,
    useClearSelection,
    // Active workout session
    useIsSessionActive,
    useSessionExercises,
    useCurrentExercise,
    useCurrentExerciseIndex,
    useCompletedSetsThisSession,
    useSessionStartedAt,
    useSessionSource,
    useStartSession,
    useEndSession,
    useSetCurrentExercise,
    useStartRestTimer,
    useCancelRestTimer,
    useIncrementCompletedSets,
    useUpdateSessionExercises,
    useRestTimer,
    formatTime,
    useAutoStartTimer,
    useToggleAutoStartTimer,
} from '@/client/features/workout';
import type { WorkoutTab, SessionSource } from '@/client/features/workout';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';
import { useSavedWorkouts, useCreateSavedWorkout } from './hooks';
import type { SavedWorkoutWithExercises } from '@/apis/saved-workouts/types';
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
    const { activePlan, plans } = useSyncActivePlan();

    // Week progress data
    const {
        data: weekData,
        isLoading: weekLoading,
        isFetching,
    } = useWeekProgress(activePlanId, currentWeek);

    // Update sets mutation
    const updateSetsMutation = useUpdateSets();

    // Selection mode state
    const selectedExerciseIds = useSelectedExerciseIds();
    const isSelectionMode = useIsSelectionMode();
    const toggleSelection = useToggleSelection();
    const clearSelection = useClearSelection();

    // Active workout session state
    const isSessionActive = useIsSessionActive();
    const sessionExercises = useSessionExercises();
    const currentExercise = useCurrentExercise();
    const currentExerciseIndex = useCurrentExerciseIndex();
    const completedSetsThisSession = useCompletedSetsThisSession();
    const sessionStartedAt = useSessionStartedAt();
    const sessionSource = useSessionSource();
    const startSession = useStartSession();
    const endSession = useEndSession();
    const setCurrentExerciseAction = useSetCurrentExercise();
    const startRestTimer = useStartRestTimer();
    const cancelRestTimer = useCancelRestTimer();
    const incrementCompletedSets = useIncrementCompletedSets();
    const updateSessionExercises = useUpdateSessionExercises();
    const { remainingSeconds, isRunning: isRestTimerRunning } = useRestTimer();
    const autoStartTimer = useAutoStartTimer();
    const toggleAutoStartTimer = useToggleAutoStartTimer();

    // Saved workouts data
    const { data: savedWorkoutsData } = useSavedWorkouts();

    // Detect mobile viewport (matches Tailwind's sm: breakpoint at 640px)
    // Used to position selection bar above the bottom navbar on mobile
    const isMobile = useMemo(() => {
        return typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false;
    }, []);
    const createWorkoutMutation = useCreateSavedWorkout();
    const savedWorkouts = savedWorkoutsData?.workouts || [];

    // Local UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [completedExpanded, setCompletedExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exerciseDetailsOpen, setExerciseDetailsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [selectedExerciseForDetails, setSelectedExerciseForDetails] = useState<ExerciseWeekProgress | null>(null);

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


    const handleAddSet = (exercise: ExerciseWeekProgress) => {
        if (!activePlanId || exercise.setsCompleted >= exercise.targetSets) return;

        updateSetsMutation.mutate({
            planId: activePlanId,
            planExerciseId: exercise.planExerciseId,
            weekNumber: currentWeek,
            action: 'add',
        });
    };

    const handleRemoveSet = (exercise: ExerciseWeekProgress) => {
        if (!activePlanId || exercise.setsCompleted <= 0) return;

        updateSetsMutation.mutate({
            planId: activePlanId,
            planExerciseId: exercise.planExerciseId,
            weekNumber: currentWeek,
            action: 'remove',
        });
    };

    const handleCompleteAll = (exercise: ExerciseWeekProgress) => {
        if (!activePlanId) return;

        const remaining = exercise.targetSets - exercise.setsCompleted;
        if (remaining > 0) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: exercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'complete-all',
                targetSets: exercise.targetSets,
            });
        }
    };

    const handleOpenExerciseDetails = (exercise: ExerciseWeekProgress) => {
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
    const handleStartWorkout = (exercisesToStart?: ExerciseWeekProgress[], source: SessionSource = 'plan') => {
        const workoutExercises = exercisesToStart ||
            (selectedExerciseIds.length > 0
                ? exercises.filter((ex) => selectedExerciseIds.includes(ex.planExerciseId))
                : exercises);

        if (workoutExercises.length === 0) return;

        startSession(workoutExercises, source);
        clearSelection();
        setActiveTab('active');
    };

    // Handle session set completion
    const handleSessionAddSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted >= currentExercise.targetSets) return;

        // Only sync to backend for plan-based sessions (saved workouts don't have real planExerciseIds)
        if (sessionSource === 'plan' && activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: currentExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'add',
            });
        }

        // Update session state
        incrementCompletedSets();

        // Auto-start rest timer (if enabled)
        if (autoStartTimer) {
            startRestTimer();
        }

        // Update session exercises with new set count
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === currentExercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );
    };

    const handleSessionRemoveSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted <= 0) return;

        // Only sync to backend for plan-based sessions (saved workouts don't have real planExerciseIds)
        if (sessionSource === 'plan' && activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: currentExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'remove',
            });
        }

        // Update session exercises
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === currentExercise.planExerciseId
                    ? { ...ex, setsCompleted: Math.max(0, ex.setsCompleted - 1) }
                    : ex
            )
        );
    };

    const handleEndWorkout = () => {
        endSession();
        setActiveTab('exercises');
    };

    const handleSaveSessionAsWorkout = () => {
        if (sessionExercises.length === 0) return;

        const workoutName = `Workout ${new Date().toLocaleDateString()}`;
        createWorkoutMutation.mutate({
            name: workoutName,
            exercises: sessionExercises.map((ex) => ({
                exerciseDefId: ex.exerciseDef._id,
                sets: ex.targetSets,
                reps: ex.planExercise.reps,
                weight: ex.planExercise.weight,
                durationSeconds: ex.planExercise.durationSeconds,
            })),
        });
    };

    // Calculate session duration
    const getSessionDuration = () => {
        if (!sessionStartedAt) return '0:00';
        const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // No plan selected
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

    // Loading state
    if (weekLoading && !weekData) {
        return (
            <div className="p-4 pb-20 space-y-4">
                {/* Week Navigator Skeleton */}
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-6 w-32" />
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
                            disabled={currentWeek <= 1 || isFetching}
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
                            disabled={currentWeek >= activePlan.durationWeeks || isFetching}
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
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
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
                        <TabsTrigger value="active" className="flex-1 rounded-lg text-sm font-medium">
                            Active
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
                        className="fixed left-0 right-0 p-4 bg-background/95 backdrop-blur-lg border-t z-50"
                        style={{
                            // On mobile, position above the BottomNavBar which includes safe-area-inset-bottom
                            // BottomNavBar height: pt-1 (4px) + h-14 (56px) + paddingBottom (safe-area + 4px) = 64px + safe-area
                            // On desktop (≥640px), bottom nav is hidden, so use bottom: 0
                            bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0,
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
                                className="h-12 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30"
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

                    {/* Empty State */}
                    {savedWorkouts.length === 0 && (
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

                    {/* Saved Workouts List */}
                    {savedWorkouts.length > 0 && (
                        <div className="space-y-3">
                            {savedWorkouts.map((workout) => (
                                <SavedWorkoutCard
                                    key={workout._id}
                                    workout={workout}
                                    onStart={() => {
                                        // Convert saved workout exercises to session format
                                        // Note: Using exerciseDefId as planExerciseId since saved workouts aren't tied to plans
                                        const workoutExercises: ExerciseWeekProgress[] = workout.exercises.map((workoutEx) => ({
                                            planExerciseId: workoutEx.exerciseDefId,
                                            exerciseDef: workoutEx.exerciseDef,
                                            planExercise: {
                                                _id: workoutEx.exerciseDefId,
                                                planId: '',
                                                exerciseDefId: workoutEx.exerciseDefId,
                                                sets: workoutEx.sets,
                                                reps: workoutEx.reps,
                                                weight: workoutEx.weight,
                                                durationSeconds: workoutEx.durationSeconds ?? 0,
                                                comments: '',
                                                order: 0,
                                                createdAt: new Date().toISOString(),
                                                updatedAt: new Date().toISOString(),
                                            },
                                            targetSets: workoutEx.sets,
                                            setsCompleted: 0,
                                            isDone: false,
                                        }));
                                        // Pass 'saved-workout' source to prevent backend sync (no real planExerciseIds)
                                        handleStartWorkout(workoutExercises, 'saved-workout');
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Active Workout Tab Content */}
                <TabsContent value="active" className="mt-4 space-y-4">
                    {!isSessionActive ? (
                        /* Empty state when no active session */
                        <Card className="rounded-2xl border-0 shadow-sm">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Play className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Active Workout</h3>
                                <p className="text-sm text-muted-foreground mb-4 text-center">
                                    Start a workout session to track your exercises with rest timers
                                </p>
                                <Button
                                    onClick={() => handleStartWorkout()}
                                    disabled={exercises.length === 0}
                                    className="h-12 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30"
                                >
                                    <Play className="mr-2 h-5 w-5" />
                                    Start Workout
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        /* Active Workout Session UI */
                        <>
                            {/* Session Header */}
                            <Card className="rounded-2xl border-0 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg">Active Workout</h3>
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                {getSessionDuration()} • {completedSetsThisSession} sets done
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {/* Only show Save button for plan-based workouts (not already saved) */}
                                            {sessionSource === 'plan' && (
                                                <Button
                                                    variant="outline"
                                                    onClick={handleSaveSessionAsWorkout}
                                                    className="rounded-xl"
                                                >
                                                    <Bookmark className="mr-2 h-4 w-4" />
                                                    Save
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                onClick={handleEndWorkout}
                                                className="rounded-xl text-destructive border-destructive/50 hover:bg-destructive/10"
                                            >
                                                <Square className="mr-2 h-4 w-4" />
                                                End
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Exercise Navigator */}
                            <div className="flex items-center justify-center gap-4">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentExerciseAction(currentExerciseIndex - 1)}
                                    disabled={currentExerciseIndex <= 0}
                                    className="h-10 w-10 rounded-full"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <span className="text-sm font-medium text-muted-foreground">
                                    Exercise {currentExerciseIndex + 1} of {sessionExercises.length}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentExerciseAction(currentExerciseIndex + 1)}
                                    disabled={currentExerciseIndex >= sessionExercises.length - 1}
                                    className="h-10 w-10 rounded-full"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Current Exercise Card */}
                            {currentExercise && (
                                <ActiveExerciseCard
                                    exercise={currentExercise}
                                    onAddSet={handleSessionAddSet}
                                    onRemoveSet={handleSessionRemoveSet}
                                />
                            )}

                            {/* Rest Timer */}
                            <Card className="rounded-2xl border-0 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Timer className="h-5 w-5 text-primary" />
                                            <span className="font-medium">Rest Timer</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isRestTimerRunning && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={cancelRestTimer}
                                                    className="text-muted-foreground"
                                                >
                                                    <SkipForward className="mr-1 h-4 w-4" />
                                                    Skip
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Auto-start toggle */}
                                    <div className="flex items-center justify-between py-2 mb-2 border-b border-border">
                                        <Label htmlFor="auto-start-timer" className="text-sm text-muted-foreground cursor-pointer">
                                            Auto-start after set
                                        </Label>
                                        <Switch
                                            id="auto-start-timer"
                                            checked={autoStartTimer}
                                            onCheckedChange={toggleAutoStartTimer}
                                        />
                                    </div>

                                    {/* Timer Display */}
                                    <div className="text-center py-4">
                                        <p className={`text-5xl font-bold tabular-nums ${isRestTimerRunning ? 'text-primary' : 'text-muted-foreground'}`}>
                                            {formatTime(remainingSeconds)}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {isRestTimerRunning ? 'Rest time remaining' : 'Tap a preset to start'}
                                        </p>
                                    </div>

                                    {/* Rest Time Presets */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[30, 60, 90, 120].map((seconds) => (
                                            <Button
                                                key={seconds}
                                                variant="outline"
                                                onClick={() => startRestTimer(seconds)}
                                                className="rounded-xl"
                                            >
                                                {seconds}s
                                            </Button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Exercise List Preview */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground px-1">All Exercises</p>
                                {sessionExercises.map((ex, index) => (
                                    <button
                                        key={ex.planExerciseId}
                                        onClick={() => setCurrentExerciseAction(index)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${index === currentExerciseIndex
                                                ? 'bg-primary/10 ring-1 ring-primary'
                                                : 'bg-card hover:bg-muted/50'
                                            } ${ex.setsCompleted >= ex.targetSets ? 'opacity-60' : ''}`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                            {ex.exerciseDef.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={ex.exerciseDef.imageUrl}
                                                    alt={ex.exerciseDef.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="font-medium truncate">{ex.exerciseDef.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {ex.setsCompleted}/{ex.targetSets} sets
                                            </p>
                                        </div>
                                        {ex.setsCompleted >= ex.targetSets && (
                                            <Check className="h-5 w-5 text-green-500" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
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
    exercise: ExerciseWeekProgress;
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
            className={`rounded-2xl border-0 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isComplete ? 'border-2 border-green-500/50 bg-green-500/5' : ''
                } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <CardContent className="p-4">
                <div className="flex gap-4 mb-3">
                    {/* Image with completion/selection badge */}
                    <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden">
                            {exercise.exerciseDef.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
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
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                <Check className="h-4 w-4 text-white" strokeWidth={3} />
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
                        <p className={`text-base font-semibold mt-1 ${isComplete ? 'text-green-500' : ''}`}>
                            Sets: {exercise.setsCompleted}/{exercise.targetSets}
                            {isComplete && ' ✓'}
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${isComplete
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
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
                                className="h-11 w-11 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30 active:scale-95 transition-transform"
                            >
                                <CheckCheck className="h-6 w-6" />
                            </Button>
                        )}
                        {isComplete && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-full text-green-500 border-2 border-green-500/50 bg-green-500/10"
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
            className={`rounded-xl border-0 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${isComplete ? 'border-2 border-green-500/50 bg-green-500/5' : ''
                } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Image with completion/selection badge */}
                    <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                            {exercise.exerciseDef.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
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
                        </div>
                        {/* Selection badge (takes priority) */}
                        {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                            </div>
                        )}
                        {/* Completion badge (only if not selected) */}
                        {isComplete && !isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{exercise.exerciseDef.name}</h3>
                        <p className={`text-sm ${isComplete ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {exercise.setsCompleted}/{exercise.targetSets} sets{isComplete && ' ✓'}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onOpenDetails}
                            className="h-9 w-9 rounded-full text-primary"
                        >
                            <Info className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRemoveSet}
                            disabled={exercise.setsCompleted <= 0}
                            className={`h-9 w-9 rounded-full active:scale-95 transition-transform ${
                                isComplete ? 'text-red-500 border-red-500/50 hover:bg-red-500/10' : ''
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
                                className="h-9 w-9 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition-transform"
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
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// Saved Workout Card Component
interface SavedWorkoutCardProps {
    workout: SavedWorkoutWithExercises;
    onStart: () => void;
}

function SavedWorkoutCard({ workout, onStart }: SavedWorkoutCardProps) {
    return (
        <Card className="rounded-xl border-0 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{workout.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                        </p>
                        {/* Exercise preview */}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {workout.exercises.slice(0, 3).map((ex) => (
                                <Badge
                                    key={ex.exerciseDefId}
                                    variant="outline"
                                    className="text-xs"
                                >
                                    {ex.exerciseDef.name}
                                </Badge>
                            ))}
                            {workout.exercises.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                    +{workout.exercises.length - 3} more
                                </Badge>
                            )}
                        </div>
                    </div>
                    <Button
                        size="icon"
                        onClick={onStart}
                        className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25"
                    >
                        <Play className="h-5 w-5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// Active Workout Exercise Card - Large format for session view
interface ActiveExerciseCardProps {
    exercise: ExerciseWeekProgress;
    onAddSet: () => void;
    onRemoveSet: () => void;
}

function ActiveExerciseCard({ exercise, onAddSet, onRemoveSet }: ActiveExerciseCardProps) {
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;
    const isComplete = exercise.setsCompleted >= exercise.targetSets;

    return (
        <Card className={`rounded-2xl border-0 shadow-lg ${isComplete ? 'ring-2 ring-green-500 bg-green-500/5' : ''}`}>
            <CardContent className="p-6">
                {/* Large Exercise Image */}
                <div className="aspect-square max-h-48 mx-auto mb-6 rounded-2xl bg-muted overflow-hidden">
                    {exercise.exerciseDef.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={exercise.exerciseDef.imageUrl}
                            alt={exercise.exerciseDef.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Dumbbell className="h-16 w-16 text-muted-foreground" />
                        </div>
                    )}
                </div>

                {/* Exercise Info */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-1">{exercise.exerciseDef.name}</h2>
                    <p className="text-muted-foreground">
                        {exercise.planExercise.reps} reps
                        {exercise.planExercise.weight > 0 && ` • ${exercise.planExercise.weight}kg`}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <Badge
                            variant="outline"
                            className="bg-[hsl(210,100%,95%)] text-[hsl(210,100%,40%)] border-[hsl(210,100%,85%)] dark:bg-[hsl(210,100%,20%)] dark:text-[hsl(210,100%,80%)]"
                        >
                            {exercise.exerciseDef.primaryMuscle}
                        </Badge>
                    </div>
                </div>

                {/* Sets Progress */}
                <div className="text-center mb-6">
                    <p className={`text-4xl font-bold ${isComplete ? 'text-green-500' : ''}`}>
                        {exercise.setsCompleted} / {exercise.targetSets}
                    </p>
                    <p className="text-sm text-muted-foreground">sets completed</p>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-muted rounded-full overflow-hidden mb-6">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${isComplete
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-primary to-primary/80'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>

                {/* Large Action Buttons */}
                <div className="flex items-center justify-center gap-4">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={onRemoveSet}
                        disabled={exercise.setsCompleted <= 0}
                        className="h-16 w-16 rounded-full border-2 active:scale-95 transition-transform"
                    >
                        <Minus className="h-8 w-8" />
                    </Button>
                    <Button
                        size="lg"
                        onClick={onAddSet}
                        disabled={isComplete}
                        className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30 active:scale-95 transition-transform"
                    >
                        <Plus className="h-10 w-10" />
                    </Button>
                    {isComplete && (
                        <div className="h-16 w-16 rounded-full bg-green-500/10 border-2 border-green-500/50 flex items-center justify-center">
                            <CheckCheck className="h-8 w-8 text-green-500" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
