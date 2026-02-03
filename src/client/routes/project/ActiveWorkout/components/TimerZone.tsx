import { formatTime } from '@/client/features/workout';

interface TimerZoneProps {
    isInSet: boolean;
    isRestTimerRunning: boolean;
    remainingSeconds: number;
    restTimerProgress: number;
    onStartRestTimer: (seconds: number) => void;
    onCancelRestTimer: () => void;
}

export function TimerZone({
    isInSet,
    isRestTimerRunning,
    remainingSeconds,
    restTimerProgress,
    onStartRestTimer,
    onCancelRestTimer,
}: TimerZoneProps) {
    // Determine current state for consistent styling
    const isIdle = !isRestTimerRunning && !isInSet;

    return (
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
                                onClick={() => onStartRestTimer(seconds)}
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
                        onClick={onCancelRestTimer}
                        className="text-xs font-medium text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors duration-150"
                    >
                        Skip
                    </button>
                )}
            </div>
        </div>
    );
}
