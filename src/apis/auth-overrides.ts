import type { AuthOverrides } from './template/auth/auth-overrides-types';

/**
 * Auth Overrides
 *
 * Configure custom login/signup logic for your project.
 * This file is project-owned and will not be overwritten by template sync.
 *
 * Return an error string from any hook to reject the action.
 * Return undefined (or don't return) to allow it.
 */
export const authOverrides: AuthOverrides = {
  // Example: Disable new signups
  // validateRegistration: async () => {
  //   return 'Registration is currently disabled';
  // },

  // Example: Admin-only login
  // validateLogin: async ({ user }) => {
  //   const adminUserId = process.env.ADMIN_USER_ID;
  //   if (adminUserId && user._id.toString() !== adminUserId) {
  //     return 'Login is restricted to administrators only';
  //   }
  // },

  // Example: Restrict signups to specific email domains
  // validateRegistration: async ({ request }) => {
  //   if (!request.email?.endsWith('@mycompany.com')) {
  //     return 'Only @mycompany.com email addresses are allowed';
  //   }
  // },
};
