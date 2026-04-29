/**
 * Push Notifications API Names
 *
 * Web Push (VAPID) subscription management for iOS/Android/Desktop PWAs.
 */

// Legacy name export for eslint compatibility
export const name = 'push-notifications';

export const API_PUSH_SUBSCRIBE = 'push-notifications/subscribe';
export const API_PUSH_UNSUBSCRIBE = 'push-notifications/unsubscribe';
export const API_PUSH_GET_STATUS = 'push-notifications/status';
export const API_PUSH_SEND_TEST = 'push-notifications/sendTest';
export const API_PUSH_SEND_TEST_TO_USER = 'admin/push-notifications/sendTest';
