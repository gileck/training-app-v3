import apiClient from '@/client/utils/apiClient';
import { COMPLETE_LOGIN_APPROVAL } from './index';
import type {
  CompleteLoginApprovalRequest,
  CompleteLoginApprovalResponse,
} from './types';

export const apiCompleteLoginApproval = (
  params: CompleteLoginApprovalRequest
) => {
  return apiClient.call<
    CompleteLoginApprovalResponse,
    CompleteLoginApprovalRequest
  >(COMPLETE_LOGIN_APPROVAL, params).then((response) => {
    const maybeError = (response.data as { error?: string } | undefined)?.error;
    if (maybeError) {
      throw new Error(maybeError);
    }
    return response;
  });
};
