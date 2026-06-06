export type * from './types';

// Domain name
export const name = 'agent';

// API endpoint names
export const API_LIST_CONVERSATIONS = 'agent/listConversations';
export const API_GET_CONVERSATION = 'agent/getConversation';
export const API_CREATE_CONVERSATION = 'agent/createConversation';
export const API_DELETE_CONVERSATION = 'agent/deleteConversation';
export const API_SEND_MESSAGE = 'agent/sendMessage';
export const API_CANCEL_MESSAGE = 'agent/cancelMessage';
export const API_ANSWER_QUESTION = 'agent/answerQuestion';
export const API_GET_TRACES = 'agent/getTraces';
export const API_UPLOAD_ATTACHMENT = 'agent/uploadAttachment';
