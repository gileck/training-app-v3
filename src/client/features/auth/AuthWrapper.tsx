import React from 'react';
import { useAuthStore, useIsProbablyLoggedIn } from './store';
import { useAuthValidation } from './hooks';
import { LoginForm } from './LoginForm';
import { IOSAuthModal } from './IOSAuthModal';
import { LinearProgress } from '@/client/components/ui/linear-progress';

interface AuthWrapperProps {
    children: React.ReactNode;
}

/**
 * AuthWrapper - Instant-boot auth pattern with cookie session support:
 * 
 * 1. Zustand hydrates `isProbablyLoggedIn` from localStorage
 * 2. If hint exists: show app immediately (instant boot), validate in background
 * 3. If no hint: show loading, call /me to check for cookie session
 * 4. On validation success: show app; on failure: show login dialog
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
    const isProbablyLoggedIn = useIsProbablyLoggedIn();
    const { isAuthenticated, isValidating } = useAuthValidation();
    const isValidated = useAuthStore((state) => state.isValidated);

    // Instant boot: show app while validating
    if (isProbablyLoggedIn && !isValidated) {
        return (
            <>
                {isValidating && (
                    <div className="fixed top-0 left-0 right-0 z-50">
                        <LinearProgress className="h-0.5" />
                    </div>
                )}
                {children}
            </>
        );
    }

    // Validated and authenticated
    if (isAuthenticated) {
        return <>{children}</>;
    }

    // First load without cached hint
    if (isValidating && !isProbablyLoggedIn) {
        return (
            <div className="w-full py-2">
                <div className="mx-auto max-w-screen-lg">
                    <LinearProgress />
                </div>
            </div>
        );
    }

    // Not authenticated - show iOS-style login modal
    return (
        <IOSAuthModal isOpen>
            <LoginForm />
        </IOSAuthModal>
    );
};

export default AuthWrapper;
