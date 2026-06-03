import apiClient from '@/client/utils/apiClient';
import { API_LIST_USERS, API_GENERATE_PASSKEY_LINK } from './index';
import type {
  AdminUsersListResponse,
  GeneratePasskeyLinkRequest,
  GeneratePasskeyLinkResponse,
} from './types';

export const apiListUsers = () => {
  return apiClient.call<AdminUsersListResponse>(API_LIST_USERS, {});
};

export const apiGeneratePasskeyLink = (params: GeneratePasskeyLinkRequest) => {
  return apiClient.call<GeneratePasskeyLinkResponse, GeneratePasskeyLinkRequest>(
    API_GENERATE_PASSKEY_LINK,
    params
  );
};
