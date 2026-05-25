/**
 * RPC Connections API Names
 *
 * Admin-only endpoints for the Connection Page that gates RPC calls
 * behind a per-user, admin-approved, TTL-bound session.
 */

export const name = 'rpc-connections';

export const API_RPC_CONNECTION_CONNECT = 'admin/rpc-connections/connect';
export const API_RPC_CONNECTION_GET_CURRENT = 'admin/rpc-connections/getCurrent';
export const API_RPC_CONNECTION_STOP = 'admin/rpc-connections/stop';
export const API_RPC_CONNECTION_TEST = 'admin/rpc-connections/test';
export const API_RPC_CONNECTION_LIST_HISTORY = 'admin/rpc-connections/listHistory';
export const API_RPC_CONNECTION_DAEMON_STATUS = 'admin/rpc-connections/daemonStatus';
