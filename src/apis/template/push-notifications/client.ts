import apiClient from '@/client/utils/apiClient';
import {
    API_PUSH_SUBSCRIBE,
    API_PUSH_UNSUBSCRIBE,
    API_PUSH_GET_STATUS,
    API_PUSH_SEND_TEST,
    API_PUSH_SEND_TEST_TO_USER,
} from './index';
import type {
    SubscribeRequest,
    SubscribeResponse,
    UnsubscribeRequest,
    UnsubscribeResponse,
    GetStatusRequest,
    GetStatusResponse,
    SendTestRequest,
    SendTestResponse,
    SendTestToUserRequest,
    SendTestToUserResponse,
} from './types';

export const subscribePush = (params: SubscribeRequest) =>
    apiClient.post<SubscribeResponse, SubscribeRequest>(API_PUSH_SUBSCRIBE, params);

export const unsubscribePush = (params: UnsubscribeRequest) =>
    apiClient.post<UnsubscribeResponse, UnsubscribeRequest>(
        API_PUSH_UNSUBSCRIBE,
        params
    );

export const getPushStatus = () =>
    apiClient.call<GetStatusResponse, GetStatusRequest>(
        API_PUSH_GET_STATUS,
        {} as GetStatusRequest
    );

export const sendTestPush = (params: SendTestRequest = {}) =>
    apiClient.post<SendTestResponse, SendTestRequest>(API_PUSH_SEND_TEST, params);

export const sendTestPushToUser = (params: SendTestToUserRequest) =>
    apiClient.post<SendTestToUserResponse, SendTestToUserRequest>(
        API_PUSH_SEND_TEST_TO_USER,
        params
    );
