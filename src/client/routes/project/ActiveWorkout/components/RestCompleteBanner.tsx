import { useEffect } from 'react';
import { Check } from 'lucide-react';
import {
    useRestJustCompletedAt,
    useDismissRestCompletedBanner,
} from '@/client/features/project/workout';

/**
 * Prominent overlay banner shown when the rest timer completes.
 * Replaces the small bottom toast — large, top-anchored, dismissible,
 * and auto-dismisses after 15s as a safety net.
 */
export function RestCompleteBanner() {
    const completedAt = useRestJustCompletedAt();
    const dismiss = useDismissRestCompletedBanner();

    useEffect(() => {
        if (!completedAt) return;
        const timeout = setTimeout(dismiss, 15000);
        return () => clearTimeout(timeout);
    }, [completedAt, dismiss]);

    if (!completedAt) return null;

    return (
        <div
            className="fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-[max(env(safe-area-inset-top),1rem)] pointer-events-none"
            role="alert"
            aria-live="assertive"
        >
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border-2 border-success bg-success/10 backdrop-blur-sm shadow-2xl animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3 p-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-success flex items-center justify-center animate-pulse">
                        <Check className="w-6 h-6 text-success-foreground" strokeWidth={3} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-base font-bold text-foreground">Rest complete</div>
                        <div className="text-sm text-muted-foreground">Time for your next set</div>
                    </div>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="flex-shrink-0 min-h-11 px-3 rounded-lg bg-success text-success-foreground font-semibold text-sm hover:bg-success/90 active:scale-95 transition-all"
                        aria-label="Dismiss rest complete banner"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
