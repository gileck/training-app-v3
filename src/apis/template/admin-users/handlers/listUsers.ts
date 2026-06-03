import { listAllUsers } from '@/server/database/collections/template/users';
import { countCredentialsByUser } from '@/server/database/collections/template/credentials';
import type { AdminUsersListResponse } from '../types';

export const listUsers = async (): Promise<AdminUsersListResponse> => {
  const adminUserId = process.env.ADMIN_USER_ID;
  const [users, passkeyCounts] = await Promise.all([
    listAllUsers(),
    countCredentialsByUser(),
  ]);
  return {
    users: users.map((u) => {
      const id = u._id.toString();
      return {
        id,
        username: u.username,
        email: u.email,
        createdAt: (u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt)).toISOString(),
        isAdmin: !!adminUserId && id === adminUserId,
        approvalStatus: u.approvalStatus ?? 'approved',
        passkeyCount: passkeyCounts[id] ?? 0,
      };
    }),
  };
};
