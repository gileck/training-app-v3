/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Export all handlers from a single entry point
 */

export { handleLoginApproval } from './approval';
export { handleRpcConnectionApprove, handleRpcConnectionReject } from './rpc-connection';
