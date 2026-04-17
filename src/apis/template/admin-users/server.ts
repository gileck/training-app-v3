import { API_LIST_USERS } from './index';
import { listUsers } from './handlers/listUsers';

export * from './index';

export const adminUsersApiHandlers = {
  [API_LIST_USERS]: { process: listUsers },
};
