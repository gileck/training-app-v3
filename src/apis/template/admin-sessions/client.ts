import apiClient from '@/client/utils/apiClient';
import {
  API_GET_SESSION_STATS,
  API_LIST_SESSION_USERS,
} from './index';
import type {
  GetSessionStatsRequest,
  GetSessionStatsResponse,
  ListSessionUsersRequest,
  ListSessionUsersResponse,
} from './types';

export const getSessionStats = () => {
  return apiClient.call<GetSessionStatsResponse, GetSessionStatsRequest>(
    API_GET_SESSION_STATS,
    {} as GetSessionStatsRequest
  );
};

export const listSessionUsers = () => {
  return apiClient.call<ListSessionUsersResponse, ListSessionUsersRequest>(
    API_LIST_SESSION_USERS,
    {} as ListSessionUsersRequest
  );
};
