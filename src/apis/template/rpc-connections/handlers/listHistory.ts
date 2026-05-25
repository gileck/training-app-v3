import type { ApiHandlerContext } from '@/apis/template/auth/types';
import { listConnectionsForUser } from '@/server/database/collections/template/rpc-connections/rpc-connections';
import { users } from '@/server/database';
import type { ListHistoryRequest, ListHistoryResponse } from '../types';
import { toRpcConnectionView } from './shared';

export const listHistory = async (
  request: ListHistoryRequest,
  context: ApiHandlerContext
): Promise<ListHistoryResponse> => {
  if (!context.userId) return { connections: [] };

  const rows = await listConnectionsForUser(context.userId, request.limit ?? 50);

  const uniqueUserIds = [...new Set(rows.map((r) => r.userId))];
  const usernames = new Map<string, string>();
  await Promise.all(
    uniqueUserIds.map(async (uid) => {
      const u = await users.findUserById(uid).catch(() => null);
      if (u?.username) usernames.set(uid, u.username);
    })
  );

  return {
    connections: rows.map((row) => ({
      ...toRpcConnectionView(row),
      requestedByUsername: usernames.get(row.userId),
    })),
  };
};
