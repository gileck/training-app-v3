import { useEffect, useRef, useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/ui/alert-dialog';
import {
    Play,
    Dumbbell,
    MoreHorizontal,
    Bookmark,
    List,
    Square,
    ArrowLeft,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    Trophy,
    Flame,
    Timer,
    PanelsLeftRight,
    GripVertical,
    Trash2,
} from 'lucide-react';
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
    useUpdateSets,
    useActivePlanId,
    useCurrentWeek,
    formatTime,
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
} from '@/client/features/workout';
import { useCreatePlanWorkout } from '@/client/features/plan-workouts';
import { toast } from '@/client/components/ui/toast';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

export function ActiveWorkout() {
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
    const updateSetsMutation = useUpdateSets();
    const createPlanWorkoutMutation = useCreatePlanWorkout(activePlanId || '');

    // Plan exercises (for adding exercises during workout - always available with active plan)
    const { data: weekProgressData } = useWeekProgress(activePlanId, currentWeek);

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

    // Handle START SET
    const handleStartSet = () => {
        setIsInSet(true);
        cancelRestTimer();
    };

    // Auto-start the set when rest finishes (equivalent to tapping "Start Set")
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

    // Handle COMPLETE SET - always syncs to backend (active plan always exists when workout is active)
    const handleCompleteSet = () => {
        if (supersetEnabled && supersetExercises.length === 2) {
            const eligible = supersetExercises.filter((ex) => ex.setsCompleted < ex.targetSets);
            if (eligible.length === 0) return;

            // Always sync to backend
            if (activePlanId) {
                eligible.forEach((ex) => {
                    updateSetsMutation.mutate({
                        planId: activePlanId,
                        planExerciseId: ex.planExerciseId,
                        weekNumber: currentWeek,
                        action: 'add',
                    });
                });
            }

            // Update session state for both exercises
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

        // Always sync to backend
        if (activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: currentExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'add',
            });
        }

        // Update session state
        incrementCompletedSets();

        // Update session exercises with new set count
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === currentExercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );

        // Exit set state and start rest timer
        setIsInSet(false);
        startRestTimer();

        // Auto-advance to next exercise if current is complete
        const newSetsCompleted = currentExercise.setsCompleted + 1;
        if (newSetsCompleted >= currentExercise.targetSets && currentExerciseIndex < sessionExercises.length - 1) {
            setCurrentExerciseAction(currentExerciseIndex + 1);
        }
    };

    // Handle add set (same as complete but without state transitions) - always syncs to backend
    const handleAddSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted >= currentExercise.targetSets) return;

        // Always sync to backend
        if (activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: currentExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'add',
            });
        }

        incrementCompletedSets();
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === currentExercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );
    };

    // Handle remove set - always syncs to backend
    const handleRemoveSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted <= 0) return;

        // Always sync to backend
        if (activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: currentExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'remove',
            });
        }

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

        // Create plan-workout with planExerciseId references
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
                    // Set planWorkoutId and name so Save button disappears
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
        const parsed = Number(customRest);
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
        if (supersetSelection.length !== 2) {
            setSupersetError('Select exactly 2 exercises');
            return;
        }
        setSupersetExerciseIds(supersetSelection);
        setSupersetEnabled(true);
        setSupersetDialogOpen(false);
    };

    const handleDisableSuperset = () => {
        setSupersetEnabled(false);
        setSupersetExerciseIds([]);
    };

    // Empty state when no active session
    if (!isSessionActive) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Dumbbell className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Active Workout</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
                    Start a workout from the home screen
                </p>
                <Button onClick={() => navigate('/')} className="h-12 px-6 rounded-xl">
                    <Play className="mr-2 h-5 w-5" />
                    Go to Workouts
                </Button>
            </div>
        );
    }

    // View All Exercises overlay
    if (allExercisesOpen) {
        const planWeekExercises = weekProgressData?.exercises || [];
        const canAddFromPlan = !!activePlanId && planWeekExercises.length > 0;
        // Show notice when editing a saved plan-workout that session edits don't update the template
        const isSavedWorkout = planWorkoutId !== null;

        const handleReorderExercises = (nextExercises: ExerciseWeekProgress[]) => {
            const currentId = sessionExercises[currentExerciseIndex]?.planExerciseId;
            updateSessionExercises(nextExercises);
            if (!currentId) return;
            const nextIndex = nextExercises.findIndex((ex) => ex.planExerciseId === currentId);
            if (nextIndex >= 0 && nextIndex !== currentExerciseIndex) {
                setCurrentExerciseAction(nextIndex);
            }
        };

        const handleRemoveExercise = (planExerciseId: string) => {
            const currentId = sessionExercises[currentExerciseIndex]?.planExerciseId;
            const nextExercises = sessionExercises.filter((ex) => ex.planExerciseId !== planExerciseId);
            updateSessionExercises(nextExercises);

            // If we removed an exercise that's part of superset, clear/disable it
            if (supersetEnabled && supersetExerciseIds.includes(planExerciseId)) {
                setSupersetEnabled(false);
                setSupersetExerciseIds([]);
            }

            if (nextExercises.length === 0) return;

            // Keep selection stable:
            // - if current was removed, keep same index (clamped)
            // - otherwise keep pointing at the same exercise id
            if (currentId && currentId !== planExerciseId) {
                const nextIndex = nextExercises.findIndex((ex) => ex.planExerciseId === currentId);
                if (nextIndex >= 0 && nextIndex !== currentExerciseIndex) {
                    setCurrentExerciseAction(nextIndex);
                }
                return;
            }

            const clamped = Math.min(currentExerciseIndex, nextExercises.length - 1);
            setCurrentExerciseAction(clamped);
        };

        return (
            <AllExercisesOverlay
                exercises={sessionExercises}
                currentIndex={currentExerciseIndex}
                onSelectExercise={(index) => {
                    setCurrentExerciseAction(index);
                    setAllExercisesOpen(false);
                }}
                onReorderExercises={handleReorderExercises}
                onRemoveExercise={handleRemoveExercise}
                canAddFromPlan={canAddFromPlan}
                planWeekExercises={planWeekExercises}
                isSavedWorkout={isSavedWorkout}
                onAddExercise={(exercise) => {
                    // Avoid duplicates (should already be filtered, but keep it safe)
                    if (sessionExercises.some((ex) => ex.planExerciseId === exercise.planExerciseId)) return;
                    updateSessionExercises([...sessionExercises, exercise]);
                }}
                onBack={() => setAllExercisesOpen(false)}
            />
        );
    }

    const isExerciseComplete = currentExercise ? currentExercise.setsCompleted >= currentExercise.targetSets : false;
    const supersetExercises = supersetExerciseIds
        .map((id) => sessionExercises.find((ex) => ex.planExerciseId === id))
        .filter(Boolean) as ExerciseWeekProgress[];
    const supersetComplete =
        supersetEnabled &&
        supersetExercises.length === 2 &&
        supersetExercises.every((ex) => ex.setsCompleted >= ex.targetSets);

    // Determine current state for consistent styling
    const isIdle = !isRestTimerRunning && !isInSet;

    return (
        <>
        {/* Breathing animation for READY state anticipation */}
        <style>{`
            @keyframes breathe {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.015); }
            }
        `}</style>
        <div className="flex flex-col min-h-[calc(100dvh-8rem)] pt-0 bg-transparent transition-colors duration-200">
            {/* Context Bar - transparent to blend with page background */}
            <div className="flex items-center justify-between py-1 px-4 max-h-14 gap-3">
                {/* Stacked layout: name on top, time + progress below - IN SET demoted to historical context */}
                <div className={`flex flex-col gap-1 min-w-0 transition-opacity duration-200 ${
                    isInSet ? 'opacity-60' : isIdle ? 'opacity-70' : 'opacity-80'
                }`}>
                    {planWorkoutName ? (
                        <p className="text-[18px] font-semibold text-foreground/85 truncate">
                            {planWorkoutName}
                        </p>
                    ) : null}
                    <p className="text-[14px] font-normal text-foreground/60 flex items-center">
                        <span>{duration}</span>
                        <span className="mx-2 text-foreground/25">·</span>
                        <span>{completedSets}/{totalSets} sets</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Show Save button only when session is not tied to a saved plan-workout */}
                    {planWorkoutId === null && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={openSaveDialog}
                            aria-label="Save workout"
                            className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 active:scale-[0.97] transition-transform"
                        >
                            <Bookmark className="h-[18px] w-[18px]" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={openSupersetDialog}
                        aria-label={supersetEnabled ? 'Edit super set' : 'Enable super set'}
                        disabled={sessionExercises.length < 2}
                        className={`h-10 w-10 rounded-full hover:bg-primary/10 active:scale-[0.97] transition-transform ${
                            supersetEnabled ? 'text-primary' : 'text-foreground/60'
                        }`}
                    >
                        <PanelsLeftRight className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEndDialogOpen(true)}
                        aria-label="End workout"
                        className="h-10 w-10 rounded-full text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-transform"
                    >
                        <Square className="h-[18px] w-[18px]" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-full active:scale-[0.97] transition-transform">
                                <MoreHorizontal className="h-[18px] w-[18px] text-foreground/55" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {planWorkoutId === null && (
                                <DropdownMenuItem onClick={openSaveDialog}>
                                    <Bookmark className="mr-2 h-4 w-4" />
                                    Save workout
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setAllExercisesOpen(true)}>
                                <List className="mr-2 h-4 w-4" />
                                View all exercises
                            </DropdownMenuItem>
                        <DropdownMenuItem onClick={openRestDialog}>
                                <Timer className="mr-2 h-4 w-4" />
                                Manage rest time
                            </DropdownMenuItem>
                        <DropdownMenuItem onClick={openSupersetDialog}>
                            <PanelsLeftRight className="mr-2 h-4 w-4" />
                            {supersetEnabled ? 'Edit super set' : 'Enable super set'}
                        </DropdownMenuItem>
                        {supersetEnabled && (
                            <DropdownMenuItem onClick={handleDisableSuperset}>
                                <Square className="mr-2 h-4 w-4" />
                                Disable super set
                            </DropdownMenuItem>
                        )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setEndDialogOpen(true)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Square className="mr-2 h-4 w-4" />
                                End workout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ZONE A: Timer / Rest Zone OR Workout Complete */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {isWorkoutComplete ? (
                /* Workout Complete Card */
                <div className="flex flex-col items-center justify-center py-6">
                    <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-warning via-warning/70 to-warning rounded-full blur-xl opacity-25 animate-pulse" />
                        {/* Trophy icon */}
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center shadow-lg">
                            <Trophy className="h-12 w-12 text-warning-foreground" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mt-4 bg-gradient-to-r from-warning to-warning/70 bg-clip-text text-transparent">
                        Workout Complete!
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Flame className="h-4 w-4 text-warning" />
                        {completedSets} sets · {duration}
                    </p>
                    <Button
                        onClick={handleEndWorkout}
                        className="mt-4 h-11 px-6 rounded-full bg-warning hover:bg-warning/90 text-warning-foreground font-semibold shadow-md"
                    >
                        Finish Workout
                    </Button>
                    <button
                        onClick={() => {
                            updateSessionExercises(
                                sessionExercises.map((ex) => ({ ...ex, setsCompleted: 0 }))
                            );
                            setCurrentExerciseAction(0);
                        }}
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Restart
                    </button>
                </div>
            ) : (
                /* Timer Zone - single focal point, state-driven colors */
                <div className="h-56 flex flex-col items-center pt-1 relative">
                    {/* Radial glow removed (keeps background consistent with theme's bg-background) */}

                    {/* Timer with ring - IN SET 8px, RESTING thinned to 5px for asymmetry */}
                    <div className={`relative transition-all duration-200 ease-out ${
                        isInSet ? 'scale-[0.62] translate-y-9' : isIdle ? 'scale-100 translate-y-0 animate-[breathe_3s_ease-in-out_infinite]' : 'scale-100 translate-y-0'
                    }`}>
                        {/* Progress Ring - IN SET 8px vs RESTING 5px */}
                        <svg className="w-44 h-44 -rotate-90 relative">
                            <circle
                                cx="88"
                                cy="88"
                                r="76"
                                stroke="currentColor"
                                strokeWidth={isInSet ? 8 : 5}
                                fill="none"
                                className={`transition-colors duration-200 ${
                                    isInSet ? 'text-success/40' : 'text-info/15'
                                }`}
                            />
                            <circle
                                cx="88"
                                cy="88"
                                r="76"
                                stroke="currentColor"
                                strokeWidth={isInSet ? 8 : 5}
                                fill="none"
                                strokeLinecap="round"
                                className={`transition-colors duration-200 ${
                                    isInSet ? 'text-success' : isRestTimerRunning ? 'text-info/[0.55]' : 'text-info/[0.35]'
                                }`}
                                strokeDasharray={2 * Math.PI * 76}
                                strokeDashoffset={2 * Math.PI * 76 * (1 - restTimerProgress / 100)}
                                style={{ transition: 'stroke-dashoffset 0.1s ease' }}
                            />
                        </svg>
                        {/* Timer Text - IN SET: semibold, RESTING: medium (no font-black) */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-[3rem] tabular-nums transition-all duration-200 ${
                                isInSet
                                    ? 'font-semibold text-success'
                                    : isRestTimerRunning
                                        ? 'font-medium text-info/70'
                                        : 'font-medium text-info/60'
                            }`}>
                                {formatTime(remainingSeconds)}
                            </span>
                            {/* Only show label during active states - timer owns time, card owns READY */}
                            {(isInSet || isRestTimerRunning) && (
                                <span className={`text-[10px] uppercase tracking-widest font-semibold mt-0.5 transition-colors duration-200 ${
                                    isInSet ? 'text-success' : 'text-info/80'
                                }`}>
                                    {isInSet ? 'In Set' : 'Resting'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Presets / Skip */}
                    <div className="mt-2 flex justify-center h-8">
                        {/* Rest Presets - only when idle */}
                        {isIdle && (
                            <div className="flex gap-2">
                                {[60, 90, 120].map((seconds) => (
                                    <button
                                        key={seconds}
                                        onClick={() => startRestTimer(seconds)}
                                        className="px-3.5 py-1 text-xs font-medium rounded-full bg-info/8 hover:bg-info/15 text-info/80 hover:text-info transition-all duration-150 active:scale-95"
                                    >
                                        {seconds}s
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* Skip - text only, minimal */}
                        {isRestTimerRunning && !isInSet && (
                            <button
                                onClick={cancelRestTimer}
                                className="text-xs font-medium text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors duration-150"
                            >
                                Skip
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ZONE B: Exercise Card with Nav (hidden when workout complete) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {currentExercise && !isWorkoutComplete && (
                <div className="flex-1 px-1 pt-1 pb-3 flex justify-center">
                    <div className={`relative ${supersetEnabled && supersetExercises.length === 2 ? 'w-full max-w-3xl' : 'w-[360px] max-w-full'} rounded-xl overflow-hidden bg-card border border-border/40 transition-all duration-200 ease-out ${
                        isInSet
                            ? 'shadow-2xl scale-[1.02] -translate-y-2'
                            : isRestTimerRunning
                                ? 'shadow-sm dark:shadow-md'
                                : 'shadow-md dark:shadow-lg'
                    }`}>
                        <div className={`relative h-2 transition-all duration-200 ${
                            isInSet
                                ? 'bg-success/70'
                                : isRestTimerRunning
                                    ? 'bg-info/30'
                                    : 'bg-muted-foreground/15'
                        }`} />

                        {supersetEnabled && supersetExercises.length === 2 ? (
                            <div className="px-6 py-5 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-foreground">Super set</div>
                                    <Button variant="outline" size="sm" onClick={openSupersetDialog}>
                                        Choose exercises
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {supersetExercises.map((exercise, idx) => {
                                        const isCompleted = exercise.setsCompleted >= exercise.targetSets;
                                        return (
                                            <div key={exercise.planExerciseId} className="rounded-lg border border-border/50 p-4 shadow-sm bg-card/80">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border/40">
                                                        {exercise.exerciseDef.imageUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={exercise.exerciseDef.imageUrl}
                                                                alt=""
                                                                className="w-full h-full object-contain"
                                                            />
                                                        ) : (
                                                            <Dumbbell className="h-6 w-6 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate">
                                                            {idx === 0 ? 'A · ' : 'B · '}
                                                            {exercise.exerciseDef.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {exercise.planExercise.reps} reps
                                                            {exercise.planExercise.weight > 0 && ` · ${exercise.planExercise.weight}kg`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mt-3">
                                                    <div className="flex items-center gap-2">
                                                        {Array.from({ length: exercise.targetSets }).map((_, i) => {
                                                            const dotComplete = i < exercise.setsCompleted;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`h-2.5 w-2.5 rounded-full transition-colors duration-200 ${
                                                                        dotComplete ? 'bg-success' : 'bg-muted-foreground/30'
                                                                    }`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {exercise.setsCompleted}/{exercise.targetSets}
                                                    </span>
                                                </div>
                                                {isCompleted && (
                                                    <p className="mt-2 text-xs text-success font-medium">Done</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center justify-center gap-3 pt-2">
                                    {isInSet ? (
                                        <Button
                                            onClick={handleCompleteSet}
                                            className="h-11 px-6 rounded-xl text-sm font-bold bg-success/90 hover:bg-success/90 text-success-foreground shadow-lg transition-none active:scale-[0.995]"
                                        >
                                            Complete Set (A & B)
                                        </Button>
                                    ) : supersetComplete ? (
                                        <Button
                                            variant="outline"
                                            className="h-11 px-6 rounded-xl text-sm font-semibold"
                                            disabled
                                        >
                                            Superset complete
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={handleStartSet}
                                            className="h-11 px-6 rounded-xl text-sm font-bold bg-info hover:bg-info/90 text-info-foreground shadow-lg shadow-info/40 active:scale-[0.97]"
                                        >
                                            Start Sets
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Internal nav arrows - vertically centered, anchored */}
                                <div className="pointer-events-none">
                                    <button
                                        onClick={() => setCurrentExerciseAction(currentExerciseIndex - 1)}
                                        disabled={currentExerciseIndex <= 0 || isInSet}
                                        className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-muted/25 text-muted-foreground/70 ring-1 ring-border/30 hover:bg-muted/45 hover:text-foreground/80 transition-all duration-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentExerciseAction(currentExerciseIndex + 1)}
                                        disabled={currentExerciseIndex >= sessionExercises.length - 1 || isInSet}
                                        className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-muted/25 text-muted-foreground/70 ring-1 ring-border/30 hover:bg-muted/45 hover:text-foreground/80 transition-all duration-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="flex flex-col items-center px-6 py-5">
                                    {/* Exercise Image - grounded with shadow */}
                                    <div className="relative mb-4">
                                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-md ring-1 ring-border/25">
                                            {currentExercise.exerciseDef.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={currentExercise.exerciseDef.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-contain bg-muted/30"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                                    <Dumbbell className="h-7 w-7 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Ground shadow */}
                                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-14 h-2.5 bg-foreground/10 rounded-full blur-md" />
                                    </div>

                                    {/* Exercise Name - heaviest weight */}
                                    <h2 className="text-xl font-extrabold text-center text-foreground">
                                        {currentExercise.exerciseDef.name}
                                    </h2>

                                    {/* Reps · Weight - increased contrast */}
                                    <p className="text-sm mt-1 font-medium text-muted-foreground/80">
                                        {currentExercise.planExercise.reps} reps
                                        {currentExercise.planExercise.weight > 0 && ` · ${currentExercise.planExercise.weight}kg`}
                                    </p>

                                    {/* Set Dots - state-aware: IN SET quiets glow, confirms don't celebrate */}
                                    <div className="flex items-center justify-center gap-2.5 mt-4">
                                        {Array.from({ length: currentExercise.targetSets }).map((_, i) => {
                                            const isCompleted = i < currentExercise.setsCompleted;
                                            const isCurrent = i === currentExercise.setsCompleted;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`rounded-full transition-all duration-200 ${
                                                        isCompleted
                                                            ? 'w-4 h-4 bg-success'
                                                            : isCurrent
                                                                ? isInSet
                                                                    ? 'w-4 h-4 bg-success ring-2 ring-success/25'
                                                                    : 'w-3.5 h-3.5 bg-transparent ring-[1.5px] ring-success/[0.7]'
                                                                : isInSet
                                                                    ? 'w-3 h-3 bg-muted-foreground/[0.2]'
                                                                    : 'w-3 h-3 bg-muted-foreground/[0.45]'
                                                    }`}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Numbers (secondary) */}
                                    <p className="text-[11px] mt-1.5 font-medium text-muted-foreground/60">
                                        {currentExercise.setsCompleted} of {currentExercise.targetSets}
                                    </p>
                                </div>

                                {/* CTA Area - state-aware styling */}
                                <div className="px-6 pb-5 pt-1">
                                    <div className="flex items-center justify-center gap-3">
                                        {/* Remove Set - max 40% opacity, hidden in IN SET */}
                                        <button
                                            onClick={handleRemoveSet}
                                            disabled={currentExercise.setsCompleted <= 0}
                                            className={`h-9 w-9 rounded-full border border-border/40 bg-muted/20 hover:bg-muted/60 hover:border-border flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-15 disabled:cursor-not-allowed ${
                                                isInSet ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-35 hover:opacity-90'
                                            }`}
                                        >
                                            <span className="text-base font-medium text-muted-foreground">−</span>
                                        </button>

                                        {/* Primary CTA - hierarchy: READY > REST, IN SET highest */}
                                        {isExerciseComplete ? (
                                            <Button
                                                onClick={() => {
                                                    if (currentExerciseIndex < sessionExercises.length - 1) {
                                                        setCurrentExerciseAction(currentExerciseIndex + 1);
                                                    }
                                                }}
                                                disabled={currentExerciseIndex >= sessionExercises.length - 1}
                                                className="h-11 px-6 rounded-xl text-sm font-semibold flex-1 max-w-[180px] bg-info hover:bg-info/90 text-info-foreground shadow-md shadow-info/30 active:scale-[0.97] transition-all duration-200"
                                            >
                                                Next Exercise
                                            </Button>
                                        ) : isInSet ? (
                                            <Button
                                                onClick={handleCompleteSet}
                                                className="h-12 px-8 rounded-xl text-sm font-bold flex-1 max-w-[200px] bg-success/90 hover:bg-success/90 text-success-foreground shadow-lg transition-none cursor-pointer active:scale-[0.995]"
                                            >
                                                Complete Set
                                            </Button>
                                        ) : isRestTimerRunning ? (
                                            <Button
                                                onClick={handleStartSet}
                                                className="h-10 px-5 rounded-xl text-sm font-medium flex-1 max-w-[160px] bg-info/75 hover:bg-info/90 text-info-foreground shadow-none active:scale-[0.97] transition-all duration-200"
                                            >
                                                Start Set
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={handleStartSet}
                                                className="h-11 px-7 rounded-xl text-sm font-bold flex-1 max-w-[180px] bg-info hover:bg-info/90 text-info-foreground shadow-lg shadow-info/40 active:scale-[0.97] transition-all duration-200"
                                            >
                                                Start Set
                                            </Button>
                                        )}

                                        {/* Add Set - max 40% opacity, hidden in IN SET */}
                                        <button
                                            onClick={handleAddSet}
                                            disabled={isExerciseComplete}
                                            className={`h-9 w-9 rounded-full border border-border/40 bg-muted/20 hover:bg-muted/60 hover:border-border flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-15 disabled:cursor-not-allowed ${
                                                isInSet ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-35 hover:opacity-90'
                                            }`}
                                        >
                                            <span className="text-base font-medium text-muted-foreground">+</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Save Workout Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Save Workout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="workout-name">Workout Name</Label>
                            <Input
                                id="workout-name"
                                value={workoutName}
                                onChange={(e) => setWorkoutName(e.target.value)}
                                placeholder="Enter workout name"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">
                                {sessionExercises.length} exercises
                            </Label>
                            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                                {sessionExercises.map((exercise) => (
                                    <div
                                        key={exercise.planExerciseId}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                                            {exercise.exerciseDef.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={exercise.exerciseDef.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="flex-1 truncate">{exercise.exerciseDef.name}</span>
                                        <span className="text-muted-foreground text-xs">
                                            {exercise.targetSets}x{exercise.planExercise.reps}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveWorkout}
                            disabled={!workoutName.trim() || createPlanWorkoutMutation.isPending}
                        >
                            {createPlanWorkoutMutation.isPending ? 'Saving...' : 'Save Workout'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Rest Time Dialog */}
            <Dialog open={restDialogOpen} onOpenChange={setRestDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Manage Rest Time</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            {[60, 90, 120].map((seconds) => (
                                <Button
                                    key={seconds}
                                    variant={restTimerDuration === seconds ? 'default' : 'outline'}
                                    className="h-10"
                                    onClick={() => handleSelectRest(seconds)}
                                >
                                    {seconds}s
                                </Button>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="custom-rest">Custom (seconds)</Label>
                            <Input
                                id="custom-rest"
                                type="number"
                                min={5}
                                value={customRest}
                                onChange={(e) => setCustomRest(e.target.value)}
                                placeholder="e.g. 75"
                            />
                            {restError && <p className="text-sm text-destructive">{restError}</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRestDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveCustomRest} disabled={!customRest.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Super Set Selection Dialog */}
            <Dialog open={supersetDialogOpen} onOpenChange={setSupersetDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Choose Super Set Exercises</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {sessionExercises.map((exercise) => {
                            const selected = supersetSelection.includes(exercise.planExerciseId);
                            const disabled = !selected && supersetSelection.length >= 2;
                            return (
                                <Button
                                    key={exercise.planExerciseId}
                                    variant={selected ? 'default' : 'outline'}
                                    className="w-full justify-between h-auto py-3"
                                    disabled={disabled}
                                    onClick={() => toggleSupersetSelection(exercise.planExerciseId)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border/40">
                                            {exercise.exerciseDef.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={exercise.exerciseDef.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold">{exercise.exerciseDef.name}</p>
                                            <p
                                                className={`text-xs ${
                                                    selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                                }`}
                                            >
                                                {exercise.targetSets} sets · {exercise.planExercise.reps} reps
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs ${
                                            selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {selected ? 'Selected' : disabled ? 'Limit reached' : 'Tap to select'}
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                    {supersetError && <p className="text-sm text-destructive">{supersetError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSupersetDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveSuperset} disabled={supersetSelection.length !== 2}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* End Workout Confirmation */}
            <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>End Workout?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {planWorkoutId === null && 'This workout is not saved. '}
                            Are you sure you want to end this workout?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEndWorkout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            End Workout
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        </>
    );
}

// All Exercises Full-Page Overlay
interface AllExercisesOverlayProps {
    exercises: ExerciseWeekProgress[];
    currentIndex: number;
    onSelectExercise: (index: number) => void;
    onReorderExercises: (nextExercises: ExerciseWeekProgress[]) => void;
    onRemoveExercise: (planExerciseId: string) => void;
    canAddFromPlan: boolean;
    planWeekExercises: ExerciseWeekProgress[];
    isSavedWorkout: boolean;
    onAddExercise: (exercise: ExerciseWeekProgress) => void;
    onBack: () => void;
}

function AllExercisesOverlay({
    exercises,
    currentIndex,
    onSelectExercise,
    onReorderExercises,
    onRemoveExercise,
    canAddFromPlan,
    planWeekExercises,
    isSavedWorkout,
    onAddExercise,
    onBack,
}: AllExercisesOverlayProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- route-local UI mode
    const [reorderMode, setReorderMode] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- route-local dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const moveExercise = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= exercises.length) return;
        const next = [...exercises];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return;
        next.splice(toIndex, 0, moved);
        onReorderExercises(next);
    };

    return (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-lg font-semibold truncate">All Exercises</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddDialogOpen(true)}
                        disabled={!canAddFromPlan}
                    >
                        Add exercise
                    </Button>
                    <Button
                        variant={reorderMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setReorderMode((v) => !v)}
                    >
                        {reorderMode ? 'Done' : 'Edit'}
                    </Button>
                </div>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isSavedWorkout ? (
                    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        Changes here affect the <span className="font-medium text-foreground">active workout</span> only and won’t update your saved workout.
                    </div>
                ) : null}
                {exercises.map((exercise, index) => {
                    const isComplete = exercise.setsCompleted >= exercise.targetSets;
                    const isCurrent = index === currentIndex;

                    const rowClassName = `w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        isCurrent ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted'
                    }`;

                    return (
                        <div key={exercise.planExerciseId} className={rowClassName}>
                            {reorderMode ? (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <GripVertical className="h-4 w-4 text-muted-foreground/70" />
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => moveExercise(index, index - 1)}
                                            disabled={index === 0}
                                            aria-label="Move up"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => moveExercise(index, index + 1)}
                                            disabled={index === exercises.length - 1}
                                            aria-label="Move down"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                        onClick={() => onRemoveExercise(exercise.planExerciseId)}
                                        aria-label="Remove from workout"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : null}
                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                {exercise.exerciseDef.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={exercise.exerciseDef.imageUrl}
                                        alt=""
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                disabled={reorderMode}
                                onClick={() => onSelectExercise(index)}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium truncate">{exercise.exerciseDef.name}</p>
                                        {isComplete && <Check className="h-4 w-4 text-success flex-shrink-0" />}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {exercise.planExercise.reps} reps
                                        {exercise.planExercise.weight > 0 && ` · ${exercise.planExercise.weight}kg`}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0">
                                <span className={`text-lg font-bold tabular-nums ${isComplete ? 'text-success' : ''}`}>
                                    {exercise.setsCompleted}/{exercise.targetSets}
                                </span>
                                {/* Mini dots */}
                                <div className="flex gap-0.5 mt-1">
                                    {Array.from({ length: exercise.targetSets }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-1.5 h-1.5 rounded-full ${
                                                i < exercise.setsCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Add Exercise Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add exercise</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {[...planWeekExercises]
                            .filter((exercise) => !exercises.some((ex) => ex.planExerciseId === exercise.planExerciseId))
                            .sort((a, b) => {
                                const aLeft = Math.max(0, a.targetSets - a.setsCompleted);
                                const bLeft = Math.max(0, b.targetSets - b.setsCompleted);
                                if (bLeft !== aLeft) return bLeft - aLeft; // Most sets left first
                                return a.exerciseDef.name.localeCompare(b.exerciseDef.name);
                            })
                            .map((exercise) => (
                                (() => {
                                    const isComplete = exercise.setsCompleted >= exercise.targetSets;
                                    return (
                                <div
                                    key={exercise.planExerciseId}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 bg-card"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border/40 flex-shrink-0">
                                            {exercise.exerciseDef.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={exercise.exerciseDef.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate">{exercise.exerciseDef.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {exercise.targetSets} sets · {exercise.planExercise.reps} reps
                                                {exercise.planExercise.weight > 0 && ` · ${exercise.planExercise.weight}kg`}
                                            </p>
                                        </div>
                                    </div>
                                    {isComplete ? (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Check className="h-4 w-4 text-success" />
                                            <span className="text-xs font-medium text-success">Done</span>
                                        </div>
                                    ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            onAddExercise(exercise);
                                            setAddDialogOpen(false);
                                        }}
                                    >
                                        Add
                                    </Button>
                                    )}
                                </div>
                                    );
                                })()
                            ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
