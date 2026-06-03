import { API_LIST_USERS, API_GENERATE_PASSKEY_LINK } from './index';
import { listUsers } from './handlers/listUsers';
import { generatePasskeyLink } from './handlers/generatePasskeyLink';

export * from './index';

export const adminUsersApiHandlers = {
  [API_LIST_USERS]: { process: listUsers },
  [API_GENERATE_PASSKEY_LINK]: { process: generatePasskeyLink },
};
