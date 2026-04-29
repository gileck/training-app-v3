import jwt from 'jsonwebtoken';
import type { ApiHandlerContext } from '@/apis/template/auth/types';
import {
  COOKIE_NAME,
  COOKIE_OPTIONS,
  JWT_EXPIRES_IN,
  getJwtSecret,
  sanitizeUser,
} from '@/apis/template/auth/shared';
import type {
  CompleteLoginApprovalRequest,
  CompleteLoginApprovalResponse,
} from '../types';
import { loginApprovals, users } from '@/server/database';
import { toStringId } from '@/server/template/utils';

export const completeLoginApproval = async (
  request: CompleteLoginApprovalRequest,
  context: ApiHandlerContext
): Promise<CompleteLoginApprovalResponse> => {
  if (!request?.approvalId || !request?.approvalToken) {
    return { status: 'invalid' };
  }

  const approval = await loginApprovals.findLoginApprovalByIdAndToken(
    request.approvalId,
    request.approvalToken
  );

  if (!approval) {
    return { status: 'invalid' };
  }

  if (approval.expiresAt.getTime() <= Date.now()) {
    return {
      status: 'expired',
      expiresAt: approval.expiresAt.toISOString(),
    };
  }

  if (approval.status !== 'approved') {
    return {
      status: 'pending',
      expiresAt: approval.expiresAt.toISOString(),
    };
  }

  const user = await users.findUserById(approval.userId);
  if (!user) {
    return { status: 'invalid' };
  }

  const userId = toStringId(user._id);
  const isAdmin = !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;

  const token = jwt.sign(
    { userId },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );

  context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  return {
    status: 'authenticated',
    expiresAt: approval.expiresAt.toISOString(),
    user: {
      ...sanitizeUser(user),
      isAdmin,
    },
  };
};
