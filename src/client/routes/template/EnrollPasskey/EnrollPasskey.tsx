/**
 * Enroll Passkey Landing Page
 *
 * Public, full-screen page opened from a passkey-enrollment magic link
 * (?token=...). Validates the link, runs the WebAuthn registration ceremony,
 * and — for approved users — drops them straight into the app, signed in.
 */

import { Fingerprint, Loader2, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { useRouter } from '@/client/features';
import { Button } from '@/client/components/template/ui/button';
import {
    useEnrollOptions,
    useCompleteEnroll,
    browserSupportsPasskeys,
} from './hooks';

export const EnrollPasskey = () => {
    const { queryParams, navigate } = useRouter();
    const token = queryParams.token;

    const optionsQuery = useEnrollOptions(token);
    const complete = useCompleteEnroll();

    const supported = browserSupportsPasskeys();
    const prepared = optionsQuery.data;
    const completed = complete.data;

    const handleRegister = () => {
        if (!token || !prepared) return;
        complete.mutate({ token, ...prepared });
    };

    const handleRetry = () => {
        complete.reset();
        optionsQuery.refetch();
    };

    // --- No token in the URL ---
    if (!token) {
        return (
            <Shell
                icon={<AlertTriangle className="h-7 w-7 text-destructive-foreground" />}
                iconBg="bg-destructive"
                title="Invalid link"
                subtitle="This enrollment link is missing its token. Ask your admin for a fresh link."
            />
        );
    }

    if (!supported) {
        return (
            <Shell
                icon={<AlertTriangle className="h-7 w-7 text-destructive-foreground" />}
                iconBg="bg-destructive"
                title="Passkeys not supported"
                subtitle="This browser can't create passkeys. Open the link on a device with Face ID, Touch ID, or a device PIN."
            />
        );
    }

    // --- Successful enrollment ---
    if (completed?.verified) {
        const signedIn = !!completed.user;
        return (
            <Shell
                icon={<ShieldCheck className="h-7 w-7 text-primary-foreground" />}
                iconBg="bg-primary"
                title="Passkey registered"
                subtitle={
                    signedIn
                        ? 'This device can now sign in with Face ID, Touch ID, or your device PIN.'
                        : 'Your passkey is set up. You can sign in once your account is approved.'
                }
            >
                {signedIn && (
                    <Button className="min-h-11 w-full" onClick={() => navigate('/', { replace: true })}>
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </Shell>
        );
    }

    // --- Link invalid / expired ---
    if (optionsQuery.isError) {
        return (
            <Shell
                icon={<AlertTriangle className="h-7 w-7 text-destructive-foreground" />}
                iconBg="bg-destructive"
                title="Link expired or invalid"
                subtitle={
                    optionsQuery.error instanceof Error
                        ? optionsQuery.error.message
                        : 'Ask your admin to generate a new enrollment link.'
                }
            />
        );
    }

    // --- Loading the link ---
    if (optionsQuery.isLoading || !prepared) {
        return (
            <Shell
                icon={<Loader2 className="h-7 w-7 animate-spin text-primary-foreground" />}
                iconBg="bg-primary"
                title="Checking your link…"
                subtitle="One moment."
            />
        );
    }

    // --- Ready to register ---
    const completeError = complete.error instanceof Error ? complete.error.message : null;
    return (
        <Shell
            icon={<Fingerprint className="h-7 w-7 text-primary-foreground" />}
            iconBg="bg-primary"
            title="Set up your passkey"
            subtitle={
                prepared.username
                    ? `Register this device for ${prepared.username}. You'll sign in with Face ID, Touch ID, or your device PIN — no password.`
                    : "Register this device. You'll sign in with Face ID, Touch ID, or your device PIN — no password."
            }
        >
            {completeError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-left">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{completeError}</p>
                </div>
            )}

            {completeError ? (
                <Button className="min-h-11 w-full" onClick={handleRetry}>
                    Try again
                </Button>
            ) : (
                <Button
                    className="min-h-11 w-full"
                    onClick={handleRegister}
                    disabled={complete.isPending}
                >
                    {complete.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Waiting for your device…
                        </>
                    ) : (
                        <>
                            <Fingerprint className="mr-2 h-4 w-4" />
                            Register this device
                        </>
                    )}
                </Button>
            )}
        </Shell>
    );
};

interface ShellProps {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    children?: React.ReactNode;
}

function Shell({ icon, iconBg, title, subtitle, children }: ShellProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <div className="w-full max-w-sm space-y-6 text-center">
                <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${iconBg}`}
                >
                    {icon}
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                {children}
            </div>
        </div>
    );
}
