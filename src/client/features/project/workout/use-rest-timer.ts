import { useState, useEffect } from 'react';
import {
    useRestTimerEndAt,
    useRestTimerDuration,
    useCancelRestTimer,
    useWorkoutSessionStore,
} from './session-store';

// Module-level singleton AudioContext. iOS Safari starts it `suspended` and
// only allows `resume()` from a real user gesture, so we prime it once at
// every `startRestTimer` call site via `primeRestAudio()`.
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (audioCtx) return audioCtx;
    const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
        audioCtx = new Ctor();
    } catch {
        return null;
    }
    return audioCtx;
}

function tone(ctx: AudioContext, start: number, freq: number, duration: number, peak: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

/**
 * Call from a user gesture (e.g. set-completion handler) so the AudioContext
 * is resumed and the deferred beep at rest-end will actually play. iOS Safari
 * REQUIRES this — without it, the beep is silent.
 */
export function primeRestAudio(): void {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    // Near-silent tick to fully unlock the context on iOS.
    tone(ctx, ctx.currentTime, 440, 0.01, 0.0001);
}

function playRestDoneBeep() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(ctx, now, 880, 0.22, 0.5);
    tone(ctx, now + 0.26, 1175, 0.22, 0.5);
    tone(ctx, now + 0.52, 1568, 0.42, 0.5);
}

function showRestDoneNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
        new Notification('Rest complete', { body: 'Time for your next set.', tag: 'rest-timer' });
    } catch {
        // iOS Safari only allows notifications via ServiceWorkerRegistration;
        // banner + sound still fire so this is best-effort.
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
                    navigator.vibrate([300, 150, 300, 150, 300]);
                }
                playRestDoneBeep();
                useWorkoutSessionStore.getState().markRestJustCompleted();
                showRestDoneNotification();
            } else {
                setState({
                    isRunning: true,
                    remainingSeconds: remaining,
                    progress,
                });
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 100);
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
