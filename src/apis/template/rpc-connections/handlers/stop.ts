import type { ApiHandlerContext } from '@/apis/template/auth/types';
import { endActiveConnectionForUser } from '@/server/database/collections/template/rpc-connections/rpc-connections';
import type { StopRequest, StopResponse } from '../types';

export const stop = async (
  _request: StopRequest,
  context: ApiHandlerContext
): Promise<StopResponse> => {
  if (!context.userId) return { success: false };
  await endActiveConnectionForUser(context.userId, 'user_stop');
  return { success: true };
};
