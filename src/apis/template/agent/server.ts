export * from './index';

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
import { listConversations } from './handlers/listConversations';
import { getConversation } from './handlers/getConversation';
import { createConversation } from './handlers/createConversation';
import { deleteConversation } from './handlers/deleteConversation';
import { sendMessage } from './handlers/sendMessage';
import { cancelMessage } from './handlers/cancelMessage';
import { answerQuestion } from './handlers/answerQuestion';
import { getTraces } from './handlers/getTraces';
import { uploadAttachment } from './handlers/uploadAttachment';

export const agentApiHandlers = {
    [API_LIST_CONVERSATIONS]: { process: listConversations },
    [API_GET_CONVERSATION]: { process: getConversation },
    [API_CREATE_CONVERSATION]: { process: createConversation },
    [API_DELETE_CONVERSATION]: { process: deleteConversation },
    [API_SEND_MESSAGE]: { process: sendMessage },
    [API_CANCEL_MESSAGE]: { process: cancelMessage },
    [API_ANSWER_QUESTION]: { process: answerQuestion },
    [API_GET_TRACES]: { process: getTraces },
    [API_UPLOAD_ATTACHMENT]: { process: uploadAttachment },
};
