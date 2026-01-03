import React, { useRef, useEffect } from 'react';
import { useIsProbablyLoggedIn, useUserHint } from './store';
import { useAuthValidation } from './hooks';
import { LoginForm } from './LoginForm';
import { IOSAuthModal } from './IOSAuthModal';
import { Skeleton } from '@/client/components/ui/skeleton';
import { markEvent, logStatus, BOOT_PHASES } from '../boot-performance';
import { useRouter } from '@/client/router';

interface AuthWrapperProps {
    children: React.ReactNode;
}

/**
 * AuthWrapper - Instant-boot auth pattern with preflight optimization:
 * 
 * NOTE: This component renders AFTER BootGate ensures zustand hydration is complete.
 * All store values (isProbablyLoggedIn, userHint, etc.) are guaranteed to be hydrated.
 * 
 * 1. PUBLIC ROUTES: Render immediately without auth check
 * 2. HAS HINT (isProbablyLoggedIn): Show app immediately while validating in background
 * 3. NO HINT + VALIDATING: Show loading skeleton
 * 4. VALIDATED + AUTHENTICATED: Show app
 * 5. VALIDATED + NOT AUTHENTICATED: Show login
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
    const { isPublicRoute } = useRouter();
    const isProbablyLoggedIn = useIsProbablyLoggedIn();
    const userHint = useUserHint();
    const { isAuthenticated, isValidated, isValidating } = useAuthValidation();
    
    // Track logging to prevent duplicates
    const hasLoggedRender = useRef(false);
    const hasLoggedStatus = useRef(false);
    const hasLoggedInstantBoot = useRef(false);
    
    // Log first render
    if (!hasLoggedRender.current) {
        hasLoggedRender.current = true;
        markEvent(BOOT_PHASES.AUTH_WRAPPER_RENDER);
    }
    
    // Log cache status once (values are guaranteed hydrated by BootGate)
    useEffect(() => {
        if (!hasLoggedStatus.current) {
            hasLoggedStatus.current = true;
            logStatus('Auth Cache Status', {
                isProbablyLoggedIn,
                userHint: userHint?.name || null,
                isAuthenticated,
                isValidated,
                isValidating,
            });
        }
    }, [isProbablyLoggedIn, userHint, isAuthenticated, isValidated, isValidating]);
    
    // Show app if authenticated OR have localStorage hint (instant boot)
    const showApp = isAuthenticated || isProbablyLoggedIn;
    
    // Log instant boot when showing app due to hint (before validation completes)
    useEffect(() => {
        if (showApp && isProbablyLoggedIn && !isAuthenticated && !hasLoggedInstantBoot.current) {
            hasLoggedInstantBoot.current = true;
            markEvent(BOOT_PHASES.APP_CONTENT_SHOWN_INSTANT);
            logStatus('Instant Boot', { reason: 'localStorage hint', userHint: userHint?.name });
        }
    }, [showApp, isProbablyLoggedIn, isAuthenticated, userHint]);

    // Public routes bypass authentication entirely
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Show login only AFTER validation explicitly confirms no user
    const showLogin = isValidated && !isAuthenticated && !isProbablyLoggedIn;

    // Show loading skeleton while validating (only for users without hint)
    const showLoading = isValidating && !isProbablyLoggedIn && !isAuthenticated;

    return (
        <>
            {showLoading && <AuthLoadingSkeleton />}
            {showApp && children}
            {showLogin && (
                <IOSAuthModal isOpen>
                    <LoginForm />
                </IOSAuthModal>
            )}
        </>
    );
};

/**
 * Loading skeleton shown during auth validation.
 * Mimics the app layout to prevent layout shift.
 */
function AuthLoadingSkeleton() {
    return (
        <div className="min-h-screen bg-background">
            {/* Top nav skeleton */}
            <div className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            
            {/* Main content skeleton */}
            <div className="p-4 space-y-4">
                {/* Progress card skeleton */}
                <div className="rounded-2xl bg-card p-5 space-y-4">
                    <div className="flex justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-16" />
                        </div>
                        <div className="space-y-2 text-right">
                            <Skeleton className="h-6 w-12 ml-auto" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    </div>
                    <Skeleton className="h-3 w-full rounded-full" />
                    <Skeleton className="h-4 w-32 mx-auto" />
                </div>
                
                {/* Exercise cards skeleton */}
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl bg-card p-4 space-y-3">
                        <div className="flex gap-4">
                            <Skeleton className="h-20 w-20 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                ))}
            </div>
            
            {/* Bottom nav skeleton */}
            <div className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-card px-4 flex items-center justify-around">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-10 rounded-lg" />
                ))}
            </div>
        </div>
    );
}

export default AuthWrapper;
