import type { ApiHandlerContext } from '../../auth/types';
import type {
  ListPendingUsersRequest,
  ListPendingUsersResponse,
  PendingUser,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';

export const listPendingUsersHandler = async (
  _request: ListPendingUsersRequest,
  context: ApiHandlerContext
): Promise<ListPendingUsersResponse> => {
  try {
    if (!context.isAdmin) {
      return { error: 'Admin access required' };
    }

    const pending = await users.findPendingUsers();
    const sanitized: PendingUser[] = pending.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
    }));

    return { users: sanitized };
  } catch (error: unknown) {
    console.error('[listPendingUsers] error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to list pending users' };
  }
};
