import { SendChatMessageRequest, SendChatMessageResponse } from './types';
import apiClient from '@/client/utils/apiClient';
import { SEND_CHAT_MESSAGE } from './index';
import type { CacheResult } from '@/common/cache/types';

export const sendChatMessage = (request: SendChatMessageRequest): Promise<CacheResult<SendChatMessageResponse>> => {
    return apiClient.call<SendChatMessageResponse, SendChatMessageRequest>(SEND_CHAT_MESSAGE, request);
};
