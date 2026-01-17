/**
 * Workout State Management Hooks
 *
 * Provides state and handlers for the ActiveWorkout component.
 * Split into two hooks following the state + handlers pattern for better organization.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/client/router';
import {
    useIsSessionActive,
    useSessionExercises,
    useCurrentExercise,
    useCurrentExerciseIndex,
    useSessionStartedAt,
    useEndSession,
    useSetCurrentExercise,
    useStartRestTimer,
    useCancelRestTimer,
    useIncrementCompletedSets,
    useUpdateSessionExercises,
    useRestTimer,
    useActivePlanId,
    useCurrentWeek,
    usePlanWorkoutId,
    usePlanWorkoutName,
    useSetPlanWorkoutId,
    useSetPlanWorkoutName,
    useIsInSet,
    useSetIsInSet,
    useRestTimerDuration,
    useSetRestTimerDuration,
    useSupersetEnabled,
    useSupersetExerciseIds,
    useSetSupersetEnabled,
    useSetSupersetExerciseIds,
    useWeekProgress,
    useActiveWorkoutTab,
    useSetActiveWorkoutTab,
    useGeneratedWarmup,
    useSetGeneratedWarmup,
    useWarmupCost,
    useSetWarmupCost,
} from '@/client/features/workout';
import { useCreatePlanWorkout } from '@/client/features/plan-workouts';
import { useSetProgress } from '@/client/features/plan-data';
import { toast } from '@/client/components/ui/toast';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';
import { useDeleteActivity } from '@/client/routes/Progress/hooks';
import { generateWarmup } from '@/apis/workout-warmup/client';
import type { WarmupExerciseData } from '@/apis/workout-warmup/types';

/**
 * Aggregates all state needed for an active workout session.
 *
 * Manages:
 * - Plan context (activePlanId, currentWeek, planWorkout info)
 * - Session state (exercises, current exercise, completion progress)
 * - Timer state (rest timer, in-set tracking)
 * - Superset configuration and pairing
 * - UI state (dialogs, forms, selections)
 *
 * @returns Object containing all workout state and store hooks
 */
export function useActiveWorkoutState() {
    const { navigate } = useRouter();

    // Plan context
    const activePlanId = useActivePlanId();
    const currentWeek = useCurrentWeek();

    // Active workout session state
    const isSessionActive = useIsSessionActive();
    const sessionExercises = useSessionExercises();
    const currentExercise = useCurrentExercise();
    const currentExerciseIndex = useCurrentExerciseIndex();
    const sessionStartedAt = useSessionStartedAt();
    const endSession = useEndSession();
    const setCurrentExerciseAction = useSetCurrentExercise();
    const startRestTimer = useStartRestTimer();
    const cancelRestTimer = useCancelRestTimer();
    const incrementCompletedSets = useIncrementCompletedSets();
    const updateSessionExercises = useUpdateSessionExercises();
    const { remainingSeconds, isRunning: isRestTimerRunning, progress: restTimerProgress } = useRestTimer();
    const isInSet = useIsInSet();
    const setIsInSet = useSetIsInSet();
    const restTimerDuration = useRestTimerDuration();
    const setRestTimerDuration = useSetRestTimerDuration();
    const prevRestStateRef = useRef<{ isRunning: boolean; remainingSeconds: number }>({
        isRunning: false,
        remainingSeconds: 0,
    });
    const supersetEnabled = useSupersetEnabled();
    const supersetExerciseIds = useSupersetExerciseIds();
    const setSupersetEnabled = useSetSupersetEnabled();
    const setSupersetExerciseIds = useSetSupersetExerciseIds();

    // Plan workout state (null = ad-hoc unsaved, non-null = saved plan-workout)
    const planWorkoutId = usePlanWorkoutId();
    const planWorkoutName = usePlanWorkoutName();
    const setPlanWorkoutId = useSetPlanWorkoutId();
    const setPlanWorkoutName = useSetPlanWorkoutName();

    // Mutations
    const createPlanWorkoutMutation = useCreatePlanWorkout(activePlanId || '');

    // Set progress actions (unified store + activity logging)
    const { addSet, removeSet } = useSetProgress(activePlanId, currentWeek, planWorkoutId);

    // Plan exercises (for adding exercises during workout)
    const { data: weekProgressData } = useWeekProgress(activePlanId, currentWeek);

    // Tab state for Active/Exercises tabs (persisted in session store)
    const activeTab = useActiveWorkoutTab();
    const setActiveTab = useSetActiveWorkoutTab();

    // AI Warmup state (persisted in session store)
    const generatedWarmup = useGeneratedWarmup();
    const setGeneratedWarmup = useSetGeneratedWarmup();
    const warmupCost = useWarmupCost();
    const setWarmupCost = useSetWarmupCost();

    // Local state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral timer state
    const [duration, setDuration] = useState('0:00');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [workoutName, setWorkoutName] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [endDialogOpen, setEndDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral overlay state
    const [allExercisesOpen, setAllExercisesOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [restDialogOpen, setRestDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [customRest, setCustomRest] = useState(() => String(restTimerDuration));
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral error state
    const [restError, setRestError] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [supersetDialogOpen, setSupersetDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral selection state
    const [supersetSelection, setSupersetSelection] = useState<string[]>([]);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral error state
    const [supersetError, setSupersetError] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [warmupDialogOpen, setWarmupDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral loading state
    const [isGeneratingWarmup, setIsGeneratingWarmup] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral model selection state
    const [warmupModelId, setWarmupModelId] = useState('gemini-2.5-flash');

    // Calculate total and completed sets from actual exercise data
    const totalSets = sessionExercises.reduce((sum, ex) => sum + ex.targetSets, 0);
    const completedSets = sessionExercises.reduce((sum, ex) => sum + ex.setsCompleted, 0);

    // Check if workout is complete
    const isWorkoutComplete = sessionExercises.length > 0 && sessionExercises.every(ex => ex.setsCompleted >= ex.targetSets);

    // Duration timer - stops when workout is complete
    useEffect(() => {
        if (!isSessionActive || !sessionStartedAt || isWorkoutComplete) return;

        const updateDuration = () => {
            const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateDuration();
        const interval = setInterval(updateDuration, 1000);
        return () => clearInterval(interval);
    }, [isSessionActive, sessionStartedAt, isWorkoutComplete]);

    // Auto-start the set when rest finishes
    useEffect(() => {
        const prev = prevRestStateRef.current;
        const justFinishedRest =
            prev.isRunning &&
            !isRestTimerRunning &&
            prev.remainingSeconds > 0 &&
            remainingSeconds === 0;

        if (justFinishedRest && !isInSet && isSessionActive && !isWorkoutComplete) {
            setIsInSet(true);
            cancelRestTimer();
        }

        prevRestStateRef.current = { isRunning: isRestTimerRunning, remainingSeconds };
    }, [
        cancelRestTimer,
        isInSet,
        isRestTimerRunning,
        isSessionActive,
        isWorkoutComplete,
        remainingSeconds,
        setIsInSet,
    ]);

    return {
        navigate,
        activePlanId,
        currentWeek,
        isSessionActive,
        sessionExercises,
        currentExercise,
        currentExerciseIndex,
        sessionStartedAt,
        endSession,
        setCurrentExerciseAction,
        startRestTimer,
        cancelRestTimer,
        incrementCompletedSets,
        updateSessionExercises,
        remainingSeconds,
        isRestTimerRunning,
        restTimerProgress,
        isInSet,
        setIsInSet,
        restTimerDuration,
        setRestTimerDuration,
        supersetEnabled,
        supersetExerciseIds,
        setSupersetEnabled,
        setSupersetExerciseIds,
        planWorkoutId,
        planWorkoutName,
        setPlanWorkoutId,
        setPlanWorkoutName,
        createPlanWorkoutMutation,
        addSet,
        removeSet,
        weekProgressData,
        duration,
        saveDialogOpen,
        setSaveDialogOpen,
        workoutName,
        setWorkoutName,
        endDialogOpen,
        setEndDialogOpen,
        allExercisesOpen,
        setAllExercisesOpen,
        restDialogOpen,
        setRestDialogOpen,
        customRest,
        setCustomRest,
        restError,
        setRestError,
        supersetDialogOpen,
        setSupersetDialogOpen,
        supersetSelection,
        setSupersetSelection,
        supersetError,
        setSupersetError,
        totalSets,
        completedSets,
        isWorkoutComplete,
        activeTab,
        setActiveTab,
        generatedWarmup,
        setGeneratedWarmup,
        warmupCost,
        setWarmupCost,
        warmupDialogOpen,
        setWarmupDialogOpen,
        isGeneratingWarmup,
        setIsGeneratingWarmup,
        warmupModelId,
        setWarmupModelId,
    };
}

/**
 * Provides handler functions for workout actions.
 *
 * Handles:
 * - Set completion (single exercise or superset pair)
 * - Manual set add/remove with workout tracking
 * - Rest timer configuration and auto-start
 * - Superset setup and configuration
 * - Workout save and end actions
 * - Navigation between exercises
 *
 * @param state - State object from useActiveWorkoutState
 * @returns Object containing all workout action handlers
 */
export function useWorkoutHandlers(state: ReturnType<typeof useActiveWorkoutState>) {
    const {
        sessionExercises,
        currentExercise,
        currentExerciseIndex,
        setIsInSet,
        cancelRestTimer,
        startRestTimer,
        incrementCompletedSets,
        updateSessionExercises,
        addSet,
        removeSet,
        endSession,
        navigate,
        setWorkoutName,
        setSaveDialogOpen,
        createPlanWorkoutMutation,
        setPlanWorkoutId,
        setPlanWorkoutName,
        setCustomRest,
        setRestError,
        setRestDialogOpen,
        setRestTimerDuration,
        supersetExerciseIds,
        setSupersetSelection,
        setSupersetError,
        setSupersetDialogOpen,
        setSupersetExerciseIds,
        setSupersetEnabled,
        setCurrentExerciseAction,
        supersetEnabled,
        activePlanId,
        restTimerDuration,
        workoutName,
        setGeneratedWarmup,
        setWarmupCost,
        setIsGeneratingWarmup,
        warmupModelId,
    } = state;

    const deleteActivityMutation = useDeleteActivity();

    /**
     * Generate AI warmup based on session exercises
     */
    const handleGenerateWarmup = async () => {
        if (sessionExercises.length === 0) {
            toast.error('No exercises in workout');
            return;
        }

        setIsGeneratingWarmup(true);

        try {
            // Convert exercises to warmup data format
            const exerciseData: WarmupExerciseData[] = sessionExercises.map((ex) => ({
                name: ex.exerciseDef.name,
                primaryMuscle: ex.exerciseDef.primaryMuscle,
                secondaryMuscles: ex.exerciseDef.secondaryMuscles,
                type: ex.exerciseDef.type,
                isBodyweight: ex.exerciseDef.isBodyweight,
                isStatic: ex.exerciseDef.isStatic,
                sets: ex.targetSets,
                reps: ex.planExercise.reps,
                weight: ex.planExercise.weight,
                durationSeconds: ex.planExercise.durationSeconds,
            }));

            const response = await generateWarmup({ exercises: exerciseData, modelId: warmupModelId });

            if (response.data?.error) {
                toast.error(response.data.error);
                return;
            }

            if (response.data?.warmup) {
                setGeneratedWarmup(response.data.warmup);
                if (response.data.cost) {
                    setWarmupCost(response.data.cost);
                }
                toast.success('Warmup generated!');
            }
        } catch (error) {
            console.error('Error generating warmup:', error);
            toast.error('Failed to generate warmup');
        } finally {
            setIsGeneratingWarmup(false);
        }
    };

    const handleStartSet = () => {
        setIsInSet(true);
        cancelRestTimer();
    };

    const supersetExercises = supersetExerciseIds
        .map((id) => sessionExercises.find((ex) => ex.planExerciseId === id))
        .filter(Boolean) as ExerciseWeekProgress[];

    const handleCompleteSet = () => {
        if (supersetEnabled && supersetExercises.length === 2) {
            const eligible = supersetExercises.filter((ex) => ex.setsCompleted < ex.targetSets);
            if (eligible.length === 0) return;

            const allActivityIds: string[] = [];
            eligible.forEach((ex) => {
                addSet(ex.planExerciseId, ex.targetSets, undefined, (activityIds) => {
                    allActivityIds.push(...activityIds);
                });
            });

            // Show toast after both sets are logged
            if (allActivityIds.length > 0) {
                const exerciseNames = eligible.map((ex) => ex.exerciseDef.name).join(' + ');
                toast.success(`Progress logged for ${exerciseNames}`, {
                    duration: 6000,
                    actions: [
                        {
                            label: 'Delete',
                            onClick: () => {
                                // Delete only the activity logs (not the set count in plan data)
                                allActivityIds.forEach((activityId) => {
                                    deleteActivityMutation.mutate({ activityId });
                                });
                                toast.success('Logs deleted');
                            },
                        },
                    ],
                });
            }

            for (let i = 0; i < eligible.length; i++) {
                incrementCompletedSets();
            }
            updateSessionExercises(
                sessionExercises.map((ex) => {
                    if (supersetExerciseIds.includes(ex.planExerciseId) && ex.setsCompleted < ex.targetSets) {
                        return { ...ex, setsCompleted: ex.setsCompleted + 1 };
                    }
                    return ex;
                })
            );

            setIsInSet(false);
            startRestTimer();
            return;
        }

        if (!currentExercise) return;
        if (currentExercise.setsCompleted >= currentExercise.targetSets) return;

        addSet(currentExercise.planExerciseId, currentExercise.targetSets, undefined, (activityIds) => {
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
        incrementCompletedSets();

        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === currentExercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );

        setIsInSet(false);
        startRestTimer();

        const newSetsCompleted = currentExercise.setsCompleted + 1;
        if (newSetsCompleted >= currentExercise.targetSets && currentExerciseIndex < sessionExercises.length - 1) {
            setCurrentExerciseAction(currentExerciseIndex + 1);
        }
    };

    const handleAddSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted >= currentExercise.targetSets) return;

        addSet(currentExercise.planExerciseId, currentExercise.targetSets, undefined, (activityIds) => {
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
        incrementCompletedSets();
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === currentExercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );
    };

    const handleRemoveSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted <= 0) return;

        removeSet(currentExercise.planExerciseId);
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
        navigate('/');
    };

    const openSaveDialog = () => {
        if (sessionExercises.length === 0) return;
        setWorkoutName('');
        setSaveDialogOpen(true);
    };

    const handleSaveWorkout = () => {
        if (sessionExercises.length === 0 || !workoutName.trim() || !activePlanId) return;

        createPlanWorkoutMutation.mutate(
            {
                planId: activePlanId,
                name: workoutName.trim(),
                items: sessionExercises.map((ex, idx) => ({
                    planExerciseId: ex.planExerciseId,
                    order: idx,
                })),
            },
            {
                onSuccess: (data) => {
                    toast.success('Workout saved!');
                    if (data?._id) {
                        setPlanWorkoutId(data._id);
                    }
                    setPlanWorkoutName(workoutName.trim());
                    setSaveDialogOpen(false);
                    setWorkoutName('');
                },
                onError: (error) => {
                    toast.error(`Failed to save: ${error.message}`);
                },
            }
        );
    };

    const openRestDialog = () => {
        setCustomRest(String(restTimerDuration));
        setRestError(null);
        setRestDialogOpen(true);
    };

    const handleSelectRest = (seconds: number) => {
        setRestError(null);
        setCustomRest(String(seconds));
        setRestTimerDuration(seconds);
        setRestDialogOpen(false);
    };

    const handleSaveCustomRest = () => {
        const parsed = Number(state.customRest);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setRestError('Enter a positive number of seconds');
            return;
        }

        const rounded = Math.round(parsed);
        setRestTimerDuration(rounded);
        setRestDialogOpen(false);
    };

    const openSupersetDialog = () => {
        const selected = supersetExerciseIds.length > 0 ? supersetExerciseIds : sessionExercises.slice(0, 2).map((ex) => ex.planExerciseId);
        setSupersetSelection(selected);
        setSupersetError(null);
        setSupersetDialogOpen(true);
    };

    const toggleSupersetSelection = (planExerciseId: string) => {
        setSupersetSelection((prev) => {
            const exists = prev.includes(planExerciseId);
            if (exists) {
                return prev.filter((id) => id !== planExerciseId);
            }
            if (prev.length >= 2) {
                return [prev[1], planExerciseId];
            }
            return [...prev, planExerciseId];
        });
    };

    const handleSaveSuperset = () => {
        if (state.supersetSelection.length !== 2) {
            setSupersetError('Select exactly 2 exercises');
            return;
        }
        setSupersetExerciseIds(state.supersetSelection);
        setSupersetEnabled(true);
        setSupersetDialogOpen(false);
    };

    const handleDisableSuperset = () => {
        setSupersetEnabled(false);
        setSupersetExerciseIds([]);
    };

    // Exercises Tab Handlers - for interacting with any exercise (not just current)
    const handleExercisesTabAddSet = (exercise: ExerciseWeekProgress) => {
        if (exercise.setsCompleted >= exercise.targetSets) return;

        addSet(exercise.planExerciseId, exercise.targetSets, undefined, (activityIds) => {
            const activityId = activityIds[0];
            toast.success('Progress logged successfully', {
                duration: 6000,
                actions: [
                    {
                        label: 'Delete',
                        onClick: () => {
                            deleteActivityMutation.mutate(
                                { activityId },
                                {
                                    onSuccess: () => toast.success('Log deleted'),
                                    onError: () => toast.error('Failed to delete log'),
                                }
                            );
                        },
                    },
                ],
            });
        });
        incrementCompletedSets();
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === exercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );
        // Auto-start rest timer after adding a set
        startRestTimer();
    };

    const handleExercisesTabRemoveSet = (exercise: ExerciseWeekProgress) => {
        if (exercise.setsCompleted <= 0) return;

        removeSet(exercise.planExerciseId);
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === exercise.planExerciseId
                    ? { ...ex, setsCompleted: Math.max(0, ex.setsCompleted - 1) }
                    : ex
            )
        );
    };

    const handleExercisesTabCompleteAll = (exercise: ExerciseWeekProgress) => {
        const remainingSets = exercise.targetSets - exercise.setsCompleted;
        if (remainingSets <= 0) return;

        const allActivityIds: string[] = [];
        for (let i = 0; i < remainingSets; i++) {
            addSet(exercise.planExerciseId, exercise.targetSets, undefined, (activityIds) => {
                allActivityIds.push(...activityIds);
            });
            incrementCompletedSets();
        }

        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === exercise.planExerciseId
                    ? { ...ex, setsCompleted: exercise.targetSets }
                    : ex
            )
        );

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
        // Auto-start rest timer after completing all sets
        startRestTimer();
    };

    return {
        handleStartSet,
        handleCompleteSet,
        handleAddSet,
        handleRemoveSet,
        handleEndWorkout,
        openSaveDialog,
        handleSaveWorkout,
        openRestDialog,
        handleSelectRest,
        handleSaveCustomRest,
        openSupersetDialog,
        toggleSupersetSelection,
        handleSaveSuperset,
        handleDisableSuperset,
        supersetExercises,
        // Exercises Tab Handlers
        handleExercisesTabAddSet,
        handleExercisesTabRemoveSet,
        handleExercisesTabCompleteAll,
        // Warmup Handler
        handleGenerateWarmup,
    };
}
