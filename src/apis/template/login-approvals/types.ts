import type { TwoFactorMethod, UserResponse } from '@/apis/template/auth/types';

export interface CompleteLoginApprovalRequest {
  approvalId: string;
  approvalToken: string;
}

export type LoginApprovalCompletionStatus =
  | 'pending'
  | 'authenticated'
  | 'expired'
  | 'invalid';

export interface CompleteLoginApprovalResponse {
  status: LoginApprovalCompletionStatus;
  user?: UserResponse;
  expiresAt?: string;
}

export interface PendingLoginApproval {
  approvalId: string;
  approvalToken: string;
  approvalMethod: TwoFactorMethod;
  approvalHint?: string;
  expiresAt: string;
  redirectPath: string;
  username: string;
}
