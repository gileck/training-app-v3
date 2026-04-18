import type { ApiHandlerContext } from '../../auth/types';
import type { ApproveUserRequest, ApproveUserResponse } from '../types';
import * as users from '@/server/database/collections/template/users/users';

export const approveUserHandler = async (
  request: ApproveUserRequest,
  context: ApiHandlerContext
): Promise<ApproveUserResponse> => {
  try {
    if (!context.isAdmin) {
      return { error: 'Admin access required' };
    }

    if (!request.userId) {
      return { error: 'userId is required' };
    }

    const updated = await users.setUserApprovalStatus(request.userId, 'approved');
    if (!updated) {
      return { error: 'User not found' };
    }

    // NOTE: Notifying the user themselves (e.g. via email) is intentionally
    // deferred to a future phase. We only capture email at signup, so that
    // notification would require email infrastructure which does not yet
    // exist in this project.

    return { success: true };
  } catch (error: unknown) {
    console.error('[approveUser] error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to approve user' };
  }
};
