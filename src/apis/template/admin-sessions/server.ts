// Must re-export all exports from index.ts
export * from './index';

import { API_GET_SESSION_STATS, API_LIST_SESSION_USERS } from './index';
import { getStatsHandler } from './handlers/getStats';
import { listUsersHandler } from './handlers/listUsers';

export const adminSessionsApiHandlers = {
  [API_GET_SESSION_STATS]: { process: getStatsHandler },
  [API_LIST_SESSION_USERS]: { process: listUsersHandler },
};
