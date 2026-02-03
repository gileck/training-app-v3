import { useEffect, useState } from 'react';
import { Button } from '@/client/components/ui/button';
import { Dumbbell, Timer, Play, Pause } from 'lucide-react';
import { useRouter } from '@/client/router';
import {
    useIsSessionActive,
    useCurrentExercise,
    useCompletedSetsThisSession,
    useSessionStartedAt,
    useSessionExercises,
    useRestTimer,
    useStartRestTimer,
    useCancelRestTimer,
    formatTime,
} from '@/client/features/project/workout';

export function FloatingWorkoutBar() {
    const { navigate, currentPath } = useRouter();

    // Session state
    const isSessionActive = useIsSessionActive();
    const currentExercise = useCurrentExercise();
    const completedSetsThisSession = useCompletedSetsThisSession();
    const sessionStartedAt = useSessionStartedAt();
    const sessionExercises = useSessionExercises();
    const { remainingSeconds, isRunning: isRestTimerRunning } = useRestTimer();
    const startRestTimer = useStartRestTimer();
    const cancelRestTimer = useCancelRestTimer();

    // Live duration update
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral timer state
    const [duration, setDuration] = useState('0:00');

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

    // Don't show if no active session or already on active workout page
    if (!isSessionActive || currentPath === '/active-workout') {
        return null;
    }

    // Calculate total sets in session
    const totalSets = sessionExercises.reduce((sum, ex) => sum + ex.targetSets, 0);

    const handleBarClick = () => {
        navigate('/active-workout');
    };

    const handleTimerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRestTimerRunning) {
            cancelRestTimer();
        } else {
            startRestTimer(90); // Default 90s rest
        }
    };

    return (
        <div
            className="fixed bottom-16 left-0 right-0 px-2 pb-2 sm:px-4 sm:pb-4 pointer-events-none z-40"
        >
            <button
                onClick={handleBarClick}
                className="w-full max-w-screen-lg mx-auto bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/25 p-3 flex items-center gap-3 active:scale-[0.98] transition-transform pointer-events-auto"
            >
                {/* Exercise Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {currentExercise?.exerciseDef.imageUrl ? (
                        <img
                            src={currentExercise.exerciseDef.imageUrl}
                            alt={currentExercise.exerciseDef.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <Dumbbell className="h-5 w-5 text-primary-foreground/70" />
                    )}
                </div>

                {/* Exercise Info */}
                <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold truncate text-sm">
                        {currentExercise?.exerciseDef.name || 'Active Workout'}
                    </p>
                    <p className="text-xs text-primary-foreground/70 flex items-center gap-2">
                        <span>{duration}</span>
                        <span>•</span>
                        <span>{completedSetsThisSession}/{totalSets} sets</span>
                    </p>
                </div>

                {/* Rest Timer Display or Button */}
                {isRestTimerRunning ? (
                    <div className="flex items-center gap-2">
                        <div className="bg-primary-foreground/20 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                            <Timer className="h-4 w-4" />
                            <span className="font-mono text-sm font-semibold tabular-nums">
                                {formatTime(remainingSeconds)}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleTimerClick}
                            className="h-9 w-9 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
                        >
                            <Pause className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleTimerClick}
                        className="h-9 w-9 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
                    >
                        <Play className="h-4 w-4" />
                    </Button>
                )}
            </button>
        </div>
    );
}
