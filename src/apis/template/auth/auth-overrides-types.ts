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
   * When true, new signups are created with `approvalStatus: 'pending'`
   * and cannot log in until an admin approves them via /admin/approvals.
   *
   * The admin receives a Telegram notification on each new signup with a
   * deep link to the approvals page.
   *
   * **Important:** The admin user (ADMIN_USER_ID) must register BEFORE you
   * enable this flag — otherwise there's no one who can approve signups.
   * The admin bypasses the approval gate on login.
   *
   * Defaults to false.
   */
  requireAdminApproval?: boolean;

  /**
   * Called after successful password verification, before completing login.
   * Return an error string to reject the login, or undefined/null to allow.
   *
   * **Ordering:** when `requireAdminApproval` is enabled, the approval gate
   * (pending/rejected check) runs BEFORE this hook. So a user with
   * `approvalStatus: 'pending'` will be rejected with a "pending approval"
   * error without `validateLogin` ever seeing them. Design your
   * `validateLogin` checks assuming you only ever see approved users.
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
