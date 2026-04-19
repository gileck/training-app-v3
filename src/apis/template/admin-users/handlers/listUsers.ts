import { listAllUsers } from '@/server/database/collections/template/users';
import type { AdminUsersListResponse } from '../types';

export const listUsers = async (): Promise<AdminUsersListResponse> => {
  const adminUserId = process.env.ADMIN_USER_ID;
  const users = await listAllUsers();
  return {
    users: users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      email: u.email,
      createdAt: (u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt)).toISOString(),
      isAdmin: !!adminUserId && u._id.toString() === adminUserId,
    })),
  };
};
