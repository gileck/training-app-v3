import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Skeleton } from '@/client/components/template/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/project/ui/tabs';
import { toast } from '@/client/components/template/ui/toast';
import { Calendar, LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from '@/client/features';
import {
    useWorkoutStore,
    useCurrentWeek,
    useActivePlanId,
    useViewMode,
    useActiveTab,
    useSyncActivePlan,
    useSelectedExerciseIds,
    useIsSelectionMode,
    useToggleSelection,
    useClearSelection,
    useStartSession,
    useSetPlanWorkoutId,
    useSetPlanWorkoutName,
    useIsSessionActive,
    useExpandedWorkoutId,
    useSetExpandedWorkoutId,
} from '@/client/features/project/workout';
import type { WorkoutTab } from '@/client/features/project/workout';
import {
    useLoadPlan,
    useLoadWeekProgress,
    useWeekProgressFromStoreData,
    usePlanLoading,
    useSetProgress,
    useWeekWorkoutSets,
    usePlanDataStore,
    useUpdatePlanExerciseAdapter,
    syncPlanToServer,
    type ExerciseWeekProgressFromStore,
} from '@/client/features/project/plan-data';
import { usePlanWorkouts } from '@/client/features/project/plan-workouts';
import { ExerciseDetails } from '@/client/components/project/ExerciseDetails/ExerciseDetails';
import { EditExerciseDialog } from '@/client/routes/project/ManagePlan/components/exercises/EditExerciseDialog';
import type { PlanExerciseWithDefinition } from '@/apis/project/plan-exercises/types';
import {
    WeekNavigator,
    SelectionBar,
    ExercisesTabContent,
    WorkoutsTabContent,
    AddExerciseToWeekDialog,
} from './components';
import { getFirstWorkoutWithCapacity, getLastWorkoutWithSets } from './utils/setAllocation';
import { useDeleteActivity } from '@/client/routes/project/Progress/hooks';

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

    // Delete activity mutation
    const deleteActivityMutation = useDeleteActivity();

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

    const planWorkoutsList = planWorkoutsData?.workouts || [];

    // Expanded workout state (persisted in store)
    const expandedWorkoutId = useExpandedWorkoutId();
    const setExpandedWorkoutId = useSetExpandedWorkoutId();

    // Local UI state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [exerciseDetailsOpen, setExerciseDetailsOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [selectedExerciseForDetails, setSelectedExerciseForDetails] = useState<ExerciseWeekProgressFromStore | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [exerciseToEdit, setExerciseToEdit] = useState<PlanExerciseWithDefinition | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [addToWeekOpen, setAddToWeekOpen] = useState(false);

    // Skip toggle + single-exercise edit mutation
    const toggleSkipExercise = usePlanDataStore((s) => s.toggleSkipExercise);
    const updateExerciseMutation = useUpdatePlanExerciseAdapter(activePlanId || '');

    const exercises = weekData?.exercises || [];
    const incompleteExercises = exercises.filter((e) => !e.isDone && !e.isSkipped);
    const completedExercises = exercises.filter((e) => e.isDone && !e.isSkipped);
    const skippedExercises = exercises.filter((e) => e.isSkipped);

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

    const getWorkoutTargetSets = (workoutId: string, exercise: ExerciseWeekProgressFromStore) => {
        const workout = planWorkoutsList.find((w) => w._id === workoutId);
        const item = workout?.items.find((i) => i.planExerciseId === exercise.planExerciseId);
        return item?.sets ?? exercise.targetSets;
    };

    // Handle adding a set from the Exercise Tab, auto-allocation, or a specific saved workout.
    const handleAddSet = (exercise: ExerciseWeekProgressFromStore, explicitWorkoutId?: string) => {
        let workoutId = explicitWorkoutId ?? null;

        if (explicitWorkoutId) {
            const workoutTargetSets = getWorkoutTargetSets(explicitWorkoutId, exercise);
            const workoutSetsCompleted = weekWorkoutSets[explicitWorkoutId]?.[exercise.planExerciseId] ?? 0;
            if (workoutSetsCompleted >= workoutTargetSets) return;
        } else {
            if (exercise.setsCompleted >= exercise.targetSets) return;
            workoutId = getFirstWorkoutWithCapacity(
                exercise.planExerciseId,
                planWorkoutsList,
                exercises,
                weekWorkoutSets
            );
        }

        addSet(exercise.planExerciseId, exercise.targetSets, workoutId ?? undefined, (activityIds) => {
            // Show toast with delete action
            const activityId = activityIds[0];

            toast.success('Progress logged successfully', {
                duration: 6000,
                actions: [
                    {
                        label: 'Delete',
                        onClick: () => {
                            // Delete only the activity log (not the set count in plan data)
                            deleteActivityMutation.mutate(
                                { activityId },
                                {
                                    onSuccess: () => {
                                        toast.success('Log deleted');
                                    },
                                    onError: () => {
                                        toast.error('Failed to delete log');
                                    },
                                }
                            );
                        },
                    },
                ],
            });
        });
    };

    // Handle removing a set from the Exercise Tab, auto-allocation, or a specific saved workout.
    const handleRemoveSet = (exercise: ExerciseWeekProgressFromStore, explicitWorkoutId?: string) => {
        let workoutId = explicitWorkoutId ?? null;

        if (explicitWorkoutId) {
            const workoutSetsCompleted = weekWorkoutSets[explicitWorkoutId]?.[exercise.planExerciseId] ?? 0;
            if (workoutSetsCompleted <= 0) return;
        } else {
            if (exercise.setsCompleted <= 0) return;
            workoutId = getLastWorkoutWithSets(exercise.planExerciseId, planWorkoutsList, weekWorkoutSets);
        }

        removeSet(exercise.planExerciseId, workoutId ?? undefined);
    };

    // Handle completing all remaining sets for an exercise
    const handleCompleteAll = (exercise: ExerciseWeekProgressFromStore, explicitWorkoutId?: string) => {
        const remainingSets = explicitWorkoutId
            ? getWorkoutTargetSets(explicitWorkoutId, exercise) -
                (weekWorkoutSets[explicitWorkoutId]?.[exercise.planExerciseId] ?? 0)
            : exercise.targetSets - exercise.setsCompleted;
        if (remainingSets <= 0) return;

        const exerciseId = exercise.planExerciseId;
        if (explicitWorkoutId) {
            const allActivityIds: string[] = [];
            for (let i = 0; i < remainingSets; i++) {
                addSet(exerciseId, exercise.targetSets, explicitWorkoutId, (activityIds) => {
                    allActivityIds.push(...activityIds);
                });
            }

            if (allActivityIds.length > 0) {
                toast.success(`${remainingSets} set${remainingSets > 1 ? 's' : ''} logged`, {
                    duration: 6000,
                    actions: [
                        {
                            label: 'Delete All',
                            onClick: () => {
                                allActivityIds.forEach((activityId) => {
                                    deleteActivityMutation.mutate({ activityId });
                                });
                                toast.success('All logs deleted');
                            },
                        },
                    ],
                });
            }
            return;
        }

        const containingWorkouts = planWorkoutsList.filter((workout) =>
            workout.items.some((item) => item.planExerciseId === exerciseId)
        );

        const allActivityIds: string[] = [];
        const workoutIdsForSets: (string | undefined)[] = [];

        // If exercise isn't in any workout, just add sets without workout tracking
        if (containingWorkouts.length === 0) {
            for (let i = 0; i < remainingSets; i++) {
                addSet(exerciseId, exercise.targetSets, undefined, (activityIds) => {
                    allActivityIds.push(...activityIds);
                    workoutIdsForSets.push(undefined);
                });
            }

            // Show toast after all sets are logged
            if (allActivityIds.length > 0) {
                toast.success(`${remainingSets} set${remainingSets > 1 ? 's' : ''} logged`, {
                    duration: 6000,
                    actions: [
                        {
                            label: 'Delete All',
                            onClick: () => {
                                // Delete only the activity logs (not the set count in plan data)
                                allActivityIds.forEach((activityId) => {
                                    deleteActivityMutation.mutate({ activityId });
                                });
                                toast.success('All logs deleted');
                            },
                        },
                    ],
                });
            }
            return;
        }

        // Track allocations locally to account for sets we're adding in this loop
        const localAllocations: Record<string, number> = {};
        for (const workout of containingWorkouts) {
            localAllocations[workout._id] = weekWorkoutSets[workout._id]?.[exerciseId] ?? 0;
        }

        // Distribute remaining sets across workouts using auto-fill logic
        for (let i = 0; i < remainingSets; i++) {
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

            addSet(exerciseId, exercise.targetSets, targetWorkoutId, (activityIds) => {
                allActivityIds.push(...activityIds);
                workoutIdsForSets.push(targetWorkoutId);
            });
            if (targetWorkoutId) {
                localAllocations[targetWorkoutId]++;
            }
        }

        // Show toast after all sets are logged
        if (allActivityIds.length > 0 && activePlanId) {
            toast.success(`${remainingSets} set${remainingSets > 1 ? 's' : ''} logged`, {
                duration: 6000,
                actions: [
                    {
                        label: 'Delete All',
                        onClick: () => {
                            // Delete only the activity logs (not the set count in plan data)
                            allActivityIds.forEach((activityId) => {
                                deleteActivityMutation.mutate({ activityId });
                            });
                            toast.success('All logs deleted');
                        },
                    },
                ],
            });
        }
    };

    const handleOpenExerciseDetails = (exercise: ExerciseWeekProgressFromStore) => {
        setSelectedExerciseForDetails(exercise);
        setExerciseDetailsOpen(true);
    };

    // Find the single selected exercise (when selection count is 1)
    const singleSelected =
        selectedExerciseIds.length === 1
            ? exercises.find((ex) => ex.planExerciseId === selectedExerciseIds[0]) ?? null
            : null;

    const handleEditSelected = () => {
        if (!singleSelected) return;
        // EditExerciseDialog expects the richer PlanExerciseWithDefinition
        // shape; rebuild it from the current store-derived view.
        setExerciseToEdit({
            _id: singleSelected.planExercise._id,
            planId: singleSelected.planExercise.planId,
            exerciseDefId: singleSelected.planExercise.exerciseDefId,
            sets: singleSelected.planExercise.sets,
            reps: singleSelected.planExercise.reps,
            weight: singleSelected.planExercise.weight,
            durationSeconds: singleSelected.planExercise.durationSeconds,
            comments: singleSelected.planExercise.comments,
            order: singleSelected.planExercise.order,
            createdAt: singleSelected.planExercise.createdAt,
            updatedAt: singleSelected.planExercise.updatedAt,
            exerciseDef: singleSelected.exerciseDef,
        });
        setEditDialogOpen(true);
    };

    const handleSaveEdit = (config: {
        sets: number;
        reps: number;
        weight: number;
        durationSeconds: number;
        comments: string;
    }) => {
        if (!exerciseToEdit) return;
        updateExerciseMutation.mutate(
            { planExerciseId: exerciseToEdit._id, ...config },
            {
                onSuccess: () => {
                    setEditDialogOpen(false);
                    setExerciseToEdit(null);
                    clearSelection();
                },
                onError: (error) => {
                    toast.error(`Failed to update exercise: ${error.message}`);
                },
            }
        );
    };

    const handleSkipSelected = () => {
        if (!singleSelected || !activePlanId) return;
        const wasSkipped = singleSelected.isSkipped;
        toggleSkipExercise(activePlanId, currentWeek, singleSelected.planExerciseId);
        syncPlanToServer(activePlanId);
        toast.success(
            wasSkipped
                ? `${singleSelected.exerciseDef.name} un-skipped for week ${currentWeek}`
                : `${singleSelected.exerciseDef.name} skipped for week ${currentWeek}`
        );
        clearSelection();
    };

    const handleViewSelected = () => {
        if (!singleSelected) return;
        handleOpenExerciseDetails(singleSelected);
    };

    // Start workout with selected exercises
    const handleStartWorkout = (
        exercisesToStart?: ExerciseWeekProgressFromStore[],
        planWorkoutId?: string | null,
        planWorkoutName?: string | null
    ) => {
        const workoutExercises =
            exercisesToStart ||
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

    // Unified loading state
    const isInitialLoading =
        (plansLoading || plansData === undefined) ||
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

    return (
        <div className="p-4 pb-20 space-y-4">
            {/* Week Navigator + Progress */}
            <WeekNavigator
                currentWeek={currentWeek}
                activePlan={activePlan}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
                onNavigateToPlan={() => navigate(`/training-plans/${activePlan._id}`)}
                progressPercent={progressPercent}
                completedSets={completedSets}
                totalSets={totalSets}
            />

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
                <TabsContent value="exercises" className="mt-4">
                    <ExercisesTabContent
                        viewMode={viewMode}
                        exercises={exercises}
                        incompleteExercises={incompleteExercises}
                        completedExercises={completedExercises}
                        skippedExercises={skippedExercises}
                        selectedExerciseIds={selectedExerciseIds}
                        onToggleSelection={toggleSelection}
                        onAddSet={handleAddSet}
                        onRemoveSet={handleRemoveSet}
                        onCompleteAll={handleCompleteAll}
                        onOpenDetails={handleOpenExerciseDetails}
                        onNavigateToAddExercises={() => navigate(`/training-plans/${activePlanId}`)}
                        onAddToWeek={() => setAddToWeekOpen(true)}
                        weekNumber={currentWeek}
                    />
                </TabsContent>

                {/* Workouts Tab Content */}
                <TabsContent value="workouts" className="mt-4">
                    <WorkoutsTabContent
                        isLoading={planWorkoutsLoading}
                        dataLoaded={planWorkoutsData !== undefined}
                        planWorkoutsList={planWorkoutsList}
                        exercises={exercises}
                        weekWorkoutSets={weekWorkoutSets}
                        expandedWorkoutId={expandedWorkoutId}
                        onToggleExpand={setExpandedWorkoutId}
                        onStartWorkout={handleStartWorkout}
                        onAddSet={handleAddSet}
                        onRemoveSet={handleRemoveSet}
                        onCompleteAll={handleCompleteAll}
                        onOpenDetails={handleOpenExerciseDetails}
                        selectedExerciseIds={selectedExerciseIds}
                        onToggleSelection={toggleSelection}
                        onNavigateToManageWorkouts={() => navigate(`/training-plans/${activePlanId}?tab=workouts`)}
                    />
                </TabsContent>

                {/* Selection Bar - shows when exercises are selected */}
                {isSelectionMode && selectedExerciseIds.length > 0 && (
                    <SelectionBar
                        selectedCount={selectedExerciseIds.length}
                        onClearSelection={clearSelection}
                        onStartWorkout={() => handleStartWorkout()}
                        onEditSingle={handleEditSelected}
                        onSkipSingle={handleSkipSelected}
                        onViewSingle={handleViewSelected}
                        isSingleSkipped={singleSelected?.isSkipped}
                        isWorkoutActive={isWorkoutActive}
                    />
                )}
            </Tabs>

            {/* Edit Exercise Dialog — opened from the single-selection menu bar */}
            <EditExerciseDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                exercise={exerciseToEdit}
                onSave={handleSaveEdit}
                isPending={updateExerciseMutation.isPending}
            />

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

            {/* Add Exercise to this Week Dialog */}
            <AddExerciseToWeekDialog
                open={addToWeekOpen}
                onOpenChange={setAddToWeekOpen}
                planId={activePlanId}
                weekNumber={currentWeek}
                addedExerciseIds={new Set(exercises.map((e) => e.planExercise.exerciseDefId))}
            />
        </div>
    );
}
