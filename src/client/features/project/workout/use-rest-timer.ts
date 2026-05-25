import { useState, useEffect } from 'react';
import { useRestTimerEndAt, useRestTimerDuration, useCancelRestTimer } from './session-store';
import { toast } from '@/client/components/template/ui/toast';

function playRestDoneBeep() {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const beep = (start: number, freq: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.02);
        };
        // Three rising tones — more attention-grabbing than the previous two-beep
        beep(now, 880, 0.22);
        beep(now + 0.26, 1175, 0.22);
        beep(now + 0.52, 1568, 0.38);
        setTimeout(() => ctx.close().catch(() => { }), 1200);
    } catch {
        // Audio playback is best-effort; ignore failures (autoplay policy, etc.)
    }
}

function showRestDoneNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
        new Notification('Rest complete', {
            body: 'Time for your next set.',
            tag: 'rest-timer',
            silent: false,
        });
    } catch {
        // Some browsers (notably iOS Safari) only allow notifications via the
        // ServiceWorkerRegistration. Fail silently — toast + sound still fire.
    }
}

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

                // Notify the user the rest is over
                if ('vibrate' in navigator) {
                    navigator.vibrate([200, 100, 200]);
                }
                playRestDoneBeep();
                toast.success('Rest complete — time for your next set', { duration: 10000 });
                showRestDoneNotification();
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

