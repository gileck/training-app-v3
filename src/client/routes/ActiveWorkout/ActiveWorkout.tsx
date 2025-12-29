import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Switch } from '@/client/components/ui/switch';
import { Label } from '@/client/components/ui/label';
import { Input } from '@/client/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/client/components/ui/dialog';
import {
    Play,
    Dumbbell,
    Clock,
    Square,
    Bookmark,
    Timer,
    Plus,
    Minus,
    Check,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useRouter } from '@/client/router';
import {
    useIsSessionActive,
    useSessionExercises,
    useCurrentExercise,
    useCurrentExerciseIndex,
    useCompletedSetsThisSession,
    useSessionStartedAt,
    useSessionSource,
    useEndSession,
    useSetCurrentExercise,
    useStartRestTimer,
    useCancelRestTimer,
    useIncrementCompletedSets,
    useUpdateSessionExercises,
    useRestTimer,
    useAutoStartTimer,
    useToggleAutoStartTimer,
    useUpdateSets,
    useActivePlanId,
    useCurrentWeek,
    formatTime,
    useSavedWorkoutName,
    useSetSavedWorkoutName,
} from '@/client/features/workout';
import { useCreateSavedWorkout } from '../Home/hooks';
import { toast } from '@/client/components/ui/toast';
import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

type ActiveTab = 'current' | 'all';

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
    const completedSetsThisSession = useCompletedSetsThisSession();
    const sessionStartedAt = useSessionStartedAt();
    const sessionSource = useSessionSource();
    const endSession = useEndSession();
    const setCurrentExerciseAction = useSetCurrentExercise();
    const startRestTimer = useStartRestTimer();
    const cancelRestTimer = useCancelRestTimer();
    const incrementCompletedSets = useIncrementCompletedSets();
    const updateSessionExercises = useUpdateSessionExercises();
    const { remainingSeconds, isRunning: isRestTimerRunning, progress: restTimerProgress } = useRestTimer();
    const autoStartTimer = useAutoStartTimer();
    const toggleAutoStartTimer = useToggleAutoStartTimer();

    // Mutations
    const updateSetsMutation = useUpdateSets();
    const createWorkoutMutation = useCreateSavedWorkout();

    // Local state
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral timer state
    const [duration, setDuration] = useState('0:00');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [activeTab, setActiveTab] = useState<ActiveTab>('current');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [workoutName, setWorkoutName] = useState('');
    // Persisted saved workout name from session store
    const savedWorkoutName = useSavedWorkoutName();
    const setSavedWorkoutName = useSetSavedWorkoutName();

    // Calculate total sets
    const totalSets = sessionExercises.reduce((sum, ex) => sum + ex.targetSets, 0);
    const completedExercises = sessionExercises.filter(ex => ex.setsCompleted >= ex.targetSets).length;

    useEffect(() => {
        if (!isSessionActive || !sessionStartedAt) return;

        const updateDuration = () => {
            const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateDuration();
        const interval = setInterval(updateDuration, 1000);
        return () => clearInterval(interval);
    }, [isSessionActive, sessionStartedAt]);

    // Handle session set completion
    const handleSessionAddSet = (exercise?: ExerciseWeekProgress) => {
        const targetExercise = exercise || currentExercise;
        if (!targetExercise) return;
        if (targetExercise.setsCompleted >= targetExercise.targetSets) return;

        // Only sync to backend for plan-based sessions
        if (sessionSource === 'plan' && activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: targetExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'add',
            });
        }

        // Update session state
        incrementCompletedSets();

        // Auto-start rest timer
        if (autoStartTimer) {
            startRestTimer();
        }

        // Update session exercises with new set count
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === targetExercise.planExerciseId
                    ? { ...ex, setsCompleted: ex.setsCompleted + 1 }
                    : ex
            )
        );
    };

    const handleSessionRemoveSet = (exercise?: ExerciseWeekProgress) => {
        const targetExercise = exercise || currentExercise;
        if (!targetExercise) return;
        if (targetExercise.setsCompleted <= 0) return;

        // Only sync to backend for plan-based sessions
        if (sessionSource === 'plan' && activePlanId) {
            updateSetsMutation.mutate({
                planId: activePlanId,
                planExerciseId: targetExercise.planExerciseId,
                weekNumber: currentWeek,
                action: 'remove',
            });
        }

        // Update session exercises
        updateSessionExercises(
            sessionExercises.map((ex) =>
                ex.planExerciseId === targetExercise.planExerciseId
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
                // Pass exercise definitions for optimistic UI update
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
            <div className="pb-20 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Dumbbell className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No Active Workout</h3>
                        <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
                            Start a workout from the home screen to track your exercises with rest timers
                        </p>
                        <Button
                            onClick={() => navigate('/')}
                            className="h-12 px-6 rounded-xl"
                        >
                            <Play className="mr-2 h-5 w-5" />
                            Go to Workouts
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="pb-20 space-y-4">
            {/* Header with optional saved workout name */}
            {savedWorkoutName && (
                <h1 className="text-lg font-semibold">{savedWorkoutName}</h1>
            )}

            {/* Compact Stats Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium tabular-nums">{duration}</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <span className="text-sm text-muted-foreground">
                        {completedSetsThisSession}/{totalSets} sets
                    </span>
                    <div className="h-4 w-px bg-border" />
                    <span className="text-sm text-muted-foreground">
                        {completedExercises}/{sessionExercises.length} done
                    </span>
                </div>
                <div className="flex gap-2">
                    {sessionSource === 'plan' && !savedWorkoutName && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={openSaveDialog}
                            className="h-8 px-3"
                        >
                            <Bookmark className="h-4 w-4 mr-1" />
                            Save
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEndWorkout}
                        className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Square className="h-4 w-4 mr-1" />
                        End
                    </Button>
                </div>
            </div>

            {/* Rest Timer - Always Visible */}
            <Card className={`rounded-2xl border-0 shadow-sm overflow-hidden ${isRestTimerRunning ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isRestTimerRunning ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <Timer className="h-6 w-6" />
                            </div>
                            <div>
                                <p className={`text-3xl font-bold tabular-nums ${isRestTimerRunning ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {formatTime(remainingSeconds)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {isRestTimerRunning ? 'Rest time' : 'Tap to start'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Quick presets */}
                            {!isRestTimerRunning ? (
                                <div className="flex gap-1">
                                    {[60, 90, 120].map((seconds) => (
                                        <Button
                                            key={seconds}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => startRestTimer(seconds)}
                                            className="h-8 px-2 text-xs rounded-lg"
                                        >
                                            {seconds}s
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelRestTimer}
                                    className="h-8 rounded-lg"
                                >
                                    Skip
                                </Button>
                            )}
                        </div>
                    </div>
                    {/* Progress bar - below time (always rendered to keep consistent height) */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                        <div
                            className={`h-full rounded-full transition-all duration-100 ${isRestTimerRunning ? 'bg-primary' : 'bg-transparent'}`}
                            style={{ width: isRestTimerRunning ? `${restTimerProgress}%` : '0%' }}
                        />
                    </div>
                    {/* Auto-start toggle - compact */}
                    <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                        <Label htmlFor="auto-timer" className="text-xs text-muted-foreground cursor-pointer">
                            Auto-start
                        </Label>
                        <Switch
                            id="auto-timer"
                            checked={autoStartTimer}
                            onCheckedChange={toggleAutoStartTimer}
                            className="scale-75"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tabs: Current / All Exercises */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="w-full">
                <TabsList className="bg-muted p-1 rounded-xl w-full">
                    <TabsTrigger value="current" className="flex-1 rounded-lg text-sm font-medium">
                        Current
                    </TabsTrigger>
                    <TabsTrigger value="all" className="flex-1 rounded-lg text-sm font-medium">
                        All Exercises
                    </TabsTrigger>
                </TabsList>

                {/* Current Exercise Tab */}
                <TabsContent value="current" className="mt-4">
                    {currentExercise && (
                        <CurrentExerciseCard
                            exercise={currentExercise}
                            currentIndex={currentExerciseIndex}
                            totalExercises={sessionExercises.length}
                            onPrevious={() => setCurrentExerciseAction(currentExerciseIndex - 1)}
                            onNext={() => setCurrentExerciseAction(currentExerciseIndex + 1)}
                            onAddSet={() => handleSessionAddSet()}
                            onRemoveSet={() => handleSessionRemoveSet()}
                        />
                    )}
                </TabsContent>

                {/* All Exercises Tab */}
                <TabsContent value="all" className="mt-4 space-y-2">
                    {sessionExercises.map((exercise, index) => (
                        <ExerciseListItem
                            key={exercise.planExerciseId}
                            exercise={exercise}
                            isActive={index === currentExerciseIndex}
                            onSelect={() => {
                                setCurrentExerciseAction(index);
                                setActiveTab('current');
                            }}
                            onAddSet={() => handleSessionAddSet(exercise)}
                            onRemoveSet={() => handleSessionRemoveSet(exercise)}
                        />
                    ))}
                </TabsContent>
            </Tabs>

            {/* Save Workout Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Save Workout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Workout Name Input */}
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

                        {/* Exercises Preview */}
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
                        <Button
                            variant="outline"
                            onClick={() => setSaveDialogOpen(false)}
                        >
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
        </div>
    );
}

// Current Exercise Card - Large format for focused view
interface CurrentExerciseCardProps {
    exercise: ExerciseWeekProgress;
    currentIndex: number;
    totalExercises: number;
    onPrevious: () => void;
    onNext: () => void;
    onAddSet: () => void;
    onRemoveSet: () => void;
}

function CurrentExerciseCard({
    exercise,
    currentIndex,
    totalExercises,
    onPrevious,
    onNext,
    onAddSet,
    onRemoveSet
}: CurrentExerciseCardProps) {
    const isComplete = exercise.setsCompleted >= exercise.targetSets;

    return (
        <Card className={`rounded-2xl border-0 shadow-lg ${isComplete ? 'ring-2 ring-success bg-success/5' : ''}`}>
            <CardContent className="p-5">
                {/* Exercise counter */}
                <p className="text-center text-xs text-muted-foreground mb-3">
                    {currentIndex + 1} / {totalExercises}
                </p>

                {/* Exercise Image */}
                <div className="aspect-square max-h-36 mx-auto mb-4 rounded-2xl bg-muted overflow-hidden">
                    {exercise.exerciseDef.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={exercise.exerciseDef.imageUrl}
                            alt={exercise.exerciseDef.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Dumbbell className="h-12 w-12 text-muted-foreground" />
                        </div>
                    )}
                </div>

                {/* Exercise Name with Nav Arrows */}
                <div className="flex items-center justify-between mb-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onPrevious}
                        disabled={currentIndex <= 0}
                        className="h-10 w-10 rounded-full"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-xl font-bold text-center flex-1 px-2">{exercise.exerciseDef.name}</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNext}
                        disabled={currentIndex >= totalExercises - 1}
                        className="h-10 w-10 rounded-full"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>

                {/* Reps/Weight Info */}
                <p className="text-sm text-muted-foreground text-center mb-4">
                    {exercise.planExercise.reps} reps
                    {exercise.planExercise.weight > 0 && ` • ${exercise.planExercise.weight}kg`}
                </p>

                {/* Sets Progress */}
                <div className="text-center mb-5">
                    <p className={`text-5xl font-bold ${isComplete ? 'text-success' : ''}`}>
                        {exercise.setsCompleted}<span className="text-2xl text-muted-foreground">/{exercise.targetSets}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">sets completed</p>
                </div>

                {/* Action Buttons - Same size */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={onRemoveSet}
                        disabled={exercise.setsCompleted <= 0}
                        className="h-16 w-16 rounded-full border-2 border-border bg-background flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-3xl font-light text-foreground">−</span>
                    </button>
                    {isComplete ? (
                        <div className="h-16 w-16 rounded-full bg-success/10 border-2 border-success/50 flex items-center justify-center">
                            <CheckCheck className="h-7 w-7 text-success" />
                        </div>
                    ) : (
                        <button
                            onClick={onAddSet}
                            className="h-16 w-16 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
                        >
                            <span className="text-3xl font-light text-primary-foreground">+</span>
                        </button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Exercise List Item - Compact with inline set controls
interface ExerciseListItemProps {
    exercise: ExerciseWeekProgress;
    isActive: boolean;
    onSelect: () => void;
    onAddSet: () => void;
    onRemoveSet: () => void;
}

function ExerciseListItem({ exercise, isActive, onSelect, onAddSet, onRemoveSet }: ExerciseListItemProps) {
    const isComplete = exercise.setsCompleted >= exercise.targetSets;
    const progress = (exercise.setsCompleted / exercise.targetSets) * 100;

    return (
        <Card className={`rounded-xl border-0 shadow-sm transition-all ${isActive ? 'ring-2 ring-primary' : ''} ${isComplete ? 'bg-success/5' : ''}`}>
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Image - tap to select */}
                    <button
                        onClick={onSelect}
                        className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary/50 transition-all"
                    >
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
                    </button>

                    {/* Info - tap to select */}
                    <button onClick={onSelect} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{exercise.exerciseDef.name}</p>
                            {isComplete && <Check className="h-4 w-4 text-success flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {exercise.planExercise.reps} reps
                            {exercise.planExercise.weight > 0 && ` • ${exercise.planExercise.weight}kg`}
                        </p>
                        {/* Progress bar */}
                        <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                            <div
                                className={`h-full rounded-full transition-all ${isComplete ? 'bg-success' : 'bg-primary'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                    </button>

                    {/* Sets & Controls */}
                    <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold tabular-nums ${isComplete ? 'text-success' : ''}`}>
                            {exercise.setsCompleted}/{exercise.targetSets}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveSet();
                                }}
                                disabled={exercise.setsCompleted <= 0}
                                className="h-8 w-8 rounded-full"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddSet();
                                }}
                                disabled={isComplete}
                                className="h-8 w-8 rounded-full"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
