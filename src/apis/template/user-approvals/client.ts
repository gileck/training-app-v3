import apiClient from '@/client/utils/apiClient';
import {
  API_LIST_PENDING_USERS,
  API_APPROVE_USER,
  API_REJECT_USER,
} from './index';
import type {
  ListPendingUsersRequest,
  ListPendingUsersResponse,
  ApproveUserRequest,
  ApproveUserResponse,
  RejectUserRequest,
  RejectUserResponse,
} from './types';

export const listPendingUsers = () => {
  return apiClient.call<ListPendingUsersResponse, ListPendingUsersRequest>(
    API_LIST_PENDING_USERS,
    {} as ListPendingUsersRequest
  );
};

export const approveUser = (params: ApproveUserRequest) => {
  return apiClient.call<ApproveUserResponse, ApproveUserRequest>(
    API_APPROVE_USER,
    params
  );
};

export const rejectUser = (params: RejectUserRequest) => {
  return apiClient.call<RejectUserResponse, RejectUserRequest>(
    API_REJECT_USER,
    params
  );
};
