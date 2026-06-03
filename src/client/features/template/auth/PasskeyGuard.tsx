/**
 * PasskeyGuard
 *
 * Wrap any sensitive page/section to gate it behind a fresh passkey step-up:
 *
 *   <PasskeyGuard guardKey="billing">
 *     <SensitiveStuff />
 *   </PasskeyGuard>
 *
 * The user is already logged in; this requires them to confirm device
 * possession again (Face ID / Touch ID / device PIN) before the content is
 * revealed. On success the page stays unlocked for `ttlMs` (default 5 min,
 * in-memory only — re-auth after a reload). On failure a generic lock screen
 * is shown with a "Try again" button.
 *
 * NOTE: this is a client-side UI gate backed by a REAL server-verified passkey
 * assertion (the user genuinely proved their device). It protects against
 * someone using an already-unlocked session / shoulder-surfing. If the
 * underlying data must be protected server-side too, additionally gate the
 * sensitive API(s) — this component does not change the session.
 */

import { Lock, ShieldCheck, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { useRouter } from '../router';
import { usePasskeyStepUp, browserSupportsPasskeys } from './passkeyHooks';
import { useIsGuardVerified, usePasskeyGuardStore } from './passkeyGuardStore';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface PasskeyGuardProps {
    /** Unique id for this guarded surface — independent unlock window per key. */
    guardKey: string;
    /** How long an unlock lasts before re-prompting. Default 5 minutes. */
    ttlMs?: number;
    title?: string;
    description?: string;
    children: React.ReactNode;
}

export function PasskeyGuard({
    guardKey,
    ttlMs = DEFAULT_TTL_MS,
    title,
    description,
    children,
}: PasskeyGuardProps) {
    const verified = useIsGuardVerified(guardKey);
    const markVerified = usePasskeyGuardStore((s) => s.markVerified);
    const stepUp = usePasskeyStepUp();
    const { navigate } = useRouter();

    if (verified) {
        return <>{children}</>;
    }

    const supported = browserSupportsPasskeys();
    const errorMessage = stepUp.error instanceof Error ? stepUp.error.message : null;

    const handleUnlock = () => {
        stepUp.mutate(undefined, {
            onSuccess: () => markVerified(guardKey, ttlMs),
        });
    };

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col items-center justify-center gap-6 px-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Lock className="h-7 w-7 text-muted-foreground" />
            </div>

            <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">
                    {title ?? 'Verify it’s you'}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {description ??
                        'This page contains sensitive information. Confirm with your passkey to continue.'}
                </p>
            </div>

            {errorMessage && (
                <div className="flex w-full items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-left">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
            )}

            {supported ? (
                <Button className="min-h-11 w-full" onClick={handleUnlock} disabled={stepUp.isPending}>
                    {stepUp.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying…
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {errorMessage ? 'Try again' : 'Unlock with passkey'}
                        </>
                    )}
                </Button>
            ) : (
                <p className="text-sm text-muted-foreground">
                    This browser doesn’t support passkeys. Open the app on a device with Face ID,
                    Touch ID, or a device PIN.
                </p>
            )}

            <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Go back
            </button>
        </div>
    );
}
