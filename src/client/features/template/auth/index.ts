/**
 * Auth Feature
 * 
 * Authentication with instant-boot support for PWA.
 */

// Store
export {
    useAuthStore,
    useIsAuthenticated,
    useIsAdmin,
    useIsProbablyLoggedIn,
    useUser,
    useUserHint,
    useAuthMode,
} from './store';

// Hooks
export {
    useAuthValidation,
    useLogin,
    useRegister,
    useLogout,
    useChangePassword,
    useRequestPasswordReset,
    useResetPassword,
    useCurrentUser,
    useInvalidateCurrentUser,
    currentUserQueryKey,
} from './hooks';

// Passkey hooks
export {
    usePasskeys,
    useAddPasskey,
    useRenamePasskey,
    useDeletePasskey,
    usePasskeyLogin,
    usePasskeyStepUp,
    browserSupportsPasskeys,
    passkeysQueryKey,
} from './passkeyHooks';

// Passkey step-up guard (gate a sensitive page behind a fresh passkey assertion)
export { PasskeyGuard } from './PasskeyGuard';
export { RoutePasskeyGuard } from './RoutePasskeyGuard';
export {
    usePasskeyGuardStore,
    useIsGuardVerified,
} from './passkeyGuardStore';

// Preflight
export {
    startAuthPreflight,
    getPreflightResult,
    waitForPreflight,
    isPreflightComplete,
    resetPreflight,
} from './preflight';

// Components
export { default as AuthWrapper } from './AuthWrapper';
export { LoginForm } from './LoginForm';
export { IOSAuthModal } from './IOSAuthModal';

// Types
export type { UserPublicHint, LoginFormState, LoginFormErrors } from './types';
export { userToHint } from './types';

