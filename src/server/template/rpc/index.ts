export { callRemote } from './client';
export type { CallRemoteOptions, RpcResult } from './types';
export {
  runWithRpcCallContext,
  getRpcCallContext,
  assertRpcConnection,
} from './connection-gate';
export type { RpcCallContext } from './connection-gate';
export {
  RpcConnectionRequiredError,
  isRpcConnectionRequiredError,
  RPC_CONNECTION_REQUIRED_CODE,
} from './errors';
export {
  RPC_CONNECTION_ENABLED,
  RPC_CONNECTION_TTL_MS,
  RPC_CONNECTION_PENDING_TIMEOUT_MS,
} from './config';
