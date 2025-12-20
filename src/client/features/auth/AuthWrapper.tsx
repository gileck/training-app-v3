import React from 'react';
import { useIsProbablyLoggedIn } from './store';
import { useAuthValidation } from './hooks';
import { LoginForm } from './LoginForm';
import { IOSAuthModal } from './IOSAuthModal';

interface AuthWrapperProps {
    children: React.ReactNode;
}

/**
 * AuthWrapper - Instant-boot auth pattern with cookie session support:
 * 
 * 1. HAS HINT (isProbablyLoggedIn=true): Show app immediately, validate in background
 * 2. NO HINT: Check cookie session silently, then show app or login
 * 
 * Key insight: Use `isValidated` (not `!isValidating`) to determine when to show
 * login - this prevents flicker during Zustand hydration race conditions.
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
    const isProbablyLoggedIn = useIsProbablyLoggedIn();
    const { isAuthenticated, isValidated } = useAuthValidation();

    // Show app if authenticated OR have localStorage hint
    const showApp = isAuthenticated || isProbablyLoggedIn;

    // Show login only AFTER validation explicitly confirms no user
    const showLogin = isValidated && !isAuthenticated && !isProbablyLoggedIn;

    return (
        <>
            {showApp && children}
            {showLogin && (
                <IOSAuthModal isOpen>
                    <LoginForm />
                </IOSAuthModal>
            )}
        </>
    );
};

export default AuthWrapper;
