// Auth API endpoint names
export const name = 'auth';
export const login = 'auth/login';
export const register = 'auth/register';
export const logout = 'auth/logout';
export const me = 'auth/me';
export const updateProfile = 'auth/update-profile';
export const changePassword = 'auth/change-password';
export const requestPasswordReset = 'auth/request-password-reset';
export const resetPassword = 'auth/reset-password';

// Passkeys / WebAuthn
export const passkeyRegisterOptions = 'auth/passkey/register-options';
export const passkeyRegisterVerify = 'auth/passkey/register-verify';
export const passkeyList = 'auth/passkey/list';
export const passkeyRename = 'auth/passkey/rename';
export const passkeyDelete = 'auth/passkey/delete';
export const passkeyLoginOptions = 'auth/passkey/login-options';
export const passkeyLoginVerify = 'auth/passkey/login-verify';
export const passkeyEnrollOptions = 'auth/passkey/enroll/options';
export const passkeyEnrollVerify = 'auth/passkey/enroll/verify';
// Self-service passkey sign-up (username-gated, no admin link required).
// Creates the account + registers the first device; admin approval is a
// separate, downstream step (see /admin/approvals).
export const passkeySignupOptions = 'auth/passkey/signup/options';
export const passkeySignupVerify = 'auth/passkey/signup/verify';
// Step-up re-auth (guard a sensitive page behind a fresh passkey assertion)
export const passkeyStepUpOptions = 'auth/passkey/step-up/options';
export const passkeyStepUpVerify = 'auth/passkey/step-up/verify';
