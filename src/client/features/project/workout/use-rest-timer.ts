import { useState, useEffect } from 'react';
import { useRestTimerEndAt, useRestTimerDuration, useCancelRestTimer } from './session-store';

export interface RestTimerState {
    isRunning: boolean;
    remainingSeconds: number;
    progress: number; // 0-100
}

export function useRestTimer(): RestTimerState {
    const restTimerEndAt = useRestTimerEndAt();
    const restTimerDuration = useRestTimerDuration();
    const cancelTimer = useCancelRestTimer();

    // eslint-disable-next-line state-management/prefer-state-architecture -- timer UI state that updates frequently
    const [state, setState] = useState<RestTimerState>({
        isRunning: false,
        remainingSeconds: 0,
        progress: 0,
    });

    useEffect(() => {
        if (!restTimerEndAt) {
            setState({
                isRunning: false,
                remainingSeconds: 0,
                progress: 0,
            });
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((restTimerEndAt - now) / 1000));
            const totalDuration = restTimerDuration;
            const elapsed = totalDuration - remaining;
            const progress = Math.min(100, (elapsed / totalDuration) * 100);

            if (remaining <= 0) {
                // Timer finished
                cancelTimer();
                setState({
                    isRunning: false,
                    remainingSeconds: 0,
                    progress: 100,
                });

                // Optional: Play notification sound or vibrate
                if ('vibrate' in navigator) {
                    navigator.vibrate([200, 100, 200]);
                }
            } else {
                setState({
                    isRunning: true,
                    remainingSeconds: remaining,
                    progress,
                });
            }
        };

        // Update immediately
        updateTimer();

        // Update every second
        const interval = setInterval(updateTimer, 100); // More frequent for smoother progress

        return () => clearInterval(interval);
    }, [restTimerEndAt, restTimerDuration, cancelTimer]);

    return state;
}

// Format seconds as MM:SS
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

