import React from 'react';
import { useRouter } from '@/client/router';
import { useIsProbablyLoggedIn } from './store';
import { useAuthValidation } from './hooks';
import { LoginForm } from './LoginForm';
import { IOSAuthModal } from './IOSAuthModal';

interface AuthWrapperProps {
    children: React.ReactNode;
}

/**
 * Public routes that render without requiring authentication.
 * To add a new public route: add the path prefix here and document in docs/authentication.md
 */
const PUBLIC_ROUTES = ['/share'];

/**
 * AuthWrapper - Instant-boot auth pattern with cookie session support:
 * 
 * 1. PUBLIC ROUTES: Render immediately without auth check
 * 2. HAS HINT (isProbablyLoggedIn=true): Show app immediately, validate in background
 * 3. NO HINT: Check cookie session silently, then show app or login
 * 
 * Key insight: Use `isValidated` (not `!isValidating`) to determine when to show
 * login - this prevents flicker during Zustand hydration race conditions.
 */
const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
    const { currentPath } = useRouter();
    const isProbablyLoggedIn = useIsProbablyLoggedIn();
    const { isAuthenticated, isValidated } = useAuthValidation();

    // Always show app for public routes (no auth required)
    const isPublicRoute = PUBLIC_ROUTES.some(route => currentPath.startsWith(route));
    
    if (isPublicRoute) {
        return <>{children}</>;
    }

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
