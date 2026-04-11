import type { User } from '@/server/database/collections/template/users/types';
import type { LoginRequest, RegisterRequest, ApiHandlerContext } from './types';

/**
 * Auth Overrides Interface
 *
 * Implement these hooks in src/apis/auth-overrides.ts to customize
 * login/signup behavior for your project.
 */
export interface AuthOverrides {
  /**
   * Called after successful password verification, before completing login.
   * Return an error string to reject the login, or undefined/null to allow.
   *
   * @example Admin-only login
   * validateLogin: async ({ user }) => {
   *   const adminUserId = process.env.ADMIN_USER_ID;
   *   if (adminUserId && user._id.toString() !== adminUserId) {
   *     return 'Login is restricted to administrators only';
   *   }
   * }
   */
  validateLogin?: (params: {
    user: User;
    request: LoginRequest;
    context: ApiHandlerContext;
  }) => Promise<string | undefined | null> | string | undefined | null;

  /**
   * Called before creating a new user account.
   * Return an error string to reject the registration, or undefined/null to allow.
   *
   * @example Disable signups
   * validateRegistration: async () => {
   *   return 'Registration is currently disabled';
   * }
   *
   * @example Restrict to specific email domains
   * validateRegistration: async ({ request }) => {
   *   if (!request.email?.endsWith('@mycompany.com')) {
   *     return 'Only @mycompany.com emails are allowed';
   *   }
   * }
   */
  validateRegistration?: (params: {
    request: RegisterRequest;
    context: ApiHandlerContext;
  }) => Promise<string | undefined | null> | string | undefined | null;
}
