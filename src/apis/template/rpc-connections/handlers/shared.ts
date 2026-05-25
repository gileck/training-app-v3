import type { RpcConnection } from '@/server/database/collections/template/rpc-connections/types';
import { toStringId } from '@/server/template/utils';
import type { RpcConnectionView } from '../types';

export function toRpcConnectionView(
  connection: RpcConnection
): RpcConnectionView {
  return {
    id: toStringId(connection._id),
    userId: connection.userId,
    status: connection.status,
    requestedAt: connection.requestedAt.toISOString(),
    approvedAt: connection.approvedAt?.toISOString(),
    expiresAt: connection.expiresAt?.toISOString(),
    pendingExpiresAt: connection.pendingExpiresAt.toISOString(),
    endedAt: connection.endedAt?.toISOString(),
    userAgent: connection.userAgent,
    ip: connection.ip,
    endedReason: connection.endedReason,
  };
}
