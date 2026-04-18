import type { ApiHandlerContext } from '../../auth/types';
import type { RejectUserRequest, RejectUserResponse } from '../types';
import * as users from '@/server/database/collections/template/users/users';

/**
 * Reject a pending user.
 *
 * Soft delete: we set `approvalStatus: 'rejected'` instead of deleting the
 * user row. This keeps the username/email reserved so the rejected user
 * cannot immediately re-register with the same credentials, and leaves an
 * audit trail for the admin.
 */
export const rejectUserHandler = async (
  request: RejectUserRequest,
  context: ApiHandlerContext
): Promise<RejectUserResponse> => {
  try {
    if (!context.isAdmin) {
      return { error: 'Admin access required' };
    }

    if (!request.userId) {
      return { error: 'userId is required' };
    }

    const updated = await users.setUserApprovalStatus(request.userId, 'rejected');
    if (!updated) {
      return { error: 'User not found' };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[rejectUser] error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to reject user' };
  }
};
