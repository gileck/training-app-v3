// Must re-export all exports from index.ts
export * from './index';

import {
  API_LIST_PENDING_USERS,
  API_APPROVE_USER,
  API_REJECT_USER,
} from './index';

import { listPendingUsersHandler } from './handlers/listPendingUsers';
import { approveUserHandler } from './handlers/approveUser';
import { rejectUserHandler } from './handlers/rejectUser';

export const userApprovalsApiHandlers = {
  [API_LIST_PENDING_USERS]: { process: listPendingUsersHandler },
  [API_APPROVE_USER]: { process: approveUserHandler },
  [API_REJECT_USER]: { process: rejectUserHandler },
};
