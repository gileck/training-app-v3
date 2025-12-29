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
    Trophy,
    Flame,
} from 'lucide-react';
import { useRouter } from '@/client/router';
import {
    useIsSessionActive,
    useSessionExercises,
    useCurrentExercise,
    useCurrentExerciseIndex,
    useSessionStartedAt,
    useSessionSource,
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
    useSavedWorkoutName,
    useSetSavedWorkoutName,
    useIsInSet,
    useSetIsInSet,
} from '@/client/features/workout';
import { useCreateSavedWorkout } from '../Home/hooks';
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
    const sessionSource = useSessionSource();
    const endSession = useEndSession();
    const setCurrentExerciseAction = useSetCurrentExercise();
    const startRestTimer = useStartRestTimer();
    const cancelRestTimer = useCancelRestTimer();
    const incrementCompletedSets = useIncrementCompletedSets();
    const updateSessionExercises = useUpdateSessionExercises();
    const { remainingSeconds, isRunning: isRestTimerRunning, progress: restTimerProgress } = useRestTimer();
    const isInSet = useIsInSet();
    const setIsInSet = useSetIsInSet();
    const prevRestStateRef = useRef<{ isRunning: boolean; remainingSeconds: number }>({
        isRunning: false,
        remainingSeconds: 0,
    });

    // Saved workout state
    const savedWorkoutName = useSavedWorkoutName();
    const setSavedWorkoutName = useSetSavedWorkoutName();

    // Mutations
    const updateSetsMutation = useUpdateSets();
    const createWorkoutMutation = useCreateSavedWorkout();

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

    // Handle COMPLETE SET
    const handleCompleteSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted >= currentExercise.targetSets) return;

        // Only sync to backend for plan-based sessions
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

    // Handle add set (same as complete but without state transitions)
    const handleAddSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted >= currentExercise.targetSets) return;

        // Only sync to backend for plan-based sessions
        if (sessionSource === 'plan' && activePlanId) {
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

    // Handle remove set
    const handleRemoveSet = () => {
        if (!currentExercise) return;
        if (currentExercise.setsCompleted <= 0) return;

        // Only sync to backend for plan-based sessions
        if (sessionSource === 'plan' && activePlanId) {
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
        if (sessionExercises.length === 0 || !workoutName.trim()) return;

        createWorkoutMutation.mutate(
            {
                name: workoutName.trim(),
                exercises: sessionExercises.map((ex) => ({
                    exerciseDefId: ex.exerciseDef._id,
                    sets: ex.targetSets,
                    reps: ex.planExercise.reps,
                    weight: ex.planExercise.weight,
                    durationSeconds: ex.planExercise.durationSeconds,
                })),
                exerciseDefs: sessionExercises.map((ex) => ex.exerciseDef),
            },
            {
                onSuccess: () => {
                    toast.success('Workout saved!');
                    setSavedWorkoutName(workoutName.trim());
                    setSaveDialogOpen(false);
                    setWorkoutName('');
                },
                onError: (error) => {
                    toast.error(`Failed to save: ${error.message}`);
                },
            }
        );
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
        return (
            <AllExercisesOverlay
                exercises={sessionExercises}
                currentIndex={currentExerciseIndex}
                onSelectExercise={(index) => {
                    setCurrentExerciseAction(index);
                    setAllExercisesOpen(false);
                }}
                onBack={() => setAllExercisesOpen(false)}
            />
        );
    }

    const isExerciseComplete = currentExercise ? currentExercise.setsCompleted >= currentExercise.targetSets : false;

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
        <div className={`flex flex-col min-h-[calc(100dvh-8rem)] pt-3 transition-colors duration-200 ${
            isInSet
                ? 'bg-background'
                : 'bg-gradient-to-b from-info/[0.10] via-background to-background dark:from-info/[0.07] dark:via-background dark:to-background'
        }`}>
            {/* Context Bar - transparent to blend with page background */}
            <div className="flex items-center justify-between py-3 px-6 max-h-14">
                {/* Stacked layout: name on top, time + progress below - IN SET demoted to historical context */}
                <div className={`flex flex-col gap-1 min-w-0 transition-opacity duration-200 ${
                    isInSet ? 'opacity-60' : isIdle ? 'opacity-70' : 'opacity-80'
                }`}>
                    <p className="text-[18px] font-semibold text-foreground/85 truncate">
                        {savedWorkoutName || 'Unsaved Workout'}
                    </p>
                    <p className="text-[14px] font-normal text-foreground/60 flex items-center">
                        <span>{duration}</span>
                        <span className="mx-2 text-foreground/25">·</span>
                        <span>{completedSets}/{totalSets} sets</span>
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 -mr-2">
                            <MoreHorizontal className="h-[18px] w-[18px] text-foreground/55" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!savedWorkoutName && (
                            <DropdownMenuItem onClick={openSaveDialog}>
                                <Bookmark className="mr-2 h-4 w-4" />
                                Save workout
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setAllExercisesOpen(true)}>
                            <List className="mr-2 h-4 w-4" />
                            View all exercises
                        </DropdownMenuItem>
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
                    {/* Radial glow - subtle backdrop, not a focal element */}
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 rounded-full transition-all duration-200 ${
                            isInSet
                                ? 'bg-success/[0.06] top-11 w-32 h-32'
                                : isRestTimerRunning
                                    ? 'bg-info/[0.03] top-0 w-48 h-48'
                                    : 'bg-info/[0.04] top-0 w-44 h-44'
                        }`}
                        style={{ filter: isInSet ? 'blur(12px)' : 'blur(40px)' }}
                    />

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
                <div className="flex-1 flex items-start gap-2 px-2 pt-2 pb-4">
                    {/* Previous Exercise - max 40% opacity */}
                    <button
                        onClick={() => setCurrentExerciseAction(currentExerciseIndex - 1)}
                        disabled={currentExerciseIndex <= 0}
                        className={`mt-16 h-11 w-11 flex items-center justify-center rounded-full bg-muted/25 text-muted-foreground/70 ring-1 ring-border/30 hover:bg-muted/45 hover:text-foreground/80 transition-all duration-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed ${
                            isInSet ? 'opacity-0 scale-75 pointer-events-none' : ''
                        }`}
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>

                    {/* Exercise Card - tokenized elevation: REST (sm), READY (md), IN SET (lg tight) */}
                    <div className={`relative flex-1 rounded-xl overflow-hidden bg-card border border-border/40 transition-all duration-200 ease-out ${
                        isInSet
                            ? 'shadow-2xl scale-[1.02] -translate-y-2'
                            : isRestTimerRunning
                                ? 'shadow-sm dark:shadow-md'
                                : 'shadow-md dark:shadow-lg'
                    }`}>
                        {/* Top accent bar - reduced height, subtle state hint only */}
                        <div className={`relative h-2 transition-all duration-200 ${
                            isInSet
                                ? 'bg-success/70'
                                : isRestTimerRunning
                                    ? 'bg-info/30'
                                    : 'bg-muted-foreground/15'
                        }`} />

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
                    </div>

                    {/* Next Exercise - max 40% opacity */}
                    <button
                        onClick={() => setCurrentExerciseAction(currentExerciseIndex + 1)}
                        disabled={currentExerciseIndex >= sessionExercises.length - 1}
                        className={`mt-16 h-11 w-11 flex items-center justify-center rounded-full bg-muted/25 text-muted-foreground/70 ring-1 ring-border/30 hover:bg-muted/45 hover:text-foreground/80 transition-all duration-200 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed ${
                            isInSet ? 'opacity-0 scale-75 pointer-events-none' : ''
                        }`}
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
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
                            disabled={!workoutName.trim() || createWorkoutMutation.isPending}
                        >
                            {createWorkoutMutation.isPending ? 'Saving...' : 'Save Workout'}
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
                            {!savedWorkoutName && 'This workout is not saved. '}
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
    onBack: () => void;
}

function AllExercisesOverlay({ exercises, currentIndex, onSelectExercise, onBack }: AllExercisesOverlayProps) {
    return (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold">All Exercises</h2>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {exercises.map((exercise, index) => {
                    const isComplete = exercise.setsCompleted >= exercise.targetSets;
                    const isCurrent = index === currentIndex;

                    return (
                        <button
                            key={exercise.planExerciseId}
                            onClick={() => onSelectExercise(index)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                                isCurrent ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted'
                            }`}
                        >
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
                            <div className="flex flex-col items-end">
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
                    );
                })}
            </div>
        </div>
    );
}
