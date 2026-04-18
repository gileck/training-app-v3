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
  // Admin-approved signups (enabled by default).
  //
  // New users are created with `approvalStatus: 'pending'` and cannot log
  // in until an admin approves them via /admin/approvals.
  //
  // Two auto-approval bypasses handle the bootstrap case:
  //   1. First-user-wins — on a fresh deployment with zero users, the
  //      very first signup is auto-approved. Assumes the first person
  //      to reach the signup form is the intended admin.
  //   2. Admin bypass — a user whose _id matches ADMIN_USER_ID is
  //      always auto-approved (handles admin re-register after DB wipe).
  //
  // After the first signup, grab the user's _id from MongoDB (or from
  // the server log line emitted on first-user-wins) and set
  // ADMIN_USER_ID=<id> so you can access /admin/approvals.
  //
  // Set this to `false` to allow open signups without admin review.
  requireAdminApproval: true,

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
