export * from './index';

import {
    API_PUSH_SUBSCRIBE,
    API_PUSH_UNSUBSCRIBE,
    API_PUSH_GET_STATUS,
    API_PUSH_SEND_TEST,
    API_PUSH_SEND_TEST_TO_USER,
} from './index';

import { subscribeHandler } from './handlers/subscribe';
import { unsubscribeHandler } from './handlers/unsubscribe';
import { getStatusHandler } from './handlers/getStatus';
import { sendTestHandler } from './handlers/sendTest';
import { sendTestToUserHandler } from './handlers/sendTestToUser';

export const pushNotificationsApiHandlers = {
    [API_PUSH_SUBSCRIBE]: { process: subscribeHandler },
    [API_PUSH_UNSUBSCRIBE]: { process: unsubscribeHandler },
    [API_PUSH_GET_STATUS]: { process: getStatusHandler },
    [API_PUSH_SEND_TEST]: { process: sendTestHandler },
    [API_PUSH_SEND_TEST_TO_USER]: { process: sendTestToUserHandler },
};
