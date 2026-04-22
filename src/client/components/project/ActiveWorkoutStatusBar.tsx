/**
 * ActiveWorkoutStatusBar
 *
 * Compact status pill rendered in the TopNavBar slot while a workout session
 * is active. Shows set progress normally and flips to a live rest-timer
 * countdown when the rest timer is running. Clicking navigates to the Active
 * Workout page. Renders null when no session is active.
 */

import { Activity, Timer } from 'lucide-react';
import { useRouter } from '@/client/features';
import {
    useIsSessionActive,
    useSessionExercises,
    useRestTimer,
    formatTime,
} from '@/client/features/project/workout';

export function ActiveWorkoutStatusBar() {
    const { navigate, currentPath } = useRouter();
    const isActive = useIsSessionActive();
    const exercises = useSessionExercises();
    const restTimer = useRestTimer();

    if (!isActive) return null;

    const totalTarget = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
    const totalCompleted = exercises.reduce(
        (sum, ex) => sum + Math.min(ex.setsCompleted, ex.targetSets),
        0
    );

    const onActiveWorkoutPage = currentPath === '/active-workout';
    const isResting = restTimer.isRunning;

    const handleClick = () => {
        if (!onActiveWorkoutPage) navigate('/active-workout');
    };

    // Palette flips to the info/timer colors during rest so the bar doubles
    // as an at-a-glance rest countdown. `info` (blue) reads well in both
    // light and dark modes; `warning` (yellow) washes out in light mode.
    const tone = isResting
        ? 'border-info/40 bg-info/10 text-info hover:bg-info/20 disabled:hover:bg-info/10'
        : 'border-success/40 bg-success/10 text-success hover:bg-success/20 disabled:hover:bg-success/10';
    const dotColor = isResting ? 'bg-info' : 'bg-success';

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={onActiveWorkoutPage}
            aria-label={isResting ? 'Rest timer — go to active workout' : 'Go to active workout'}
            className={`relative overflow-hidden flex items-center gap-2 w-full min-w-0 h-9 px-3 rounded-full border disabled:cursor-default transition-colors ${tone}`}
        >
            {/* Progress fill for the rest timer (fills from left to right) */}
            {isResting && (
                <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-info/20 transition-[width] duration-100 ease-linear"
                    style={{ width: `${restTimer.progress}%` }}
                />
            )}
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75 animate-ping`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
            </span>
            {isResting ? (
                <Timer className="relative h-4 w-4 shrink-0" aria-hidden />
            ) : (
                <Activity className="relative h-4 w-4 shrink-0" aria-hidden />
            )}
            <div className="relative flex-1 min-w-0 text-left text-sm font-semibold leading-none tabular-nums truncate">
                {isResting
                    ? formatTime(restTimer.remainingSeconds)
                    : totalTarget > 0
                      ? `${totalCompleted}/${totalTarget} sets`
                      : ''}
            </div>
        </button>
    );
}
