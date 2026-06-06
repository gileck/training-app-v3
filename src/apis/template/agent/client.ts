import apiClient from '@/client/utils/apiClient';
import type { CacheResult } from '@/common/cache/types';
import {
    API_LIST_CONVERSATIONS,
    API_GET_CONVERSATION,
    API_CREATE_CONVERSATION,
    API_DELETE_CONVERSATION,
    API_SEND_MESSAGE,
    API_CANCEL_MESSAGE,
    API_ANSWER_QUESTION,
    API_GET_TRACES,
    API_UPLOAD_ATTACHMENT,
} from './index';
import type {
    ListConversationsRequest,
    ListConversationsResponse,
    GetConversationRequest,
    GetConversationResponse,
    CreateConversationRequest,
    CreateConversationResponse,
    DeleteConversationRequest,
    DeleteConversationResponse,
    SendMessageRequest,
    SendMessageResponse,
    CancelMessageRequest,
    CancelMessageResponse,
    AnswerQuestionRequest,
    AnswerQuestionResponse,
    GetTracesRequest,
    GetTracesResponse,
    UploadAttachmentRequest,
    UploadAttachmentResponse,
} from './types';

export const listConversations = (
    params: ListConversationsRequest = {}
): Promise<CacheResult<ListConversationsResponse>> =>
    apiClient.call(API_LIST_CONVERSATIONS, params);

export const getConversation = (
    params: GetConversationRequest
): Promise<CacheResult<GetConversationResponse>> =>
    apiClient.call(API_GET_CONVERSATION, params);

export const createConversation = (
    params: CreateConversationRequest
): Promise<CacheResult<CreateConversationResponse>> =>
    apiClient.post(API_CREATE_CONVERSATION, params);

export const deleteConversation = (
    params: DeleteConversationRequest
): Promise<CacheResult<DeleteConversationResponse>> =>
    apiClient.post(API_DELETE_CONVERSATION, params);

export const sendMessage = (
    params: SendMessageRequest
): Promise<CacheResult<SendMessageResponse>> =>
    apiClient.post(API_SEND_MESSAGE, params);

export const cancelMessage = (
    params: CancelMessageRequest
): Promise<CacheResult<CancelMessageResponse>> =>
    apiClient.post(API_CANCEL_MESSAGE, params);

export const answerQuestion = (
    params: AnswerQuestionRequest
): Promise<CacheResult<AnswerQuestionResponse>> =>
    apiClient.post(API_ANSWER_QUESTION, params);

export const getTraces = (
    params: GetTracesRequest
): Promise<CacheResult<GetTracesResponse>> =>
    apiClient.call(API_GET_TRACES, params);

export const uploadAttachment = (
    params: UploadAttachmentRequest
): Promise<CacheResult<UploadAttachmentResponse>> =>
    apiClient.post(API_UPLOAD_ATTACHMENT, params);
